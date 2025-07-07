const PrestamoEspecial = require('../models/PrestamoEspecial');
const PagoEspecial = require('../models/PagoEspecial');
const Cliente = require('../models/Cliente');
const Ruta = require('../models/Ruta');
const moment = require('moment');

// Listar todos los préstamos especiales
const index = async (req, res) => {
  try {
    const prestamos = await PrestamoEspecial.findAllWithClienteYRuta();
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
const create = async (req, res) => {
  try {
    await PrestamoEspecial.create(req.body);
    req.flash('success', 'Préstamo especial creado correctamente');
    res.redirect('/prestamos-especiales');
  } catch (error) {
    console.error('Error al crear préstamo especial:', error);
    req.flash('error', 'Error al crear préstamo especial: ' + error.message);
    res.redirect('/prestamos-especiales/nuevo');
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
