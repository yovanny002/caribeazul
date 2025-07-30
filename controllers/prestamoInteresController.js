const db = require('../models/db');
const { QueryTypes } = require('sequelize');
const PrestamoInteres = require('../models/PrestamoInteres');
const Cliente = require('../models/Cliente');
const Pago = require('../models/Pago');
const SolicitudPrestamo = require('../models/SolicitudPrestamo');
const Ruta = require('../models/Ruta');
const moment = require('moment');
const { imprimirTicket } = require('../utils/impresora');
const PDFDocument = require('pdfkit');
const fs = require('fs');

// Helper para parsear valores numéricos de forma segura
const safeParseFloat = (value, defaultValue = 0) => {
  const num = parseFloat(value);
  return isNaN(num) ? defaultValue : num;
};


// ===================================
// === Métodos para el controlador ===
// ===================================

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
    console.error('Error al obtener préstamos:', error);
    req.flash('error', 'Hubo un error al cargar los préstamos');
    res.redirect('/');
  }
};

exports.createForm = async (req, res) => {
  try {
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
      body: req.body || {}
    });
  } catch (error) {
    console.error('Error al cargar formulario de préstamo:', error);
    req.flash('error', 'Error al cargar formulario de préstamo');
    res.redirect('/prestamos_interes');
  }
};

exports.create = async (req, res) => {
  try {
    const prestamoId = await PrestamoInteres.create(req.body);
    req.flash('success', 'Préstamo creado correctamente');
    res.redirect(`/prestamos_interes/${prestamoId}`);
  } catch (error) {
    console.error('❌ Error al crear préstamo:', error.message);
    req.flash('error', `Error al crear préstamo: ${error.message}`);
    res.redirect('/prestamos_interes/create');
  }
};

// ============ FUNCIÓN SHOW CORREGIDA ============
exports.show = async (req, res) => {
  try {
    const prestamoId = req.params.id;
    const prestamo = await PrestamoInteres.findById(prestamoId);
    if (!prestamo) {
      req.flash('error', 'Préstamo no encontrado');
      return res.redirect('/prestamos_interes');
    }

    const pagos = await PrestamoInteres.getHistorialPagos(prestamoId);

    const interesGeneradoAhora = await PrestamoInteres.calculateAccruedInterest(prestamo);
    let saldoInteres = prestamo.interes_pendiente_acumulado + interesGeneradoAhora;
    saldoInteres = Math.max(0, saldoInteres);

    const totalCapitalPagado = pagos.reduce((sum, p) => sum + (p.capital_pagado || 0), 0);
    const totalInteresPagado = pagos.reduce((sum, p) => sum + (p.interes_pagado || 0), 0);

    let mora = 0;
    const diasPorPeriodo = prestamo.frecuencia_interes === 'quincenal' ? 15 : 30;
    const fechaUltimaActualizacion = moment(prestamo.updated_at);
    const hoy = moment();
    const diasAtraso = hoy.diff(fechaUltimaActualizacion, 'days');

    if (diasAtraso > diasPorPeriodo + 2 && (saldoInteres > 0 || prestamo.saldo_capital > 0)) {
        mora = prestamo.saldo_capital * 0.02;
    }
    mora = safeParseFloat(mora);

    const saldoCapital = prestamo.saldo_capital;
    const totalPagado = totalCapitalPagado + totalInteresPagado;
    const saldoTotal = saldoCapital + saldoInteres + mora;

    prestamo.saldo_capital = saldoCapital;
    prestamo.saldo_capital_formatted = `RD$ ${saldoCapital.toFixed(2)}`;
    prestamo.intereses_acumulados = saldoInteres;
    prestamo.intereses_acumulados_formatted = `RD$ ${saldoInteres.toFixed(2)}`;
    prestamo.total_intereses_pagados = totalInteresPagado;
    prestamo.total_capital_pagado = totalCapitalPagado;
    prestamo.total_pagado = totalPagado;
    prestamo.total_pagado_formatted = `RD$ ${totalPagado.toFixed(2)}`;
    prestamo.saldo_total = saldoTotal;
    prestamo.saldo_total_formatted = `RD$ ${saldoTotal.toFixed(2)}`;
    prestamo.saldo_intereses = saldoInteres;
    prestamo.mora = mora > 0 ? { monto: mora, dias: diasAtraso } : null;

    res.render('prestamos_interes/show', {
      prestamo,
      pagos,
      moment
    });
  } catch (error) {
    console.error('Error al mostrar préstamo:', error);
    req.flash('error', 'Error al cargar detalles del préstamo');
    res.redirect('/prestamos_interes');
  }
};


exports.showPago = async (req, res) => {
  const { id } = req.params;
  try {
    const prestamo = await PrestamoInteres.findById(id);
    if (!prestamo) {
      req.flash('error', 'Préstamo no encontrado.');
      return res.redirect('/prestamos_interes');
    }
    const interesGeneradoAhora = await PrestamoInteres.calculateAccruedInterest(prestamo);
    const intereses_acumulados = prestamo.interes_pendiente_acumulado + interesGeneradoAhora;
    const saldoCapital = prestamo.saldo_capital;
    
    let mora = 0;
    const diasPorPeriodo = prestamo.frecuencia_interes === 'quincenal' ? 15 : 30;
    const fechaUltimaActualizacion = moment(prestamo.updated_at);
    const hoy = moment();
    const diasAtraso = hoy.diff(fechaUltimaActualizacion, 'days');
    
    if (diasAtraso > diasPorPeriodo + 2 && (intereses_acumulados > 0 || saldoCapital > 0)) {
        mora = saldoCapital * 0.02;
    }
    mora = safeParseFloat(mora);

    const total_sugerido = saldoCapital + intereses_acumulados + mora;

    prestamo.saldo_capital = saldoCapital;
    prestamo.intereses_acumulados = intereses_acumulados;
    prestamo.mora = mora;
    prestamo.total_sugerido = total_sugerido;

    res.render('prestamos_interes/pago', { prestamo });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Error al cargar el formulario de pago.');
    res.redirect('/prestamos_interes');
  }
};

