const db = require('./db');

const PagoEspecial = {
  findAll: async (options = {}) => {
    let query = `SELECT * FROM pagos_especiales`;
    const replacements = {};

    if (options.where && options.where.prestamo_id) {
      query += ` WHERE prestamo_id = :prestamo_id`;
      replacements.prestamo_id = options.where.prestamo_id;
    }

    if (options.order) {
      const [col, dir] = options.order[0];
      query += ` ORDER BY ${col} ${dir}`;
    }

    const [rows] = await db.query(query, { replacements });
    return rows;
  },

  findByPk: async (id) => {
    const [rows] = await db.query(`
      SELECT * FROM pagos_especiales WHERE id = :id
    `, {
      replacements: { id }
    });
    return rows[0];
  },

  create: async (pago) => {
    const {
      prestamo_id,
      monto,
      interes_pagado = 0,
      capital_pagado = 0,
      metodo = 'efectivo',
      referencia = '',
      fecha = new Date(),
      registrado_por = 'Sistema'
    } = pago;

    const [result] = await db.query(`
      INSERT INTO pagos_especiales
      (prestamo_id, monto, interes_pagado, capital_pagado, metodo, referencia, fecha, registrado_por)
      VALUES (:prestamo_id, :monto, :interes_pagado, :capital_pagado, :metodo, :referencia, :fecha, :registrado_por)
    `, {
      replacements: {
        prestamo_id,
        monto,
        interes_pagado,
        capital_pagado,
        metodo,
        referencia,
        fecha,
        registrado_por
      }
    });

    return result.insertId;
  }
};

module.exports = PagoEspecial;
