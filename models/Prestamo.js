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
findById: async (id) => {
  try {
    const rows = await db.query(`
      SELECT p.*, 
             c.nombre AS cliente_nombre, 
             c.apellidos AS cliente_apellidos,
             c.cedula AS cliente_cedula,
             c.profesion AS cliente_profesion,
             r.nombre AS ruta_nombre,
             r.zona AS ruta_zona
      FROM solicitudes_prestamos p
      JOIN clientes c ON p.cliente_id = c.id
      LEFT JOIN rutas r ON p.ruta_id = r.id
      WHERE p.id = :id
    `, {
      replacements: { id },
      type: QueryTypes.SELECT
    });

    if (!rows || rows.length === 0) return null;

    const prestamo = rows[0];
    prestamo.monto_aprobado = safeParseFloat(prestamo.monto_aprobado);
    prestamo.interes_porcentaje = safeParseFloat(prestamo.interes_porcentaje, 43);
    prestamo.monto_interes = prestamo.monto_aprobado * (prestamo.interes_porcentaje / 100);
    prestamo.monto_total = prestamo.monto_aprobado + prestamo.monto_interes;
    
    // Calcular moras pendientes
    const cuotas = await Prestamo.findCuotasByPrestamo(id);
    let morasPendientes = 0;
    
    cuotas.forEach(cuota => {
      if (cuota.estado === 'pendiente' && moment(cuota.fecha_vencimiento).add(3, 'days').isBefore(moment())) {
        const mora = cuota.monto * 0.05; // 5% de mora
        morasPendientes += mora;
      }
    });
    
    prestamo.moras = safeParseFloat(prestamo.moras, 0) + morasPendientes;

    const pagos = await Pago.findByPrestamo(id) || [];
    const total_pagado = pagos.reduce((sum, pago) => sum + safeParseFloat(pago.monto), 0);
    prestamo.total_pagado = total_pagado;
    prestamo.saldo_actual = Math.max(0, prestamo.monto_total + prestamo.moras - total_pagado);

    return prestamo;
  } catch (error) {
    console.error(`❌ Error en findById(${id}):`, error.message);
    throw error;
  }
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
    cuotas,
    forma_pago,
    estado,
    moras,
    ruta_id,
    tipo_prestamo, // 'abierto' o 'cerrado' (cuotas)
    interes_manual // Solo para préstamos abiertos
  } = data;

  const montoAprobadoVal = safeParseFloat(monto_aprobado || monto_solicitado);
  const interes = safeParseFloat(interes_porcentaje, 43);
  
  // Calcular montos según tipo de préstamo
  let montoInteres, montoTotal;
  
  if (tipo_prestamo === 'abierto') {
    // Para préstamo abierto, el interés manual es el total a cobrar
    montoInteres = safeParseFloat(interes_manual);
    montoTotal = montoAprobadoVal + montoInteres;
  } else {
    // Para préstamo cerrado (cuotas), cálculo normal
    montoInteres = montoAprobadoVal * (interes / 100);
    montoTotal = montoAprobadoVal + montoInteres;
  }

  // Insertar préstamo
  const [result] = await db.query(`
    INSERT INTO solicitudes_prestamos 
    (cliente_id, ingresos_mensuales, monto_solicitado, monto_aprobado, 
     interes_porcentaje, cuotas, monto_por_cuota, forma_pago, estado, moras, ruta_id, tipo_prestamo, monto_interes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING id
  `, {
    replacements: [
      cliente_id,
      ingresos_mensuales,
      monto_solicitado,
      montoAprobadoVal,
      interes,
      tipo_prestamo === 'abierto' ? 1 : cuotas, // Para abierto solo 1 "cuota"
      tipo_prestamo === 'abierto' ? montoTotal : (montoTotal / cuotas), // Para abierto el monto total
      forma_pago,
      estado || 'pendiente',
      safeParseFloat(moras, 0),
      ruta_id,
      tipo_prestamo,
      montoInteres
    ],
    type: QueryTypes.INSERT
  });

  const prestamoId = result[0].id;

  // Generar cuotas solo si no es abierto
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

  // Calcular interés actual (10% del capital actual)
  const interesActual = prestamo.saldo_actual * 0.10;
  const capitalPagado = Math.max(0, montoPago - interesActual);
  
  // Registrar el pago
  const [result] = await db.query(`
    INSERT INTO pagos_abiertos 
    (prestamo_id, monto, interes, capital, saldo_anterior, saldo_posterior)
    VALUES (?, ?, ?, ?, ?, ?)
    RETURNING id
  `, {
    replacements: [
      prestamoId,
      montoPago,
      interesActual,
      capitalPagado,
      prestamo.saldo_actual,
      prestamo.saldo_actual - capitalPagado
    ],
    type: QueryTypes.INSERT
  });

  // Actualizar saldo del préstamo
  await db.query(`
    UPDATE solicitudes_prestamos 
    SET saldo_actual = saldo_actual - ?
    WHERE id = ?
  `, {
    replacements: [capitalPagado, prestamoId],
    type: QueryTypes.UPDATE
  });

  return result[0].id;
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
