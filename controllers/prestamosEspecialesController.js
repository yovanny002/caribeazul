const PrestamoEspecial = require('../models/PrestamoEspecial');
const PagoEspecial = require('../models/PagoEspecial');
const Cliente = require('../models/Cliente');
const Ruta = require('../models/Ruta');
const moment = require('moment');

// Helpers reutilizables
const formatHelpers = {
  fecha: (dateString) => dateString 
    ? new Date(dateString).toLocaleDateString('es-DO', { year: 'numeric', month: '2-digit', day: '2-digit' })
    : '',

  currency: (amount) => parseFloat(amount || 0).toLocaleString('en-US', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  }),

  safeFloat: (value, defaultValue = 0) => {
    const num = parseFloat(value);
    return isNaN(num) ? defaultValue : num;
  },

  parseId: (id) => {
    const parsed = parseInt(id);
    return isNaN(parsed) ? null : parsed;
  }
};

// Middleware de validación de ID
const validatePrestamoId = (req, res, next) => {
  const prestamoId = formatHelpers.parseId(req.params.id);
  if (!prestamoId) {
    req.flash('error', 'ID de préstamo inválido');
    return res.redirect('/prestamos-especiales');
  }
  req.prestamoId = prestamoId;
  next();
};

// Controlador principal
module.exports = {
  // Listar todos los préstamos
  async index(req, res) {
    try {
      const prestamos = await PrestamoEspecial.findAll();
      const formatted = prestamos.map(p => ({
        ...p,
        fecha_creacion_formatted: formatHelpers.fecha(p.fecha_creacion),
        monto_solicitado: formatHelpers.currency(p.monto_solicitado)
      }));
      
      res.render('prestamosEspeciales/index', { 
        prestamos: formatted, 
        messages: req.flash() 
      });
    } catch (error) {
      console.error('Error al obtener préstamos especiales:', error);
      req.flash('error', 'Error al cargar los préstamos');
      res.redirect('/');
    }
  },

  // Formulario de creación
  async createForm(req, res) {
    try {
      const [clientes, rutas] = await Promise.all([
        Cliente.findAll(),
        Ruta.findAll()
      ]);
      
      res.render('prestamosEspeciales/create', {
        clientes,
        rutas,
        messages: req.flash()
      });
    } catch (error) {
      console.error('Error al cargar formulario:', error);
      req.flash('error', 'Error al cargar formulario');
      res.redirect('/prestamos-especiales');
    }
  },

  // Crear nuevo préstamo
  async create(req, res) {
    try {
      const { cliente_id, monto_solicitado, interes_porcentaje, forma_pago, observaciones } = req.body;
      
      const prestamoId = await PrestamoEspecial.create({
        cliente_id,
        monto_solicitado: formatHelpers.safeFloat(monto_solicitado),
        monto_aprobado: 0, // Se establece en aprobación
        interes_porcentaje: formatHelpers.safeFloat(interes_porcentaje),
        forma_pago,
        observaciones,
        estado: 'pendiente'
      });

      req.flash('success', 'Préstamo especial creado exitosamente');
      res.redirect(`/prestamos-especiales/${prestamoId}`);
    } catch (error) {
      console.error('Error al crear préstamo:', error);
      req.flash('error', `Error al crear préstamo: ${error.message}`);
      res.redirect('/prestamos-especiales/nuevo');
    }
  },

  // Mostrar detalles
  async show(req, res) {
    try {
      const prestamo = await PrestamoEspecial.findById(req.prestamoId);
      if (!prestamo) {
        req.flash('error', 'Préstamo no encontrado');
        return res.redirect('/prestamos-especiales');
      }

      // Formatear montos
      prestamo.monto_solicitado = formatHelpers.safeFloat(prestamo.monto_solicitado);
      prestamo.monto_aprobado = formatHelpers.safeFloat(prestamo.monto_aprobado);
      prestamo.interes_porcentaje = formatHelpers.safeFloat(prestamo.interes_porcentaje);
      prestamo.capital_restante = formatHelpers.safeFloat(prestamo.capital_restante);

      // Obtener y formatear pagos
      const pagos = await PagoEspecial.findByPrestamo(req.prestamoId);
      let totalPagado = 0, capitalPagado = 0, interesPagado = 0;

      const pagosFormatted = pagos.map(pago => {
        pago.monto = formatHelpers.safeFloat(pago.monto);
        pago.capital_pagado = formatHelpers.safeFloat(pago.capital_pagado);
        pago.interes_pagado = formatHelpers.safeFloat(pago.interes_pagado);
        pago.fecha_formatted = formatHelpers.fecha(pago.fecha);

        totalPagado += pago.monto;
        capitalPagado += pago.capital_pagado;
        interesPagado += pago.interes_pagado;

        return pago;
      });

      res.render('prestamosEspeciales/show', {
        prestamo: {
          ...prestamo,
          fecha_creacion_formatted: formatHelpers.fecha(prestamo.fecha_creacion),
          fecha_aprobacion_formatted: formatHelpers.fecha(prestamo.fecha_aprobacion)
        },
        pagos: pagosFormatted,
        totalPagado,
        capitalPagado,
        interesPagado,
        messages: req.flash()
      });
    } catch (error) {
      console.error('Error al mostrar préstamo:', error);
      req.flash('error', 'Error al cargar detalles');
      res.redirect('/prestamos-especiales');
    }
  },

  // Formulario de edición
  async editForm(req, res) {
    try {
      const [prestamo, clientes] = await Promise.all([
        PrestamoEspecial.findById(req.prestamoId),
        Cliente.findAll()
      ]);

      if (!prestamo) {
        req.flash('error', 'Préstamo no encontrado');
        return res.redirect('/prestamos-especiales');
      }

      res.render('prestamosEspeciales/edit', { 
        prestamo, 
        clientes,
        messages: req.flash() 
      });
    } catch (error) {
      console.error('Error al cargar formulario:', error);
      req.flash('error', 'Error al cargar formulario');
      res.redirect(`/prestamos-especiales/${req.prestamoId}`);
    }
  },

  // Actualizar préstamo
  async update(req, res) {
    try {
      const { monto_solicitado, interes_porcentaje, forma_pago, observaciones } = req.body;
      
      await PrestamoEspecial.update(req.prestamoId, {
        monto_solicitado: formatHelpers.safeFloat(monto_solicitado),
        interes_porcentaje: formatHelpers.safeFloat(interes_porcentaje),
        forma_pago,
        observaciones
      });

      req.flash('success', 'Préstamo actualizado exitosamente');
      res.redirect(`/prestamos-especiales/${req.prestamoId}`);
    } catch (error) {
      console.error('Error al actualizar:', error);
      req.flash('error', `Error al actualizar: ${error.message}`);
      res.redirect(`/prestamos-especiales/${req.prestamoId}/editar`);
    }
  },

  // Aprobar préstamo
  async aprobar(req, res) {
    try {
      const { monto_aprobado } = req.body;
      const monto = formatHelpers.safeFloat(monto_aprobado);

      if (monto <= 0) {
        req.flash('error', 'El monto aprobado debe ser positivo');
        return res.redirect('/prestamos-especiales/pendientes');
      }

      await PrestamoEspecial.update(req.prestamoId, {
        estado: 'aprobado',
        monto_aprobado: monto,
        capital_restante: monto,
        fecha_aprobacion: new Date()
      });

      req.flash('success', `Préstamo #${req.prestamoId} aprobado por RD$ ${formatHelpers.currency(monto)}`);
      res.redirect('/prestamos-especiales');
    } catch (error) {
      console.error('Error al aprobar:', error);
      req.flash('error', 'Error al aprobar préstamo');
      res.redirect('/prestamos-especiales/pendientes');
    }
  },

  // Rechazar préstamo
  async rechazar(req, res) {
    try {
      await PrestamoEspecial.update(req.prestamoId, { 
        estado: 'rechazado',
        fecha_rechazo: new Date()
      });
      
      req.flash('success', 'Préstamo rechazado correctamente');
      res.redirect('/prestamos-especiales/pendientes');
    } catch (error) {
      console.error('Error al rechazar:', error);
      req.flash('error', 'Error al rechazar préstamo');
      res.redirect('/prestamos-especiales/pendientes');
    }
  },

  // Formulario de pago
  async pagoForm(req, res) {
    try {
      const prestamo = await PrestamoEspecial.findById(req.prestamoId);
      if (!prestamo || !['aprobado', 'pendiente'].includes(prestamo.estado)) {
        req.flash('error', 'No se pueden registrar pagos para este préstamo');
        return res.redirect(`/prestamos-especiales/${req.prestamoId}`);
      }

      const pagos = await PagoEspecial.findByPrestamo(req.prestamoId);
      const montoAprobado = formatHelpers.safeFloat(prestamo.monto_aprobado);
      const interesTotal = montoAprobado * (formatHelpers.safeFloat(prestamo.interes_porcentaje) / 100);
      const interesPagado = pagos.reduce((sum, p) => sum + formatHelpers.safeFloat(p.interes_pagado), 0);

      res.render('prestamosEspeciales/pago', {
        prestamo,
        interesPendienteDePago: Math.max(0, interesTotal - interesPagado),
        capitalRestanteDisplay: formatHelpers.safeFloat(prestamo.capital_restante),
        messages: req.flash()
      });
    } catch (error) {
      console.error('Error al cargar formulario:', error);
      req.flash('error', 'Error al cargar formulario de pago');
      res.redirect(`/prestamos-especiales/${req.prestamoId}`);
    }
  },

  // Procesar pago
  async procesarPago(req, res) {
    try {
      const { monto_pago, metodo_pago } = req.body;
      const montoPago = formatHelpers.safeFloat(monto_pago);

      if (montoPago <= 0) {
        req.flash('error', 'Monto de pago inválido');
        return res.redirect(`/prestamos-especiales/${req.prestamoId}/pago`);
      }

      const [prestamo, pagosPrevios] = await Promise.all([
        PrestamoEspecial.findById(req.prestamoId),
        PagoEspecial.findByPrestamo(req.prestamoId)
      ]);

      if (!prestamo || prestamo.estado !== 'aprobado') {
        req.flash('error', 'Préstamo no válido para pago');
        return res.redirect(`/prestamos-especiales/${req.prestamoId}`);
      }

      // Cálculo de distribución del pago
      const resultadoPago = this._calcularDistribucionPago(
        prestamo, 
        pagosPrevios, 
        montoPago
      );

      // Registrar pago
      const pagoId = await PagoEspecial.create({
        prestamo_especial_id: req.prestamoId,
        monto: montoPago,
        capital_pagado: resultadoPago.capitalPagado,
        interes_pagado: resultadoPago.interesPagado,
        metodo: metodo_pago,
        registrado_por: req.user?.nombre || 'Sistema'
      });

      // Actualizar préstamo
      await PrestamoEspecial.update(req.prestamoId, {
        capital_restante: resultadoPago.nuevoCapitalRestante,
        estado: resultadoPago.nuevoEstado
      });

      req.flash('success', `Pago de RD$ ${formatHelpers.currency(montoPago)} registrado`);
      res.redirect(`/prestamos-especiales/${req.prestamoId}/recibo/${pagoId}`);
    } catch (error) {
      console.error('Error al procesar pago:', error);
      req.flash('error', `Error al procesar pago: ${error.message}`);
      res.redirect(`/prestamos-especiales/${req.prestamoId}/pago`);
    }
  },

  // Recibo de pago
  async recibo(req, res) {
    try {
      const pagoId = formatHelpers.parseId(req.params.pagoId);
      if (!pagoId) {
        req.flash('error', 'ID de pago inválido');
        return res.redirect(`/prestamos-especiales/${req.prestamoId}`);
      }

      const [pago, prestamo] = await Promise.all([
        PagoEspecial.findById(pagoId),
        PrestamoEspecial.findById(req.prestamoId)
      ]);

      if (!pago || pago.prestamo_especial_id !== req.prestamoId || !prestamo) {
        req.flash('error', 'Recibo no encontrado');
        return res.redirect(`/prestamos-especiales/${req.prestamoId}`);
      }

      // Obtener datos adicionales
      const [cliente, ruta] = await Promise.all([
        Cliente.findById(prestamo.cliente_id),
        prestamo.cliente_id ? Ruta.findById(prestamo.cliente_id) : Promise.resolve(null)
      ]);

      res.render('prestamosEspeciales/recibo', {
        pago: {
          ...pago,
          cliente,
          ruta,
          prestamoEspecial: {
            ...prestamo,
            capital_restante: formatHelpers.safeFloat(prestamo.capital_restante)
          },
          fecha_formatted: pago.fecha 
            ? new Date(pago.fecha).toLocaleString('es-DO')
            : 'Fecha no disponible'
        },
        messages: req.flash()
      });
    } catch (error) {
      console.error('Error al generar recibo:', error);
      req.flash('error', 'Error al generar recibo');
      res.redirect(`/prestamos-especiales/${req.prestamoId}`);
    }
  },

  // Método auxiliar para cálculo de distribución de pago
  _calcularDistribucionPago(prestamo, pagosPrevios, montoPago) {
    const montoAprobado = formatHelpers.safeFloat(prestamo.monto_aprobado);
    const interesTotal = montoAprobado * (formatHelpers.safeFloat(prestamo.interes_porcentaje) / 100);
    const interesPagado = pagosPrevios.reduce((sum, p) => sum + formatHelpers.safeFloat(p.interes_pagado), 0);
    
    let interesPendiente = Math.max(0, interesTotal - interesPagado);
    let capitalRestante = formatHelpers.safeFloat(prestamo.capital_restante);
    let restante = montoPago;
    
    // Primero aplicar a interés pendiente
    const interesPagadoNow = Math.min(restante, interesPendiente);
    restante -= interesPagadoNow;
    
    // Luego aplicar a capital
    const capitalPagado = Math.min(restante, capitalRestante);
    const nuevoCapitalRestante = capitalRestante - capitalPagado;
    
    return {
      interesPagado: interesPagadoNow,
      capitalPagado,
      nuevoCapitalRestante,
      nuevoEstado: nuevoCapitalRestante <= 0.01 ? 'pagado' : prestamo.estado
    };
  },

  // Middleware de validación
  validatePrestamoId
};