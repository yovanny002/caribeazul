const db = require('../db');
const { QueryTypes } = require('sequelize');
const PrestamoInteres = require('../models/PrestamoInteres');
const moment = require('moment');

function safeParseFloat(valor) {
  const num = parseFloat(valor);
  return isNaN(num) ? 0 : num;
}
exports.index = async (req, res) => {
  try {
    const estado = req.query.estado || null;
    const prestamos = await PrestamoInteres.findAllWithClientes(estado);
    
    res.render('prestamos_interes/index', {
      prestamos,
      moment,
      estadoFiltro: estado
    });
  } catch (error) {
    console.error('Error al listar préstamos:', error);
    req.flash('error', 'Error al listar préstamos');
    res.redirect('/');
  }
};

exports.show = async (req, res) => {
  try {
    const prestamo = await PrestamoInteres.findById(req.params.id);
    if (!prestamo) {
      req.flash('error', 'Préstamo no encontrado');
      return res.redirect('/prestamos_interes');
    }

    const pagos = await PrestamoInteres.getHistorialPagos(req.params.id);
    
    res.render('prestamos_interes/show', {
      prestamo,
      pagos,
      moment
    });
  } catch (error) {
    console.error('Error al mostrar préstamo:', error);
    req.flash('error', 'Error al mostrar préstamo');
    res.redirect('/prestamos_interes');
  }
};

exports.createForm = async (req, res) => {
  try {
    // Obtener listado de clientes y rutas desde la base de datos
    const [clientes, rutas] = await Promise.all([
      db.query('SELECT id, nombre, apellidos, cedula, profesion FROM clientes ORDER BY nombre', {
        type: QueryTypes.SELECT
      }),
      db.query('SELECT id, nombre, zona FROM rutas ORDER BY nombre', {
        type: QueryTypes.SELECT
      })
    ]);

    res.render('prestamos_interes/create', {
      clientes,
      rutas,
      body: req.body || {} // Para repoblar el formulario en caso de error
    });
  } catch (error) {
    console.error('Error al cargar formulario de préstamo:', error);
    req.flash('error', 'Error al cargar formulario de préstamo');
    res.redirect('/prestamos_intereses');
  }
};

exports.create = async (req, res) => {
  try {
    // Convertir el interés manual a quincenal si es necesario
    if (req.body.frecuencia_interes === 'quincenal' && req.body.interes_manual) {
      req.body.interes_manual = safeParseFloat(req.body.interes_manual) / 2;
    }
    
    const prestamoId = await PrestamoInteres.create(req.body);
    req.flash('success', 'Préstamo creado exitosamente');
    res.redirect(`/prestamos_interes/${prestamoId}`);
  } catch (error) {
    console.error('Error al crear préstamo:', error);
    req.flash('error', 'Error al crear préstamo: ' + error.message);
    res.redirect('/prestamos_interes/create');
  }
};

exports.pagoForm = async (req, res) => {
  try {
    const prestamo = await PrestamoInteres.findById(req.params.id);
    if (!prestamo) {
      req.flash('error', 'Préstamo no encontrado');
      return res.redirect('/prestamos_interes');
    }
    
    res.render('prestamos_interes/pago', { prestamo });
  } catch (error) {
    console.error('Error al mostrar formulario de pago:', error);
    req.flash('error', 'Error al cargar formulario de pago');
    res.redirect(`/prestamos_interes/${req.params.id}`);
  }
};

exports.registrarPago = async (req, res) => {
  try {
    const pagoData = {
      ...req.body,
      prestamo_id: req.params.id,
      registrado_por: req.user ? req.user.nombre : 'Sistema'
    };
    
    await PrestamoInteres.registrarPago(pagoData);
    req.flash('success', 'Pago registrado exitosamente');
    res.redirect(`/prestamos_interes/${req.params.id}`);
  } catch (error) {
    console.error('Error al registrar pago:', error);
    req.flash('error', 'Error al registrar pago: ' + error.message);
    res.redirect(`/prestamos_interes/${req.params.id}/pago`);
  }
};

exports.recibo = async (req, res) => {
  try {
    const pagoId = req.params.pagoId;
    const [pago] = await db.query(`
      SELECT p.*, pi.monto_aprobado, pi.interes_porcentaje, 
             c.nombre AS cliente_nombre, c.apellidos AS cliente_apellidos,
             c.cedula AS cliente_cedula
      FROM pagos_interes p
      JOIN prestamos_interes pi ON p.prestamo_id = pi.id
      JOIN clientes c ON pi.cliente_id = c.id
      WHERE p.id = :pagoId
    `, {
      replacements: { pagoId },
      type: QueryTypes.SELECT
    });

    if (!pago) {
      req.flash('error', 'Recibo no encontrado');
      return res.redirect('/prestamos_interes');
    }

    res.render('prestamos_interes/recibo', {
      pago,
      moment,
      formatCurrency: (amount) => `RD$ ${parseFloat(amount).toFixed(2)}`
    });
  } catch (error) {
    console.error('Error al generar recibo:', error);
    req.flash('error', 'Error al generar recibo');
    res.redirect(`/prestamos_interes/${req.params.id}`);
  }
};