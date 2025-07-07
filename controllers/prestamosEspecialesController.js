const PrestamoEspecial = require('../models/PrestamoEspecial');
const Cliente = require('../models/Cliente');
const Ruta = require('../models/Ruta');
const PagoEspecial = require('../models/PagoEspecial');
const moment = require('moment');

exports.index = async (req, res) => {
  try {
    // Aquí asumo que implementas un método que traiga prestamos con cliente y ruta incluidos
    const prestamos = await PrestamoEspecial.findAllWithClienteYRuta();

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

exports.formulario = async (req, res) => {
  try {
    const clientes = await Cliente.findAll();
    const clientesActivos = clientes.filter(c => c.estado === 'activo');
    const rutas = await Ruta.findAll();

    res.render('prestamosEspeciales/create', { 
      clientes: clientesActivos, 
      rutas, 
      title: 'Nuevo Préstamo Especial' 
    });
  } catch (error) {
    console.error('Error al cargar formulario:', error);
    req.flash('error', 'No se pudo cargar el formulario de préstamo especial.');
    res.redirect('/prestamos-especiales');
  }
};

exports.crear = async (req, res) => {
  try {
    const {
      cliente_id,
      ruta_id,
      monto_solicitado,
      monto_aprobado,
      interes_porcentaje,
      forma_pago
    } = req.body;

    const prestamoId = await PrestamoEspecial.create({
      cliente_id,
      ruta_id: ruta_id || null,
      monto_solicitado,
      monto_aprobado,
      interes_porcentaje,
      forma_pago
    });

    // Aquí puedes generar cuotas si aplica (similar a la otra lógica)
    // await PrestamoEspecial.generateCuotas(prestamoId, ...);

    req.flash('success', 'Préstamo especial registrado exitosamente.');
    res.redirect('/prestamos-especiales');
  } catch (error) {
    console.error('Error al crear préstamo especial:', error);
    req.flash('error', 'Hubo un error al registrar el préstamo especial.');
    res.redirect('/prestamos-especiales');
  }
};

exports.show = async (req, res) => {
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
      title: 'Detalle del Préstamo Especial',
      moment
    });
  } catch (error) {
    console.error('Error al cargar detalle:', error);
    req.flash('error', 'Error al mostrar el préstamo especial.');
    res.redirect('/prestamos-especiales');
  }
};

exports.pagoForm = async (req, res) => {
  try {
    const prestamo = await PrestamoEspecial.findById(req.params.id);
    if (!prestamo) {
      req.flash('error', 'Préstamo especial no encontrado.');
      return res.redirect('/prestamos-especiales');
    }
    res.render('prestamosEspeciales/pago', { prestamo, title: 'Registrar Pago' });
  } catch (error) {
    console.error('Error al cargar formulario de pago:', error);
    req.flash('error', 'No se pudo cargar el formulario de pago.');
    res.redirect('/prestamos-especiales');
  }
};

exports.procesarPago = async (req, res) => {
  try {
    const { id } = req.params;
    const { monto, metodo, referencia } = req.body;

    const prestamo = await PrestamoEspecial.findById(id);
    if (!prestamo) {
      req.flash('error', 'Préstamo no encontrado.');
      return res.redirect('/prestamos-especiales');
    }

    // Calcular intereses y capital pagado
    const interesGenerado = (prestamo.capital_restante * prestamo.interes_porcentaje) / 100;
    const interes_pagado = Math.min(monto, interesGenerado);
    const capital_pagado = monto > interesGenerado ? monto - interesGenerado : 0;

    const nuevoCapital = prestamo.capital_restante - capital_pagado;
    const capitalRestante = nuevoCapital < 0 ? 0 : nuevoCapital;

    await PrestamoEspecial.updateCapital(prestamo.id, capitalRestante);

    await PagoEspecial.create({
      prestamo_id: prestamo.id,
      monto,
      interes_pagado,
      capital_pagado,
      metodo: metodo || 'efectivo',
      referencia: referencia || '',
      fecha: new Date(),
      registrado_por: req.user ? req.user.nombre : 'Sistema'
    });

    req.flash('success', 'Pago registrado correctamente.');
    res.redirect(`/prestamos-especiales/${id}`);
  } catch (error) {
    console.error('Error al procesar pago especial:', error);
    req.flash('error', 'No se pudo registrar el pago.');
    res.redirect('/prestamos-especiales');
  }
};

exports.reciboPago = async (req, res) => {
  try {
    const { id, pagoId } = req.params;

    const prestamo = await PrestamoEspecial.findByIdWithClienteYRuta(id);
    const pago = await PagoEspecial.findById(pagoId);
    const historialPagos = await PagoEspecial.findAllByPrestamoId(id);

    const restante = prestamo.capital_restante;

    res.render('prestamosEspeciales/recibo', {
      prestamo,
      pago,
      historialPagos,
      restante,
      user: req.user || null,
      moment
    });
  } catch (error) {
    console.error('Error al generar recibo:', error);
    req.flash('error', 'Error al generar recibo de pago.');
    res.redirect('/prestamos-especiales');
  }
};
