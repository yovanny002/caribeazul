  const db = require('../models/db');
  const Prestamo = require('../models/Prestamo');
  const Cliente = require('../models/Cliente');
  const Cuota = require('../models/Cuota');
  const Pago = require('../models/Pago');
  const SolicitudPrestamo = require('../models/SolicitudPrestamo');
  const Ruta = require('../models/Ruta'); // Asegúrate de que este archivo existe
  const moment = require('moment');
  const { imprimirTicket } = require('../utils/impresora'); // crearás esto luego
  const PDFDocument = require('pdfkit'); // Asegúrate de tener esta dependencia
  const fs = require('fs');


  // Mostrar todos los préstamos
  exports.index = async (req, res) => {
    try {
      const prestamos = await Prestamo.findAllWithClientes();
      res.render('prestamos/index', { prestamos,moment, messages: req.flash() });
    } catch (error) {
      console.error('Error al obtener préstamos:', error);
      req.flash('error', 'Hubo un error al cargar los préstamos');
      res.redirect('/');
    }
  };

  // Mostrar formulario para crear préstamo
// Modificar el método createForm para incluir tipo de préstamo
exports.createForm = async (req, res) => {
  try {
    const clientes = await Cliente.findAll();
    const rutas = await Ruta.findAll();

    res.render('prestamos/create', {
      clientes,
      rutas,
      tiposPrestamo: [
        { value: 'cerrado', label: 'Préstamo Cerrado (Cuotas fijas)' },
        { value: 'abierto', label: 'Préstamo Abierto (Interés sobre saldo)' }
      ]
    });
  } catch (error) {
    console.error('❌ Error cargando formulario de préstamo:', error.message);
    req.flash('error', 'No se pudo cargar el formulario de préstamo');
    res.redirect('/prestamos');
  }
};


  // Crear un nuevo préstamo
  exports.create = async (req, res) => {
    try {
      console.log('POST recibido en /prestamos/create');
      console.log(req.body);

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
    // Solo préstamos normales con estado 'pendiente'
    const prestamos = await Prestamo.findAllWithClientes('pendiente');

    // Formatear datos para la vista
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
  // Mostrar un préstamo específico

  // En tu controlador (prestamoController.js)
// En el método show, asegurarnos de pasar moment a la vista
// Modificar el método show para mostrar información de préstamos abiertos
exports.show = async (req, res) => {
  try {
    const prestamoId = req.params.id;
    const prestamo = await Prestamo.findById(prestamoId);

    if (!prestamo) {
      req.flash('error', 'Préstamo no encontrado');
      return res.redirect('/prestamos');
    }

    let cuotas = [];
    let historialPagos = [];
    
    if (prestamo.tipo_prestamo === 'cerrado') {
      cuotas = await Prestamo.findCuotasByPrestamo(prestamoId);
      historialPagos = await Prestamo.getHistorialPagos(prestamoId);
    } else {
      // Para préstamos abiertos, obtener historial de pagos con detalles de interés/capital
      historialPagos = await db.query(`
        SELECT p.*, 
               DATE_FORMAT(p.fecha, '%d/%m/%Y') as fecha_display,
               p.monto as monto_formatted
        FROM pagos p
        WHERE p.prestamo_id = ?
        ORDER BY p.fecha DESC
      `, { replacements: [prestamoId], type: QueryTypes.SELECT });
    }

    res.render('prestamos/show', {
      prestamo,
      cuotas,
      historialPagos,
      moment,
      esAbierto: prestamo.tipo_prestamo === 'abierto'
    });
  } catch (error) {
    console.error('Error al mostrar préstamo:', error);
    req.flash('error', 'Error al cargar detalles del préstamo');
    res.redirect('/prestamos');
  }
};
// Nuevo método para calcular interés acumulado
exports.calcularInteres = async (req, res) => {
  try {
    const { id } = req.params;
    const interesDiario = await Prestamo.calcularInteresDiario(id);
    
    res.json({
      success: true,
      interesDiario,
      message: 'Interés calculado correctamente'
    });
  } catch (error) {
    console.error('Error calculando interés:', error);
    res.status(500).json({
      success: false,
      message: 'Error calculando interés'
    });
  }
};
// Nuevo método para registrar pagos en préstamos abiertos
exports.registrarPagoAbierto = async (req, res) => {
  try {
    const { id } = req.params;
    const { monto, metodo } = req.body;
    const registrado_por = req.user?.nombre || 'Sistema';

    // Obtener el préstamo
    const prestamo = await Prestamo.findById(id);
    if (!prestamo || prestamo.tipo_prestamo !== 'abierto') {
      return res.status(400).json({ success: false, message: 'Préstamo no válido' });
    }

    // Calcular interés acumulado
    const ultimoPago = await db.query(
      `SELECT fecha FROM pagos WHERE prestamo_id = ? ORDER BY fecha DESC LIMIT 1`,
      { replacements: [id], type: QueryTypes.SELECT }
    );

    const fechaInicio = ultimoPago.length > 0 ? 
      new Date(ultimoPago[0].fecha) : 
      new Date(prestamo.created_at);
    
    const dias = Math.max(1, Math.floor((new Date() - fechaInicio) / (1000 * 60 * 60 * 24)));
    const interesDiario = (prestamo.saldo_actual * (prestamo.interes_porcentaje / 100)) / 30;
    const interesAcumulado = parseFloat((interesDiario * dias).toFixed(2));

    // Distribuir el pago
    let pagoInteres = 0;
    let pagoCapital = 0;

    if (monto >= interesAcumulado) {
      pagoInteres = interesAcumulado;
      pagoCapital = parseFloat((monto - interesAcumulado).toFixed(2));
    } else {
      pagoInteres = monto;
      pagoCapital = 0;
    }

    // Registrar el pago
    await db.query(
      `INSERT INTO pagos (prestamo_id, monto, interes, capital, metodo, registrado_por, fecha)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      {
        replacements: [
          id,
          monto,
          pagoInteres,
          pagoCapital,
          metodo,
          registrado_por
        ],
        type: QueryTypes.INSERT
      }
    );

    // Actualizar saldo del préstamo
    const nuevoSaldo = parseFloat((prestamo.saldo_actual - pagoCapital).toFixed(2));
    
    await db.query(
      `UPDATE solicitudes_prestamos 
       SET saldo_actual = ?, total_pagado = total_pagado + ?
       WHERE id = ?`,
      {
        replacements: [nuevoSaldo, monto, id],
        type: QueryTypes.UPDATE
      }
    );

    res.json({ 
      success: true,
      message: 'Pago registrado correctamente',
      nuevoSaldo,
      pagoInteres,
      pagoCapital
    });

  } catch (error) {
    console.error('Error en registrarPagoAbierto:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
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

exports.pagar = async (req, res) => {
  const { id: prestamoId } = req.params;
  const { monto, metodo, notas, cuota_id } = req.body;
  const registrado_por = req.user?.nombre || 'Sistema';

  try {
    // Validaciones básicas
    if (!monto || isNaN(monto) || parseFloat(monto) <= 0) {
      throw new Error('Monto de pago inválido');
    }

    if (!metodo || !['efectivo', 'transferencia', 'tarjeta', 'cheque'].includes(metodo)) {
      throw new Error('Método de pago no válido');
    }

    // Calcular mora si es pago de cuota vencida
    let mora = 0;
    if (cuota_id) {
      mora = await Cuota.calcularMora(cuota_id);
    }

    const montoTotal = parseFloat(monto) + mora;

    // Registrar el pago
    const [result] = await db.query(
      `INSERT INTO pagos (prestamo_id, cuota_id, monto, mora, metodo, notas, registrado_por, fecha) 
       VALUES (:prestamo_id, :cuota_id, :monto, :mora, :metodo, :notas, :registrado_por, NOW())`,
      {
        replacements: {
          prestamo_id: prestamoId,
          cuota_id: cuota_id || null,
          monto: montoTotal,
          mora: mora,
          metodo: metodo,
          notas: notas || null,
          registrado_por: registrado_por
        },
        type: db.QueryTypes.INSERT
      }
    );

    const pagoId = result;

    // Si es pago de cuota, actualizar estado
    if (cuota_id) {
      await db.query(
        `UPDATE cuotas SET estado = 'pagada', fecha_pago = NOW() 
         WHERE id = :cuota_id AND prestamo_id = :prestamo_id`,
        {
          replacements: {
            cuota_id: cuota_id,
            prestamo_id: prestamoId
          }
        }
      );
    }

    // Obtener datos del préstamo
    const prestamo = await Prestamo.findById(prestamoId);
    if (!prestamo) throw new Error('Préstamo no encontrado');

    // Obtener número de cuota si aplica
    let cuotaNumero = 'Adicional';
    if (cuota_id) {
      const cuotas = await Cuota.findCuotasByPrestamo(prestamoId);
      const cuotaPagada = cuotas.find(c => c.id == cuota_id);
      cuotaNumero = cuotaPagada ? cuotaPagada.numero_cuota : 'Adicional';
    }

    const ticketData = {
      cliente: `${prestamo.cliente_nombre} ${prestamo.cliente_apellidos}`,
      cedula: prestamo.cliente_cedula,
      prestamoId: prestamo.id,
      cuotaNumero,
      monto: montoTotal.toFixed(2),
      mora: mora.toFixed(2),
      metodo: metodo.charAt(0).toUpperCase() + metodo.slice(1),
      fecha: new Date().toLocaleDateString('es-DO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      })
    };

    // Imprimir ticket (no bloqueante)
    setImmediate(async () => {
      try {
        await imprimirTicket(ticketData);
      } catch (err) {
        console.error('Error al imprimir ticket:', err.message);
      }
    });

    // Responder
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
      return res.status(400).json({
        success: false,
        message: error.message
      });
    } else {
      req.flash('error', error.message);
      return res.redirect(`/prestamos/${prestamoId}`);
    }
  }
};

  // Funciones auxiliares para manejar respuestas
  async function handleSuccessResponse(res, req, { prestamoId, pagoId, ticketData, redirectUrl }) {
    if (req.xhr || req.accepts('json')) {
      return res.json({
        success: true,
        message: 'Pago registrado correctamente',
        pagoId,
        ticketData,
        ticketUrl: redirectUrl
      });
    } else {
      req.flash('success', 'Pago registrado correctamente');
      return res.redirect(redirectUrl);
    }
  }

  async function handleErrorResponse(res, req, message, prestamoId) {
    console.error('Error en pago:', message);
    
    if (req.xhr || req.accepts('json')) {
      return res.status(400).json({
        success: false,
        message: message
      });
    } else {
      req.flash('error', message);
      return res.redirect(`/prestamos/${prestamoId}`);
    }
  }

  // Función para generar ticket sin bloquear la respuesta
  async function generarTicketNoBloqueante(ticketData) {
    try {

      // Usar setImmediate para no bloquear el ciclo de eventos
      setImmediate(async () => {
        try {
          await imprimirTicket(ticketData);
        } catch (error) {
          console.error('⚠️ Error al imprimir ticket:', error.message);
          // Opcional: Registrar fallo de impresión en base de datos
        }
      });
    } catch (error) {
      console.error('⚠️ Error al cargar módulo de impresión:', error.message);
    }
  };
  // En prestamoController.js
  // Ruta GET: /prestamos/:id/recibo
// Ruta GET: /prestamos/:id/recibo
exports.recibo = async (req, res) => {
  try {
    const prestamoId = req.params.id;
    const pagoId = req.query.pago;

    // Obtener préstamo con datos completos
    const prestamo = await Prestamo.findById(prestamoId);
    if (!prestamo) throw new Error('Préstamo no encontrado');

    // Obtener todos los pagos
    const pagos = await db.query(
      'SELECT * FROM pagos WHERE prestamo_id = ? ORDER BY fecha ASC',
      { replacements: [prestamoId], type: db.QueryTypes.SELECT }
    );

    const pago = pagos.find(p => p.id == pagoId);
    if (!pago) throw new Error('Pago no encontrado');

    // Obtener cuota relacionada si existe
    let cuota = null;
    if (pago.cuota_id) {
      const [cuotaData] = await db.query(
        'SELECT * FROM cuotas WHERE id = ? LIMIT 1',
        { replacements: [pago.cuota_id], type: db.QueryTypes.SELECT }
      );
      cuota = cuotaData;
    }

    // Obtener cuotas para determinar número de cuota
    const cuotas = await db.query(
      'SELECT id, numero_cuota FROM cuotas WHERE prestamo_id = ? ORDER BY numero_cuota ASC',
      { replacements: [prestamoId], type: db.QueryTypes.SELECT }
    );

    let numeroCuota = 'Adicional';
    if (pago.cuota_id) {
      const cuotaActual = cuotas.find(c => String(c.id) === String(pago.cuota_id));
      numeroCuota = cuotaActual ? `${cuotaActual.numero_cuota}/${cuotas.length}` : 'Adicional';
    }

    // Preparar historial de pagos
    const historialPagos = pagos.map(p => ({
      ...p,
      fecha: p.fecha || new Date(),
      monto: parseFloat(p.monto) || 0,
      metodo: p.metodo || 'N/A'
    }));

    // Calcular montos importantes
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
        mora: parseFloat(pago.mora) || 0,
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


  // En controllers/prestamoController.js
  // En prestamoController.js
  exports.imprimirTicket = async (req, res) => {
    try {
      const { id: prestamoId } = req.params;
      const pagoId = req.query.pago;

      // Validar que exista el pago
      const pago = await db.query(
        'SELECT * FROM pagos WHERE id = ? LIMIT 1',
        { replacements: [pagoId], type: db.QueryTypes.SELECT }
      ).then(rows => rows[0]);

      if (!pago) throw new Error('Pago no encontrado');

      // Aquí iría el código para enviar a la impresora térmica
      // Por ejemplo usando node-thermal-printer o similar
      
      // Simulación de impresión exitosa
      console.log(`Enviando ticket a impresora para pago ${pagoId}`);
      
      return res.json({ success: true, message: 'Ticket enviado a impresora' });

    } catch (error) {
      console.error('Error al imprimir ticket:', error);
      return res.status(500).json({ 
        success: false,
        message: error.message
      });
    }
  };

  // Formulario para editar un préstamo
  exports.editForm = async (req, res) => {
    const id = req.params.id;
    try {
      const prestamo = await Prestamo.findById(id);
      if (!prestamo) {
        req.flash('error', 'Préstamo no encontrado');
        return res.redirect('/prestamos');
      }

      if (Prestamo.findCuotasByPrestamo) {
        prestamo.cuotas = await Prestamo.findCuotasByPrestamo(id);
      }

      res.render('prestamos/edit', {
        prestamo,
        user: req.user || {},
        moment
      });
    } catch (error) {
      console.error('Error al cargar el formulario de edición:', error);
      req.flash('error', 'No se pudo cargar el préstamo');
      res.redirect('/prestamos');
    }
  };

  // Actualizar préstamo existente
  exports.update = async (req, res) => {
    const id = req.params.id;
    const {
      monto_solicitado,
      monto_aprobado,
      interes_porcentaje,
      forma_pago,
      estado
    } = req.body;

    try {
      await Prestamo.update(id, {
        monto_solicitado,
        monto_aprobado,
        interes_porcentaje,
        forma_pago,
        estado
      });

      req.flash('success', 'Préstamo actualizado correctamente');
      res.redirect('/prestamos');
    } catch (err) {
      console.error('Error al actualizar préstamo:', err.message);
      req.flash('error', 'No se pudo actualizar el préstamo');
      res.redirect(`/prestamos/${id}/edit`);
    }
  };
  // En prestamoController.js
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
        return res.status(404).json({
          success: false,
          message: 'Préstamo no encontrado'
        });
      }

      const pagos = await db.query('SELECT * FROM pagos WHERE id = ?', {
        replacements: [pagoId],
        type: db.QueryTypes.SELECT
      });

      const pago = pagos.length > 0 ? pagos[0] : null;

      if (!pago) {
        return res.status(404).json({
          success: false,
          message: 'Pago no encontrado'
        });
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
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
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


