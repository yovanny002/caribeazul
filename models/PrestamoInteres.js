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
  query += ` ORDER BY pi.createdAt DESC`;

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
  const [result] = await db.query(`
    INSERT INTO prestamos_interes (cliente_id, monto_aprobado, interes_porcentaje, frecuencia_interes, estado, createdAt, updatedAt)
    VALUES (:cliente_id, :monto_aprobado, :interes_porcentaje, :frecuencia_interes, :estado, NOW(), NOW())
    RETURNING id
  `, {
    replacements: {
      cliente_id: data.cliente_id,
      monto_aprobado: data.monto_aprobado,
      interes_porcentaje: data.interes_manual || data.interes_porcentaje,
      frecuencia_interes: data.frecuencia_interes,
      estado: 'activo'
    },
    type: QueryTypes.INSERT
  });

  return result.id;
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