exports.pagoForm = exports.showPago;

exports.registrarPago = async (req, res) => {
  const {
    prestamo_id,
    monto,
    metodo,
    notas,
    referencia
  } = req.body;
  const registrado_por = req.session.usuario_id;
  if (!prestamo_id || !monto || !registrado_por) {
    req.flash('error', 'Datos incompletos para registrar el pago.');
    return res.redirect(`/prestamos_interes/${prestamo_id}`);
  }
  try {
    const pagoId = await PrestamoInteres.registrarPago({
      prestamo_id,
      monto: safeParseFloat(monto),
      metodo,
      notas,
      referencia,
      registrado_por
    });
    req.flash('success', 'Pago registrado correctamente.');
    res.redirect(`/prestamos_interes/${prestamo_id}`);
  } catch (error) {
    console.error('Error al registrar pago:', error);
    req.flash('error', `Hubo un problema al registrar el pago: ${error.message}`);
    res.redirect(`/prestamos_interes/${prestamo_id}`);
  }
};

exports.imprimirContrato = async (req, res) => {
  try {
    const prestamoId = req.params.id;
    const prestamo = await PrestamoInteres.findById(prestamoId);
    
    if (!prestamo) {
      return res.status(404).send('Préstamo no encontrado');
    }

    const cliente = await Cliente.findById(prestamo.cliente_id);
    if (!cliente) {
      return res.status(404).send('Cliente no encontrado para el préstamo');
    }

    res.render('prestamos_interes/imprimir_contrato', {
      layout: false, 
      prestamo: {
        ...prestamo,
        cliente_nombre: cliente.nombre,
        cliente_apellidos: cliente.apellidos,
        cliente_cedula: cliente.cedula,
        cliente_telefono1: cliente.telefono1,
        cliente_direccion: cliente.direccion
      }
    });
  } catch (error) {
    console.error('Error al cargar vista de impresión del contrato:', error);
    res.status(500).send('Error interno del servidor');
  }
};

exports.recibo = async (req, res) => {
  try {
    const pagoId = req.params.pagoId;
    const [pago] = await db.query(`
      SELECT p.*, 
             pi.id AS prestamo_id, pi.monto_aprobado, pi.interes_porcentaje, 
             pi.interes_manual, pi.frecuencia_interes, pi.created_at, pi.updated_at as prestamo_updated_at,
             c.nombre AS cliente_nombre, c.apellidos AS cliente_apellidos,
             c.cedula AS cliente_cedula,
             c.profesion AS cliente_profesion,
             r.nombre AS ruta_nombre
      FROM pagos_interes p
      JOIN prestamos_interes pi ON p.prestamo_id = pi.id
      JOIN clientes c ON pi.cliente_id = c.id
      LEFT JOIN rutas r ON pi.ruta_id = r.id
      WHERE p.id = :pagoId
    `, { replacements: { pagoId }, type: db.QueryTypes.SELECT });

    if (!pago) {
      req.flash('error', 'Recibo no encontrado');
      return res.redirect('/prestamos_interes');
    }
    const prestamoActualizado = await PrestamoInteres.findById(pago.prestamo_id);
    if (!prestamoActualizado) {
      req.flash('error', 'Préstamo asociado al recibo no encontrado.');
      return res.redirect('/prestamos_interes');
    }
    const interesGeneradoAhora = await PrestamoInteres.calculateAccruedInterest(prestamoActualizado);
    const interesesPendientesParaRecibo = prestamoActualizado.interes_pendiente_acumulado + interesGeneradoAhora;
    let moraParaRecibo = 0;
    const diasPorPeriodo = prestamoActualizado.frecuencia_interes === 'quincenal' ? 15 : 30;
    const fechaUltimaActualizacion = moment(prestamoActualizado.updated_at);
    const diasAtraso = moment().diff(fechaUltimaActualizacion, 'days');
    if (diasAtraso > diasPorPeriodo + 2 && (interesesPendientesParaRecibo > 0 || prestamoActualizado.saldo_capital > 0)) {
      moraParaRecibo = prestamoActualizado.saldo_capital * 0.02;
    }
    const prestamoForReceipt = {
      id: prestamoActualizado.id,
      cliente_nombre: pago.cliente_nombre,
      cliente_apellidos: pago.cliente_apellidos,
      cliente_cedula: pago.cliente_cedula,
      monto_aprobado: prestamoActualizado.monto_aprobado,
      saldo_capital: prestamoActualizado.saldo_capital,
      intereses_acumulados: interesesPendientesParaRecibo,
      mora: moraParaRecibo
    };
    pago.fecha_display = moment(pago.fecha).format('DD/MM/YYYY HH:mm');
    pago.monto = safeParseFloat(pago.monto);
    pago.interes_pagado = safeParseFloat(pago.interes_pagado);
    pago.capital_pagado = safeParseFloat(pago.capital_pagado);
    res.render('prestamos_interes/recibo', { prestamo: prestamoForReceipt, pago, layout: false });
  } catch (error) {
    console.error('Error generando recibo:', error);
    req.flash('error', 'Error al generar recibo: ' + error.message);
    res.redirect(`/prestamos_interes/${req.params.id}`);
  }
};