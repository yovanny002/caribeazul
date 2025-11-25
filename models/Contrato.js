const db = require('./db');
const { QueryTypes } = require('sequelize');
const moment = require('moment');

module.exports = {

  // ============================================================
  // LISTAR TODOS LOS CONTRATOS
  // ============================================================
  getAll: async () => {
    try {
      const contratos = await db.query(`
        SELECT 
          c.id,
          c.cliente_id,
          c.prestamo_id,
          c.datos_cliente,
          c.datos_vehiculo,
          c.datos_financiamiento,
          c.datos_seguro,
          c.contrato_texto,
          c.created_at
        FROM contratos_financiamiento c
        ORDER BY c.id DESC
      `, { type: QueryTypes.SELECT });

      return contratos;
    } catch (error) {
      console.error('Error obteniendo contratos:', error);
      throw error;
    }
  },

  // ============================================================
  // OBTENER UN CONTRATO POR ID
  // ============================================================
  getById: async (id) => {
    try {
      const contrato = await db.query(`
        SELECT 
          c.id,
          c.cliente_id,
          c.prestamo_id,
          c.datos_cliente,
          c.datos_vehiculo,
          c.datos_financiamiento,
          c.datos_seguro,
          c.contrato_texto,
          c.created_at
        FROM contratos_financiamiento c
        WHERE c.id = $1
        LIMIT 1
      `, {
        bind: [id],
        type: QueryTypes.SELECT
      });

      return contrato[0] || null;
    } catch (error) {
      console.error('Error obteniendo contrato por ID:', error);
      throw error;
    }
  },

  // ============================================================
  // CREAR CONTRATO
  // ============================================================
  create: async (contratoData) => {
    try {
      const {
        cliente_id,
        prestamo_id,
        datos_cliente,
        datos_vehiculo,
        datos_financiamiento,
        datos_seguro,
        contrato_texto
      } = contratoData;

      const result = await db.query(`
        INSERT INTO contratos_financiamiento 
        (cliente_id, prestamo_id, datos_cliente, datos_vehiculo, datos_financiamiento, datos_seguro, contrato_texto)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `, {
        bind: [
          cliente_id || null,
          prestamo_id || null,
          JSON.stringify(datos_cliente),
          JSON.stringify(datos_vehiculo),
          JSON.stringify(datos_financiamiento),
          JSON.stringify(datos_seguro),
          contrato_texto
        ],
        type: QueryTypes.INSERT
      });

      console.log("Contrato creado con ID:", result[0].id);
      return result[0].id;

    } catch (error) {
      console.error('Error creando contrato:', error);
      throw error;
    }
  },

  // ============================================================
  // ACTUALIZAR CONTRATO
  // ============================================================
  update: async (id, contratoData) => {
    try {
      const {
        cliente_id,
        prestamo_id,
        datos_cliente,
        datos_vehiculo,
        datos_financiamiento,
        datos_seguro,
        contrato_texto
      } = contratoData;

      await db.query(`
        UPDATE contratos_financiamiento
        SET cliente_id = $1,
            prestamo_id = $2,
            datos_cliente = $3,
            datos_vehiculo = $4,
            datos_financiamiento = $5,
            datos_seguro = $6,
            contrato_texto = $7
        WHERE id = $8
      `, {
        bind: [
          cliente_id,
          prestamo_id,
          JSON.stringify(datos_cliente),
          JSON.stringify(datos_vehiculo),
          JSON.stringify(datos_financiamiento),
          JSON.stringify(datos_seguro),
          contrato_texto,
          id
        ],
        type: QueryTypes.UPDATE
      });

      return true;

    } catch (error) {
      console.error('Error actualizando contrato:', error);
      throw error;
    }
  },

  // ============================================================
  // ELIMINAR CONTRATO
  // ============================================================
  delete: async (id) => {
    try {
      await db.query(`
        DELETE FROM contratos_financiamiento
        WHERE id = $1
      `, {
        bind: [id],
        type: QueryTypes.DELETE
      });

      return true;
    } catch (error) {
      console.error('Error eliminando contrato:', error);
      throw error;
    }
  }

};
