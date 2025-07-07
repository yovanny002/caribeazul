const PrestamoEspecial = require('../models/PrestamoEspecial');
const PagoEspecial = require('../models/PagoEspecial'); // Asumo que tienes este modelo para pagos
const moment = require('moment');

// Listar todos los préstamos especiales
// Listar todos los préstamos especiales
exports.index = async (req, res) => {
  try {
    const prestamos = await PrestamoEspecial.findAll();
    res.render('prestamosEspeciales/index', {
      prestamos,
      title: 'Préstamos Especiales',
      messages: req.flash()
    });
  } catch (error) {
    console.error('Error al listar préstamos especiales:', error);
    req.flash('error', 'No se pudieron cargar los préstamos especiales.');
    res.redirect('/');
  }
};

// Mostrar formulario para crear préstamo especial
exports.createForm = async (req, res) => {
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
exports.create = async (req, res) => {
  try {
    const prestamoId = await PrestamoEspecial.create(req.body);
    req.flash('success', 'Préstamo especial creado correctamente');
    res.redirect('/prestamos-especiales');
  } catch (error) {
    console.error('Error al crear préstamo especial:', error);
    req.flash('error', 'Error al crear préstamo especial: ' + error.message);
    res.redirect('/prestamos-especiales/create');
  }
};

// Mostrar detalle de un préstamo especial
// Mostrar detalle de un préstamo especial
exports.show = async (req, res) => {
  try {
    const prestamo = await PrestamoEspecial.findById(req.params.id);
    if (!prestamo) {
      req.flash('error', 'Préstamo especial no encontrado.');
      return res.redirect('/prestamos-especiales');
    }

    const pagos = await PagoEspecial.findAll({
      where: { prestamo_id: prestamo.id },
      order: [['fecha', 'DESC']]
    });

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

// Formulario para editar préstamo especial
exports.editForm = async (req, res) => {
  try {
    const prestamo = await PrestamoEspecial.findByIdWithClienteYRuta(req.params.id);
    const clientes = await Cliente.findAll();
    const rutas = await Ruta.findAll();

    if (!prestamo) {
      req.flash('error', 'Préstamo especial no encontrado.');
      return res.redirect('/prestamos-especiales');
    }

    res.render('prestamosEspeciales/edit', {
      prestamo,
      clientes,
      rutas,
      title: 'Editar Préstamo Especial',
      messages: req.flash()
    });
  } catch (error) {
    console.error('Error al cargar formulario de edición:', error);
    req.flash('error', 'No se pudo cargar el préstamo especial');
    res.redirect('/prestamos-especiales');
  }
};

// Actualizar préstamo especial
exports.update = async (req, res) => {
  const id = req.params.id;
  const {
    cliente_id,
    ruta_id,
    monto_solicitado,
    monto_aprobado,
    interes_porcentaje,
    forma_pago,
    estado
  } = req.body;

  try {
    await PrestamoEspecial.update(id, {
      cliente_id,
      ruta_id,
      monto_solicitado,
      monto_aprobado,
      interes_porcentaje,
      forma_pago,
      estado
    });

    req.flash('success', 'Préstamo especial actualizado correctamente');
    res.redirect('/prestamos-especiales');
  } catch (error) {
    console.error('Error al actualizar préstamo especial:', error);
    req.flash('error', 'No se pudo actualizar el préstamo especial');
    res.redirect(`/prestamos-especiales/${id}/edit`);
  }
};

// Eliminar préstamo especial
exports.delete = async (req, res) => {
  const id = req.params.id;
  try {
    await PrestamoEspecial.delete(id);
    req.flash('success', 'Préstamo especial eliminado correctamente');
    res.redirect('/prestamos-especiales');
  } catch (error) {
    console.error('Error al eliminar préstamo especial:', error);
    req.flash('error', 'No se pudo eliminar el préstamo especial');
    res.redirect('/prestamos-especiales');
  }
};
