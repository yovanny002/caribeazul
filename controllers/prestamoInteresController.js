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

    // Obtener historial de pagos
    let pagos = [];
    try {
      pagos = await PrestamoInteres.getHistorialPagos(id) || [];
    } catch (error) {
      console.error('Error al obtener pagos:', error);
    }

    const fechaInicio = moment(prestamo.created_at);
    const hoy = moment();

    // Siempre cuenta al menos 1 periodo (interés inicial inmediato)
    let periodosTranscurridos = 1;

    if (prestamo.frecuencia_interes === 'quincenal') {
      const dias = hoy.diff(fechaInicio, 'days');
      periodosTranscurridos += Math.floor(dias / 15);
    } else {
      const meses = hoy.diff(fechaInicio, 'months');
      periodosTranscurridos += meses;
    }

    const interesPorPeriodo = prestamo.monto_aprobado * (prestamo.interes_porcentaje / 100);
    const interesAcumulado = prestamo.frecuencia_interes === 'quincenal'
      ? (interesPorPeriodo / 2) * periodosTranscurridos
      : interesPorPeriodo * periodosTranscurridos;

    // Pagos realizados
    const totalCapitalPagado = pagos.reduce((sum, p) => sum + (p.capital_pagado || 0), 0);
    const totalInteresPagado = pagos.reduce((sum, p) => sum + (p.interes_pagado || 0), 0);

    const saldoCapital = prestamo.monto_aprobado - totalCapitalPagado;
    const saldoInteres = interesAcumulado - totalInteresPagado;

    // Cálculo de mora si pasaron más de 2 días desde último vencimiento
    let mora = null;
    const diasDesdeInicio = hoy.diff(fechaInicio, 'days');
    const diasPorPeriodo = prestamo.frecuencia_interes === 'quincenal' ? 15 : 30;
    const fechaUltimoVencimiento = moment(fechaInicio).add(Math.floor(diasDesdeInicio / diasPorPeriodo) * diasPorPeriodo, 'days');
    const diasAtraso = hoy.diff(fechaUltimoVencimiento, 'days');

    if (diasAtraso > 2) {
      mora = {
        monto: saldoCapital * 0.02, // 2% de capital
        dias: diasAtraso
      };
    }

    const totalPagado = totalCapitalPagado + totalInteresPagado;
    const saldoTotal = saldoCapital + saldoInteres + (mora ? mora.monto : 0);

    // Formateo de campos para vista
    prestamo.monto_aprobado_formatted = `RD$ ${prestamo.monto_aprobado.toFixed(2)}`;
    prestamo.saldo_capital = saldoCapital;
    prestamo.saldo_capital_formatted = `RD$ ${saldoCapital.toFixed(2)}`;
    prestamo.intereses_acumulados = interesAcumulado;
    prestamo.intereses_acumulados_formatted = `RD$ ${interesAcumulado.toFixed(2)}`;
    prestamo.total_intereses_pagados = totalInteresPagado;
    prestamo.total_capital_pagado = totalCapitalPagado;
    prestamo.total_pagado = totalPagado;
    prestamo.total_pagado_formatted = `RD$ ${totalPagado.toFixed(2)}`;
    prestamo.saldo_total = saldoTotal;
    prestamo.saldo_total_formatted = `RD$ ${saldoTotal.toFixed(2)}`;
    prestamo.saldo_intereses = saldoInteres;
    prestamo.mora = mora;

    // Enviar a la vista
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
    // 1. Validación de datos básicos
    if (!req.body.cliente_id || !req.body.monto_solicitado) {
      throw new Error('Debe seleccionar un cliente y especificar el monto solicitado');
    }

    // 2. Procesamiento de datos
    const prestamoData = {
      ...req.body,
      monto_aprobado: req.body.monto_aprobado || req.body.monto_solicitado,
      estado: 'pendiente', // Valor por defecto según DB
      plazo_meses: req.body.plazo_meses || 1,
      forma_pago: req.body.forma_pago || 'mensual',
      interes_porcentaje: req.body.interes_porcentaje || 10
    };

    // 3. Conversión de interés quincenal
    if (req.body.frecuencia_interes === 'quincenal' && req.body.interes_manual) {
      prestamoData.interes_manual = safeParseFloat(req.body.interes_manual) / 2;
    }

    // 4. Debug: Ver datos antes de insertar
    console.log('Datos del préstamo a crear:', prestamoData);

    // 5. Creación del préstamo
    const prestamoId = await PrestamoInteres.create(prestamoData);
    
    // 6. Redirección exitosa
    req.flash('success', 'Préstamo creado exitosamente');
    return res.redirect(`/prestamos_interes/${prestamoId}`);

  } catch (error) {
    console.error('Error en create controller:', error);
    
    // 7. Recargar datos para mostrar el formulario nuevamente
    try {
      const [clientes, rutas] = await Promise.all([
        db.query('SELECT id, nombre, apellidos, cedula FROM clientes ORDER BY nombre', {
          type: QueryTypes.SELECT
        }),
        db.query('SELECT id, nombre, zona FROM rutas ORDER BY nombre', {
          type: QueryTypes.SELECT
        })
      ]);

      // 8. Renderizar con errores y datos previos
      req.flash('error', `Error al crear préstamo: ${error.message}`);
      return res.render('prestamos_interes/create', {
        clientes,
        rutas,
        body: req.body, // Mantener datos ingresados
        messages: req.flash()
      });

    } catch (err) {
      console.error('Error al recargar datos del formulario:', err);
      req.flash('error', 'Error crítico al procesar la solicitud');
      return res.redirect('/prestamos_interes');
    }
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