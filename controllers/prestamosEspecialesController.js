  const db = require('../models/db');
const PrestamoEspecial = require('../models/PrestamoEspecial');
const PagoEspecial = require('../models/PagoEspecial');
const Cliente = require('../models/Cliente');
const Ruta = require('../models/Ruta');
const moment = require('moment');

// Listar todos los préstamos especiales
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
      monto_aprobado: Number(p.monto_aprobado) || 0,
      capital_restante: Number(p.capital_restante) || 0,
      interes_porcentaje: Number(p.interes_porcentaje) || 0,
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

// Mostrar formulario para crear préstamo
exports.createForm = async (req, res) => {
  try {
    const clientes = await Cliente.findAll({ where: { estado: 'activo' }, order: [['nombre', 'ASC']] });
    const rutas = await Ruta.findAll({ order: [['zona', 'ASC'], ['nombre', 'ASC']] });

    res.render('prestamosEspeciales/create', {
      clientes,
      rutas,
      title: 'Crear Préstamo Especial',
      prestamo: {},
      messages: req.flash()
    });
  } catch (error) {
    console.error('Error al cargar formulario de préstamo especial:', error);
    req.flash('error', 'No se pudo cargar el formulario');
    res.redirect('/prestamos-especiales');
  }
};

// Crear nuevo préstamo
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
      req.flash('error', 'Monto solicitado inválido');
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
      capital_restante: montoAprobado,
      fecha_creacion: new Date()
    };

    const nuevoPrestamo = await PrestamoEspecial.create(prestamoData);
    req.flash('success', 'Préstamo especial creado correctamente');
    res.redirect(`/prestamos-especiales/${nuevoPrestamo.id}`);
  } catch (error) {
    console.error('Error al crear préstamo especial:', error);
    req.flash('error', `Error: ${error.message}`);
    res.redirect('/prestamos-especiales/nuevo');
  }
};

// Mostrar detalle del préstamo
exports.show = async (req, res) => {
    const prestamoId = req.params.id;

    try {
        // 1. Fetch the main loan details
        const prestamoResult = await db.query('SELECT pe.*, c.nombre AS cliente_nombre, c.apellidos AS cliente_apellidos, c.cedula AS cliente_cedula, r.nombre AS ruta_nombre, r.zona AS ruta_zona FROM prestamos_especiales pe JOIN clientes c ON pe.cliente_id = c.id LEFT JOIN rutas r ON c.ruta_id = r.id WHERE pe.id = $1', [prestamoId]);
        const prestamo = prestamoResult.rows[0];

        if (!prestamo) {
            req.flash('error', 'Préstamo especial no encontrado.');
            return res.redirect('/prestamos-especiales'); // Or render an error page
        }

        // 2. Fetch all payments for this loan
        const pagosResult = await db.query('SELECT * FROM pagos_prestamos_especiales WHERE prestamo_especial_id = $1 ORDER BY fecha DESC', [prestamoId]);
        const pagos = pagosResult.rows;

        // 3. Calculate financial summaries from payments
        let totalPagado = 0;
        let capitalPagado = 0;
        let interesPagado = 0;

        if (pagos.length > 0) {
            pagos.forEach(pago => {
                totalPagado += parseFloat(pago.monto || 0); // Assuming 'monto' is the total payment amount
                capitalPagado += parseFloat(pago.capital_pagado || 0);
                interesPagado += parseFloat(pago.interes_pagado || 0);
            });
        }

        // IMPORTANT: Ensure 'capital_restante' is being updated in your database
        // when payments are processed. If not, you might need to calculate it here too:
        // let capitalRestante = parseFloat(prestamo.monto_aprobado) - capitalPagado;
        // prestamo.capital_restante = capitalRestante; // Add this to the prestamo object

        // 4. Render the EJS template, passing all necessary data
        res.render('prestamosEspeciales/detallePrestamoEspecial', {
            prestamo,
            pagos, // This array holds all payment details
            totalPagado, // Calculated sum of all payment amounts
            capitalPagado, // Calculated sum of capital paid
            interesPagado, // Calculated sum of interest paid
            messages: req.flash()
        });

    } catch (err) {
        console.error('Error al obtener el detalle del préstamo especial:', err);
        req.flash('error', 'Error al cargar el detalle del préstamo especial.');
        res.redirect('/prestamos-especiales');
    }
};

// Formulario para registrar pago
exports.pagoForm = async (req, res) => {
  try {
    const prestamo = await PrestamoEspecial.findByIdWithClienteYRuta(req.params.id);
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
    req.flash('error', 'Error al cargar formulario');
    res.redirect(`/prestamos-especiales/${req.params.id}`);
  }
};

// Procesar pago
exports.procesarPago = async (req, res) => {
  try {
    const prestamo = await PrestamoEspecial.findById(req.params.id);
    const monto = Number(req.body.monto) || 0;

    if (monto <= 0) {
      req.flash('error', 'Monto no válido');
      return res.redirect(`/prestamos-especiales/${req.params.id}/pago`);
    }

    const interesCalculado = prestamo.capital_restante * (prestamo.interes_porcentaje / 100);
    const interesPagado = Math.min(monto, interesCalculado);
    const capitalPagado = Math.min(monto - interesPagado, prestamo.capital_restante);

    const pagoData = {
      prestamo_id: prestamo.id,
      monto,
      interes_pagado: interesPagado,
      capital_pagado: capitalPagado,
      metodo: req.body.metodo || 'efectivo',
      referencia: req.body.referencia || '',
      fecha: new Date(),
      registrado_por: (req.user && req.user.id) ? req.user.id : 'Sistema'
    };

    await PagoEspecial.create(pagoData);
    const nuevoCapital = prestamo.capital_restante - capitalPagado;
    await PrestamoEspecial.updateCapital(prestamo.id, nuevoCapital);

    req.flash('success', 'Pago registrado correctamente');
    res.redirect(`/prestamos-especiales/${req.params.id}`);
  } catch (error) {
    console.error('Error al procesar pago:', error);
    req.flash('error', 'Error al registrar el pago');
    res.redirect(`/prestamos-especiales/${req.params.id}/pago`);
  }
};

// Recibo
exports.recibo = async (req, res) => {
  try {
    const pago = await PagoEspecial.findByPk(req.params.pagoId);
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
