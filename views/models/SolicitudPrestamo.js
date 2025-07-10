// models/SolicitudPrestamo.js
const db = require('./db');

const SolicitudPrestamo = {
  findByIdWithCliente: async (id) => {
    const [rows] = await db.query(
      `SELECT sp.*, c.nombre AS cliente_nombre, c.apellidos AS cliente_apellidos,
        c.apodo AS cliente_apodo, c.cedula AS cliente_cedula, c.telefono1 AS cliente_telefono1,
        c.telefono2 AS cliente_telefono2, c.direccion AS cliente_direccion
       FROM solicitudes_prestamos sp
       JOIN clientes c ON sp.cliente_id = c.id
       WHERE sp.id = :id`,
      { replacements: { id } }
    );
    return rows[0];
  },

  // Puedes agregar otras funciones aquí igual que en Cliente
};

module.exports = SolicitudPrestamo;
