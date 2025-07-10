const db = require('./db');
const { QueryTypes } = require('sequelize');
const moment = require('moment');
const Pago = require('./Pago');
const rutas = require('./Ruta'); // Asegúrate de que este modelo exista
const CuotaModel = require('./Cuota'); // Asegúrate de que este modelo exista

// Helper para parsear valores numéricos de forma segura
const safeParseFloat = (value, defaultValue = 0) => {
  const num = parseFloat(value);
  return isNaN(num) ? defaultValue : num;
};

const Prestamo = {
  findAll: async () => {
    const rows = await db.query('SELECT * FROM solicitudes_prestamos', { type: QueryTypes.SELECT });
    return rows;
  },

  findCuotaById: async (cuotaId) => {
    const rows = await db.query(
      'SELECT * FROM cuotas WHERE id = ? LIMIT 1',
      { replacements: [cuotaId], type: QueryTypes.SELECT }
    );
    return rows[0];
  },

// En el método findById, agregar cálculo de mora
// Modificar findById para manejar préstamos abiertos
// Modificar findById para préstamos abiertos
findById: async (id) => {
  const prestamo = await db.query(`
    SELECT p.*, 
           c.nombre AS cliente_nombre, 
           c.apellidos AS cliente_apellidos,
           c.cedula AS cliente_cedula
    FROM solicitudes_prestamos p
    JOIN clientes c ON p.cliente_id = c.id
    WHERE p.id = ?
  `, { replacements: [id], type: QueryTypes.SELECT });

  if (!prestamo || prestamo.length === 0) return null;

  const result = prestamo[0];
  
  // Calcular saldos para préstamos abiertos
  if (result.tipo_prestamo === 'abierto') {
    const pagos = await db.query(`
      SELECT SUM(interes) AS total_interes, SUM(capital) AS total_capital
      FROM pagos WHERE prestamo_id = ?
    `, { replacements: [id], type: QueryTypes.SELECT });

    result.total_pagado = parseFloat(pagos[0].total_interes || 0) + parseFloat(pagos[0].total_capital || 0);
    result.saldo_actual = parseFloat(result.monto_aprobado) - parseFloat(pagos[0].total_capital || 0);
    
    // Calcular interés acumulado desde último pago
    const ultimoPago = await db.query(`
      SELECT fecha FROM pagos 
      WHERE prestamo_id = ? 
      ORDER BY fecha DESC LIMIT 1
    `, { replacements: [id], type: QueryTypes.SELECT });

    const fechaInicio = ultimoPago.length > 0 ? 
      new Date(ultimoPago[0].fecha) : 
      new Date(result.created_at);
    
    const dias = Math.max(1, Math.floor((new Date() - fechaInicio) / (1000 * 60 * 60 * 24)));
    const interesDiario = (result.saldo_actual * (result.interes_porcentaje / 100)) / 30;
    result.interes_acumulado = parseFloat((interesDiario * dias).toFixed(2));
  }

  return result;
},

// En el método findCuotasByPrestamo, agregar cálculo de mora por cuota
findCuotasByPrestamo: async (prestamoId) => {
  const rows = await db.query(`
    SELECT * FROM cuotas
    WHERE prestamo_id = :prestamoId
    ORDER BY numero_cuota ASC
  `, {
    replacements: { prestamoId },
    type: QueryTypes.SELECT
  });

  return rows.map(row => {
    const cuota = {
      ...row,
      monto: safeParseFloat(row.monto)
    };
    
    // Calcular mora si la cuota está vencida por más de 3 días
    if (cuota.estado === 'pendiente' && moment(cuota.fecha_vencimiento).add(3, 'days').isBefore(moment())) {
      cuota.mora = cuota.monto * 0.05; // 5% de mora
      cuota.total_a_pagar = cuota.monto + cuota.mora;
    } else {
      cuota.mora = 0;
      cuota.total_a_pagar = cuota.monto;
    }
    
    return cuota;
  });
},

findAllWithClientes: async (estado = null) => {
  let query = `
    SELECT p.*, 
           c.nombre AS cliente_nombre, 
           c.apellidos AS cliente_apellidos,
           c.cedula AS cliente_cedula,
           c.profesion AS cliente_profesion,
           r.nombre AS ruta_nombre
    FROM solicitudes_prestamos p
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
      interes_porcentaje: safeParseFloat(row.interes_porcentaje, 43)
    }));
  } catch (error) {
    console.error('Error en findAllWithClientes:', error);
    throw error;
  }
},

// Agregar tipo de préstamo en el método create
create: async (data) => {
  const {
    cliente_id,
    ingresos_mensuales,
    monto_solicitado,
    monto_aprobado,
    interes_porcentaje,
    cuotas,
    forma_pago,
    estado,
    moras,
    ruta_id,
    tipo_prestamo = 'cerrado' // 'cerrado' o 'abierto'
  } = data;

  const montoAprobadoVal = safeParseFloat(monto_aprobado || monto_solicitado);
  const interes = safeParseFloat(interes_porcentaje, 43);
  
  // Diferente cálculo según tipo de préstamo
  let montoTotal, monto_por_cuota;
  
  if (tipo_prestamo === 'abierto') {
    montoTotal = montoAprobadoVal; // Solo el capital, interés se calcula sobre saldo
    monto_por_cuota = null; // No hay cuotas fijas
  } else {
    const montoInteres = montoAprobadoVal * (interes / 100);
    montoTotal = montoAprobadoVal + montoInteres;
    monto_por_cuota = parseFloat((montoTotal / cuotas).toFixed(2));
  }

  const [result] = await db.query(`
    INSERT INTO solicitudes_prestamos 
    (cliente_id, ingresos_mensuales, monto_solicitado, monto_aprobado, 
     interes_porcentaje, cuotas, monto_por_cuota, forma_pago, estado, moras, ruta_id, tipo_prestamo)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING id
  `, {
    replacements: [
      cliente_id,
      ingresos_mensuales,
      monto_solicitado,
      montoAprobadoVal,
      interes,
      cuotas,
      monto_por_cuota,
      forma_pago,
      estado || 'pendiente',
      safeParseFloat(moras, 0),
      ruta_id,
      tipo_prestamo
    ],
    type: QueryTypes.INSERT
  });

  const prestamoId = result[0].id;

  // Solo generar cuotas si es préstamo cerrado
  if (tipo_prestamo === 'cerrado') {
    await Prestamo.generateCuotas(prestamoId, montoTotal, cuotas, forma_pago);
  }

  return prestamoId;
},


  update: async (id, data) => {
    await db.query(`
      UPDATE solicitudes_prestamos
      SET monto_solicitado = ?,
          monto_aprobado = ?,
          interes_porcentaje = ?,
          forma_pago = ?,
          estado = ?,
          moras = ?
      WHERE id = ?
    `, [
      safeParseFloat(data.monto_solicitado),
      safeParseFloat(data.monto_aprobado),
      safeParseFloat(data.interes_porcentaje, 25),
      data.forma_pago,
      data.estado,
      safeParseFloat(data.moras, 0),
      id
    ]);
  },
updateEstado: async (id, estado) => {
  await db.query(`
    UPDATE solicitudes_prestamos
    SET estado = :estado
    WHERE id = :id
  `, {
    replacements: { estado, id },
    type: QueryTypes.UPDATE
  });
},


// Método corregido
insertCuotas: async (cuotasData) => {
  if (!Array.isArray(cuotasData) || cuotasData.length === 0) return;

  try {
    await CuotaModel.bulkCreate(cuotasData, {
      validate: true, // Valida cada registro
      returning: true // Opcional: devuelve los registros insertados si los necesitas
    });
    console.log(`✅ ${cuotasData.length} cuotas insertadas correctamente`);
  } catch (error) {
    console.error('❌ Error al insertar cuotas:', error.message);
    throw error;
  }
},

generateCuotas: async (prestamoId, montoTotal, numeroCuotas, formaPago = 'mensual') => {
  if (!prestamoId) throw new Error('ID del préstamo no válido al generar cuotas');

  // ✅ Verificar si ya existen cuotas para este préstamo
  const [{ count }] = await db.query(`
    SELECT COUNT(*)::int AS count FROM cuotas WHERE prestamo_id = $1
  `, {
    bind: [prestamoId],
    type: QueryTypes.SELECT
  });

  if (count > 0) {
    console.warn(`⚠️ Ya existen cuotas para el préstamo ${prestamoId}. Se omite la generación.`);
    return;
  }

  const numCuotas = parseInt(numeroCuotas);
  if (isNaN(numCuotas)) throw new Error('Número de cuotas no válido');

  const cuotas = [];
  const montoTotalNum = safeParseFloat(montoTotal);
  const montoPorCuota = parseFloat((montoTotalNum / numCuotas).toFixed(2));
  const fechaBase = moment();

  let diasIncremento = 30;
  switch (formaPago) {
    case 'diario': diasIncremento = 1; break;
    case 'semanal': diasIncremento = 7; break;
    case 'quincenal': diasIncremento = 15; break;
    case 'mensual': diasIncremento = 30; break;
  }

  let acumulado = 0;
  for (let i = 0; i < numCuotas; i++) {
    let monto = montoPorCuota;
    if (i === numCuotas - 1) {
      monto = parseFloat((montoTotalNum - acumulado).toFixed(2));
    } else {
      acumulado += montoPorCuota;
    }

    const fecha = fechaBase.clone().add(diasIncremento * (i + 1), 'days').format('YYYY-MM-DD');

    cuotas.push({
      prestamo_id: prestamoId,
      numero_cuota: i + 1,
      monto,
      fecha_vencimiento: fecha,
      estado: 'pendiente'
    });
  }

  await Prestamo.insertCuotas(cuotas);
},




  getHistorialPagos: async (prestamoId) => {
    const pagos = await db.query(`
      SELECT p.*, 
             c.numero_cuota,
             c.fecha_vencimiento
      FROM pagos p
      LEFT JOIN cuotas c ON p.cuota_id = c.id
      WHERE p.prestamo_id = :prestamoId
      ORDER BY p.fecha DESC
    `, {
      replacements: { prestamoId },
      type: QueryTypes.SELECT
    });

    return pagos.map(pago => ({
      ...pago,
      monto: safeParseFloat(pago.monto),
      monto_formatted: `RD$ ${safeParseFloat(pago.monto).toFixed(2)}`,
      fecha_display: pago.fecha ? moment(pago.fecha).format('DD/MM/YYYY') : 'Sin fecha'
    }));
  },
// Nuevo método para calcular interés diario
calcularInteresDiario: async (prestamoId) => {
  const prestamo = await Prestamo.findById(prestamoId);
  if (!prestamo || prestamo.tipo_prestamo !== 'abierto') return 0;
  
  const interesDiario = (prestamo.monto_aprobado * (prestamo.interes_porcentaje / 100)) / 30;
  return parseFloat(interesDiario.toFixed(2));
},
 // En el método registrarPago del modelo
// En el método registrarPago
// En el método registrarPago
// En el método registrarPago
// Modificar registrarPago para manejar préstamos abiertos
registrarPago: async (pagoData) => {
  const {
    prestamo_id,
    cuota_id,
    monto,
    metodo,
    notas,
    referencia,
    registrado_por
  } = pagoData;

  const prestamo = await Prestamo.findById(prestamo_id);
  if (!prestamo) throw new Error('Préstamo no encontrado');

  let montoMora = 0;
  let montoInteres = 0;
  let montoCapital = 0;

  // Lógica diferente para préstamos abiertos
  if (prestamo.tipo_prestamo === 'abierto') {
    // 1. Calcular días desde último pago o desde creación
    const ultimoPago = await db.query(`
      SELECT fecha FROM pagos 
      WHERE prestamo_id = ? 
      ORDER BY fecha DESC LIMIT 1
    `, { replacements: [prestamo_id], type: QueryTypes.SELECT });

    const fechaInicio = ultimoPago.length > 0 ? 
      new Date(ultimoPago[0].fecha) : 
      new Date(prestamo.created_at);
    
    const dias = Math.max(1, Math.floor((new Date() - fechaInicio) / (1000 * 60 * 60 * 24)));
    
    // 2. Calcular interés acumulado
    const interesDiario = await Prestamo.calcularInteresDiario(prestamo_id);
    montoInteres = parseFloat((interesDiario * dias).toFixed(2));
    
    // 3. Aplicar pago: primero interés, luego capital
    if (monto >= montoInteres) {
      montoCapital = parseFloat((monto - montoInteres).toFixed(2));
    } else {
      montoInteres = monto;
      montoCapital = 0;
    }
  } else {
    // Lógica original para préstamos cerrados
    if (cuota_id) {
      const cuota = await Prestamo.findCuotaById(cuota_id);
      if (cuota && cuota.estado === 'pendiente' && 
          moment(cuota.fecha_vencimiento).add(3, 'days').isBefore(moment())) {
        montoMora = cuota.monto * 0.05;
      }
    }
  }

  const result = await db.query(`
    INSERT INTO pagos 
    (prestamo_id, cuota_id, monto, moras, interes, capital, metodo, notas, referencia, registrado_por, fecha)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW()) RETURNING id
  `, [
    prestamo_id,
    cuota_id || null,
    safeParseFloat(monto),
    montoMora,
    montoInteres,
    montoCapital,
    metodo,
    notas || null,
    referencia || null,
    registrado_por || 'Sistema'
  ], {
    type: QueryTypes.INSERT
  });

  // Actualizar estado de la cuota si es préstamo cerrado
  if (prestamo.tipo_prestamo === 'cerrado' && cuota_id) {
    const cuota = await Prestamo.findCuotaById(cuota_id);
    const totalAPagar = cuota.monto + montoMora;
    
    if (safeParseFloat(monto) >= totalAPagar) {
      await db.query(`
        UPDATE cuotas 
        SET estado = 'pagada', fecha_pago = NOW()
        WHERE id = ?
      `, { replacements: [cuota_id], type: QueryTypes.UPDATE });
    }
  }

  return result[0].id;
}
};

module.exports = Prestamo;
