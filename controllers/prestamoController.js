const db = require('../models/db');
const Prestamo = require('../models/Prestamo');
const Cliente = require('../models/Cliente');
const Cuota = require('../models/Cuota');
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
    const prestamos = await Prestamo.findAllWithClientes();
    res.render('prestamos/index', { prestamos, moment, messages: req.flash() });
  } catch (error) {
    console.error('Error al obtener préstamos:', error);
    req.flash('error', 'Hubo un error al cargar los préstamos');
    res.redirect('/');
  }
};

exports.createForm = async (req, res) => {
  try {
    const clientes = await Cliente.findAll();
    const rutas = await Ruta.findAll();
    res.render('prestamos/create', { clientes, rutas });
  } catch (error) {
    console.error('❌ Error cargando formulario de préstamo:', error.message);
    req.flash('error', 'No se pudo cargar el formulario de préstamo');
    res.redirect('/prestamos');
  }
};

exports.create = async (req, res) => {
  try {
    console.log('POST recibido en /prestamos/create');
    const prestamoId = await Prestamo.create(req.body);
    console.log('🆔 Préstamo creado con ID:', prestamoId);
    const montoBase = parseFloat(req.body.monto_aprobado || req.body.monto_solicitado);
    const interes = parseFloat(req.body.interes_porcentaje || 20);
    const montoTotal = parseFloat((montoBase * (1 + interes / 100)).toFixed(2));
    await Prestamo.generateCuotas(
      prestamoId,
      montoTotal,
      parseInt(req.body.cuotas),
      req.body.forma_pago
    );
    req.flash('success', 'Préstamo creado correctamente');
    res.redirect('/prestamos');
  } catch (error) {
    console.error('❌ Error al crear préstamo:', error.message);
    req.flash('error', `Error al crear préstamo: ${error.message}`);
    res.redirect('/prestamos/create');
  }
};

exports.pendientes = async (req, res) => {
  try {
    const prestamos = await Prestamo.findAllWithClientes('pendiente');
    const formattedPrestamos = prestamos.map(p => ({
      ...p,
      tipo: 'normal',
      monto_solicitado: Number(p.monto_solicitado) || 0,
      monto_aprobado: Number(p.monto_aprobado) || 0,
      fecha_creacion: moment(p.created_at).format('YYYY-MM-DD'),
      cliente: {
        nombre: p.cliente_nombre,
        apellidos: p.cliente_apellidos,
        cedula: p.cliente_cedula,
        profesion: p.cliente_profesion
      }
    }));
    res.render('prestamos/pendientes', {
      title: 'Préstamos Pendientes de Aprobación',
      prestamos: formattedPrestamos,
      moment,
      messages: req.flash()
    });
  } catch (error) {
    console.error('Error al cargar préstamos pendientes:', error);
    req.flash('error', 'Error al cargar préstamos pendientes: ' + error.message);
    res.redirect('/prestamos');
  }
};

exports.aprobarPrestamo = async (req, res) => {
  const prestamoId = req.params.id;
  try {
    const prestamo = await Prestamo.findById(prestamoId);
    if (!prestamo) {
      req.flash('error_msg', 'Préstamo no encontrado');
      return res.redirect('/prestamos/pendientes');
    }
    await Prestamo.updateEstado(prestamoId, 'aprobado');
    const cuotasExistentes = await Prestamo.findCuotasByPrestamo(prestamoId);
    if (!cuotasExistentes.length) {
      await Prestamo.generateCuotas(prestamoId, prestamo.monto_total, prestamo.cuotas, prestamo.forma_pago);
    }
    req.flash('success_msg', 'Préstamo aprobado correctamente');
    res.redirect('/prestamos/pendientes');
  } catch (error) {
    console.error('Error al aprobar préstamo:', error);
    req.flash('error_msg', 'No se pudo aprobar el préstamo');
    res.redirect('/prestamos/pendientes');
  }
};

// ============ MÉTODO SHOW MEJORADO PARA CALCULAR MORA DE FORMA CONSISTENTE ============
exports.show = async (req, res) => {
  try {
    const prestamoId = req.params.id;
    const prestamo = await Prestamo.findById(prestamoId);
    if (!prestamo) {
      req.flash('error', 'Préstamo no encontrado');
      return res.redirect('/prestamos');
    }
    const cuotas = await Prestamo.findCuotasByPrestamo(prestamoId);
    const historialPagos = await Prestamo.getHistorialPagos(prestamoId);

    // Recalculamos la mora total del préstamo a partir de las cuotas vencidas
    const moraTotalCalculada = cuotas.reduce((sum, cuota) => sum + (cuota.mora || 0), 0);
    // Actualizamos la mora del objeto prestamo para la vista
    prestamo.mora_total = moraTotalCalculada;
    // Volvemos a calcular el saldo actual con la mora actualizada
    prestamo.saldo_actual = Math.max(0, prestamo.monto_total + prestamo.mora_total - prestamo.total_pagado);

    res.render('prestamos/show', {
      prestamo,
      cuotas,
      historialPagos,
      moment
    });
  } catch (error) {
    console.error('Error al mostrar préstamo:', error);
    req.flash('error', 'Error al cargar detalles del préstamo');
    res.redirect('/prestamos');
  }
};


