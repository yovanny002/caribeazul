const PrestamoEspecial = require('../models/PrestamoEspecial');
const PagoEspecial = require('../models/PagoEspecial');
const Cliente = require('../models/Cliente');
const Ruta = require('../models/Ruta');
const moment = require('moment');

// Listar todos los préstamos especiales con paginación
exports.index = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const [prestamos, totalCount] = await Promise.all([
      PrestamoEspecial.findAllWithClienteYRuta({ limit, offset }),
      PrestamoEspecial.countAll()
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    const formattedPrestamos = prestamos.map(p => ({
      ...p,
      monto_aprobado: parseFloat(p.monto_aprobado) || 0,
      capital_restante: parseFloat(p.capital_restante) || parseFloat(p.monto_aprobado) || 0,
      interes_porcentaje: parseFloat(p.interes_porcentaje) || 0,
      fecha_creacion: p.created_at,
      estado_class: p.estado === 'aprobado' ? 'success' : 
                   p.estado === 'pendiente' ? 'warning' : 'danger'
    }));

    res.render('prestamosEspeciales/index', {
      prestamos: formattedPrestamos,
      title: 'Préstamos Especiales',
      messages: req.flash(),
      currentPage: page,
      totalPages,
      limit,
      moment
    });
  } catch (error) {
    console.error('Error al listar préstamos especiales:', error);
    req.flash('error', 'No se pudieron cargar los préstamos especiales');
    res.redirect('/');
  }
};

// Mostrar formulario para crear préstamo especial
exports.createForm = async (req, res) => {
  try {
    const clientes = await Cliente.findAll({
      where: { estado: 'activo' },
      order: [['nombre', 'ASC']]
    });

    const rutas = await Ruta.findAll({
      order: [['zona', 'ASC'], ['nombre', 'ASC']]
    });

    res.render('prestamosEspeciales/create', {
      clientes,
      rutas,
      title: 'Crear Préstamo Especial',
      prestamo: {},
      messages: req.flash()
    });
  } catch (error) {
    console.error('Error al cargar formulario de préstamo especial:', error);
    req.flash('error', 'No se pudo cargar el formulario de préstamo especial');
    res.redirect('/prestamos-especiales');
  }
};

// Crear un nuevo préstamo especial
exports.create = async (req, res) => {
  try {
    const { cliente_id, ruta_id, monto_solicitado, monto_aprobado, interes_porcentaje, forma_pago } = req.body;

    if (!cliente_id) {
      req.flash('error', 'Debe seleccionar un cliente');
      return res.redirect('/prestamos-especiales/nuevo');
    }

    const montoSolicitado = Number(monto_solicitado) || 0;
    const montoAprobado = Number(monto_aprobado) || montoSolicitado;

    if (montoSolicitado <= 0) {
      req.flash('error', 'Monto solicitado no válido');
      return res.redirect('/prestamos-especiales/nuevo');
    }

    const prestamoData = {
      cliente_id,
      ruta_id: ruta_id || null,
      monto_solicitado: montoSolicitado,
      monto_aprobado: montoAprobado,
      interes_porcentaje: Number(interes_porcentaje) || 0,
      forma_pago,
      estado: 'pendiente',
      capital_restante: montoAprobado, // 👈 forzamos aquí
      fecha_creacion: new Date()
    };

    const nuevoPrestamo = await PrestamoEspecial.create(prestamoData);

    req.flash('success', 'Préstamo especial creado correctamente');
    res.redirect(`/prestamos-especiales/${nuevoPrestamo.id}`);
  } catch (error) {
    console.error('❌ Error al crear préstamo especial:', error);
    req.flash('error', `Error al crear préstamo especial: ${error.message}`);
    res.redirect('/prestamos-especiales/nuevo');
  }
};


