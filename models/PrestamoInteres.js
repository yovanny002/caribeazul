const { DataTypes, QueryTypes } = require('sequelize');
const db = require('./db'); // Asegúrate de que esta ruta sea correcta para tu conexión a la DB
const moment = require('moment'); // Para manejo de fechas

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
  interes_manual: { type: DataTypes.DECIMAL(10, 2) }, // Puede ser null
  frecuencia_interes: { type: DataTypes.STRING, defaultValue: 'mensual' },
  plazo_meses: { type: DataTypes.INTEGER, allowNull: false },
  forma_pago: { type: DataTypes.STRING, allowNull: false },
  estado: { type: DataTypes.STRING, defaultValue: 'activo' }, // Cambiado a 'activo' por defecto
  ruta_id: { type: DataTypes.INTEGER }, // Puede ser null
  saldo_capital: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  // Columna para llevar el control del interés acumulado pendiente
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
 * @param {string} estado - Estado del préstamo a filtrar (ej: 'activo', 'pagado', null para todos).
 * @returns {Array<object>} Lista de préstamos con detalles del cliente y ruta.
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

    // Asegurar que los valores numéricos sean floats
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
 * Buscar préstamo por ID con información completa (cliente y ruta).
 * @param {number} id - ID del préstamo a buscar.
 * @returns {object|null} Objeto del préstamo o null si no se encuentra.
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

    // Asegurar que los valores numéricos sean floats
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
 * Obtener historial de pagos de un préstamo.
 * @param {number} id - ID del préstamo.
 * @returns {Array<object>} Lista de pagos asociados al préstamo.
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
      fecha_display: moment(pago.fecha).format('DD/MM/YYYY HH:mm') // Incluir hora para el recibo
    }));
  } catch (error) {
    console.error(`Error al obtener pagos para préstamo ${id}:`, error);
    throw error;
  }
};

/**
 * Función para calcular el interés para un período completo (quincenal o mensual).
 * Se usa para inicializar el interés del primer período al crear el préstamo.
 * La tasa de interés (interes_porcentaje) se interpreta como MENSUAL.
 * @param {number} montoCapital - El monto de capital sobre el cual calcular el interés.
 * @param {object} params - Objeto con interes_porcentaje, interes_manual, frecuencia_interes.
 * @returns {number} Monto de interés para un período.
 */
PrestamoInteres.calculateInterestForPeriod = (montoCapital, params) => {
    let interesPorPeriodo = 0;
    const interesManual = safeParseFloat(params.interes_manual);
    const interesPorcentaje = safeParseFloat(params.interes_porcentaje);
    const frecuenciaInteres = params.frecuencia_interes || 'mensual';

    if (interesManual > 0) {
        interesPorPeriodo = interesManual;
    } else {
        // La tasa porcentual (interes_porcentaje) ahora se asume MENSUAL
        const tasaMensualDecimal = interesPorcentaje / 100; 
        interesPorPeriodo = montoCapital * tasaMensualDecimal;
        
        if (frecuenciaInteres === 'quincenal') {
            interesPorPeriodo = interesPorPeriodo / 2; // La mitad del interés mensual para una quincena
        }
    }
    return interesPorPeriodo;
};

/**
 * Función para calcular el interés que se ha generado desde la última actualización
 * del interés acumulado o desde la creación del préstamo, hasta la fecha actual.
 * La tasa de interés (interes_porcentaje) se interpreta como MENSUAL.
 * @param {object} prestamo - Objeto del préstamo (debe contener saldo_capital, interes_porcentaje, interes_manual, frecuencia_interes, updated_at).
 * @returns {number} Monto de interés generado.
 */