exports.pagarCuota = async (req, res) => {
  const cuotaId = req.params.id;
  await db.query(`
    UPDATE cuotas SET estado = 'pagada', fecha_pago = CURRENT_DATE
    WHERE id = :cuotaId
  `, { replacements: { cuotaId } });
  req.flash('success', 'Cuota marcada como pagada');
  res.redirect('back');
};

// ============ MÉTODO PAGAR MEJORADO PARA LA MORA ============
exports.pagar = async (req, res) => {
  const { id: prestamoId } = req.params;
  const { monto, metodo, notas, cuota_id } = req.body;
  const registrado_por = req.user?.nombre || 'Sistema';

  try {
    if (!monto || isNaN(monto) || parseFloat(monto) <= 0) {
      throw new Error('Monto de pago inválido');
    }

    if (!metodo || !['efectivo', 'transferencia', 'tarjeta', 'cheque'].includes(metodo)) {
      throw new Error('Método de pago no válido');
    }

    const prestamo = await Prestamo.findById(prestamoId);
    if (!prestamo) throw new Error('Préstamo no encontrado');

    let mora_pagada = 0;
    // Si se está pagando una cuota, calculamos la mora y la aplicamos
    if (cuota_id) {
      const cuotas = await Prestamo.findCuotasByPrestamo(prestamoId);
      const cuotaAPagar = cuotas.find(c => c.id == cuota_id);
      if (cuotaAPagar.mora > 0) {
        mora_pagada = Math.min(parseFloat(monto), cuotaAPagar.mora);
      }
    }

    // Actualizar la mora total del préstamo si se pagó algo de mora
    if (mora_pagada > 0) {
      await db.query(`
        UPDATE solicitudes_prestamos
        SET moras = moras - :mora_pagada
        WHERE id = :prestamoId
      `, { replacements: { mora_pagada, prestamoId }, type: db.QueryTypes.UPDATE });
    }

    // Registrar el pago en la base de datos
    const [result] = await db.query(
      `INSERT INTO pagos (prestamo_id, cuota_id, monto, moras, metodo, notas, registrado_por, fecha) 
       VALUES (:prestamo_id, :cuota_id, :monto, :moras, :metodo, :notas, :registrado_por, NOW()) RETURNING id`,
      {
        replacements: {
          prestamo_id: prestamoId,
          cuota_id: cuota_id || null,
          monto: parseFloat(monto),
          moras: mora_pagada,
          metodo: metodo,
          notas: notas || null,
          registrado_por: registrado_por
        },
        type: db.QueryTypes.INSERT
      }
    );

    const pagoId = result[0].id;

    // Si es pago de cuota, actualizar estado
    if (cuota_id) {
      await db.query(
        `UPDATE cuotas SET estado = 'pagada', fecha_pago = NOW() 
         WHERE id = :cuota_id AND prestamo_id = :prestamo_id`,
        { replacements: { cuota_id, prestamo_id: prestamoId }, type: db.QueryTypes.UPDATE }
      );
    }
    
    const prestamoActualizado = await Prestamo.findById(prestamoId);
    let cuotaNumero = 'Adicional';
    if (cuota_id) {
      const cuotas = await Prestamo.findCuotasByPrestamo(prestamoId);
      const cuotaPagada = cuotas.find(c => c.id == cuota_id);
      cuotaNumero = cuotaPagada ? cuotaPagada.numero_cuota : 'Adicional';
    }

    const ticketData = {
      cliente: `${prestamoActualizado.cliente_nombre} ${prestamoActualizado.cliente_apellidos}`,
      cedula: prestamoActualizado.cliente_cedula,
      prestamoId: prestamoActualizado.id,
      cuotaNumero,
      monto: parseFloat(monto).toFixed(2),
      mora: mora_pagada.toFixed(2),
      metodo: metodo.charAt(0).toUpperCase() + metodo.slice(1),
      fecha: new Date().toLocaleDateString('es-DO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      })
    };

    setImmediate(async () => {
      try { await imprimirTicket(ticketData); } catch (err) {
        console.error('Error al imprimir ticket:', err.message);
      }
    });

    if (req.xhr || req.accepts('json')) {
      return res.json({
        success: true,
        message: 'Pago registrado correctamente',
        pagoId,
        ticketUrl: `/prestamos/${prestamoId}/recibo?pago=${pagoId}`
      });
    } else {
      req.flash('success', 'Pago registrado correctamente');
      return res.redirect(`/prestamos/${prestamoId}/recibo?pago=${pagoId}`);
    }

  } catch (error) {
    console.error('Error en pagar:', error.message);
    if (req.xhr || req.accepts('json')) {
      return res.status(400).json({ success: false, message: error.message });
    } else {
      req.flash('error', error.message);
      return res.redirect(`/prestamos/${prestamoId}`);
    }
  }
};

// ============ NUEVA FUNCIÓN DEL CONTROLADOR PARA ELIMINAR LA MORA ============
exports.eliminarMora = async (req, res) => {
  const { id } = req.params;
  try {
    const affectedRows = await Prestamo.eliminarMora(id);
    if (affectedRows > 0) {
      req.flash('success', 'La mora del préstamo ha sido eliminada exitosamente.');
      return res.status(200).json({ success: true, message: 'Mora eliminada exitosamente.' });
    } else {
      return res.status(404).json({ success: false, message: 'Préstamo no encontrado o sin mora para eliminar.' });
    }
  } catch (error) {
    console.error('❌ Error en el controlador al eliminar mora:', error);
    return res.status(500).json({ success: false, message: 'Error interno del servidor al eliminar la mora.' });
  }
};

exports.recibo = async (req, res) => {
  try {
    const prestamoId = req.params.id;
    const pagoId = req.query.pago;
    const prestamo = await Prestamo.findById(prestamoId);
    if (!prestamo) throw new Error('Préstamo no encontrado');
    const pagos = await db.query(
      'SELECT * FROM pagos WHERE prestamo_id = ? ORDER BY fecha ASC',
      { replacements: [prestamoId], type: db.QueryTypes.SELECT }
    );
    const pago = pagos.find(p => p.id == pagoId);
    if (!pago) throw new Error('Pago no encontrado');
    let cuota = null;
    if (pago.cuota_id) {
      const [cuotaData] = await db.query(
        'SELECT * FROM cuotas WHERE id = ? LIMIT 1',
        { replacements: [pago.cuota_id], type: db.QueryTypes.SELECT }
      );
      cuota = cuotaData;
    }
    const cuotas = await db.query(
      'SELECT id, numero_cuota FROM cuotas WHERE prestamo_id = ? ORDER BY numero_cuota ASC',
      { replacements: [prestamoId], type: db.QueryTypes.SELECT }
    );
    let numeroCuota = 'Adicional';
    if (pago.cuota_id) {
      const cuotaActual = cuotas.find(c => String(c.id) === String(pago.cuota_id));
      numeroCuota = cuotaActual ? `${cuotaActual.numero_cuota}/${cuotas.length}` : 'Adicional';
    }
    const historialPagos = pagos.map(p => ({
      ...p,
      fecha: p.fecha || new Date(),
      monto: parseFloat(p.monto) || 0,
      metodo: p.metodo || 'N/A'
    }));
    const sumaPagos = historialPagos.reduce((acc, p) => acc + p.monto, 0);
    const totalPrestamo = parseFloat(prestamo.monto_total || 0);
    const restante = Math.max(0, totalPrestamo - sumaPagos);

    res.render('prestamos/recibo', {
      layout: false,
      prestamo: {
        ...prestamo,
        cliente_nombre: prestamo.cliente_nombre || '',
        cliente_apellidos: prestamo.cliente_apellidos || '',
        cliente_cedula: prestamo.cliente_cedula || ''
      },
      pago: {
        ...pago,
        metodo: pago.metodo || 'efectivo',
        monto: parseFloat(pago.monto) || 0,
        mora: parseFloat(pago.moras) || 0,
        fecha: pago.fecha || new Date()
      },
      cuota,
      historialPagos,
      numeroCuota,
      restante: restante.toFixed(2),
      moment
    });
  } catch (error) {
    console.error('Error generando recibo:', error);
    req.flash('error', 'Error al generar recibo: ' + error.message);
    res.redirect(`/prestamos/${req.params.id}`);
  }
};


exports.imprimirTicket = async (req, res) => {
  try {
    const { id: prestamoId } = req.params;
    const pagoId = req.query.pago;
    const pago = await db.query(
      'SELECT * FROM pagos WHERE id = ? LIMIT 1',
      { replacements: [pagoId], type: db.QueryTypes.SELECT }
    ).then(rows => rows[0]);
    if (!pago) throw new Error('Pago no encontrado');
    console.log(`Enviando ticket a impresora para pago ${pagoId}`);
    return res.json({ success: true, message: 'Ticket enviado a impresora' });
  } catch (error) {
    console.error('Error al imprimir ticket:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.editForm = async (req, res) => {
  const id = req.params.id;
  try {
    const prestamo = await Prestamo.findById(id);
    if (!prestamo) {
      req.flash('error', 'Préstamo no encontrado');
      return res.redirect('/prestamos');
    }
    if (prestamo.estado === 'aprobado') {
      prestamo.cuotas = await Prestamo.findCuotasByPrestamo(id);
    }
    const rutas = await Ruta.findAll();
    res.render('prestamos/edit', {
      prestamo,
      rutas,
      user: req.user || {},
      moment,
      messages: req.flash()
    });
  } catch (error) {
    console.error('Error al cargar el formulario de edición:', error);
    req.flash('error', 'No se pudo cargar el préstamo');
    res.redirect('/prestamos');
  }
};

exports.update = async (req, res) => {
  const id = req.params.id;
  try {
    const {
      monto_solicitado,
      monto_aprobado,
      interes_porcentaje,
      forma_pago,
      estado,
      ruta_id
    } = req.body;
    if (!monto_solicitado || isNaN(monto_solicitado)) {
      throw new Error('Monto solicitado no válido');
    }
    const montoAprobado = estado === 'aprobado'
      ? monto_aprobado || monto_solicitado
      : monto_aprobado;
    await Prestamo.update(id, {
      monto_solicitado,
      monto_aprobado: montoAprobado,
      interes_porcentaje,
      forma_pago,
      estado,
      ruta_id
    });
    if (estado === 'aprobado') {
      const cuotas = await Prestamo.findCuotasByPrestamo(id);
      if (!cuotas || cuotas.length === 0) {
        const montoTotal = parseFloat(montoAprobado) * (1 + parseFloat(interes_porcentaje || 43) / 100);
        await Prestamo.generateCuotas(id, montoTotal, req.body.cuotas || 3, forma_pago);
      }
    }
    req.flash('success', 'Préstamo actualizado correctamente');
    res.redirect(`/prestamos/${id}`);
  } catch (error) {
    console.error('Error al actualizar préstamo:', error.message);
    req.flash('error', `No se pudo actualizar el préstamo: ${error.message}`);
    res.redirect(`/prestamos/${id}/edit`);
  }
};

exports.imprimirTicketApi = async (req, res) => {
  const { prestamoId, pagoId } = req.body;
  if (!prestamoId || !pagoId) {
    return res.status(400).json({
      success: false,
      message: 'prestamoId y pagoId son requeridos'
    });
  }
  try {
    const prestamo = await Prestamo.findById(prestamoId);
    if (!prestamo) {
      return res.status(404).json({ success: false, message: 'Préstamo no encontrado' });
    }
    const pagos = await db.query('SELECT * FROM pagos WHERE id = ?', {
      replacements: [pagoId],
      type: db.QueryTypes.SELECT
    });
    const pago = pagos.length > 0 ? pagos[0] : null;
    if (!pago) {
      return res.status(404).json({ success: false, message: 'Pago no encontrado' });
    }
    console.log('pago:', pago);
    console.log('pago.cuota_id:', pago.cuota_id);
    let cuotaNumero = 'N/A';
    if (pago.cuota_id != null) {
      const cuotas = (await Prestamo.findCuotasByPrestamo(prestamoId)) || [];
      console.log('cuotas:', cuotas);
      const cuota = cuotas.find(c => String(c.id) === String(pago.cuota_id));
      cuotaNumero = cuota ? cuota.numero_cuota : 'No registrada';
    }
    const ticketData = {
      cliente: `${prestamo.cliente_nombre} ${prestamo.cliente_apellidos}`,
      cedula: prestamo.cliente_cedula,
      prestamoId: prestamo.id,
      cuotaNumero: cuotaNumero,
      monto: parseFloat(pago.monto),
      metodo: pago.metodo,
      fecha: new Date(pago.fecha).toLocaleString('es-DO')
    };
    await imprimirTicket(ticketData);
    return res.json({ success: true });
  } catch (error) {
    console.error('❌ Error en imprimirTicketApi:', error);
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

exports.imprimir = async (req, res) => {
  try {
    const prestamo = await SolicitudPrestamo.findByIdWithCliente(req.params.id);
    if (!prestamo) {
      return res.status(404).send('Préstamo no encontrado');
    }
    res.render('prestamos/imprimir', { prestamo, layout: false });
  } catch (error) {
    console.error('Error al cargar vista de impresión:', error);
    res.status(500).send('Error interno del servidor');
  }
};