// Mostrar detalle de un préstamo especial
exports.show = async (req, res) => {
  try {
    const prestamo = await PrestamoEspecial.findByIdWithClienteYRuta(req.params.id);
    if (!prestamo) {
      req.flash('error', 'Préstamo especial no encontrado.');
      return res.redirect('/prestamos-especiales');
    }

    prestamo.monto_aprobado = Number(prestamo.monto_aprobado) || 0;
    prestamo.capital_restante = Number(prestamo.capital_restante) || prestamo.monto_aprobado;
    prestamo.interes_porcentaje = Number(prestamo.interes_porcentaje) || 0;

    const pagos = await PagoEspecial.findAllByPrestamoId(prestamo.id) || [];

    const totalPagado = pagos.reduce((sum, pago) => sum + (Number(pago.monto) || 0), 0);
    const interesPagado = pagos.reduce((sum, pago) => sum + (Number(pago.interes_pagado) || 0), 0);
    const capitalPagado = pagos.reduce((sum, pago) => sum + (Number(pago.capital_pagado) || 0), 0);

    res.render('prestamosEspeciales/show', {
      prestamo: {
        ...prestamo,
        fecha_creacion: moment(prestamo.fecha_creacion).format('DD/MM/YYYY')
      },
      pagos: pagos.map(pago => ({
        ...pago,
        monto: Number(pago.monto) || 0,
        interes_pagado: Number(pago.interes_pagado) || 0,
        capital_pagado: Number(pago.capital_pagado) || 0,
        fecha: moment(pago.fecha).format('DD/MM/YYYY')
      })),
      totalPagado,
      interesPagado,
      capitalPagado,
      moment,
      title: 'Detalle del Préstamo Especial',
      messages: req.flash()
    });
  } catch (error) {
    console.error('Error detallado:', error.stack);
    req.flash('error', 'Error al mostrar el préstamo especial.');
    res.redirect('/prestamos-especiales');
  }
};

// Formulario para editar préstamo especial
exports.editForm = async (req, res) => {
  try {
    const prestamo = await PrestamoEspecial.findById(req.params.id);
    if (!prestamo) {
      req.flash('error', 'Préstamo no encontrado');
      return res.redirect('/prestamos-especiales');
    }

    const clientes = await Cliente.findAll({
      where: { estado: 'activo' },
      order: [['nombre', 'ASC']]
    });

    const rutas = await Ruta.findAll({
      order: [['zona', 'ASC'], ['nombre', 'ASC']]
    });

    res.render('prestamosEspeciales/edit', {
      prestamo,
      clientes,
      rutas,
      title: 'Editar Préstamo Especial',
      messages: req.flash()
    });
  } catch (error) {
    console.error('Error al cargar formulario de edición:', error);
    req.flash('error', 'Error al cargar formulario de edición');
    res.redirect(`/prestamos-especiales/${req.params.id}`);
  }
};

// Actualizar préstamo especial
exports.update = async (req, res) => {
  try {
    const prestamo = await PrestamoEspecial.findById(req.params.id);
    if (!prestamo) {
      req.flash('error', 'Préstamo no encontrado');
      return res.redirect('/prestamos-especiales');
    }

    const updateData = {
      ruta_id: req.body.ruta_id || null,
      monto_solicitado: Number(req.body.monto_solicitado) || 0,
      monto_aprobado: Number(req.body.monto_aprobado) || 0,
      interes_porcentaje: Number(req.body.interes_porcentaje) || 0,
      forma_pago: req.body.forma_pago,
      estado: req.body.estado || 'pendiente'
    };

    if (updateData.estado === 'aprobado' && prestamo.estado !== 'aprobado') {
      updateData.capital_restante = updateData.monto_aprobado;
    }

    await PrestamoEspecial.update(req.params.id, updateData);

    req.flash('success', 'Préstamo actualizado correctamente');
    res.redirect(`/prestamos-especiales/${req.params.id}`);
  } catch (error) {
    console.error('Error al actualizar préstamo:', error);
    req.flash('error', 'Error al actualizar préstamo');
    res.redirect(`/prestamos-especiales/${req.params.id}/editar`);
  }
};

// Formulario para registrar pago
exports.pagoForm = async (req, res) => {
  try {
    const prestamo = await PrestamoEspecial.findByIdWithClienteYRuta(req.params.id);
    if (!prestamo) {
      req.flash('error', 'Préstamo no encontrado');
      return res.redirect('/prestamos-especiales');
    }

    res.render('prestamosEspeciales/pago', {
      prestamo: {
        ...prestamo,
        monto_aprobado: Number(prestamo.monto_aprobado),
        capital_restante: Number(prestamo.capital_restante),
        interes_porcentaje: Number(prestamo.interes_porcentaje)
      },
      title: 'Registrar Pago',
      messages: req.flash()
    });
  } catch (error) {
    console.error('Error al cargar formulario de pago:', error);
    req.flash('error', 'Error al cargar formulario de pago');
    res.redirect(`/prestamos-especiales/${req.params.id}`);
  }
};

