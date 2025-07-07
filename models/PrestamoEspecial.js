const db = require('./db');

const PrestamoEspecial = {
  /**
   * Busca todos los préstamos especiales con opciones de filtrado
   */
  findAll: async (options = {}) => {
    const {
      where = {},
      order = [['fecha_creacion', 'DESC']],
      limit,
      offset
    } = options;

    let query = `
      SELECT pe.*, c.nombre, c.apellidos
      FROM prestamos_especiales pe
      JOIN clientes c ON pe.cliente_id = c.id
    `;
    
    const replacements = {};
    const whereClauses = [];
    
    // Construir condiciones WHERE
    if (where.cliente_id) {
      whereClauses.push('pe.cliente_id = :cliente_id');
      replacements.cliente_id = where.cliente_id;
    }
    
    if (where.estado) {
      whereClauses.push('pe.estado = :estado');
      replacements.estado = where.estado;
    }

    if (whereClauses.length > 0) {
      query += ` WHERE ${whereClauses.join(' AND ')}`;
    }
    
    // Ordenación
    const [orderField, orderDirection] = order[0];
    query += ` ORDER BY ${orderField} ${orderDirection}`;
    
    // Paginación
    if (limit !== undefined) {
      query += ' LIMIT :limit';
      replacements.limit = limit;
      
      if (offset !== undefined) {
        query += ' OFFSET :offset';
        replacements.offset = offset;
      }
    }
    
    const [rows] = await db.query(query, { replacements });
    return rows;
  },

  /**
   * Busca un préstamo especial por ID con información básica del cliente
   */
  findById: async (id) => {
    const [rows] = await db.query(`
      SELECT pe.*, c.nombre, c.apellidos, c.cedula
      FROM prestamos_especiales pe
      JOIN clientes c ON pe.cliente_id = c.id
      WHERE pe.id = :id
    `, {
      replacements: { id }
    });
    
    return rows[0] ? this._formatPrestamo(rows[0]) : null;
  },

  /**
   * Crea un nuevo préstamo especial
   */
  create: async (prestamoData) => {
    const defaults = {
      ruta_id: null,
      estado: 'pendiente',
      capital_restante: prestamoData.monto_aprobado || prestamoData.monto_solicitado,
      fecha_creacion: new Date()
    };

    const prestamo = { ...defaults, ...prestamoData };

    const [result] = await db.query(`
      INSERT INTO prestamos_especiales (
        cliente_id, ruta_id, monto_solicitado, monto_aprobado, 
        interes_porcentaje, forma_pago, estado, capital_restante, fecha_creacion
      ) VALUES (
        :cliente_id, :ruta_id, :monto_solicitado, :monto_aprobado, 
        :interes_porcentaje, :forma_pago, :estado, :capital_restante, :fecha_creacion
      )
    `, {
      replacements: prestamo
    });

    return result.insertId;
  },

  /**
   * Actualiza un préstamo especial
   */
  update: async (id, updateData) => {
    const validFields = [
      'ruta_id', 'monto_solicitado', 'monto_aprobado', 'interes_porcentaje',
      'forma_pago', 'estado', 'capital_restante'
    ];

    const fieldsToUpdate = {};
    validFields.forEach(field => {
      if (updateData[field] !== undefined) {
        fieldsToUpdate[field] = updateData[field];
      }
    });

    if (Object.keys(fieldsToUpdate).length === 0) {
      throw new Error('No hay datos válidos para actualizar');
    }

    const setClauses = [];
    const replacements = { id };
    
    Object.keys(fieldsToUpdate).forEach(key => {
      setClauses.push(`${key} = :${key}`);
      replacements[key] = fieldsToUpdate[key];
    });

    await db.query(`
      UPDATE prestamos_especiales
      SET ${setClauses.join(', ')}
      WHERE id = :id
    `, { replacements });

    return true;
  },

  /**
   * Actualiza solo el capital restante de un préstamo
   */
  updateCapital: async (id, nuevoCapital) => {
    if (isNaN(nuevoCapital) || nuevoCapital < 0) {
      throw new Error('El capital debe ser un número válido');
    }

    await db.query(`
      UPDATE prestamos_especiales
      SET capital_restante = :capital
      WHERE id = :id
    `, {
      replacements: { id, capital: nuevoCapital }
    });
  },

  /**
   * Busca préstamos con información completa de cliente y ruta
   */
  findAllWithClienteYRuta: async (options = {}) => {
    const { where = {} } = options;
    
    let query = `
      SELECT 
        pe.*,
        c.nombre AS cliente_nombre,
        c.apellidos AS cliente_apellidos,
        c.cedula AS cliente_cedula,
        r.zona AS ruta_zona,
        r.nombre AS ruta_nombre
      FROM prestamos_especiales pe
      LEFT JOIN clientes c ON pe.cliente_id = c.id
      LEFT JOIN rutas r ON pe.ruta_id = r.id
    `;

    const replacements = {};
    const whereClauses = [];

    if (where.estado) {
      whereClauses.push('pe.estado = :estado');
      replacements.estado = where.estado;
    }

    if (where.cliente_id) {
      whereClauses.push('pe.cliente_id = :cliente_id');
      replacements.cliente_id = where.cliente_id;
    }

    if (whereClauses.length > 0) {
      query += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    query += ' ORDER BY pe.fecha_creacion DESC';

    const [rows] = await db.query(query, { replacements });
    return rows.map(this._formatPrestamo);
  },

  /**
   * Busca un préstamo por ID con información completa de cliente y ruta
   */
  findByIdWithClienteYRuta: async (id) => {
    const [rows] = await db.query(`
      SELECT 
        pe.*,
        c.nombre AS cliente_nombre,
        c.apellidos AS cliente_apellidos,
        c.cedula AS cliente_cedula,
        r.zona AS ruta_zona,
        r.nombre AS ruta_nombre
      FROM prestamos_especiales pe
      LEFT JOIN clientes c ON pe.cliente_id = c.id
      LEFT JOIN rutas r ON pe.ruta_id = r.id
      WHERE pe.id = :id
    `, {
      replacements: { id }
    });

    return rows[0] ? this._formatPrestamo(rows[0]) : null;
  },

  /**
   * Calcula el interés para un monto dado
   */
  calcularInteres: (monto, porcentaje) => {
    if (isNaN(monto)) throw new Error('Monto debe ser un número') ;
    if (isNaN(porcentaje)) throw new Error('Porcentaje debe ser un número');
    
    return monto * (porcentaje / 100);
  },

  /**
   * Formatea los valores numéricos del préstamo
   */
  _formatPrestamo: (prestamo) => {
    return {
      ...prestamo,
      monto_solicitado: Number(prestamo.monto_solicitado) || 0,
      monto_aprobado: Number(prestamo.monto_aprobado) || 0,
      capital_restante: Number(prestamo.capital_restante) || 0,
      interes_porcentaje: Number(prestamo.interes_porcentaje) || 0
    };
  }
};

module.exports = PrestamoEspecial;