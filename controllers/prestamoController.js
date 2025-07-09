const db = require('../models/db');
const Prestamo = require('../models/Prestamo');
const Cliente = require('../models/Cliente');
const Cuota = require('../models/Cuota');
const Pago = require('../models/Pago');
const moment = require('moment');
const { imprimirTicket } = require('../utils/impresora');

// Helper functions
const formatCurrency = (amount) => parseFloat(amount || 0).toLocaleString('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const safeParseFloat = (value, defaultValue = 0) => {
  const num = parseFloat(value);
  return isNaN(num) ? defaultValue : num;
};

// Operaciones CRUD básicas
exports.index = async (req, res) => {
  try {
    const prestamos = await Prestamo.findAllWithClientes();
    res.render('prestamos/index', { 
      prestamos,
      moment,
      formatCurrency,
      messages: req.flash() 
    });
  } catch (error) {
    console.error('Error al obtener préstamos:', error);
    req.flash('error', 'Error al cargar los préstamos');
    res.redirect('/');
  }
};

exports.createForm = async (req, res) => {
  try {
    const clientes = await Cliente.findAll();
    res.render('prestamos/create', {
      clientes,
      messages: req.flash()
    });
  } catch (error) {
    console.error('Error al cargar formulario:', error);
    req.flash('error', 'Error al cargar formulario');
    res.redirect('/prestamos');
  }
};

exports.create = async (req, res) => {
  try {
    const prestamoId = await Prestamo.create(req.body);
    
    const montoBase = safeParseFloat(req.body.monto_aprobado || req.body.monto_solicitado);
    const interes = safeParseFloat(req.body.interes_porcentaje, 20);
    const montoTotal = (montoBase * (1 + interes / 100)).toFixed(2);
    
    await Prestamo.generateCuotas(
      prestamoId,
      montoTotal,
      parseInt(req.body.cuotas),
      req.body.forma_pago
    );

    req.flash('success', 'Préstamo creado exitosamente');
    res.redirect(`/prestamos/${prestamoId}`);
  } catch (error) {
    console.error('Error al crear préstamo:', error);
    req.flash('error', `Error al crear préstamo: ${error.message}`);
    res.redirect('/prestamos/create');
  }
};

exports.show = async (req, res) => {
  try {
    const prestamo = await Prestamo.findById(req.params.id);
    if (!prestamo) {
      req.flash('error', 'Préstamo no encontrado');
      return res.redirect('/prestamos');
    }

    const [cuotas, historialPagos] = await Promise.all([
      Prestamo.findCuotasByPrestamo(req.params.id),
      Prestamo.getHistorialPagos(req.params.id)
    ]);

    // Calcular moras
    const cuotasConMora = cuotas.map(cuota => {
      const esVencida = new Date(cuota.fecha_vencimiento) < new Date() && cuota.estado !== 'pagada';
      cuota.mora = esVencida ? 
        Math.max(0, cuota.monto * 0.05 * Math.floor((new Date() - new Date(cuota.fecha_vencimiento)) / (1000 * 60 * 60 * 24) - 2)) : 
        0;
      return cuota;
    });

    res.render('prestamos/show', {
      prestamo,
      cuotas: cuotasConMora,
      historialPagos,
      moment,
      formatCurrency
    });
  } catch (error) {
    console.error('Error al mostrar préstamo:', error);
    req.flash('error', 'Error al cargar detalles');
    res.redirect('/prestamos');
  }
};

exports.editForm = async (req, res) => {
  try {
    const prestamo = await Prestamo.findById(req.params.id);
    if (!prestamo) {
      req.flash('error', 'Préstamo no encontrado');
      return res.redirect('/prestamos');
    }

    res.render('prestamos/edit', {
      prestamo,
      messages: req.flash()
    });
  } catch (error) {
    console.error('Error al cargar formulario:', error);
    req.flash('error', 'Error al cargar formulario');
    res.redirect(`/prestamos/${req.params.id}`);
  }
};

exports.update = async (req, res) => {
  try {
    await Prestamo.update(req.params.id, {
      monto_solicitado: req.body.monto_solicitado,
      monto_aprobado: req.body.monto_aprobado,
      interes_porcentaje: req.body.interes_porcentaje,
      forma_pago: req.body.forma_pago,
      estado: req.body.estado
    });

    req.flash('success', 'Préstamo actualizado');
    res.redirect(`/prestamos/${req.params.id}`);
  } catch (error) {
    console.error('Error al actualizar:', error);
    req.flash('error', 'Error al actualizar préstamo');
    res.redirect(`/prestamos/${req.params.id}/edit`);
  }
};

