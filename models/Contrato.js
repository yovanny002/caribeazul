const db = require('./db');
const { QueryTypes } = require('sequelize');

const Contrato = {
  // Crear tabla si no existe
  createTable: async () => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS contratos_financiamiento (
        id SERIAL PRIMARY KEY,
        cliente_id INTEGER REFERENCES clientes(id),
        prestamo_id INTEGER REFERENCES solicitudes_prestamos(id),
        datos_cliente JSONB NOT NULL,
        datos_vehiculo JSONB NOT NULL,
        datos_financiamiento JSONB NOT NULL,
        datos_seguro JSONB NOT NULL,
        contrato_texto TEXT NOT NULL,
        estado VARCHAR(50) DEFAULT 'activo',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  },

  // Crear nuevo contrato
  create: async (contratoData) => {
    const {
      cliente_id,
      prestamo_id,
      datos_cliente,
      datos_vehiculo,
      datos_financiamiento,
      datos_seguro,
      contrato_texto
    } = contratoData;

    const [result] = await db.query(`
      INSERT INTO contratos_financiamiento 
      (cliente_id, prestamo_id, datos_cliente, datos_vehiculo, datos_financiamiento, datos_seguro, contrato_texto)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      RETURNING id
    `, {
      replacements: [
        cliente_id,
        prestamo_id,
        JSON.stringify(datos_cliente),
        JSON.stringify(datos_vehiculo),
        JSON.stringify(datos_financiamiento),
        JSON.stringify(datos_seguro),
        contrato_texto
      ],
      type: QueryTypes.INSERT
    });

    return result[0].id;
  },

  // Buscar por ID
  findById: async (id) => {
    const rows = await db.query(`
      SELECT c.*, 
        cli.nombre as cliente_nombre,
        cli.apellidos as cliente_apellidos,
        cli.cedula as cliente_cedula
      FROM contratos_financiamiento c
      LEFT JOIN clientes cli ON c.cliente_id = cli.id
      WHERE c.id = ?
    `, {
      replacements: [id],
      type: QueryTypes.SELECT
    });

    if (rows.length === 0) return null;

    const contrato = rows[0];
    // Parsear JSON fields
    contrato.datos_cliente = JSON.parse(contrato.datos_cliente);
    contrato.datos_vehiculo = JSON.parse(contrato.datos_vehiculo);
    contrato.datos_financiamiento = JSON.parse(contrato.datos_financiamiento);
    contrato.datos_seguro = JSON.parse(contrato.datos_seguro);

    return contrato;
  },

  // Buscar todos los contratos
  findAll: async () => {
    const rows = await db.query(`
      SELECT c.*, 
        cli.nombre as cliente_nombre,
        cli.apellidos as cliente_apellidos,
        cli.cedula as cliente_cedula,
        p.monto_aprobado
      FROM contratos_financiamiento c
      LEFT JOIN clientes cli ON c.cliente_id = cli.id
      LEFT JOIN solicitudes_prestamos p ON c.prestamo_id = p.id
      ORDER BY c.created_at DESC
    `, {
      type: QueryTypes.SELECT
    });

    return rows.map(row => ({
      ...row,
      datos_cliente: JSON.parse(row.datos_cliente),
      datos_vehiculo: JSON.parse(row.datos_vehiculo),
      datos_financiamiento: JSON.parse(row.datos_financiamiento)
    }));
  },

  // Buscar por cliente
  findByClienteId: async (clienteId) => {
    const rows = await db.query(`
      SELECT * FROM contratos_financiamiento 
      WHERE cliente_id = ?
      ORDER BY created_at DESC
    `, {
      replacements: [clienteId],
      type: QueryTypes.SELECT
    });

    return rows.map(row => ({
      ...row,
      datos_cliente: JSON.parse(row.datos_cliente),
      datos_vehiculo: JSON.parse(row.datos_vehiculo),
      datos_financiamiento: JSON.parse(row.datos_financiamiento),
      datos_seguro: JSON.parse(row.datos_seguro)
    }));
  },

  // Actualizar contrato
  update: async (id, contratoData) => {
    const {
      datos_cliente,
      datos_vehiculo,
      datos_financiamiento,
      datos_seguro,
      contrato_texto,
      estado
    } = contratoData;

    await db.query(`
      UPDATE contratos_financiamiento 
      SET datos_cliente = ?,
          datos_vehiculo = ?,
          datos_financiamiento = ?,
          datos_seguro = ?,
          contrato_texto = ?,
          estado = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, {
      replacements: [
        JSON.stringify(datos_cliente),
        JSON.stringify(datos_vehiculo),
        JSON.stringify(datos_financiamiento),
        JSON.stringify(datos_seguro),
        contrato_texto,
        estado,
        id
      ],
      type: QueryTypes.UPDATE
    });
  },

  // Eliminar contrato (soft delete)
  delete: async (id) => {
    await db.query(`
      UPDATE contratos_financiamiento 
      SET estado = 'eliminado'
      WHERE id = ?
    `, {
      replacements: [id],
      type: QueryTypes.UPDATE
    });
  }
};

module.exports = Contrato;