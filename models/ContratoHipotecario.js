const db = require('./db');

const ContratoHipotecario = {
  create: async (payload) => {
    try {
      const {
        cliente_nombre,
        cliente_nacionalidad,
        cliente_ocupacion,
        cliente_tipo_documento,
        cliente_numero_documento,
        cliente_telefono,
        cliente_direccion,
        datos_financiamiento,
        propiedades,
        contrato_texto
      } = payload;

      const result = await db.query(
        `INSERT INTO contratos_hipotecarios
          (cliente_nombre, cliente_nacionalidad, cliente_ocupacion, cliente_tipo_documento, cliente_numero_documento, cliente_telefono, cliente_direccion, datos_financiamiento, propiedades, contrato_texto)
         VALUES
          (:cliente_nombre, :cliente_nacionalidad, :cliente_ocupacion, :cliente_tipo_documento, :cliente_numero_documento, :cliente_telefono, :cliente_direccion, :datos_financiamiento::jsonb, :propiedades::jsonb, :contrato_texto)
         RETURNING id`,
        {
          replacements: {
            cliente_nombre,
            cliente_nacionalidad,
            cliente_ocupacion,
            cliente_tipo_documento,
            cliente_numero_documento,
            cliente_telefono,
            cliente_direccion,
            datos_financiamiento: JSON.stringify(datos_financiamiento || {}),
            propiedades: JSON.stringify(propiedades || []),
            contrato_texto
          }
        }
      );

      return result.rows[0].id;
    } catch (err) {
      console.error('Error creando contrato hipotecario:', err);
      throw err;
    }
  },

  findById: async (id) => {
    try {
      const result = await db.query(
        `SELECT * FROM contratos_hipotecarios WHERE id = :id AND estado != 'eliminado'`,
        { replacements: { id } }
      );
      if (result.rows.length === 0) return null;
      const row = result.rows[0];
      return {
        ...row,
        datos_financiamiento: row.datos_financiamiento || {},
        propiedades: row.propiedades || []
      };
    } catch (err) {
      console.error('Error findById hipoteca:', err);
      throw err;
    }
  },

  findAll: async () => {
    try {
      const result = await db.query(
        `SELECT * FROM contratos_hipotecarios WHERE estado != 'eliminado' ORDER BY created_at DESC`
      );
      return result.rows.map(r => ({
        ...r,
        datos_financiamiento: r.datos_financiamiento || {},
        propiedades: r.propiedades || []
      }));
    } catch (err) {
      console.error('Error findAll hipoteca:', err);
      throw err;
    }
  },

  update: async (id, payload) => {
    try {
      const { datos_financiamiento, propiedades, contrato_texto, estado } = payload;
      await db.query(
        `UPDATE contratos_hipotecarios
         SET datos_financiamiento = :datos_financiamiento::jsonb,
             propiedades = :propiedades::jsonb,
             contrato_texto = :contrato_texto,
             estado = :estado,
             updated_at = NOW()
         WHERE id = :id`,
        {
          replacements: {
            datos_financiamiento: JSON.stringify(datos_financiamiento || {}),
            propiedades: JSON.stringify(propiedades || []),
            contrato_texto,
            estado: estado || 'activo',
            id
          }
        }
      );
      return true;
    } catch (err) {
      console.error('Error update hipoteca:', err);
      throw err;
    }
  },

  delete: async (id) => {
    try {
      await db.query(
        `UPDATE contratos_hipotecarios SET estado = 'eliminado', updated_at = NOW() WHERE id = :id`,
        { replacements: { id } }
      );
      return true;
    } catch (err) {
      console.error('Error delete hipoteca:', err);
      throw err;
    }
  }
};

module.exports = ContratoHipotecario;
