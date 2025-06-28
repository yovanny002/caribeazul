  const db = require('../models/db');
  const Prestamo = require('../models/Prestamo');
  const Cliente = require('../models/Cliente');
  const Pago = require('../models/Pago');
  const Ruta = require('../models/Ruta'); // Asegúrate de que este archivo existe
  const moment = require('moment');
  const { imprimirTicket } = require('../utils/impresora'); // crearás esto luego
  const PDFDocument = require('pdfkit'); // Asegúrate de tener esta dependencia
  const fs = require('fs');

  // Mostrar todos los préstamos
  exports.index = async (req, res) => {
    try {
      const prestamos = await Prestamo.findAllWithClientes();
      res.render('prestamos/index', { prestamos, messages: req.flash() });
    } catch (error) {
      console.error('Error al obtener préstamos:', error);
      req.flash('error', 'Hubo un error al cargar los préstamos');
      res.redirect('/');
    }
  };

  // Mostrar formulario para crear préstamo
exports.createForm = async (req, res) => {
  try {
    const clientes = await Cliente.findAll();
    const rutas = await Ruta.findAll(); // <-- Asegúrate de que devuelve [{ id, zona, nombre }, ...]

    res.render('prestamos/create', {
      clientes,
      rutas
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
    const prestamos = await Prestamo.findAllWithClientes('pendiente');
    res.render('prestamos/pendientes', { title: 'Préstamos Pendientes', prestamos });
  } catch (error) {
    console.error('Error al cargar préstamos pendientes:', error);
    req.flash('error', 'No se pudieron cargar los préstamos');
    res.redirect('/');
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

    // Calcular mora pendiente para cada cuota vencida
    const cuotasConMora = await Promise.all(cuotas.map(async cuota => {
      const esVencida = new Date(cuota.fecha_vencimiento) < new Date() && cuota.estado !== 'pagada';
      if (esVencida) {
        const diasAtraso = Math.max(0, Math.floor((new Date() - new Date(cuota.fecha_vencimiento)) / (1000 * 60 * 60 * 24)) - 2);
        cuota.mora = diasAtraso > 0 ? cuota.monto * 0.05 * diasAtraso : 0;
      } else {
        cuota.mora = 0;
      }
      return cuota;
    }));

    res.render('prestamos/show', {
      prestamo,
      cuotas: cuotasConMora,
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
  // Ruta POST: /prestamos/:id/pagar
  // Corregir el método de pago
  // Controlador para procesar pagos
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

    // Calcular mora si es pago de cuota
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

    // Obtener datos para el ticket
    const prestamo = await Prestamo.findById(prestamoId);
    if (!prestamo) {
      throw new Error('Préstamo no encontrado');
    }

    // Obtener número de cuota si aplica
    let cuotaNumero = null;
    if (cuota_id) {
      const cuotas = await Cuota.findCuotasByPrestamo(prestamoId);
      const cuotaPagada = cuotas.find(c => c.id == cuota_id);
      cuotaNumero = cuotaPagada ? cuotaPagada.numero_cuota : null;
    }

    // Preparar datos para impresión
    const ticketData = {
      cliente: `${prestamo.cliente_nombre} ${prestamo.cliente_apellidos}`,
      cedula: prestamo.cliente_cedula,
      prestamoId: prestamo.id,
      cuotaNumero: cuotaNumero || 'Adicional',
      monto: montoTotal.toFixed(2),
      mora: mora.toFixed(2),
      metodo: metodo.charAt(0).toUpperCase() + metodo.slice(1),
      fecha: new Date().toLocaleDateString('es-DO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      })
    };

    // Imprimir ticket (manejando errores)
    try {
      await imprimirTicket(ticketData);
    } catch (error) {
      console.error('Error al imprimir:', error.message);
    }

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

