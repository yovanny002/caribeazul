const db = require('./db');
const { QueryTypes } = require('sequelize');

const Cliente = {
  findAll: async () => {
    try {
      const rows = await db.query('SELECT * FROM clientes', {
        type: QueryTypes.SELECT
      });
      return rows;
    } catch (error) {
      console.error('Error en findAll clientes:', error.message);
      throw error;
    }
  },

  findById: async (id) => {
    try {
      const rows = await db.query('SELECT * FROM clientes WHERE id = :id', {
        replacements: { id },
        type: QueryTypes.SELECT
      });
      return rows[0] || null;
    } catch (error) {
      console.error(`Error en findById cliente (${id}):`, error.message);
      throw error;
    }
  },

  create: async (cliente) => {
    const {
      nombre,
      apellidos,
      profesion = null,
      cedula = null,
      telefono1 = null,
      telefono2 = null,
      direccion = null,
      estado = 'activo',
      apodo = null,
      foto = null
    } = cliente;

    try {
      const result = await db.query(
        `INSERT INTO clientes
         (nombre, apellidos, profesion, cedula, telefono1, telefono2, direccion, estado, apodo, foto)
         VALUES (:nombre, :apellidos, :profesion, :cedula, :telefono1, :telefono2, :direccion, :estado, :apodo, :foto)
         RETURNING id`,
        {
          replacements: {
            nombre,
            apellidos,
            profesion,
            cedula,
            telefono1,
            telefono2,
            direccion,
            estado,
            apodo,
            foto
          },
          type: QueryTypes.INSERT
        }
      );
      return result[0]?.id || null;
    } catch (error) {
      console.error('Error al crear cliente:', error.message);
      throw error;
    }
  },

  update: async (id, cliente) => {
    const {
      nombre,
      apellidos,
      profesion,
      cedula,
      telefono1,
      telefono2,
      direccion,
      estado = 'activo',
      apodo,
      foto
    } = cliente;

    try {
      await db.query(
        `UPDATE clientes SET
         nombre = :nombre,
         apellidos = :apellidos,
         profesion = :profesion,
         cedula = :cedula,
         telefono1 = :telefono1,
         telefono2 = :telefono2,
         direccion = :direccion,
         estado = :estado,
         apodo = :apodo,
         foto = :foto
         WHERE id = :id`,
        {
          replacements: {
            id,
            nombre,
            apellidos,
            profesion,
            cedula,
            telefono1,
            telefono2,
            direccion,
            estado,
            apodo,
            foto
          },
          type: QueryTypes.UPDATE
        }
      );
    } catch (error) {
      console.error(`Error al actualizar cliente (${id}):`, error.message);
      throw error;
    }
  }
};

module.exports = Cliente;
