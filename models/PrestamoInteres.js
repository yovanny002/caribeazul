const { DataTypes, QueryTypes } = require('sequelize');
const db = require('./db');
const moment = require('moment');

// Helper para parsear valores numéricos de forma segura
const safeParseFloat = (value, defaultValue = 0) => {
  const num = parseFloat(value);
  return isNaN(num) ? defaultValue : num;
};

const PrestamoInteres = db.define('prestamos_interes', {
  cliente_id: { type: DataTypes.INTEGER, allowNull: false },
  monto_solicitado: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  monto_aprobado: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  interes_porcentaje: { type: DataTypes.DECIMAL(5, 2), allowNull: false },
  interes_manual: { type: DataTypes.DECIMAL(10, 2) },
  frecuencia_interes: { type: DataTypes.STRING, defaultValue: 'mensual' },
  plazo_meses: { type: DataTypes.INTEGER, allowNull: false },
  forma_pago: { type: DataTypes.STRING, allowNull: false },
  estado: { type: DataTypes.STRING, defaultValue: 'aprobado' },
  ruta_id: { type: DataTypes.INTEGER },
  saldo_capital: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  // Nueva columna para llevar el control del interés acumulado pendiente
  interes_pendiente_acumulado: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0, allowNull: false }
}, {
  tableName: 'prestamos_interes',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

// ====================== MÉTODOS PERSONALIZADOS ======================

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
      interes_pendiente_acumulado: safeParseFloat(p.interes_pendiente_acumulado) // Asegurar parseo
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

    // Calcular valores numéricos
    prestamo.monto_aprobado = safeParseFloat(prestamo.monto_aprobado);
    prestamo.monto_solicitado = safeParseFloat(prestamo.monto_solicitado);
    prestamo.interes_porcentaje = safeParseFloat(prestamo.interes_porcentaje);
    prestamo.interes_manual = safeParseFloat(prestamo.interes_manual);
    prestamo.saldo_capital = safeParseFloat(prestamo.saldo_capital);
    prestamo.interes_pendiente_acumulado = safeParseFloat(prestamo.interes_pendiente_acumulado); // Asegurar parseo

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
      fecha_display: moment(pago.fecha).format('DD/MM/YYYY')
    }));
  } catch (error) {
    console.error(`Error al obtener pagos para préstamo ${id}:`, error);
    throw error;
  }
};

/**
 * Crear un nuevo préstamo
 */
