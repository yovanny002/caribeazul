// models/PrestamoEspecial.js
const db = require('./db');

const PrestamoEspecial = {
  findAll: async (options = {}) => {
    let query = `
      SELECT pe.*, c.nombre, c.apellidos
      FROM prestamos_especiales pe
      JOIN clientes c ON pe.cliente_id = c.id
    `;
    
    const replacements = {};
    
    // Filtros
    if (options.where) {
      const whereClauses = [];
      
      if (options.where.cliente_id) {
        whereClauses.push('pe.cliente_id = :cliente_id');
        replacements.cliente_id = options.where.cliente_id;
      }
      
      if (options.where.estado) {
        whereClauses.push('pe.estado = :estado');
        replacements.estado = options.where.estado;
      }
      
      if (whereClauses.length > 0) {
        query += ' WHERE ' + whereClauses.join(' AND ');
      }
    }
    
    // Orden
    if (options.order) {
      const [column, direction] = options.order[0];
      query += ` ORDER BY ${column} ${direction}`;
    } else {
      query += ' ORDER BY pe.fecha_creacion DESC';
    }
    
    // Paginación
    if (options.limit) {
      query += ' LIMIT :limit';
      replacements.limit = options.limit;
      
      if (options.offset) {
        query += ' OFFSET :offset';
        replacements.offset = options.offset;
      }
    }
    
    const [rows] = await db.query(query, { replacements });
    return rows;
  },

  findById: async (id) => {
    const [rows] = await db.query(`
      SELECT pe.*, c.nombre, c.apellidos, c.cedula
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
      estado = 'pendiente',
      capital_restante,
      fecha_creacion = new Date()
    } = prestamo;

    const [result] = await db.query(`
      INSERT INTO prestamos_especiales
      (cliente_id, ruta_id, monto_solicitado, monto_aprobado, interes_porcentaje, 
       forma_pago, estado, capital_restante, fecha_creacion)
      VALUES 
      (:cliente_id, :ruta_id, :monto_solicitado, :monto_aprobado, :interes_porcentaje, 
       :forma_pago, :estado, :capital_restante, :fecha_creacion)
    `, {
      replacements: {
        cliente_id,
        ruta_id,
        monto_solicitado,
        monto_aprobado,
        interes_porcentaje,
        forma_pago,
        estado,
        capital_restante,
        fecha_creacion
      }
    });

    return result.insertId;
  },

  update: async (id, updateData) => {
    const fields = [];
    const replacements = { id };
    
    Object.keys(updateData).forEach(key => {
      fields.push(`${key} = :${key}`);
      replacements[key] = updateData[key];
    });
    
    if (fields.length === 0) {
      throw new Error('No hay datos para actualizar');
    }
    
    const query = `
      UPDATE prestamos_especiales
      SET ${fields.join(', ')}
      WHERE id = :id
    `;
    
    await db.query(query, { replacements });
    return true;
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

findAllWithClienteYRuta: async (options = {}) => {
    try {
      let query = `
        SELECT 
          pe.id,
          pe.cliente_id,
          pe.ruta_id,
          pe.monto_solicitado,
          pe.monto_aprobado,
          pe.interes_porcentaje,
          pe.forma_pago,
          pe.estado,
          pe.created_at,
          COALESCE(c.nombre, '') AS cliente_nombre,
          COALESCE(c.apellidos, '') AS cliente_apellidos,
          COALESCE(c.cedula, '') AS cliente_cedula,
          COALESCE(r.zona, '') AS ruta_zona,
          COALESCE(r.nombre, '') AS ruta_nombre
        FROM prestamos_especiales pe
        LEFT JOIN clientes c ON pe.cliente_id = c.id AND c.estado = 'activo'
        LEFT JOIN rutas r ON pe.ruta_id = r.id AND r.activo = true
      `;

      const replacements = {};
      const whereClauses = [];

      if (options.where) {
        if (options.where.estado) {
          whereClauses.push('pe.estado = :estado');
          replacements.estado = options.where.estado;
        }
        if (options.where.cliente_id) {
          whereClauses.push('pe.cliente_id = :cliente_id');
          replacements.cliente_id = options.where.cliente_id;
        }
      }

      if (whereClauses.length > 0) {
        query += ` WHERE ${whereClauses.join(' AND ')}`;
      }

      query += ' ORDER BY pe.created_at DESC';

      const [rows] = await db.query(query, { replacements });
      return rows || [];
    } catch (error) {
      console.error('Error en findAllWithClienteYRuta:', error);
      throw error;
    }
  },


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
  
  if (rows[0]) {
    // Convertir valores numéricos
    rows[0].monto_aprobado = Number(rows[0].monto_aprobado) || 0;
    rows[0].capital_restante = Number(rows[0].capital_restante) || 0;
    rows[0].interes_porcentaje = Number(rows[0].interes_porcentaje) || 0;
  }
  
  return rows[0];
},
  calcularInteres: (monto, porcentaje) => {
    return monto * (porcentaje / 100);
  },
    update: async (id, updateData) => {
    const fields = [];
    const replacements = { id };
    
    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        fields.push(`${key} = :${key}`);
        replacements[key] = updateData[key];
      }
    });
    
    if (fields.length === 0) {
      throw new Error('No hay datos para actualizar');
    }
    
    await db.query(
      `UPDATE prestamos_especiales SET ${fields.join(', ')} WHERE id = :id`,
      { replacements }
    );
  }
};



module.exports = PrestamoEspecial;