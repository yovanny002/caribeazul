const db = require('./db');
const { QueryTypes } = require('sequelize');
const moment = require('moment');
const Pago = require('./Pago');
const rutas = require('./Ruta');

const safeParseFloat = (value, defaultValue = 0) => {
  const num = parseFloat(value);
  return isNaN(num) ? defaultValue : num;
};

const PrestamoInteres = {
  // Crear nuevo préstamo con interés manual
  create: async (data) => {
  const {
    cliente_id,
    monto_solicitado,
    monto_aprobado,
    interes_porcentaje,
    interes_manual, // Nuevo campo para el monto manual de interés
    plazo_meses,
    forma_pago,
    estado,
    ruta_id,
    frecuencia_interes // 'quincenal' o 'mensual'
  } = data;

  const montoAprobado = safeParseFloat(monto_aprobado || monto_solicitado);
  const plazo = parseInt(plazo_meses) || 1;
  
  // Calcular el interés según la opción seleccionada
  let interesCalculado = 0;
  if (interes_manual) {
    interesCalculado = safeParseFloat(interes_manual);
    // Si es quincenal, multiplicamos por 2 para tener el interés mensual equivalente
    if (frecuencia_interes === 'quincenal') {
      interesCalculado *= 2;
    }
  } else {
    interesCalculado = montoAprobado * (safeParseFloat(interes_porcentaje, 10) / 100);
  }

  const [result] = await db.query(`
    INSERT INTO prestamos_interes 
    (cliente_id, monto_solicitado, monto_aprobado, 
     interes_porcentaje, interes_manual, frecuencia_interes,
     plazo_meses, forma_pago, estado, ruta_id, saldo_capital)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING id
  `, {
    replacements: [
      cliente_id,
      monto_solicitado,
      montoAprobado,
      safeParseFloat(interes_porcentaje, 10),
      interes_manual || null,
      frecuencia_interes || 'mensual',
      plazo,
      forma_pago,
      estado || 'pendiente',
      ruta_id,
      montoAprobado
    ],
    type: QueryTypes.INSERT
  });

  return result[0].id;
},


  // Obtener préstamo por ID con cálculos actualizados
findById: async (id) => {
  try {
    // 1. Obtener información básica del préstamo
    const rows = await db.query(`
      SELECT p.*, 
             c.nombre AS cliente_nombre, 
             c.apellidos AS cliente_apellidos,
             c.cedula AS cliente_cedula,
             c.profesion AS cliente_profesion,
             r.nombre AS ruta_nombre,
             r.zona AS ruta_zona
      FROM prestamos_interes p
      JOIN clientes c ON p.cliente_id = c.id
      LEFT JOIN rutas r ON p.ruta_id = r.id
      WHERE p.id = :id
    `, {
      replacements: { id },
      type: QueryTypes.SELECT
    });

    if (!rows || rows.length === 0) return null;

    const prestamo = rows[0];
    
    // 2. Parsear valores numéricos
    prestamo.monto_aprobado = safeParseFloat(prestamo.monto_aprobado);
    prestamo.interes_porcentaje = safeParseFloat(prestamo.interes_porcentaje, 10);
    prestamo.interes_manual = safeParseFloat(prestamo.interes_manual);
    prestamo.saldo_capital = safeParseFloat(prestamo.saldo_capital, prestamo.monto_aprobado);
    prestamo.moras = safeParseFloat(prestamo.moras, 0);
    
    // 3. Calcular días transcurridos desde la creación del préstamo
    const fechaInicio = moment(prestamo.created_at);
    const diasTranscurridos = moment().diff(fechaInicio, 'days');
    
    // 4. Calcular intereses acumulados según la frecuencia
    let interesesAcumulados = 0;
    if (prestamo.frecuencia_interes === 'quincenal') {
      // Cálculo quincenal
      const quincenasTranscurridas = Math.floor(diasTranscurridos / 15);
      
      if (prestamo.interes_manual) {
        // Usar monto manual de interés quincenal
        interesesAcumulados = prestamo.interes_manual * quincenasTranscurridas;
      } else {
        // Calcular automáticamente (porcentaje anual convertido a quincenal)
        const interesQuincenal = (prestamo.monto_aprobado * (prestamo.interes_porcentaje / 100)) / 24;
        interesesAcumulados = interesQuincenal * quincenasTranscurridas;
      }
    } else {
      // Cálculo mensual (por defecto)
      const mesesTranscurridos = Math.floor(diasTranscurridos / 30);
      
      if (prestamo.interes_manual) {
        // Usar monto manual de interés mensual
        interesesAcumulados = prestamo.interes_manual * mesesTranscurridos;
      } else {
        // Calcular automáticamente (porcentaje mensual)
        const interesMensual = prestamo.monto_aprobado * (prestamo.interes_porcentaje / 100);
        interesesAcumulados = interesMensual * mesesTranscurridos;
      }
    }
    
    // 5. Obtener historial de pagos y calcular total pagado
    const pagos = await Pago.findByPrestamoInteres(id) || [];
    const total_pagado = pagos.reduce((sum, pago) => sum + safeParseFloat(pago.monto), 0);
    
    // 6. Calcular saldos y valores importantes
    prestamo.total_pagado = total_pagado;
    prestamo.intereses_acumulados = interesesAcumulados;
    
    // Calcular cuánto se ha aplicado a intereses y capital
    const total_intereses_pagados = pagos.reduce((sum, pago) => sum + safeParseFloat(pago.interes_pagado), 0);
    const total_capital_pagado = pagos.reduce((sum, pago) => sum + safeParseFloat(pago.capital_pagado), 0);
    
    prestamo.total_intereses_pagados = total_intereses_pagados;
    prestamo.total_capital_pagado = total_capital_pagado;
    
    // 7. Calcular saldos actuales
    prestamo.saldo_intereses = Math.max(0, interesesAcumulados - total_intereses_pagados);
    prestamo.saldo_capital = Math.max(0, prestamo.monto_aprobado - total_capital_pagado);
    prestamo.saldo_total = prestamo.saldo_intereses + prestamo.saldo_capital + prestamo.moras;
    
    // 8. Calcular próximo pago de interés
    if (prestamo.frecuencia_interes === 'quincenal') {
      const quincenasTranscurridas = Math.floor(diasTranscurridos / 15);
      const proximaQuincena = (quincenasTranscurridas + 1) * 15;
      const fechaProximoInteres = fechaInicio.clone().add(proximaQuincena, 'days');
      
      prestamo.proximo_interes = {
        fecha: fechaProximoInteres.format('YYYY-MM-DD'),
        dias_restantes: fechaProximoInteres.diff(moment(), 'days'),
        monto: prestamo.interes_manual || 
              (prestamo.monto_aprobado * (prestamo.interes_porcentaje / 100)) / 24
      };
    } else {
      const mesesTranscurridos = Math.floor(diasTranscurridos / 30);
      const fechaProximoInteres = fechaInicio.clone().add(mesesTranscurridos + 1, 'months');
      
      prestamo.proximo_interes = {
        fecha: fechaProximoInteres.format('YYYY-MM-DD'),
        dias_restantes: fechaProximoInteres.diff(moment(), 'days'),
        monto: prestamo.interes_manual || 
              (prestamo.monto_aprobado * (prestamo.interes_porcentaje / 100))
      };
    }
    
    // 9. Agregar información de mora si aplica
    if (prestamo.saldo_intereses > 0) {
      const diasMora = moment().diff(
        moment(prestamo.proximo_interes.fecha).subtract(
          prestamo.frecuencia_interes === 'quincenal' ? 15 : 30, 'days'
        ), 
        'days'
      );
      
      if (diasMora > 3) {
        prestamo.mora = {
          dias: diasMora,
          monto: prestamo.saldo_intereses * 0.05 // 5% de mora
        };
        prestamo.saldo_total += prestamo.mora.monto;
      }
    }
    
    // 10. Formatear valores para visualización
    prestamo.monto_aprobado_formatted = `RD$ ${prestamo.monto_aprobado.toFixed(2)}`;
    prestamo.saldo_capital_formatted = `RD$ ${prestamo.saldo_capital.toFixed(2)}`;
    prestamo.intereses_acumulados_formatted = `RD$ ${prestamo.intereses_acumulados.toFixed(2)}`;
    prestamo.saldo_intereses_formatted = `RD$ ${prestamo.saldo_intereses.toFixed(2)}`;
    prestamo.saldo_total_formatted = `RD$ ${prestamo.saldo_total.toFixed(2)}`;
    prestamo.total_pagado_formatted = `RD$ ${prestamo.total_pagado.toFixed(2)}`;
    
    return prestamo;
  } catch (error) {
    console.error(`❌ Error en findById(${id}):`, error.message);
    throw error;
  }
},

  // Listar todos los préstamos con interés manual
  findAllWithClientes: async (estado = null) => {
    let query = `
      SELECT p.*, 
             c.nombre AS cliente_nombre, 
             c.apellidos AS cliente_apellidos,
             c.cedula AS cliente_cedula,
             r.nombre AS ruta_nombre
      FROM prestamos_interes p
      JOIN clientes c ON p.cliente_id = c.id
      LEFT JOIN rutas r ON p.ruta_id = r.id
    `;

    const replacements = [];
    if (estado) {
      query += ' WHERE p.estado = ?';
      replacements.push(estado);
    }

    query += ' ORDER BY p.created_at DESC';

    try {
      const rows = await db.query(query, { 
        replacements, 
        type: QueryTypes.SELECT 
      });

      return rows.map(row => ({
        ...row,
        monto_aprobado: safeParseFloat(row.monto_aprobado),
        monto_solicitado: safeParseFloat(row.monto_solicitado),
        interes_porcentaje: safeParseFloat(row.interes_porcentaje, 43),
        saldo_capital: safeParseFloat(row.saldo_capital)
      }));
    } catch (error) {
      console.error('Error en findAllWithClientes:', error);
      throw error;
    }
  },

  // Registrar un pago manual
  registrarPago: async (pagoData) => {
    const {
      prestamo_id,
      monto,
      metodo,
      notas,
      referencia,
      registrado_por
    } = pagoData;

    // Obtener el préstamo actualizado
    const prestamo = await PrestamoInteres.findById(prestamo_id);
    if (!prestamo) throw new Error('Préstamo no encontrado');

    const montoPago = safeParseFloat(monto);
    let interesPagado = 0;
    let capitalPagado = 0;

    // Primero se paga el interés acumulado
    if (prestamo.intereses_acumulados > 0) {
      interesPagado = Math.min(montoPago, prestamo.intereses_acumulados);
      capitalPagado = montoPago - interesPagado;
    } else {
      capitalPagado = montoPago;
    }

    // Aplicar el resto al capital si hay excedente después de pagar intereses
    if (capitalPagado > 0) {
      await db.query(`
        UPDATE prestamos_interes 
        SET saldo_capital = saldo_capital - ?
        WHERE id = ?
      `, [capitalPagado, prestamo_id]);
    }

    // Registrar el pago
    const [result] = await db.query(`
      INSERT INTO pagos_interes 
      (prestamo_id, monto, interes_pagado, capital_pagado, metodo, notas, referencia, registrado_por, fecha)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
      RETURNING id
    `, {
      replacements: [
        prestamo_id,
        montoPago,
        interesPagado,
        capitalPagado,
        metodo,
        notas || null,
        referencia || null,
        registrado_por || 'Sistema'
      ],
      type: QueryTypes.INSERT
    });

    // Verificar si el préstamo está completamente pagado
    const prestamoActualizado = await PrestamoInteres.findById(prestamo_id);
    if (prestamoActualizado.saldo_total <= 0) {
      await db.query(`
        UPDATE prestamos_interes 
        SET estado = 'pagado'
        WHERE id = ?
      `, { replacements: [prestamo_id], type: QueryTypes.UPDATE });
    }

    return result[0].id;
  },

  // Obtener historial de pagos de un préstamo
  getHistorialPagos: async (prestamoId) => {
    const pagos = await db.query(`
      SELECT p.*
      FROM pagos_interes p
      WHERE p.prestamo_id = :prestamoId
      ORDER BY p.fecha DESC
    `, {
      replacements: { prestamoId },
      type: QueryTypes.SELECT
    });

    return pagos.map(pago => ({
      ...pago,
      monto: safeParseFloat(pago.monto),
      interes_pagado: safeParseFloat(pago.interes_pagado),
      capital_pagado: safeParseFloat(pago.capital_pagado),
      monto_formatted: `RD$ ${safeParseFloat(pago.monto).toFixed(2)}`,
      fecha_display: pago.fecha ? moment(pago.fecha).format('DD/MM/YYYY') : 'Sin fecha'
    }));
  },

  // Actualizar estado del préstamo
  updateEstado: async (id, estado) => {
    await db.query(`
      UPDATE prestamos_interes
      SET estado = :estado
      WHERE id = :id
    `, {
      replacements: { estado, id },
      type: QueryTypes.UPDATE
    });
  }
};

module.exports = PrestamoInteres;