// Gestión de pagos
exports.pagar = async (req, res) => {
  try {
    const { id } = req.params;
    const { monto, metodo, cuota_id } = req.body;
    
    // Validaciones básicas
    if (!monto || isNaN(monto)) throw new Error('Monto inválido');
    if (!['efectivo', 'transferencia', 'tarjeta', 'cheque'].includes(metodo)) {
      throw new Error('Método de pago inválido');
    }

    // Calcular mora si aplica
    let mora = 0;
    if (cuota_id) {
      mora = await Cuota.calcularMora(cuota_id);
    }

    const totalPago = parseFloat(monto) + mora;
    const registrado_por = req.user?.nombre || 'Sistema';

    // Registrar pago
    const [result] = await db.query(
      `INSERT INTO pagos 
       (prestamo_id, cuota_id, monto, mora, metodo, registrado_por, fecha) 
       VALUES (?, ?, ?, ?, ?, ?, NOW()) RETURNING id`,
      [id, cuota_id || null, totalPago, mora, metodo, registrado_por]
    );

    // Actualizar cuota si aplica
    if (cuota_id) {
      await Cuota.marcarComoPagada(cuota_id, id);
    }

    // Generar ticket (asíncrono)
    setImmediate(() => this._generarTicketPago(id, result.id));

    req.flash('success', 'Pago registrado correctamente');
    res.redirect(`/prestamos/${id}/recibo?pago=${result.id}`);
  } catch (error) {
    console.error('Error al procesar pago:', error);
    req.flash('error', error.message);
    res.redirect(`/prestamos/${req.params.id}`);
  }
};

// Métodos auxiliares privados
exports._generarTicketPago = async (prestamoId, pagoId) => {
  try {
    const [prestamo, pago] = await Promise.all([
      Prestamo.findById(prestamoId),
      Pago.findById(pagoId)
    ]);

    const ticketData = {
      cliente: `${prestamo.cliente_nombre} ${prestamo.cliente_apellidos}`,
      monto: pago.monto.toFixed(2),
      mora: pago.mora.toFixed(2),
      metodo: pago.metodo,
      fecha: new Date().toLocaleDateString('es-DO')
    };

    await imprimirTicket(ticketData);
  } catch (error) {
    console.error('Error al generar ticket:', error);
  }
};

// Métodos de aprobación/rechazo
exports.aprobarPrestamo = async (req, res) => {
  try {
    const { id } = req.params;
    const { monto_aprobado, interes_porcentaje, cuotas } = req.body;

    await Prestamo.aprobar(id, {
      monto_aprobado,
      interes_porcentaje,
      cuotas
    });

    req.flash('success', 'Préstamo aprobado correctamente');
    res.redirect('/prestamos/pendientes');
  } catch (error) {
    console.error('Error al aprobar préstamo:', error);
    req.flash('error', 'Error al aprobar préstamo');
    res.redirect('/prestamos/pendientes');
  }
};

exports.rechazarPrestamo = async (req, res) => {
  try {
    const { id } = req.params;
    const { motivo } = req.body;

    await Prestamo.rechazar(id, motivo);
    req.flash('success', 'Préstamo rechazado correctamente');
    res.redirect('/prestamos/pendientes');
  } catch (error) {
    console.error('Error al rechazar préstamo:', error);
    req.flash('error', 'Error al rechazar préstamo');
    res.redirect('/prestamos/pendientes');
  }
};

// Métodos de impresión
exports.recibo = async (req, res) => {
  try {
    const { id, pago } = await this._obtenerDatosRecibo(req);
    res.render('prestamos/recibo', {
      layout: false,
      ...datosRecibo,
      formatCurrency,
      moment
    });
  } catch (error) {
    console.error('Error al generar recibo:', error);
    req.flash('error', 'Error al generar recibo');
    res.redirect(`/prestamos/${req.params.id}`);
  }
};

exports._obtenerDatosRecibo = async (req) => {
  const prestamo = await Prestamo.findById(req.params.id);
  if (!prestamo) throw new Error('Préstamo no encontrado');

  const pago = await Pago.findById(req.query.pago);
  if (!pago) throw new Error('Pago no encontrado');

  const historialPagos = await Pago.findByPrestamo(req.params.id);
  const sumaPagos = historialPagos.reduce((sum, p) => sum + p.monto, 0);
  const restante = Math.max(0, prestamo.monto_total - sumaPagos);

  return {
    prestamo,
    pago,
    historialPagos,
    restante: restante.toFixed(2)
  };
};