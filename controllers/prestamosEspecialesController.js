const PrestamoEspecial = require('../models/PrestamoEspecial');
const PagoEspecial = require('../models/PagoEspecial');
const Cliente = require('../models/Cliente');
const Ruta = require('../models/Ruta');
const moment = require('moment');

// Listar todos los préstamos especiales
// Ejemplo al listar todos los préstamos
exports.index = async (req, res) => {
  try {
    let prestamos = await PrestamoEspecial.findAllWithClienteYRuta();

    prestamos = prestamos.map(p => ({
      ...p,
      monto_aprobado: Number(p.monto_aprobado) || 0,
      capital_restante: Number(p.capital_restante) || 0,
      interes_porcentaje: Number(p.interes_porcentaje) || 0,
    }));

    res.render('prestamosEspeciales/index', { prestamos, title: 'Préstamos Especiales' });
  } catch (error) {
    console.error('Error al listar préstamos especiales:', error);
    req.flash('error', 'No se pudieron cargar los préstamos especiales.');
    res.redirect('/');
  }
};



// Mostrar formulario para crear préstamo especial
const createForm = async (req, res) => {
  try {
    const clientes = await Cliente.findAll();
    const rutas = await Ruta.findAll();

    res.render('prestamosEspeciales/create', {
      clientes,
      rutas,
      title: 'Crear Préstamo Especial'
    });
  } catch (error) {
    console.error('Error al cargar formulario de préstamo especial:', error);
    req.flash('error', 'No se pudo cargar el formulario de préstamo especial');
    res.redirect('/prestamos-especiales');
  }
};

// Crear un nuevo préstamo especial
// Controlador para crear préstamo especial
exports.create = async (req, res) => {
  try {
    const prestamoData = {
      cliente_id: req.body.cliente_id,
      ruta_id: req.body.ruta_id || null,
      monto_solicitado: Number(req.body.monto_solicitado) || 0,
      monto_aprobado: Number(req.body.monto_aprobado) || 0,
      interes_porcentaje: Number(req.body.interes_porcentaje) || 0,
      forma_pago: req.body.forma_pago,
      estado: 'pendiente', // o el que uses por defecto
      capital_restante: Number(req.body.monto_aprobado) || 0, // si usas capital_restante
    };

    const prestamoId = await PrestamoEspecial.create(prestamoData);

    req.flash('success', 'Préstamo especial creado correctamente');
    res.redirect('/prestamos-especiales');
  } catch (error) {
    console.error('Error al crear préstamo especial:', error);
    req.flash('error', 'Error al crear préstamo especial: ' + error.message);
    res.redirect('/prestamos-especiales/nuevo'); // o ruta de formulario
  }
};

// Mostrar detalle de un préstamo especial
const show = async (req, res) => {
  try {
    const prestamo = await PrestamoEspecial.findByIdWithClienteYRuta(req.params.id);

    if (!prestamo) {
      req.flash('error', 'Préstamo especial no encontrado.');
      return res.redirect('/prestamos-especiales');
    }

    const pagos = await PagoEspecial.findAllByPrestamoId(prestamo.id);

    res.render('prestamosEspeciales/show', {
      prestamo,
      pagos,
      moment,
      title: 'Detalle del Préstamo Especial',
      messages: req.flash()
    });
  } catch (error) {
    console.error('Error al cargar detalle:', error);
    req.flash('error', 'Error al mostrar el préstamo especial.');
    res.redirect('/prestamos-especiales');
  }
};

// Exportar todo como objeto
module.exports = {
  index,
  createForm,
  create,
  show
  // Agrega aquí `editForm`, `update`, `delete`, `pagoForm`, `procesarPago`, etc. cuando los implementes.
};
