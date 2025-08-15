const db = require('./db');
const { QueryTypes } = require('sequelize');
const moment = require('moment');
const Pago = require('./Pago');
const rutas = require('./Ruta');
const CuotaModel = require('./Cuota');

// Helper para parsear valores numéricos de forma segura
const safeParseFloat = (value, defaultValue = 0) => {
  const num = parseFloat(value);
  return isNaN(num) ? defaultValue : num;
};

const Prestamo = {
  // === MÉTODOS EXISTENTES ===
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
      
      // La mora total del préstamo se toma directamente del campo 'moras' de la DB
      // El controlador se encargará de recalcular la mora pendiente de las cuotas para la vista.
      prestamo.mora_total = safeParseFloat(prestamo.moras, 0);

      const pagos = await Pago.findByPrestamo(id) || [];
      const total_pagado = pagos.reduce((sum, pago) => sum + safeParseFloat(pago.monto), 0);
      prestamo.total_pagado = total_pagado;
      prestamo.saldo_actual = Math.max(0, prestamo.monto_total + prestamo.mora_total - total_pagado);

      return prestamo;
    } catch (error) {
      console.error(`❌ Error en findById(${id}):`, error.message);
      throw error;
    }
  },

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
      ruta_id
    } = data;

    const numeroCuotas = parseInt(cuotas);
    if (isNaN(numeroCuotas) || numeroCuotas <= 0) {
      throw new Error('Número de cuotas no válido');
    }

    const montoAprobadoVal = safeParseFloat(monto_aprobado || monto_solicitado);
    const interes = safeParseFloat(interes_porcentaje, 43);
    const montoInteres = montoAprobadoVal * (interes / 100);
    const montoTotal = montoAprobadoVal + montoInteres;
    const monto_por_cuota = parseFloat((montoTotal / numeroCuotas).toFixed(2));

    const [result] = await db.query(`
      INSERT INTO solicitudes_prestamos 
      (cliente_id, ingresos_mensuales, monto_solicitado, monto_aprobado, 
        interes_porcentaje, cuotas, monto_por_cuota, forma_pago, estado, moras, ruta_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING id
    `, {
      replacements: [
        cliente_id,
        ingresos_mensuales,
        monto_solicitado,
        montoAprobadoVal,
        interes,
        numeroCuotas,
        monto_por_cuota,
        forma_pago,
        estado || 'pendiente',
        safeParseFloat(moras, 0),
        ruta_id
      ],
      type: QueryTypes.INSERT
    });

    const prestamoId = result[0].id;

    await Prestamo.generateCuotas(prestamoId, montoTotal, numeroCuotas, forma_pago);

    return prestamoId;
  },

 update: async (id, data) => {
  const montoAprobado = safeParseFloat(data.monto_aprobado || data.monto_solicitado);
  const interes = safeParseFloat(data.interes_porcentaje, 43);

  let cuotas = parseInt(data.cuotas) || 3;
  switch (data.forma_pago) {
    case 'diario': cuotas = 26; break;
    case 'semanal': cuotas = 13; break;
    case 'quincenal': cuotas = 7; break;
  }

  const montoTotal = montoAprobado * (1 + interes / 100);
  const montoPorCuota = parseFloat((montoTotal / cuotas).toFixed(2));

  await db.query(`
    UPDATE solicitudes_prestamos
    SET monto_solicitado = ?,
        monto_aprobado = ?,
        interes_porcentaje = ?,
        forma_pago = ?,
        estado = ?,
        moras = ?,
        cuotas = ?,
        monto_por_cuota = ?
    WHERE id = ?
  `, [
    safeParseFloat(data.monto_solicitado),
    montoAprobado,
    interes,
    data.forma_pago,
    data.estado,
    safeParseFloat(data.moras, 0),
    cuotas,
    montoPorCuota,
    id
  ]);

  await db.query(`DELETE FROM cuotas WHERE prestamo_id = ?`, [id]);
  await Prestamo.generateCuotas(id, montoTotal, cuotas, data.forma_pago);
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

  insertCuotas: async (cuotasData) => {
    if (!Array.isArray(cuotasData) || cuotasData.length === 0) return;

    try {
      await CuotaModel.bulkCreate(cuotasData, {
        validate: true,
        returning: true
      });
      console.log(`✅ ${cuotasData.length} cuotas insertadas correctamente`);
    } catch (error) {
      console.error('❌ Error al insertar cuotas:', error.message);
      throw error;
    }
  },

  generateCuotas: async (prestamoId, montoTotal, numeroCuotas, formaPago = 'mensual') => {
    if (!prestamoId) throw new Error('ID del préstamo no válido al generar cuotas');

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
      montoMora,
      metodo,
      notas || null,
      referencia || null,
      registrado_por || 'Sistema'
    ], {
      type: QueryTypes.INSERT
    });

    // === CORRECCIÓN CLAVE: ACTUALIZAR EL CAMPO 'moras' DEL PRÉSTAMO ===
    // Solo si se pagó la mora, debemos restarla del total del préstamo
    if (montoMora > 0) {
      await db.query(`
        UPDATE solicitudes_prestamos
        SET moras = moras - :montoMora
        WHERE id = :prestamo_id
      `, {
        replacements: { montoMora, prestamo_id },
        type: QueryTypes.UPDATE
      });
    }

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
  },

  // === NUEVA FUNCIONALIDAD: ELIMINAR MORA ===
  eliminarMora: async (id) => {
    try {
      // 1. Resetear el campo 'moras' del préstamo a 0 en la tabla solicitudes_prestamos
      const [resultUpdatePrestamo, affectedRowsPrestamo] = await db.query(`
        UPDATE solicitudes_prestamos
        SET
          moras = 0,
          updated_at = NOW()
        WHERE id = :id
      `, {
        replacements: { id },
        type: QueryTypes.UPDATE
      });

      // 2. Reiniciar el campo 'mora' en las cuotas pendientes/vencidas
      const [resultUpdateCuotas, affectedRowsCuotas] = await db.query(`
        UPDATE cuotas
        SET
          mora = 0,
          updated_at = NOW()
        WHERE prestamo_id = :id
          AND estado != 'pagada'
      `, {
        replacements: { id },
        type: QueryTypes.UPDATE
      });

      console.log(`✅ Mora eliminada del préstamo #${id}. Filas de préstamo afectadas: ${affectedRowsPrestamo}, Cuotas actualizadas: ${affectedRowsCuotas}`);
      return affectedRowsPrestamo;

    } catch (error) {
      console.error('❌ Error al eliminar la mora del préstamo:', error);
      throw error;
    }
  }
};

module.exports = Prestamo;