PrestamoInteres.create = async (data) => {
  // Validación de campos obligatorios
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

  // Calcular monto aprobado (usar monto_aprobado si existe, sino monto_solicitado)
  const montoAprobado = data.monto_aprobado || data.monto_solicitado;
  
  // Ajustar interés manual si es quincenal (almacenarlo por el periodo)
  let interesManual = data.interes_manual;
  if (data.frecuencia_interes === 'quincenal' && interesManual) {
    // Si se ingresa un interés manual quincenal, se almacena tal cual
    interesManual = safeParseFloat(interesManual); 
  } else if (data.frecuencia_interes === 'mensual' && interesManual) {
    // Si se ingresa un interés manual mensual, se almacena tal cual
    interesManual = safeParseFloat(interesManual);
  } else {
    interesManual = null; // Si no hay interés manual, se usa el porcentaje
  }

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
      interes_pendiente_acumulado, -- Inicializar a 0 al crear el préstamo
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
      0, -- Interés pendiente acumulado inicial
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
        interes_manual: interesManual,
        frecuencia_interes: data.frecuencia_interes || 'mensual',
        plazo_meses: parseInt(data.plazo_meses) || 1,
        forma_pago: data.forma_pago,
        estado: data.estado || 'pendiente',
        ruta_id: data.ruta_id || null,
        saldo_capital: safeParseFloat(montoAprobado) // Saldo inicial = monto aprobado
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
 * Función para calcular el interés que se ha generado desde la última actualización
 * del interés acumulado o desde la creación del préstamo, hasta la fecha actual.
 * @param {object} prestamo - Objeto del préstamo.
 * @returns {number} Monto de interés generado.
 */
PrestamoInteres.calculateAccruedInterest = async (prestamo) => {
  const lastInterestCalculationDate = moment(prestamo.updated_at); // Usamos updated_at como proxy para la última vez que se modificó el interés
  const now = moment();

  // Si el préstamo es nuevo y aún no tiene updated_at que no sea created_at, o si nunca se ha hecho un pago, 
  // la fecha de inicio para el cálculo es created_at.
  // Si ya hubo pagos, la fecha de inicio es la fecha del último cálculo/pago relevante.
  // Para simplificar, asumiremos que updated_at se actualiza cada vez que se registra un pago
  // o se actualiza el interés_pendiente_acumulado.

  // Calculamos los días transcurridos desde la última actualización o creación del préstamo
  const daysPassed = now.diff(lastInterestCalculationDate, 'days');
  let accruedInterest = 0;
  
  const dailyInterestRate = (prestamo.interes_manual 
    ? prestamo.interes_manual 
    : (prestamo.saldo_capital * (prestamo.interes_porcentaje / 100))
  ) / (prestamo.frecuencia_interes === 'quincenal' ? 15 : 30); // Interés por día según la frecuencia

  if (dailyInterestRate > 0) {
    accruedInterest = dailyInterestRate * daysPassed;
  }
  
  return accruedInterest;
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
    // 1. Obtener el préstamo actual
    const prestamo = await PrestamoInteres.findById(pagoData.prestamo_id);
    if (!prestamo) {
      throw new Error('Préstamo no encontrado');
    }

    // Calcular el interés que se ha generado desde la última actualización hasta ahora
    const interesGeneradoAhora = await PrestamoInteres.calculateAccruedInterest(prestamo);
    
    // Sumar el interés generado ahora al interés pendiente acumulado del préstamo
    let totalInteresPendiente = prestamo.interes_pendiente_acumulado + interesGeneradoAhora;

    const montoPago = safeParseFloat(pagoData.monto);
    let interesPagado = 0;
    let capitalPagado = 0;
    let montoRestanteParaPagar = montoPago;

    // 2. Primero, cubrir los intereses pendientes
    if (totalInteresPendiente > 0) {
      interesPagado = Math.min(montoRestanteParaPagar, totalInteresPendiente);
      montoRestanteParaPagar -= interesPagado;
      totalInteresPendiente -= interesPagado; // Actualizar el interés pendiente
    }

    // 3. Lo que resta del pago se aplica al capital
    if (montoRestanteParaPagar > 0) {
      capitalPagado = Math.min(montoRestanteParaPagar, prestamo.saldo_capital);
      montoRestanteParaPagar -= capitalPagado;
    }

    // Si el capital pagado es mayor que el saldo del capital, ajustarlo para que no sea negativo
    if (capitalPagado > prestamo.saldo_capital) {
      capitalPagado = prestamo.saldo_capital;
    }

    // 4. Registrar el pago
    const [result] = await db.query(`
      INSERT INTO pagos_interes (
        prestamo_id,
        monto,
        interes_pagado,
        capital_pagado,
        metodo,
        notas,
        referencia,
        registrado_por,
        fecha,
        created_at
      ) VALUES (
        :prestamo_id,
        :monto,
        :interes_pagado,
        :capital_pagado,
        :metodo,
        :notas,
        :referencia,
        :registrado_por,
        NOW(),
        NOW()
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

    // 5. Actualizar saldo del préstamo y el interés pendiente acumulado
    let nuevoEstado = prestamo.estado;
    const nuevoSaldoCapital = prestamo.saldo_capital - capitalPagado;
    if (nuevoSaldoCapital <= 0) {
      nuevoEstado = 'pagado'; // Marcar como pagado si el capital es 0 o menos
    }

    await db.query(`
      UPDATE prestamos_interes 
      SET 
        saldo_capital = :nuevoSaldoCapital,
        interes_pendiente_acumulado = :totalInteresPendiente,
        estado = :estado,
        updated_at = NOW() -- Actualizamos updated_at para el próximo cálculo de interés
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

    return result.id;
  } catch (error) {
    console.error('Error al registrar pago:', error);
    throw error;
  }
};

module.exports = PrestamoInteres;