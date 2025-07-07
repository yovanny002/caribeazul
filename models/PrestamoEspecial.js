const db = require('./db');

const PrestamoEspecial = {
  findAll: async () => {
    const [rows] = await db.query(`
      SELECT pe.*, c.nombre, c.apellidos
      FROM prestamos_especiales pe
      JOIN clientes c ON pe.cliente_id = c.id
    `);
    return rows;
  },

  findById: async (id) => {
    const [rows] = await db.query(`
      SELECT pe.*, c.nombre, c.apellidos
      FROM prestamos_especiales pe
      JOIN clientes c ON pe.cliente_id = c.id
      WHERE pe.id = :id
    `, {
      replacements: { id }
    });
    return rows[0];
  },

  create: async (prestamo) => {
    const {
      cliente_id,
      ruta_id = null,
      monto_solicitado,
      monto_aprobado,
      interes_porcentaje,
      forma_pago,
      estado = 'pendiente'
    } = prestamo;

    const [result] = await db.query(`
      INSERT INTO prestamos_especiales
      (cliente_id, ruta_id, monto_solicitado, monto_aprobado, interes_porcentaje, forma_pago, estado)
      VALUES (:cliente_id, :ruta_id, :monto_solicitado, :monto_aprobado, :interes_porcentaje, :forma_pago, :estado)
    `, {
      replacements: {
        cliente_id,
        ruta_id,
        monto_solicitado,
        monto_aprobado,
        interes_porcentaje,
        forma_pago,
        estado
      }
    });

    return result.insertId;
  },

  updateCapital: async (id, nuevoCapital) => {
    await db.query(`
      UPDATE prestamos_especiales
      SET capital_restante = :nuevoCapital
      WHERE id = :id
    `, {
      replacements: { id, nuevoCapital }
    });
  },

  // Método necesario para listar con cliente y ruta (evitar error)
  findAllWithClienteYRuta: async () => {
    const [rows] = await db.query(`
      SELECT pe.*, 
             c.nombre AS cliente_nombre, c.apellidos AS cliente_apellidos, c.cedula AS cliente_cedula,
             r.zona AS ruta_zona, r.nombre AS ruta_nombre
      FROM prestamos_especiales pe
      LEFT JOIN clientes c ON pe.cliente_id = c.id
      LEFT JOIN rutas r ON pe.ruta_id = r.id
    `);
    return rows;
  },

  // Método para obtener un préstamo por ID con cliente y ruta
  findByIdWithClienteYRuta: async (id) => {
    const [rows] = await db.query(`
      SELECT pe.*, 
             c.nombre AS cliente_nombre, c.apellidos AS cliente_apellidos, c.cedula AS cliente_cedula,
             r.zona AS ruta_zona, r.nombre AS ruta_nombre
      FROM prestamos_especiales pe
      LEFT JOIN clientes c ON pe.cliente_id = c.id
      LEFT JOIN rutas r ON pe.ruta_id = r.id
      WHERE pe.id = :id
    `, {
      replacements: { id }
    });
    return rows[0];
  }
};

module.exports = PrestamoEspecial;
// este es el modelo