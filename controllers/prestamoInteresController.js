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

    const fechaInicio = moment(prestamo.created_at);
    const hoy = moment();

    const totalCapitalPagado = pagos.reduce((sum, p) => sum + (p.capital_pagado || 0), 0);
    const totalInteresPagado = pagos.reduce((sum, p) => sum + (p.interes_pagado || 0), 0);
    const saldoCapital = prestamo.monto_aprobado - totalCapitalPagado;

    // Calcular cuántos periodos han pasado (quincenal o mensual)
    let periodosTranscurridos = 1; // Se cobra interés inicial al momento de aprobar
    const diasTranscurridos = hoy.diff(fechaInicio, 'days');

    if (prestamo.frecuencia_interes === 'quincenal') {
      periodosTranscurridos += Math.floor(diasTranscurridos / 15);
    } else {
      periodosTranscurridos += Math.floor(diasTranscurridos / 30);
    }

    // Cálculo correcto del interés acumulado basado en el saldo actual
    const interesPorPeriodo = saldoCapital * (prestamo.interes_porcentaje / 100);
    const interesAcumulado = prestamo.frecuencia_interes === 'quincenal'
      ? (interesPorPeriodo / 2) * periodosTranscurridos
      : interesPorPeriodo * periodosTranscurridos;

    const saldoInteres = interesAcumulado - totalInteresPagado;

    // MORA
    let mora = null;
    const diasPorPeriodo = prestamo.frecuencia_interes === 'quincenal' ? 15 : 30;
    const fechaUltimoVencimiento = moment(fechaInicio).add(Math.floor(diasTranscurridos / diasPorPeriodo) * diasPorPeriodo, 'days');
    const diasAtraso = hoy.diff(fechaUltimoVencimiento, 'days');

    if (diasAtraso > 2) {
      mora = {
        monto: saldoCapital * 0.02,
        dias: diasAtraso
      };
    }

    const totalPagado = totalCapitalPagado + totalInteresPagado;
    const saldoTotal = saldoCapital + saldoInteres + (mora ? mora.monto : 0);

    // Preparar datos para la vista
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