PrestamoInteres.calculateAccruedInterest = async (prestamo) => {
  const lastInterestCalculationDate = moment(prestamo.updated_at);
  const now = moment();
  const daysPassed = now.diff(lastInterestCalculationDate, 'days');
  
  // Si no ha pasado ni un día completo, no hay interés adicional acumulado.
  if (daysPassed <= 0) { 
      return 0;
  }

  let dailyInterestRate = 0;
  const interesManual = safeParseFloat(prestamo.interes_manual);
  const interesPorcentaje = safeParseFloat(prestamo.interes_porcentaje);
  const saldoCapital = safeParseFloat(prestamo.saldo_capital);
  const diasEnMes = 30; // Asumimos 30 días para el cálculo de interés diario a partir de una tasa mensual

  if (interesManual > 0) {
      // Si hay interés manual, se usa ese valor por el período y se divide por los días del período
      dailyInterestRate = interesManual / (prestamo.frecuencia_interes === 'quincenal' ? 15 : diasEnMes);
  } else {
      // Si no hay interés manual, se usa el porcentaje sobre el saldo capital actual
      // La tasa porcentual (interes_porcentaje) ahora se asume MENSUAL, la dividimos por 30 días para obtener diaria
      const tasaDiaria = (interesPorcentaje / 100) / diasEnMes; 
      dailyInterestRate = saldoCapital * tasaDiaria;
  }
  
  const accruedInterest = dailyInterestRate * daysPassed;
  return accruedInterest;
};


/**
 * Crear un nuevo préstamo
 * @param {object} data - Datos para crear el préstamo.
 * @returns {number} ID del préstamo recién creado.
 * @throws {Error} Si faltan campos requeridos o hay un error de base de datos.
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
  
  // Calcular el interés del primer período basado en el monto aprobado
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
      :interes_pendiente_acumulado, -- Inicializado con el interés del primer período
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
        estado: data.estado || 'activo', // 'activo' para préstamos aprobados al crear
        ruta_id: data.ruta_id || null,
        saldo_capital: safeParseFloat(montoAprobado), // Saldo inicial = monto aprobado
        interes_pendiente_acumulado: interesPrimerPeriodo // Interés inicial pendiente
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
 * Registrar un pago para un préstamo.
 * Aplica el monto del pago primero a los intereses pendientes, luego al capital.
 * @param {object} pagoData - Datos del pago (prestamo_id, monto, metodo, notas, referencia, registrado_por).
 * @returns {number} ID del pago registrado.
 * @throws {Error} Si faltan campos requeridos o el préstamo no se encuentra.
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

    // 2. Calcular el interés que se ha generado desde la última actualización del updated_at
    const interesGeneradoDesdeUltimaActualizacion = await PrestamoInteres.calculateAccruedInterest(prestamo);
    
    // 3. Sumar el interés recién generado al total de interés pendiente que ya tenía el préstamo
    let totalInteresPendiente = prestamo.interes_pendiente_acumulado + interesGeneradoDesdeUltimaActualizacion;
    totalInteresPendiente = Math.max(0, totalInteresPendiente); // Asegurar que no sea negativo

    const montoPago = safeParseFloat(pagoData.monto);
    let interesPagado = 0;
    let capitalPagado = 0;
    let montoRestanteParaPagar = montoPago;

    // 4. Primero, cubrir los intereses pendientes
    if (totalInteresPendiente > 0) {
      interesPagado = Math.min(montoRestanteParaPagar, totalInteresPendiente);
      montoRestanteParaPagar -= interesPagado;
      totalInteresPendiente -= interesPagado; // El interés pendiente se reduce con lo pagado
    }

    // 5. Lo que resta del pago se aplica al capital
    if (montoRestanteParaPagar > 0) {
      capitalPagado = Math.min(montoRestanteParaPagar, prestamo.saldo_capital);
      montoRestanteParaPagar -= capitalPagado;
    }

    // Asegurarse de que el capital pagado no exceda el saldo actual y no lo haga negativo
    if (capitalPagado > prestamo.saldo_capital) {
      capitalPagado = prestamo.saldo_capital;
    }
    capitalPagado = Math.max(0, capitalPagado); // Asegurar que no sea negativo

    // 6. Registrar el pago en la tabla pagos_interes
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

    // 7. Actualizar saldo del préstamo y el interés pendiente acumulado
    let nuevoEstado = prestamo.estado;
    const nuevoSaldoCapital = prestamo.saldo_capital - capitalPagado;
    
    // Si el capital ha sido pagado en su totalidad y no hay más interés pendiente
    if (nuevoSaldoCapital <= 0 && totalInteresPendiente <= 0) {
      nuevoEstado = 'pagado'; 
    } else {
      nuevoEstado = 'activo'; // Mantener como activo si aún hay saldo o interés pendiente
    }

    await db.query(`
      UPDATE prestamos_interes 
      SET 
        saldo_capital = :nuevoSaldoCapital,
        interes_pendiente_acumulado = :totalInteresPendiente, 
        estado = :estado,
        updated_at = NOW() -- Actualizamos updated_at a la fecha del pago
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