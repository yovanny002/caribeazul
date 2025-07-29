const db = require('../models/db');
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
    const id = req.params.id;
    const prestamo = await PrestamoInteres.findById(id);
    if (!prestamo) {
      req.flash('error', 'Préstamo no encontrado');
      return res.redirect('/prestamos_interes');
    }

    let pagos = [];
    try {
      pagos = await PrestamoInteres.getHistorialPagos(id) || [];
    } catch (error) {
      console.error('Error al obtener pagos:', error);
    }

    // Calculate accrued interest since the last update/payment
    // This uses the current saldo_capital and updated_at to get *new* interest
    const interesGeneradoAhora = await PrestamoInteres.calculateAccruedInterest(prestamo);
    let saldoInteres = prestamo.interes_pendiente_acumulado + interesGeneradoAhora;

    // Recalculate total capital paid from payments table (for display consistency)
    const totalCapitalPagado = pagos.reduce((sum, p) => sum + (p.capital_pagado || 0), 0);
    const totalInteresPagado = pagos.reduce((sum, p) => sum + (p.interes_pagado || 0), 0);

    // MORA
    let mora = 0;
    const diasPorPeriodo = prestamo.frecuencia_interes === 'quincenal' ? 15 : 30;
    const fechaUltimoPago = pagos.length > 0 ? moment(pagos[0].fecha) : moment(prestamo.created_at);
    
    // Calculate full periods passed since loan creation or last payment for interest accrual
    const diasDesdeUltimoCalculo = moment().diff(fechaUltimoPago, 'days');
    const periodosAtrasados = Math.floor(diasDesdeUltimoCalculo / diasPorPeriodo);

    // Mora logic: Apply mora if periodosAtrasados > 0 (meaning at least one period has passed without full payment of interest and/or capital)
    // You might want to refine this mora logic based on your exact business rules.
    // For example, if interest is due every 15 days, and 16 days passed without payment, mora applies.
    if (periodosAtrasados > 0 && (saldoInteres > 0 || prestamo.saldo_capital > 0)) {
        // Mora on outstanding capital, adjust as per your business logic (e.g., 2% per period atrasado)
        mora = prestamo.saldo_capital * 0.02 * periodosAtrasados; 
    }
    
    // Ensure saldoCapital is the latest from the DB, not recalculated from scratch here
    const saldoCapital = prestamo.saldo_capital; 

    const totalPagado = totalCapitalPagado + totalInteresPagado;
    const saldoTotal = saldoCapital + saldoInteres + mora;

    // Prepare data for the view
    prestamo.saldo_capital = saldoCapital; // Already set from DB
    prestamo.saldo_capital_formatted = `RD$ ${saldoCapital.toFixed(2)}`;
    prestamo.intereses_acumulados = saldoInteres; // This is the *current* pending interest
    prestamo.intereses_acumulados_formatted = `RD$ ${saldoInteres.toFixed(2)}`;
    prestamo.total_intereses_pagados = totalInteresPagado;
    prestamo.total_capital_pagado = totalCapitalPagado;
    prestamo.total_pagado = totalPagado;
    prestamo.total_pagado_formatted = `RD$ ${totalPagado.toFixed(2)}`;
    prestamo.saldo_total = saldoTotal;
    prestamo.saldo_total_formatted = `RD$ ${saldoTotal.toFixed(2)}`;
    prestamo.saldo_intereses = saldoInteres; // Redundant, but keeping for clarity
    prestamo.mora = mora > 0 ? { monto: mora, dias: diasDesdeUltimoCalculo } : null; // Mora object

    res.render('prestamos_interes/show', {
      prestamo,
      pagos,
      moment
    });

  } catch (error) {
    console.error('Error al mostrar el préstamo:', error);
    req.flash('error', 'Error al cargar los detalles del préstamo');
    res.redirect('/prestamos_interes');
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
    res.redirect('/prestamos_intereses'); // Typo here, should be /prestamos_interes
  }
};

