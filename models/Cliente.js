const db = require('./db');

const Cliente = {
  findAll: async () => {
    const [rows] = await db.query('SELECT * FROM clientes');
    return rows;
  },

   findById: async (id) => {
    const [rows] = await db.query('SELECT * FROM clientes WHERE id = :id', {
      replacements: { id }
    });
    return rows[0];
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

  const [result] = await db.query(
    `INSERT INTO clientes
    (nombre, apellidos, profesion, cedula, telefono1, telefono2, direccion, estado, apodo, foto)
    VALUES (:nombre, :apellidos, :profesion, :cedula, :telefono1, :telefono2, :direccion, :estado, :apodo, :foto)`,
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
      }
    }
  );
  return result.insertId;
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
      }
    }
  );
}

};

module.exports = Cliente;
