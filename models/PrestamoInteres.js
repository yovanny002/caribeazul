const { DataTypes, QueryTypes } = require('sequelize');
const db = require('./db');
const moment = require('moment');

// Helper para parsear valores numéricos de forma segura
const safeParseFloat = (value, defaultValue = 0) => {
  const num = parseFloat(value);
  return isNaN(num) ? defaultValue : num;
};

// Definición del modelo PrestamoInteres
const PrestamoInteres = db.define('prestamos_interes', {
  cliente_id: { type: DataTypes.INTEGER, allowNull: false },
  monto_solicitado: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  monto_aprobado: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  interes_porcentaje: { type: DataTypes.DECIMAL(5, 2), allowNull: false },
  interes_manual: { type: DataTypes.DECIMAL(10, 2) },
  frecuencia_interes: { type: DataTypes.STRING, defaultValue: 'mensual' },
  plazo_meses: { type: DataTypes.INTEGER, allowNull: false },
  forma_pago: { type: DataTypes.STRING, allowNull: false },
  estado: { type: DataTypes.STRING, defaultValue: 'activo' },
  ruta_id: { type: DataTypes.INTEGER },
  saldo_capital: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  interes_pendiente_acumulado: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0, allowNull: false }
}, {
  tableName: 'prestamos_interes',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

// ====================== MÉTODOS PERSONALIZADOS DEL MODELO ======================

/**
 * Listar préstamos con información del cliente
 */
PrestamoInteres.findAllWithClientes = async (estado = null) => {
  let query = `
    SELECT 
      pi.*, 
      c.nombre AS cliente_nombre, 
      c.apellidos AS cliente_apellidos,
      c.cedula AS cliente_cedula,
      r.nombre AS ruta_nombre
    FROM prestamos_interes pi
    JOIN clientes c ON pi.cliente_id = c.id
    LEFT JOIN rutas r ON pi.ruta_id = r.id
  `;
  const replacements = {};
  if (estado) {
    query += ` WHERE pi.estado = :estado`;
    replacements.estado = estado;
  }
  query += ` ORDER BY pi.created_at DESC`;
  try {
    const prestamos = await db.query(query, {
      replacements,
      type: QueryTypes.SELECT
    });
    return prestamos.map(p => ({
      ...p,
      monto_aprobado: safeParseFloat(p.monto_aprobado),
      monto_solicitado: safeParseFloat(p.monto_solicitado),
      interes_porcentaje: safeParseFloat(p.interes_porcentaje),
      saldo_capital: safeParseFloat(p.saldo_capital),
      interes_pendiente_acumulado: safeParseFloat(p.interes_pendiente_acumulado)
    }));
  } catch (error) {
    console.error('Error al listar préstamos:', error);
    throw error;
  }
};

/**
 * Buscar préstamo por ID con información completa
 */
PrestamoInteres.findById = async (id) => {
  try {
    const [prestamo] = await db.query(`
      SELECT 
        pi.*,
        c.nombre AS cliente_nombre,
        c.apellidos AS cliente_apellidos,
        c.cedula AS cliente_cedula,
        c.profesion AS cliente_profesion,
        r.nombre AS ruta_nombre,
        r.zona AS ruta_zona
      FROM prestamos_interes pi
      JOIN clientes c ON pi.cliente_id = c.id
      LEFT JOIN rutas r ON pi.ruta_id = r.id
      WHERE pi.id = :id
    `, {
      replacements: { id },
      type: QueryTypes.SELECT
    });
    if (!prestamo) return null;
    prestamo.monto_aprobado = safeParseFloat(prestamo.monto_aprobado);
    prestamo.monto_solicitado = safeParseFloat(prestamo.monto_solicitado);
    prestamo.interes_porcentaje = safeParseFloat(prestamo.interes_porcentaje);
    prestamo.interes_manual = safeParseFloat(prestamo.interes_manual);
    prestamo.saldo_capital = safeParseFloat(prestamo.saldo_capital);
    prestamo.interes_pendiente_acumulado = safeParseFloat(prestamo.interes_pendiente_acumulado);
    return prestamo;
  } catch (error) {
    console.error(`Error al buscar préstamo ${id}:`, error);
    throw error;
  }
};

/**
 * Obtener historial de pagos de un préstamo
 */
PrestamoInteres.getHistorialPagos = async (id) => {
  try {
    const pagos = await db.query(`
      SELECT 
        id,
        monto,
        interes_pagado,
        capital_pagado,
        metodo,
        notas,
        referencia,
        registrado_por,
        fecha,
        TO_CHAR(fecha, 'YYYY-MM-DD HH24:MI:SS') as fecha_formateada,
        created_at
      FROM pagos_interes
      WHERE prestamo_id = :id
      ORDER BY created_at DESC
    `, {
      replacements: { id },
      type: QueryTypes.SELECT
    });
    return pagos.map(pago => ({
      ...pago,
      monto: safeParseFloat(pago.monto),
      interes_pagado: safeParseFloat(pago.interes_pagado),
      capital_pagado: safeParseFloat(pago.capital_pagado),
      fecha_display: moment(pago.fecha).format('DD/MM/YYYY HH:mm')
    }));
  } catch (error) {
    console.error(`Error al obtener pagos para préstamo ${id}:`, error);
    throw error;
  }
};

/**
 * Función para calcular el interés para un período completo
 */
PrestamoInteres.calculateInterestForPeriod = (montoCapital, params) => {
    let interesPorPeriodo = 0;
    const interesManual = safeParseFloat(params.interes_manual);
    const interesPorcentaje = safeParseFloat(params.interes_porcentaje);
    const frecuenciaInteres = params.frecuencia_interes || 'mensual';
    if (interesManual > 0) {
        interesPorPeriodo = interesManual;
    } else {
        const tasaMensualDecimal = interesPorcentaje / 100;
        interesPorPeriodo = montoCapital * tasaMensualDecimal;
        if (frecuenciaInteres === 'quincenal') {
            interesPorPeriodo = interesPorPeriodo / 2;
        }
    }
    return interesPorPeriodo;
};

/**
 * Función para calcular el interés que se ha generado de forma diaria
 */
PrestamoInteres.calculateAccruedInterest = async (prestamo) => {
  const lastInterestCalculationDate = moment(prestamo.updated_at);
  const now = moment();
  const daysPassed = now.diff(lastInterestCalculationDate, 'days');
  if (daysPassed <= 0) { 
      return 0;
  }
  let dailyInterestRate = 0;
  const interesManual = safeParseFloat(prestamo.interes_manual);
  const interesPorcentaje = safeParseFloat(prestamo.interes_porcentaje);
  const saldoCapital = safeParseFloat(prestamo.saldo_capital);
  const diasEnMes = 30;
  if (interesManual > 0) {
      dailyInterestRate = interesManual / (prestamo.frecuencia_interes === 'quincenal' ? 15 : diasEnMes);
  } else {
      const tasaDiaria = (interesPorcentaje / 100) / diasEnMes;
      dailyInterestRate = saldoCapital * tasaDiaria;
  }
  const accruedInterest = dailyInterestRate * daysPassed;
  return accruedInterest;
};

/**
 * Crear un nuevo préstamo
 */
PrestamoInteres.create = async (data) => {
  const requiredFields = [
    'cliente_id', 
    'monto_solicitado', 
    'interes_porcentaje', 
    'plazo_meses', 
    'forma_pago'
  ];
  const missingFields = requiredFields.filter(field => !data[field]);
  if (missingFields.length > 0) {
    throw new Error(`Faltan campos requeridos: ${missingFields.join(', ')}`);
  }
  const montoAprobado = data.monto_aprobado || data.monto_solicitado;
  const interesPrimerPeriodo = PrestamoInteres.calculateInterestForPeriod(
      safeParseFloat(montoAprobado),
      {
          interes_manual: data.interes_manual,
          interes_porcentaje: data.interes_porcentaje,
          frecuencia_interes: data.frecuencia_interes
      }
  );
  const query = `
    INSERT INTO prestamos_interes (
      cliente_id,
      monto_solicitado,
      monto_aprobado,
      interes_porcentaje,
      interes_manual,
      frecuencia_interes,
      plazo_meses,
      forma_pago,
      estado,
      ruta_id,
      saldo_capital,
      interes_pendiente_acumulado,
      created_at,
      updated_at
    ) VALUES (
      :cliente_id,
      :monto_solicitado,
      :monto_aprobado,
      :interes_porcentaje,
      :interes_manual,
      :frecuencia_interes,
      :plazo_meses,
      :forma_pago,
      :estado,
      :ruta_id,
      :saldo_capital,
      :interes_pendiente_acumulado,
      NOW(),
      NOW()
    ) RETURNING id
  `;
  try {
    const [result] = await db.query(query, {
      replacements: {
        cliente_id: data.cliente_id,
        monto_solicitado: safeParseFloat(data.monto_solicitado),
        monto_aprobado: safeParseFloat(montoAprobado),
        interes_porcentaje: safeParseFloat(data.interes_porcentaje),
        interes_manual: data.interes_manual ? safeParseFloat(data.interes_manual) : null,
        frecuencia_interes: data.frecuencia_interes || 'mensual',
        plazo_meses: parseInt(data.plazo_meses) || 1,
        forma_pago: data.forma_pago,
        estado: data.estado || 'activo',
        ruta_id: data.ruta_id || null,
        saldo_capital: safeParseFloat(montoAprobado),
        interes_pendiente_acumulado: interesPrimerPeriodo
      },
      type: QueryTypes.INSERT
    });
    return result.id;
  } catch (error) {
    console.error('Error al crear préstamo:', error);
    throw new Error('Error al crear el préstamo en la base de datos');
  }
};

/**
 * Registrar un pago para un préstamo
 */
PrestamoInteres.registrarPago = async (pagoData) => {
  const requiredFields = ['prestamo_id', 'monto', 'registrado_por'];
  const missingFields = requiredFields.filter(field => !pagoData[field]);
  if (missingFields.length > 0) {
    throw new Error(`Faltan campos requeridos: ${missingFields.join(', ')}`);
  }
  try {
    console.log('--- Proceso de Pago Reiniciado ---');
    const prestamo = await PrestamoInteres.findById(pagoData.prestamo_id);
    if (!prestamo) {
      console.error('Error: Préstamo no encontrado en la DB.');
      throw new Error('Préstamo no encontrado');
    }
    const interesGeneradoDesdeUltimaActualizacion = await PrestamoInteres.calculateAccruedInterest(prestamo);
    let totalInteresPendiente = prestamo.interes_pendiente_acumulado + interesGeneradoDesdeUltimaActualizacion;
    totalInteresPendiente = Math.max(0, totalInteresPendiente);
    const montoPago = safeParseFloat(pagoData.monto);
    let interesPagado = 0;
    let capitalPagado = 0;
    let montoRestanteParaPagar = montoPago;
    if (totalInteresPendiente > 0) {
      interesPagado = Math.min(montoRestanteParaPagar, totalInteresPendiente);
      montoRestanteParaPagar -= interesPagado;
      totalInteresPendiente -= interesPagado;
    }
    if (montoRestanteParaPagar > 0) {
      capitalPagado = Math.min(montoRestanteParaPagar, prestamo.saldo_capital);
      montoRestanteParaPagar -= capitalPagado;
    }
    capitalPagado = Math.max(0, capitalPagado);
    
    console.log('3. Datos del pago antes de insertar:');
    console.log(`   - prestamo_id: ${pagoData.prestamo_id}`);
    console.log(`   - monto: ${montoPago}`);
    console.log(`   - interes_pagado: ${interesPagado}`);
    console.log(`   - capital_pagado: ${capitalPagado}`);

    // Consulta INSERT usando la sintaxis de "replacements"
    const [result] = await db.query(`
      INSERT INTO pagos_interes (
        prestamo_id, monto, interes_pagado, capital_pagado,
        metodo, notas, referencia, registrado_por, fecha, created_at
      ) VALUES (
        :prestamo_id, :monto, :interes_pagado, :capital_pagado,
        :metodo, :notas, :referencia, :registrado_por, NOW(), NOW()
      ) RETURNING id
    `, {
      replacements: {
        prestamo_id: pagoData.prestamo_id,
        monto: montoPago,
        interes_pagado: interesPagado,
        capital_pagado: capitalPagado,
        metodo: pagoData.metodo || 'efectivo',
        notas: pagoData.notas || null,
        referencia: pagoData.referencia || null,
        registrado_por: pagoData.registrado_por
      },
      type: QueryTypes.INSERT
    });

    console.log('4.1 - Resultado de la consulta INSERT:', result);
    
    if (!result || !result[0] || !result[0].id) {
      console.error('4.2 - Falla al obtener el ID del pago. El resultado fue:', result);
      throw new Error('Fallo al registrar el pago en la base de datos.');
    }

    const pagoId = result[0].id;
    console.log(`✅ Pago insertado con ID: ${pagoId}`);

    // Consulta UPDATE usando la sintaxis de "replacements"
    let nuevoEstado = prestamo.estado;
    const nuevoSaldoCapital = prestamo.saldo_capital - capitalPagado;
    if (nuevoSaldoCapital <= 0 && totalInteresPendiente <= 0) {
      nuevoEstado = 'pagado'; 
    } else {
      nuevoEstado = 'activo';
    }
    
    console.log('5. Actualizando préstamo en la DB...');
    const [resultUpdate, affectedRows] = await db.query(`
      UPDATE prestamos_interes 
      SET 
        saldo_capital = :nuevoSaldoCapital,
        interes_pendiente_acumulado = :totalInteresPendiente, 
        estado = :estado,
        updated_at = NOW()
      WHERE id = :prestamo_id
    `, {
      replacements: {
        nuevoSaldoCapital: nuevoSaldoCapital,
        totalInteresPendiente: totalInteresPendiente,
        estado: nuevoEstado,
        prestamo_id: pagoData.prestamo_id
      },
      type: QueryTypes.UPDATE
    });
    
    console.log('   - Préstamo actualizado. Filas afectadas:', affectedRows);
    console.log('--- Proceso de Pago Finalizado ---');

    return pagoId;
  } catch (error) {
    console.error('❌ Error al registrar pago:', error);
    throw error;
  }
};
module.exports = PrestamoInteres;