exports.create = async (req, res) => {
  try {
    if (!req.body.cliente_id || !req.body.monto_solicitado) {
      throw new Error('Debe seleccionar un cliente y especificar el monto solicitado');
    }

    const prestamoData = {
      ...req.body,
      monto_aprobado: req.body.monto_aprobado || req.body.monto_solicitado,
      estado: 'activo', // Changed to 'activo' as it's a new approved loan
      plazo_meses: req.body.plazo_meses || 1,
      forma_pago: req.body.forma_pago || 'mensual',
      interes_porcentaje: req.body.interes_porcentaje || 10
    };

    // No need to divide interes_manual by 2 here, the model handles it during calculation
    // if (req.body.frecuencia_interes === 'quincenal' && req.body.interes_manual) {
    //   prestamoData.interes_manual = safeParseFloat(req.body.interes_manual); 
    // }

    console.log('Datos del préstamo a crear:', prestamoData);

    const prestamoId = await PrestamoInteres.create(prestamoData);
    
    req.flash('success', 'Préstamo creado exitosamente');
    return res.redirect(`/prestamos_interes/${prestamoId}`);

  } catch (error) {
    console.error('Error en create controller:', error);
    
    try {
      const [clientes, rutas] = await Promise.all([
        db.query('SELECT id, nombre, apellidos, cedula FROM clientes ORDER BY nombre', {
          type: QueryTypes.SELECT
        }),
        db.query('SELECT id, nombre, zona FROM rutas ORDER BY nombre', {
          type: QueryTypes.SELECT
        })
      ]);

      req.flash('error', `Error al crear préstamo: ${error.message}`);
      return res.render('prestamos_interes/create', {
        clientes,
        rutas,
        body: req.body,
        messages: req.flash()
      });

    } catch (err) {
      console.error('Error al recargar datos del formulario:', err);
      req.flash('error', 'Error crítico al procesar la solicitud');
      return res.redirect('/prestamos_interes');
    }
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

    // Get current accrued interest for display on payment form
    const interesGeneradoAhora = await PrestamoInteres.calculateAccruedInterest(prestamo);
    const intereses_acumulados = prestamo.interes_pendiente_acumulado + interesGeneradoAhora;

    // Mora logic for payment form:
    let mora = 0;
    const diasPorPeriodo = prestamo.frecuencia_interes === 'quincenal' ? 15 : 30;
    const fechaUltimoPago = prestamo.updated_at; // Use updated_at as the last reference point
    const diasAtraso = moment().diff(moment(fechaUltimoPago), 'days');
    
    // Only apply mora if there's interest pending AND days passed beyond the period grace.
    // Or if the capital is still outstanding after the period.
    if (diasAtraso > diasPorPeriodo + 2 && (intereses_acumulados > 0 || prestamo.saldo_capital > 0)) {
        mora = prestamo.saldo_capital * 0.02; // Assuming 2% of capital as mora
    }
    
    const total_sugerido = prestamo.saldo_capital + intereses_acumulados + mora;

    // Prepare format for the view
    prestamo.saldo_capital = prestamo.saldo_capital;
    prestamo.intereses_acumulados = intereses_acumulados;
    prestamo.mora = mora;
    prestamo.total_sugerido = total_sugerido;

    res.render('prestamos_interes/pago', {
      prestamo
    });

  } catch (err) {
    console.error(err);
    req.flash('error', 'Error al cargar el formulario de pago.');
    res.redirect('/prestamos_interes');
  }
};

// Renamed from pagoForm to avoid confusion, showPago now renders the form
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
    await PrestamoInteres.registrarPago({
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

exports.recibo = async (req, res) => {
    try {
        const pagoId = req.params.pagoId;

        // Obtener el pago
        const [pago] = await db.query(`
            SELECT p.*, 
                   pi.id AS prestamo_id, pi.monto_aprobado, pi.interes_porcentaje, 
                   pi.interes_manual, pi.frecuencia_interes, pi.created_at, pi.updated_at as prestamo_updated_at
            FROM pagos_interes p
            JOIN prestamos_interes pi ON p.prestamo_id = pi.id
            WHERE p.id = :pagoId
        `, {
            replacements: { pagoId },
            type: QueryTypes.SELECT
        });

        if (!pago) {
            req.flash('error', 'Recibo no encontrado');
            return res.redirect('/prestamos_interes');
        }

        // AHORA: Cargar el estado actual del préstamo (después del pago)
        const prestamoActualizado = await PrestamoInteres.findById(pago.prestamo_id);
        if (!prestamoActualizado) {
            req.flash('error', 'Préstamo asociado al recibo no encontrado.');
            return res.redirect('/prestamos_interes');
        }

        // Recalcular el interés y mora para el estado actual del préstamo para el recibo
        const interesGeneradoAhora = await PrestamoInteres.calculateAccruedInterest(prestamoActualizado);
        const interesesPendientesParaRecibo = prestamoActualizado.interes_pendiente_acumulado + interesGeneradoAhora;

        let moraParaRecibo = 0;
        const diasPorPeriodo = prestamoActualizado.frecuencia_interes === 'quincenal' ? 15 : 30;
        const fechaUltimoPagoOActualizacion = moment(prestamoActualizado.updated_at); // Usar updated_at del préstamo actualizado
        const diasAtraso = moment().diff(fechaUltimoPagoOActualizacion, 'days');

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

        res.render('prestamos_interes/recibo_termico', { // Asegúrate de usar el nombre de tu nuevo archivo EJS
            prestamo: prestamoForReceipt,
            pago
        });

    } catch (error) {
        console.error('Error al generar recibo:', error);
        req.flash('error', 'Error al generar recibo');
        res.redirect(`/prestamos_interes`);
    }
};