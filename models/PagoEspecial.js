// models/PagoEspecial.js
const db = require('./db');

const PagoEspecial = {
  findAll: async (options = {}) => {
    let query = `SELECT * FROM pagos_especiales`;
    const replacements = {};

    if (options.where) {
      const whereClauses = [];
      
      if (options.where.prestamo_id) {
        whereClauses.push('prestamo_id = :prestamo_id');
        replacements.prestamo_id = options.where.prestamo_id;
      }
      
      if (whereClauses.length > 0) {
        query += ' WHERE ' + whereClauses.join(' AND ');
      }
    }

    if (options.order) {
      const [column, direction] = options.order[0];
      query += ` ORDER BY ${column} ${direction}`;
    } else {
      query += ' ORDER BY fecha DESC';
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

// models/PagoEspecial.js
findAllByPrestamoId: async (prestamoId) => {
  try {
    const [rows] = await db.query(`
      SELECT * FROM pagos_especiales 
      WHERE prestamo_id = :prestamoId
      ORDER BY fecha DESC
    `, {
      replacements: { prestamoId },
      type: db.QueryTypes.SELECT
    });
    return rows || [];
  } catch (error) {
    console.error('Error en findAllByPrestamoId:', error);
    return [];
  }
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

    // Validar que el monto sea positivo
    if (monto <= 0) {
      throw new Error('El monto del pago debe ser mayor que cero');
    }

    // Validar que la suma de capital e interés sea igual al monto
    if (Math.abs((interes_pagado + capital_pagado) - monto) > 0.01) {
      throw new Error('La suma de capital e interés debe ser igual al monto total');
    }

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
  },

  calcularDistribucionPago: (monto, interesPorcentaje, capitalRestante) => {
    const interes = capitalRestante * (interesPorcentaje / 100);
    const interesPagado = Math.min(monto, interes);
    const capitalPagado = monto - interesPagado;
    
    return { interesPagado, capitalPagado };
  }
};

module.exports = PagoEspecial;