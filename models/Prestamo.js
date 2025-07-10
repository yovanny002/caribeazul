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
 findCuotasByPrestamo: async (prestamoId) => {
    const cuotas = await db.query(`
      SELECT * FROM cuotas 
      WHERE prestamo_id = ?
      ORDER BY numero_cuota ASC
    `, {
      replacements: [prestamoId],
      type: QueryTypes.SELECT
    });

    return cuotas.map(cuota => {
      // Calcular mora si la cuota está vencida
      const esVencida = cuota.estado === 'pendiente' && 
        moment(cuota.fecha_vencimiento).add(3, 'days').isBefore(moment());
      
      return {
        ...cuota,
        monto: safeParseFloat(cuota.monto),
        mora: esVencida ? safeParseFloat(cuota.monto) * 0.05 : 0,
        total_a_pagar: safeParseFloat(cuota.monto) + (esVencida ? safeParseFloat(cuota.monto) * 0.05 : 0)
      };
    });
  },
// En el método findById, agregar cálculo de mora


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
             c.profesion AS cliente_profesion
      FROM solicitudes_prestamos p
      JOIN clientes c ON p.cliente_id = c.id
    `;

    const values = [];
    if (estado) {
      query += ' WHERE p.estado = ?';
      values.push(estado);
    }

    const rows = await db.query(query, { replacements: values, type: QueryTypes.SELECT });

    return rows.map(row => {
      row.monto_aprobado = safeParseFloat(row.monto_aprobado);
      row.interes_porcentaje = safeParseFloat(row.interes_porcentaje, 43);
      row.monto_interes = row.monto_aprobado * (row.interes_porcentaje / 100);
      row.monto_total = row.monto_aprobado + row.monto_interes;
      row.moras = safeParseFloat(row.moras, 0);
      return row;
    });
  },

// En el método create
 create: async (data) => {
    const {
      cliente_id,
      ingresos_mensuales,
      monto_solicitado,
      monto_aprobado,
      interes_porcentaje,
      interes_manual,
      cuotas,
      forma_pago,
      estado,
      moras,
      ruta_id,
      tipo_prestamo
    } = data;

    // Validaciones básicas
    if (tipo_prestamo === 'abierto' && (!interes_manual || isNaN(interes_manual))) {
      throw new Error('Para préstamos abiertos debe especificar el interés manual');
    }

    const montoAprobadoVal = safeParseFloat(monto_aprobado || monto_solicitado);
    let montoInteres, montoTotal, montoPorCuota;

    if (tipo_prestamo === 'abierto') {
      // Lógica para préstamos abiertos
      montoInteres = safeParseFloat(interes_manual);
      montoTotal = montoAprobadoVal + montoInteres;
      montoPorCuota = montoTotal; // Para abierto, el monto por "cuota" es el total
    } else {
      // Lógica para préstamos cerrados (por cuotas)
      const interes = safeParseFloat(interes_porcentaje, 43);
      montoInteres = montoAprobadoVal * (interes / 100);
      montoTotal = montoAprobadoVal + montoInteres;
      montoPorCuota = parseFloat((montoTotal / cuotas).toFixed(2));
    }

    // Insertar el préstamo en la base de datos
    const [result] = await db.query(`
      INSERT INTO solicitudes_prestamos (
        cliente_id, ingresos_mensuales, monto_solicitado, monto_aprobado,
        interes_porcentaje, monto_interes, monto_total, cuotas, monto_por_cuota,
        forma_pago, estado, moras, ruta_id, tipo_prestamo, saldo_actual
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING id
    `, {
      replacements: [
        cliente_id,
        ingresos_mensuales,
        monto_solicitado,
        montoAprobadoVal,
        tipo_prestamo === 'abierto' ? null : interes_porcentaje,
        montoInteres,
        montoTotal,
        tipo_prestamo === 'abierto' ? 1 : cuotas,
        montoPorCuota,
        forma_pago,
        estado || 'pendiente',
        safeParseFloat(moras, 0),
        ruta_id,
        tipo_prestamo,
        montoTotal // Saldo inicial igual al monto total
      ],
      type: QueryTypes.INSERT
    });

    const prestamoId = result[0].id;

    // Generar cuotas solo para préstamos cerrados
    if (tipo_prestamo !== 'abierto') {
      await Prestamo.generateCuotas(prestamoId, montoTotal, cuotas, forma_pago);
    }

    return prestamoId;
  },

// Nuevo método para registrar pagos de préstamos abiertos
 registrarPagoAbierto: async (prestamoId, montoPago) => {
    const prestamo = await Prestamo.findById(prestamoId);
    
    if (!prestamo || prestamo.tipo_prestamo !== 'abierto') {
      throw new Error('Préstamo no encontrado o no es de tipo abierto');
    }

    // Calcular distribución del pago
    const interesPendiente = prestamo.monto_interes - (prestamo.interes_pagado || 0);
    const pagoInteres = Math.min(montoPago, interesPendiente);
    const pagoCapital = montoPago - pagoInteres;
    const nuevoSaldo = prestamo.saldo_actual - pagoCapital;

    // Iniciar transacción para asegurar consistencia
    const transaction = await db.transaction();

    try {
      // Registrar el pago
      const [pagoResult] = await db.query(`
        INSERT INTO pagos_abiertos (
          prestamo_id, monto, interes, capital, 
          saldo_anterior, saldo_posterior, fecha
        ) VALUES (?, ?, ?, ?, ?, ?, NOW())
        RETURNING id
      `, {
        replacements: [
          prestamoId,
          montoPago,
          pagoInteres,
          pagoCapital,
          prestamo.saldo_actual,
          nuevoSaldo
        ],
        type: QueryTypes.INSERT,
        transaction
      });

      // Actualizar el préstamo
      await db.query(`
        UPDATE solicitudes_prestamos 
        SET 
          interes_pagado = COALESCE(interes_pagado, 0) + ?,
          saldo_actual = ?,
          total_pagado = COALESCE(total_pagado, 0) + ?
        WHERE id = ?
      `, {
        replacements: [pagoInteres, nuevoSaldo, montoPago, prestamoId],
        type: QueryTypes.UPDATE,
        transaction
      });

      await transaction.commit();
      return pagoResult[0].id;

    } catch (error) {
      await transaction.rollback();
      console.error('Error en registrarPagoAbierto:', error);
      throw error;
    }
  },
findById: async (id) => {
    try {
      const [prestamo] = await db.query(`
        SELECT 
          p.*,
          c.nombre AS cliente_nombre,
          c.apellidos AS cliente_apellidos,
          c.cedula AS cliente_cedula,
          c.profesion AS cliente_profesion,
          r.nombre AS ruta_nombre,
          r.zona AS ruta_zona,
          COALESCE(
            (SELECT SUM(monto) FROM pagos WHERE prestamo_id = p.id), 0
          ) AS total_pagado_cerrado,
          COALESCE(
            (SELECT SUM(monto) FROM pagos_abiertos WHERE prestamo_id = p.id), 0
          ) AS total_pagado_abierto
        FROM solicitudes_prestamos p
        JOIN clientes c ON p.cliente_id = c.id
        LEFT JOIN rutas r ON p.ruta_id = r.id
        WHERE p.id = ?
        LIMIT 1
      `, {
        replacements: [id],
        type: QueryTypes.SELECT
      });

      if (!prestamo) return null;

      // Procesar valores numéricos
      prestamo.monto_aprobado = safeParseFloat(prestamo.monto_aprobado);
      prestamo.monto_interes = safeParseFloat(prestamo.monto_interes);
      prestamo.monto_total = safeParseFloat(prestamo.monto_total);
      prestamo.moras = safeParseFloat(prestamo.moras, 0);
      
      // Calcular valores según tipo de préstamo
      if (prestamo.tipo_prestamo === 'abierto') {
        prestamo.total_pagado = safeParseFloat(prestamo.total_pagado_abierto);
        prestamo.saldo_actual = safeParseFloat(prestamo.saldo_actual);
        
        // Obtener historial de pagos abiertos
        prestamo.historialPagos = await db.query(`
          SELECT * FROM pagos_abiertos 
          WHERE prestamo_id = ?
          ORDER BY fecha DESC
        `, {
          replacements: [id],
          type: QueryTypes.SELECT
        });
      } else {
        prestamo.total_pagado = safeParseFloat(prestamo.total_pagado_cerrado);
        prestamo.saldo_actual = Math.max(0, prestamo.monto_total + prestamo.moras - prestamo.total_pagado);
        
        // Calcular moras para préstamos cerrados
        const cuotas = await Prestamo.findCuotasByPrestamo(id);
        let morasPendientes = 0;
        
        cuotas.forEach(cuota => {
          if (cuota.estado === 'pendiente' && moment(cuota.fecha_vencimiento).add(3, 'days').isBefore(moment())) {
            morasPendientes += cuota.monto * 0.05; // 5% de mora
          }
        });
        
        prestamo.moras += morasPendientes;
        prestamo.cuotas = cuotas;
      }

      return prestamo;
    } catch (error) {
      console.error(`Error en findById(${id}):`, error);
      throw error;
    }
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

generateCuotas: async (prestamoId, montoTotal, numeroCuotas, formaPago) => {
    const cuotas = [];
    const montoPorCuota = parseFloat((montoTotal / numeroCuotas).toFixed(2));
    let fechaBase = moment();

    // Determinar intervalo entre cuotas según forma de pago
    let diasIncremento;
    switch (formaPago) {
      case 'diario': diasIncremento = 1; break;
      case 'semanal': diasIncremento = 7; break;
      case 'quincenal': diasIncremento = 15; break;
      case 'mensual': diasIncremento = 30; break;
      default: diasIncremento = 30;
    }

    // Generar cada cuota
    for (let i = 0; i < numeroCuotas; i++) {
      const fechaVencimiento = fechaBase.clone().add((i + 1) * diasIncremento, 'days');
      
      cuotas.push({
        prestamo_id: prestamoId,
        numero_cuota: i + 1,
        monto: i === numeroCuotas - 1 ? 
          parseFloat((montoTotal - (montoPorCuota * i)).toFixed(2)) : // Ajuste para última cuota
          montoPorCuota,
        fecha_vencimiento: fechaVencimiento.format('YYYY-MM-DD'),
        estado: 'pendiente'
      });
    }

    // Insertar cuotas en lote
    if (cuotas.length > 0) {
      await db.query(`
        INSERT INTO cuotas (
          prestamo_id, numero_cuota, monto, fecha_vencimiento, estado
        ) VALUES ${cuotas.map(() => '(?, ?, ?, ?, ?)').join(',')}
      `, {
        replacements: cuotas.flatMap(c => [
          c.prestamo_id, c.numero_cuota, c.monto, c.fecha_vencimiento, c.estado
        ]),
        type: QueryTypes.INSERT
      });
    }
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

 // En el método registrarPago del modelo
// En el método registrarPago
// En el método registrarPago
// En el método registrarPago
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

  // Verificar si hay mora en la cuota
  let montoMora = 0;
  if (cuota_id) {
    const cuota = await Prestamo.findCuotaById(cuota_id);
    if (cuota && cuota.estado === 'pendiente' && moment(cuota.fecha_vencimiento).add(3, 'days').isBefore(moment())) {
      montoMora = cuota.monto * 0.05;
    }
  }

  const result = await db.query(`
    INSERT INTO pagos 
    (prestamo_id, cuota_id, monto, moras, metodo, notas, referencia, registrado_por, fecha)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW()) RETURNING id
  `, [
    prestamo_id,
    cuota_id || null,
    safeParseFloat(monto),
    montoMora,  // Usamos moras en lugar de mora
    metodo,
    notas || null,
    referencia || null,
    registrado_por || 'Sistema'
  ], {
    type: QueryTypes.INSERT
  });

  // Actualizar el estado de la cuota si se pagó completo
  if (cuota_id) {
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
