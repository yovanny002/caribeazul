const db = require('./db');

const Reenganche = {
  // Verifica si el cliente puede solicitar reenganche
  verificarElegibilidad: async (clienteId) => {
    const [result] = await db.query(`
      SELECT 
        sp.id AS prestamo_id,
        SUM(p.monto) AS total_pagado,
        (sp.monto_por_cuota * sp.cuotas) AS total_deuda,
        ROUND((SUM(p.monto) / (sp.monto_por_cuota * sp.cuotas)) * 100, 2) AS porcentaje_pagado
      FROM solicitudes_prestamos sp
      LEFT JOIN pagos p ON sp.id = p.prestamo_id AND p.estado = 'pagado'
      WHERE sp.cliente_id = ? AND sp.estado = 'aprobado'
      GROUP BY sp.id
      ORDER BY sp.created_at DESC
      LIMIT 1
    `, [clienteId]);

    return result[0] || null;
  },

  // Crea una solicitud de reenganche
  crearSolicitud: async ({ prestamo_id, cliente_id, motivo }) => {
    const [result] = await db.query(`
      INSERT INTO solicitudes_reenganche (prestamo_id, cliente_id, motivo)
      VALUES (?, ?, ?)
    `, [prestamo_id, cliente_id, motivo]);

    return result.insertId;
  },

  // Lista todas las solicitudes de reenganche
  obtenerSolicitudes: async () => {
    const [rows] = await db.query(`
      SELECT sr.*, c.nombre, c.apellidos, sp.monto_solicitado
      FROM solicitudes_reenganche sr
      JOIN clientes c ON sr.cliente_id = c.id
      JOIN solicitudes_prestamos sp ON sr.prestamo_id = sp.id
      ORDER BY sr.created_at DESC
    `);
    return rows;
  },

  // Actualiza el estado de una solicitud (aprobado/rechazado)
  actualizarEstado: async (id, estado) => {
    await db.query(`
      UPDATE solicitudes_reenganche SET estado = ? WHERE id = ?
    `, [estado, id]);
  }
};

module.exports = Reenganche;
