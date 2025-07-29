// models/PrestamoInteres.js
const { DataTypes, QueryTypes } = require('sequelize');
const db = require('./db'); // asegúrate de que esto devuelve directamente la instancia de Sequelize

const PrestamoInteres = db.define('prestamos_interes', {
  cliente_id: { type: DataTypes.INTEGER, allowNull: false },
  monto_aprobado: { type: DataTypes.FLOAT, allowNull: false },
  interes_porcentaje: { type: DataTypes.FLOAT, allowNull: false },
  frecuencia_interes: { type: DataTypes.STRING, allowNull: false },
  estado: { type: DataTypes.STRING, defaultValue: 'activo' },
  // otros campos necesarios...
}, {
  tableName: 'prestamos_interes',
  timestamps: true
});

// ====================== MÉTODOS PERSONALIZADOS ======================

// Listar préstamos con cliente asociado
PrestamoInteres.findAllWithClientes = async (estado = null) => {
  let query = `
    SELECT pi.*, c.nombre AS cliente_nombre, c.apellidos AS cliente_apellidos
    FROM prestamos_interes pi
    JOIN clientes c ON pi.cliente_id = c.id
  `;
  if (estado) query += ` WHERE pi.estado = :estado`;
  query += ` ORDER BY pi.created_at DESC`;

  return await db.query(query, {
    type: QueryTypes.SELECT,
    replacements: estado ? { estado } : {}
  });
};

// Buscar préstamo por ID
PrestamoInteres.findById = async (id) => {
  const [result] = await db.query(`
    SELECT pi.*, c.nombre AS cliente_nombre, c.apellidos AS cliente_apellidos
    FROM prestamos_interes pi
    JOIN clientes c ON pi.cliente_id = c.id
    WHERE pi.id = :id
  `, {
    replacements: { id },
    type: QueryTypes.SELECT
  });
  return result;
};

// Obtener historial de pagos
PrestamoInteres.getHistorialPagos = async (id) => {
  return await db.query(`
    SELECT * FROM pagos_interes
    WHERE prestamo_id = :id
    ORDER BY createdAt DESC
  `, {
    replacements: { id },
    type: QueryTypes.SELECT
  });
};

// Crear préstamo
PrestamoInteres.create = async (data) => {
  // Validación de campos obligatorios
  const requiredFields = ['cliente_id', 'monto_solicitado', 'monto_aprobado', 'interes_porcentaje', 'plazo_meses', 'forma_pago'];
  const missingFields = requiredFields.filter(field => !data[field]);
  
  if (missingFields.length > 0) {
    throw new Error(`Faltan campos requeridos: ${missingFields.join(', ')}`);
  }

  const query = `
    INSERT INTO prestamos_interes (
      cliente_id,
      monto_solicitado,
      monto_aprobado,
      interes_porcentaje,
      plazo_meses,
      forma_pago,
      estado,
      ruta_id,
      saldo_capital,
      frecuencia_interes,
      created_at,
      updated_at
    ) VALUES (
      :cliente_id,
      :monto_solicitado,
      :monto_aprobado,
      :interes_porcentaje,
      :plazo_meses,
      :forma_pago,
      :estado,
      :ruta_id,
      :saldo_capital,
      :frecuencia_interes,
      NOW(),
      NOW()
    ) RETURNING id
  `;

  try {
    const [result] = await db.query(query, {
      replacements: {
        cliente_id: data.cliente_id,
        monto_solicitado: data.monto_solicitado,
        monto_aprobado: data.monto_aprobado,
        interes_porcentaje: data.interes_manual || data.interes_porcentaje,
        plazo_meses: data.plazo_meses,
        forma_pago: data.forma_pago,
        estado: data.estado || 'pendiente',
        ruta_id: data.ruta_id || null,
        saldo_capital: data.monto_aprobado, // Saldo inicial igual al monto aprobado
        frecuencia_interes: data.frecuencia_interes || 'mensual'
      },
      type: QueryTypes.INSERT
    });

    return result.id;
  } catch (error) {
    console.error('Error en la consulta SQL:', error);
    throw new Error('Error al crear el préstamo en la base de datos');
  }
};
// Registrar pago
PrestamoInteres.registrarPago = async (pagoData) => {
  return await db.query(`
    INSERT INTO pagos_interes (prestamo_id, monto_pagado, registrado_por, createdAt, updatedAt)
    VALUES (:prestamo_id, :monto_pagado, :registrado_por, NOW(), NOW())
  `, {
    replacements: {
      prestamo_id: pagoData.prestamo_id,
      monto_pagado: pagoData.monto_pagado,
      registrado_por: pagoData.registrado_por
    },
    type: QueryTypes.INSERT
  });
};

module.exports = PrestamoInteres;