exports.showPago = async (req, res) => {
  const { id } = req.params;

  try {
    const prestamo = await PrestamoInteres.findById(id);
    if (!prestamo) {
      req.flash('error', 'Préstamo no encontrado.');
      return res.redirect('/prestamos_interes');
    }

    const pagos = await PrestamoInteres.getHistorialPagos(id);

    // Cálculo del saldo capital actual
    const totalCapitalPagado = pagos.reduce((sum, p) => sum + p.capital_pagado, 0);
    const totalInteresPagado = pagos.reduce((sum, p) => sum + p.interes_pagado, 0);
    const saldoCapital = prestamo.monto_aprobado - totalCapitalPagado;

    // Cálculo del interés acumulado según la frecuencia
    const fechaInicio = moment(prestamo.created_at);
    const hoy = moment();
    const diasTranscurridos = hoy.diff(fechaInicio, 'days');
    const diasPorPeriodo = prestamo.frecuencia_interes === 'quincenal' ? 15 : 30;
    const periodosTranscurridos = Math.floor(diasTranscurridos / diasPorPeriodo);

    const interesPorPeriodo = saldoCapital * (prestamo.interes_porcentaje / 100);
    const interesAcumuladoBruto = prestamo.frecuencia_interes === 'quincenal'
      ? (interesPorPeriodo / 2) * periodosTranscurridos
      : interesPorPeriodo * periodosTranscurridos;

    const intereses_acumulados = Math.max(0, interesAcumuladoBruto - totalInteresPagado);

    // Calcular mora si han pasado más de 2 días desde el último vencimiento
    const ultimaFechaVencimiento = moment(fechaInicio).add(periodosTranscurridos * diasPorPeriodo, 'days');
    const diasAtraso = hoy.diff(ultimaFechaVencimiento, 'days');
    const mora = diasAtraso > 2 ? saldoCapital * 0.02 : 0;

    const total_sugerido = saldoCapital + intereses_acumulados + mora;

    // Preparar formato para la vista
    prestamo.saldo_capital = saldoCapital;
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
  const {
    prestamo_id,
    monto,
    metodo,
    notas,
    referencia
  } = req.body;

  const registrado_por = req.session.usuario_id; // Asegúrate de tener esta sesión
  if (!prestamo_id || !monto || !registrado_por) {
    req.flash('error', 'Datos incompletos para registrar el pago.');
    return res.redirect(`/prestamos_interes/${prestamo_id}`);
  }

  try {
    const prestamo = await PrestamoInteres.findById(prestamo_id);
    const pagos = await PrestamoInteres.getHistorialPagos(prestamo_id);

    const fechaInicio = moment(prestamo.created_at);
    const hoy = moment();
    const totalCapitalPagado = pagos.reduce((sum, p) => sum + (p.capital_pagado || 0), 0);
    const totalInteresPagado = pagos.reduce((sum, p) => sum + (p.interes_pagado || 0), 0);
    const saldoCapital = prestamo.monto_aprobado - totalCapitalPagado;

    // Calcular periodos transcurridos
    let periodosTranscurridos = 1;
    const diasTranscurridos = hoy.diff(fechaInicio, 'days');
    const diasPorPeriodo = prestamo.frecuencia_interes === 'quincenal' ? 15 : 30;

    if (prestamo.frecuencia_interes === 'quincenal') {
      periodosTranscurridos += Math.floor(diasTranscurridos / 15);
    } else {
      periodosTranscurridos += Math.floor(diasTranscurridos / 30);
    }

    // Interés acumulado basado en saldo actual
    const interesPorPeriodo = saldoCapital * (prestamo.interes_porcentaje / 100);
    const interesAcumulado = prestamo.frecuencia_interes === 'quincenal'
      ? (interesPorPeriodo / 2) * periodosTranscurridos
      : interesPorPeriodo * periodosTranscurridos;

    const saldoInteres = interesAcumulado - totalInteresPagado;

    // Calcular mora
    const fechaUltimoVencimiento = moment(fechaInicio).add(Math.floor(diasTranscurridos / diasPorPeriodo) * diasPorPeriodo, 'days');
    const diasAtraso = hoy.diff(fechaUltimoVencimiento, 'days');
    const mora = diasAtraso > 2 ? saldoCapital * 0.02 : 0;

    // Aplicar el pago
    let restante = parseFloat(monto);
    let moraPagada = 0;
    let interesPagado = 0;
    let capitalPagado = 0;

    if (mora > 0) {
      moraPagada = Math.min(restante, mora);
      restante -= moraPagada;
    }

    if (restante > 0 && saldoInteres > 0) {
      interesPagado = Math.min(restante, saldoInteres);
      restante -= interesPagado;
    }

    if (restante > 0) {
      capitalPagado = restante;
      restante = 0;
    }

    // Insertar el pago
    const [result] = await db.query(`
      INSERT INTO pagos_interes (
        prestamo_id,
        monto,
        interes_pagado,
        capital_pagado,
        metodo,
        notas,
        referencia,
        registrado_por,
        fecha,
        created_at
      ) VALUES (
        :prestamo_id,
        :monto,
        :interes_pagado,
        :capital_pagado,
        :metodo,
        :notas,
        :referencia,
        :registrado_por,
        NOW(),
        NOW()
      ) RETURNING id
    `, {
      replacements: {
        prestamo_id,
        monto: parseFloat(monto),
        interes_pagado: interesPagado,
        capital_pagado: capitalPagado,
        metodo: metodo || 'efectivo',
        notas: notas || null,
        referencia: referencia || null,
        registrado_por
      },
      type: QueryTypes.INSERT
    });

    // Actualizar saldo del préstamo
    await db.query(`
      UPDATE prestamos_interes 
      SET 
        saldo_capital = saldo_capital - :capitalPagado,
        updated_at = NOW()
      WHERE id = :prestamo_id
    `, {
      replacements: {
        capitalPagado,
        prestamo_id
      },
      type: QueryTypes.UPDATE
    });

    req.flash('success', 'Pago registrado correctamente.');
    res.redirect(`/prestamos_interes/${prestamo_id}`);
  } catch (error) {
    console.error('Error al registrar pago:', error);
    req.flash('error', 'Hubo un problema al registrar el pago.');
    res.redirect(`/prestamos_interes/${prestamo_id}`);
  }
};


exports.recibo = async (req, res) => {
  try {
    const pagoId = req.params.pagoId;

    // Obtener el pago con su préstamo y cliente
    const [pago] = await db.query(`
      SELECT p.*, 
             pi.id AS prestamo_id, pi.saldo_capital, pi.monto_aprobado, pi.interes_porcentaje, pi.created_at,
             c.nombre AS cliente_nombre, c.apellidos AS cliente_apellidos,
             c.cedula AS cliente_cedula,
             c.profesion AS cliente_profesion,
             r.nombre AS ruta_nombre
      FROM pagos_interes p
      JOIN prestamos_interes pi ON p.prestamo_id = pi.id
      JOIN clientes c ON pi.cliente_id = c.id
      LEFT JOIN rutas r ON pi.ruta_id = r.id
      WHERE p.id = :pagoId
    `, {
      replacements: { pagoId },
      type: QueryTypes.SELECT
    });

    if (!pago) {
      req.flash('error', 'Recibo no encontrado');
      return res.redirect('/prestamos_interes');
    }

    // Calcular interés acumulado
    const fechaInicio = moment(pago.created_at);
    const diasTranscurridos = moment(pago.fecha).diff(fechaInicio, 'days');

    const tasaInteres = safeParseFloat(pago.interes_porcentaje) / 100;
    const saldoCapital = safeParseFloat(pago.saldo_capital);

    let interesesAcumulados = 0;
    let mora = 0;

    if (pago.frecuencia_interes === 'quincenal') {
      const quincenas = Math.floor(diasTranscurridos / 15);
      interesesAcumulados = quincenas * (saldoCapital * tasaInteres / 2);
    } else {
      const meses = Math.floor(diasTranscurridos / 30);
      interesesAcumulados = meses * (saldoCapital * tasaInteres);
    }

    // Calcular mora si han pasado más de 2 días desde fecha de pago
    const diasMora = moment().diff(moment(pago.fecha), 'days');
    if (diasMora > 2) {
      mora = saldoCapital * 0.02; // 2% de penalización
    }

    const prestamo = {
      id: pago.prestamo_id,
      cliente_nombre: pago.cliente_nombre,
      cliente_apellidos: pago.cliente_apellidos,
      cliente_cedula: pago.cliente_cedula,
      cliente_profesion: pago.cliente_profesion,
      ruta_nombre: pago.ruta_nombre,
      saldo_capital: saldoCapital,
      intereses_acumulados: interesesAcumulados,
      mora: mora
    };

    // Formateo
    pago.fecha_display = moment(pago.fecha).format('DD/MM/YYYY');
    pago.monto = safeParseFloat(pago.monto);
    pago.interes_pagado = safeParseFloat(pago.interes_pagado);
    pago.capital_pagado = safeParseFloat(pago.capital_pagado);

    res.render('prestamos_interes/recibo', {
      prestamo,
      pago
    });

  } catch (error) {
    console.error('Error al generar recibo:', error);
    req.flash('error', 'Error al generar recibo');
    res.redirect(`/prestamos_interes`);
  }
};