// Procesar pago
exports.procesarPago = async (req, res) => {
  try {
    const prestamo = await PrestamoEspecial.findById(req.params.id);
    if (!prestamo) {
      req.flash('error', 'Préstamo no encontrado');
      return res.redirect('/prestamos-especiales');
    }

    const monto = Number(req.body.monto) || 0;
    if (monto <= 0) {
      req.flash('error', 'Monto no válido');
      return res.redirect(`/prestamos-especiales/${req.params.id}/pago`);
    }

    const interesPagado = Math.min(monto, prestamo.monto_aprobado * (prestamo.interes_porcentaje / 100));
    const capitalPagado = monto - interesPagado;

    const pagoData = {
      prestamo_id: prestamo.id,
      monto: monto,
      interes_pagado: interesPagado,
      capital_pagado: capitalPagado,
      metodo: req.body.metodo || 'efectivo',
      referencia: req.body.referencia || '',
      fecha: new Date(),
      registrado_por: req.user.id || 'Sistema'
    };

    await PagoEspecial.create(pagoData);

    const nuevoCapital = prestamo.capital_restante - capitalPagado;
    await PrestamoEspecial.updateCapital(prestamo.id, nuevoCapital);

    req.flash('success', 'Pago registrado correctamente');
    res.redirect(`/prestamos-especiales/${req.params.id}`);
  } catch (error) {
    console.error('Error al procesar pago:', error);
    req.flash('error', 'Error al procesar pago');
    res.redirect(`/prestamos-especiales/${req.params.id}/pago`);
  }
};

// Generar recibo de pago
exports.recibo = async (req, res) => {
  try {
    const pago = await PagoEspecial.findByPk(req.params.pagoId);
    if (!pago) {
      req.flash('error', 'Pago no encontrado');
      return res.redirect('/prestamos-especiales');
    }

    const prestamo = await PrestamoEspecial.findByIdWithClienteYRuta(pago.prestamo_id);

    res.render('prestamosEspeciales/recibo', {
      pago: {
        ...pago,
        monto: Number(pago.monto),
        interes_pagado: Number(pago.interes_pagado),
        capital_pagado: Number(pago.capital_pagado),
        fecha: moment(pago.fecha).format('DD/MM/YYYY')
      },
      prestamo: {
        ...prestamo,
        monto_aprobado: Number(prestamo.monto_aprobado),
        interes_porcentaje: Number(prestamo.interes_porcentaje)
      },
      title: 'Recibo de Pago',
      moment
    });
  } catch (error) {
    console.error('Error al generar recibo:', error);
    req.flash('error', 'Error al generar recibo');
    res.redirect(`/prestamos-especiales/${req.params.id}`);
  }
};

// Mostrar préstamos especiales pendientes
exports.pendientes = async (req, res) => {
  try {
    const prestamosEspeciales = await PrestamoEspecial.findAllWithClienteYRuta({
      where: { estado: 'pendiente' }
    });

    const formattedPrestamos = prestamosEspeciales.map(p => ({
      ...p,
      tipo: 'especial',
      monto_solicitado: Number(p.monto_solicitado) || 0,
      monto_aprobado: Number(p.monto_aprobado) || 0,
      capital_restante: Number(p.capital_restante) || 0,
      fecha_creacion: moment(p.fecha_creacion).format('YYYY-MM-DD')
    }));

    res.render('prestamos/pendientes', {
      title: 'Préstamos Especiales Pendientes',
      prestamos: formattedPrestamos,
      moment
    });
  } catch (error) {
    console.error('Error al cargar préstamos especiales pendientes:', error);
    req.flash('error', 'No se pudieron cargar los préstamos especiales');
    res.redirect('/');
  }
};

// Aprobar solicitud de préstamo general (si se usa también para solicitudes normales)
exports.aprobarSolicitud = async (req, res) => {
  const id = req.params.id;

  try {
    const solicitud = await SolicitudPrestamo.findByPk(id);
    if (!solicitud) {
      req.flash('error', 'Solicitud no encontrada');
      return res.redirect('/prestamos/pendientes');
    }

    await solicitud.update({ estado: 'aprobado' });

    req.flash('success', 'Solicitud aprobada correctamente');
    res.redirect('/prestamos/pendientes');
  } catch (err) {
    console.error('Error aprobando solicitud:', err);
    req.flash('error', 'Error al aprobar solicitud');
    res.redirect('/prestamos/pendientes');
  }
};

// Aprobar préstamo especial
exports.aprobarPrestamoEspecial = async (req, res) => {
  const id = req.params.id;

  try {
    const prestamo = await PrestamoEspecial.findById(id);
    if (!prestamo) {
      req.flash('error', 'Préstamo especial no encontrado');
      return res.redirect('/prestamos/pendientes');
    }

    await PrestamoEspecial.update(id, { estado: 'aprobado' });

    req.flash('success', 'Préstamo especial aprobado correctamente');
    res.redirect('/prestamos/pendientes');
  } catch (err) {
    console.error('❌ Error al aprobar préstamo especial:', err.message);
    req.flash('error', 'Error al aprobar préstamo especial');
    res.redirect('/prestamos/pendientes');
  }
};
