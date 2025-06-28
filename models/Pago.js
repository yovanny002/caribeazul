  const db = require('./db');
  const { QueryTypes } = require('sequelize');

  const Pago = {
    findByPrestamo: async (prestamoId) => {
      try {
        const rows = await db.query(`
          SELECT * FROM pagos
          WHERE prestamo_id = :prestamoId
          ORDER BY fecha DESC
        `, {
          replacements: { prestamoId },
          type: QueryTypes.SELECT
        });
        return rows;
      } catch (error) {
        console.error(`Error en findByPrestamo(${prestamoId}):`, error);
        throw error;
      }
    },

    create: async (data) => {
      const { prestamo_id, cuota_id, monto, metodo, notas, registrado_por } = data;
      
      const result = await db.query(`
        INSERT INTO pagos 
        (prestamo_id, cuota_id, monto, metodo, notas, registrado_por, fecha)
        VALUES (?, ?, ?, ?, ?, ?, NOW())
      `, {
        replacements: [prestamo_id, cuota_id, monto, metodo, notas || null, registrado_por],
        type: QueryTypes.INSERT
      });
      
      return result[0]; // Retorna el ID del pago insertado
    }
  };

  module.exports = Pago;