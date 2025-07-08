const PrestamoEspecial = require('../models/PrestamoEspecial');
const PagoEspecial = require('../models/PagoEspecial');
const Cliente = require('../models/Cliente'); // Asumiendo que Cliente también usa db.query
const Ruta = require('../models/Ruta');     // Asumiendo que Ruta también usa db.query
const moment = require('moment');

// Helper para formatear fechas
const formatFecha = (dateString) => {
    if (!dateString) return '';
    // Asegurarse de que sea un objeto Date para toLocaleDateString
    const date = new Date(dateString);
    return date.toLocaleDateString('es-DO', { year: 'numeric', month: '2-digit', day: '2-digit' });
};

// Helper para formato de moneda
const formatCurrency = (amount) => {
    return parseFloat(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// Helper para parsear valores numéricos de forma segura
const safeParseFloat = (value, defaultValue = 0) => {
    const num = parseFloat(value);
    return isNaN(num) ? defaultValue : num;
};


// Mostrar todos los préstamos especiales
exports.index = async (req, res) => {
    try {
        // Usar el método findAll del modelo PrestamoEspecial basado en db.query
        const prestamos = await PrestamoEspecial.findAll();

        // Si Cliente y Ruta usan db.query también, necesitaríamos cargar sus datos con JOINs
        // en el PrestamoEspecial.findAll si los queremos aquí.
        // El findAll de PrestamoEspecial ya incluye cliente_nombre y cliente_apellidos.

        const prestamosFormatted = prestamos.map(p => ({
            ...p, // Ya son objetos planos de la BD
            fecha_creacion_formatted: formatFecha(p.fecha_creacion)
        }));

        res.render('prestamosEspeciales/index', { prestamos: prestamosFormatted, messages: req.flash() });
    } catch (err) {
        console.error('Error al obtener préstamos especiales:', err);
        req.flash('error', 'Error al cargar los préstamos especiales.');
        res.redirect('/');
    }
};

// Mostrar formulario para crear un nuevo préstamo
exports.createForm = async (req, res) => {
    try {
        const clientes = await Cliente.findAll();
        const rutas = await Ruta.findAll(); // ← Ya devuelve objetos planos
        res.render('prestamosEspeciales/create', {
            clientes,
            rutas,
            messages: req.flash()
        });
    } catch (err) {
        console.error('Error al cargar formulario de creación de préstamo:', err);
        req.flash('error', 'Error al cargar el formulario de nuevo préstamo.');
        res.redirect('/prestamos-especiales');
    }
};



// Crear un nuevo préstamo especial
exports.create = async (req, res) => {
    const { cliente_id, monto_solicitado, interes_porcentaje, forma_pago, observaciones } = req.body;
    try {
        // Usar el método create del modelo PrestamoEspecial basado en db.query
        const nuevoPrestamoId = await PrestamoEspecial.create({
            cliente_id,
            monto_solicitado: safeParseFloat(monto_solicitado),
            interes_porcentaje: safeParseFloat(interes_porcentaje),
            forma_pago,
            observaciones
        });
        req.flash('success', 'Préstamo especial creado exitosamente. Ahora debe ser aprobado.');
        res.redirect(`/prestamos-especiales/${nuevoPrestamoId}`);
    } catch (err) {
        console.error('Error al crear préstamo especial:', err);
        req.flash('error', 'Error al crear el préstamo especial: ' + err.message);
        res.redirect('/prestamos-especiales/nuevo');
    }
};



// Mostrar detalle de un préstamo especial (CON HISTORIAL DE PAGOS Y ESTADO)
exports.show = async (req, res) => {
    const prestamoId = req.params.id;
    try {
        // Usar el método findById del modelo PrestamoEspecial basado en db.query
        const prestamo = await PrestamoEspecial.findById(prestamoId);

        if (!prestamo) {
            req.flash('error', 'Préstamo especial no encontrado.');
            return res.redirect('/prestamos-especiales');
        }

        // --- INICIO DE CORRECCIÓN ---
        // Asegurarse de que los montos sean números para usar .toFixed() en la vista
        prestamo.monto_solicitado = safeParseFloat(prestamo.monto_solicitado);
        prestamo.monto_aprobado = safeParseFloat(prestamo.monto_aprobado);
        prestamo.interes_porcentaje = safeParseFloat(prestamo.interes_porcentaje);
        prestamo.capital_restante = safeParseFloat(prestamo.capital_restante);
        // --- FIN DE CORRECCIÓN ---

        // Obtener los pagos asociados a este préstamo especial
        const pagos = await PagoEspecial.findByPrestamo(prestamoId);

        // Formatear las fechas para la vista
        prestamo.fecha_creacion_formatted = formatFecha(prestamo.fecha_creacion);
        prestamo.fecha_aprobacion_formatted = formatFecha(prestamo.fecha_aprobacion);


        // Calcular estado de pagos
        let totalPagado = 0;
        let capitalPagado = 0;
        let interesPagado = 0;

        pagos.forEach(pago => {
            // Asegurarse de que los campos de pago también sean números
            pago.monto = safeParseFloat(pago.monto);
            pago.capital_pagado = safeParseFloat(pago.capital_pagado);
            pago.interes_pagado = safeParseFloat(pago.interes_pagado);

            totalPagado += pago.monto;
            capitalPagado += pago.capital_pagado;
            interesPagado += pago.interes_pagado;
            pago.fecha_formatted = new Date(pago.fecha).toLocaleDateString('es-DO', { year: 'numeric', month: '2-digit', day: '2-digit' });
        });

        // Pasar todas las variables necesarias a la vista
        res.render('prestamosEspeciales/show', {
            prestamo,
            pagos, // Array de objetos de pago
            totalPagado,
            capitalPagado,
            interesPagado,
            messages: req.flash()
        });

    } catch (err) {
        console.error('Error al obtener el detalle del préstamo especial:', err);
        req.flash('error', 'Error al cargar el detalle del préstamo especial.');
        res.redirect('/prestamos-especiales');
    }
};

// Formulario para editar préstamo especial
exports.editForm = async (req, res) => {
    const prestamoId = req.params.id;
    try {
        // Usar findById del modelo PrestamoEspecial
        const prestamo = await PrestamoEspecial.findById(prestamoId);
        if (!prestamo) {
            req.flash('error', 'Préstamo especial no encontrado para editar.');
            return res.redirect('/prestamos-especiales');
        }
        const clientes = await Cliente.findAll(); // Asumiendo Cliente.findAll()
        res.render('prestamosEspeciales/edit', { prestamo, clientes, messages: req.flash() });
    } catch (err) {
        console.error('Error al cargar formulario de edición:', err);
        req.flash('error', 'Error al cargar el formulario de edición.');
        res.redirect(`/prestamos-especiales/${prestamoId}`);
    }
};

// Actualizar préstamo especial
exports.update = async (req, res) => {
    const prestamoId = req.params.id;
    const { monto_solicitado, interes_porcentaje, forma_pago, observaciones } = req.body;
    try {
        const prestamo = await PrestamoEspecial.findById(prestamoId);
        if (!prestamo) {
            req.flash('error', 'Préstamo no encontrado para actualizar.');
            return res.redirect(`/prestamos-especiales/${prestamoId}`);
        }
        
        // Preparar los datos para la actualización
        const updateData = {
            monto_solicitado,
            monto_aprobado: prestamo.monto_aprobado, // Mantener el aprobado si no se cambia aquí
            interes_porcentaje,
            forma_pago,
            estado: prestamo.estado, // Mantener el estado si no se cambia aquí
            fecha_aprobacion: prestamo.fecha_aprobacion,
            observaciones,
            capital_restante: prestamo.capital_restante // Mantener restante si no se cambia aquí
        };

        // Usar el método update del modelo PrestamoEspecial basado en db.query
        await PrestamoEspecial.update(prestamoId, updateData);

        req.flash('success', 'Préstamo especial actualizado exitosamente.');
        res.redirect(`/prestamos-especiales/${prestamoId}`);
    } catch (err) {
        console.error('Error al actualizar préstamo especial:', err);
        req.flash('error', 'Error al actualizar el préstamo especial: ' + err.message);
        res.redirect(`/prestamos-especiales/${prestamoId}/editar`);
    }
};

// Aprobar préstamo especial
exports.aprobarPrestamoEspecial = async (req, res) => {
    const prestamoId = req.params.id;
    const { monto_aprobado } = req.body;

    try {
        const prestamo = await PrestamoEspecial.findById(prestamoId);
        if (!prestamo) {
            req.flash('error', 'Préstamo no encontrado.');
            return res.redirect(`/prestamos-especiales/${prestamoId}`);
        }

        if (prestamo.estado === 'aprobado') {
            req.flash('info', 'El préstamo ya ha sido aprobado.');
            return res.redirect(`/prestamos-especiales/${prestamoId}`);
        }

        const montoAprobadoNum = safeParseFloat(monto_aprobado);
        if (montoAprobadoNum <= 0) {
            req.flash('error', 'Monto aprobado inválido.');
            return res.redirect(`/prestamos-especiales/${prestamoId}`);
        }

        // Actualizar el préstamo usando el método update del modelo
        await PrestamoEspecial.update(prestamoId, {
            ...prestamo, // Mantener los datos existentes
            estado: 'aprobado',
            monto_aprobado: montoAprobadoNum,
            capital_restante: montoAprobadoNum, // Inicializar capital_restante
            fecha_aprobacion: moment().format('YYYY-MM-DD') // Formato para DATEONLY
        });

        req.flash('success', `Préstamo ${prestamoId} aprobado con un monto de RD$ ${formatCurrency(montoAprobadoNum)}.`);
        res.redirect(`/prestamos-especiales/${prestamoId}`);

    } catch (err) {
        console.error('Error al aprobar préstamo especial:', err);
        req.flash('error', 'Error al aprobar el préstamo especial: ' + err.message);
        res.redirect(`/prestamos-especiales/${prestamoId}`);
    }
};

// Formulario para registrar pago
exports.pagoForm = async (req, res) => {
    const prestamoId = req.params.id;
    try {
        const prestamo = await PrestamoEspecial.findById(prestamoId);
        if (!prestamo) {
            req.flash('error', 'Préstamo especial no encontrado.');
            return res.redirect('/prestamos-especiales');
        }
        if (prestamo.estado !== 'aprobado' && prestamo.estado !== 'pendiente') { // Permite pagar si está pendiente también
            req.flash('error', 'Solo se pueden registrar pagos para préstamos aprobados o pendientes de aprobación.');
            return res.redirect(`/prestamos-especiales/${prestamoId}`);
        }

        const pagosRealizados = await PagoEspecial.findByPrestamo(prestamoId);

        const montoAprobado = safeParseFloat(prestamo.monto_aprobado || 0);
        const interesPorcentaje = safeParseFloat(prestamo.interes_porcentaje || 0);
        const interesTotal = montoAprobado * (interesPorcentaje / 100);

        const interesPagadoAcumulado = pagosRealizados.reduce((sum, p) => sum + safeParseFloat(p.interes_pagado), 0);
        const capitalPagadoAcumulado = pagosRealizados.reduce((sum, p) => sum + safeParseFloat(p.capital_pagado), 0);

        const interesPendienteDePago = Math.max(0, interesTotal - interesPagadoAcumulado);
        const capitalRestanteDisplay = safeParseFloat(prestamo.capital_restante || 0); // Capital restante del registro DB

        res.render('prestamosEspeciales/pago', {
            prestamo,
            interesPendienteDePago,
            capitalRestanteDisplay,
            messages: req.flash()
        });
    } catch (err) {
        console.error('Error al cargar formulario de pago:', err);
        req.flash('error', 'Error al cargar el formulario de pago.');
        res.redirect(`/prestamos-especiales/${prestamoId}`);
    }
};

// Procesar un pago
exports.procesarPago = async (req, res) => {
    const prestamoId = req.params.id;
    const { monto_pago, metodo_pago, registrado_por } = req.body;

    try {
        const prestamo = await PrestamoEspecial.findById(prestamoId);

        if (!prestamo || prestamo.estado !== 'aprobado') {
            req.flash('error', 'Préstamo no encontrado o no está aprobado.');
            return res.redirect(`/prestamos-especiales/${prestamoId}`);
        }

        const montoPago = safeParseFloat(monto_pago);
        if (montoPago <= 0) {
            req.flash('error', 'Monto de pago inválido.');
            return res.redirect(`/prestamos-especiales/${prestamoId}/pago`);
        }

        const montoAprobado = safeParseFloat(prestamo.monto_aprobado || 0);
        const interesPorcentaje = safeParseFloat(prestamo.interes_porcentaje || 0);
        const interesTotalCalculado = montoAprobado * (interesPorcentaje / 100);

        const pagosAnteriores = await PagoEspecial.findByPrestamo(prestamoId);
        let interesPagadoAcumulado = pagosAnteriores.reduce((sum, p) => sum + safeParseFloat(p.interes_pagado), 0);

        let interesPendienteActual = Math.max(0, interesTotalCalculado - interesPagadoAcumulado);
        let capitalRestanteActual = safeParseFloat(prestamo.capital_restante || 0);

        let interesPagadoEnEstePago = 0;
        let capitalPagadoEnEstePago = 0;
        let montoPendienteDeAsignar = montoPago;

        // Primero, cubrir el interés pendiente
        if (interesPendienteActual > 0) {
            interesPagadoEnEstePago = Math.min(montoPendienteDeAsignar, interesPendienteActual);
            montoPendienteDeAsignar -= interesPagadoEnEstePago;
        }

        // Luego, cubrir el capital restante
        if (montoPendienteDeAsignar > 0 && capitalRestanteActual > 0) {
            capitalPagadoEnEstePago = Math.min(montoPendienteDeAsignar, capitalRestanteActual);
            montoPendienteDeAsignar -= capitalPagadoEnEstePago;
        }

        // Calcular el nuevo capital restante
        const nuevoCapitalRestante = capitalRestanteActual - capitalPagadoEnEstePago;

        // Registrar el pago individual
        const nuevoPagoId = await PagoEspecial.create({
            prestamo_especial_id: prestamoId,
            monto: montoPago, // Monto total recibido en este pago
            capital_pagado: capitalPagadoEnEstePago,
            interes_pagado: interesPagadoEnEstePago,
            metodo: metodo_pago,
            registrado_por: registrado_por || 'Sistema'
        });

        // Actualizar el capital restante y estado del préstamo en la DB
        await PrestamoEspecial.update(prestamoId, {
            ...prestamo, // Mantener todos los datos del préstamo
            capital_restante: nuevoCapitalRestante,
            estado: (nuevoCapitalRestante <= 0.01) ? 'pagado' : prestamo.estado // Actualizar estado a 'pagado' si se completa
        });

        req.flash('success', `Pago de RD$ ${formatCurrency(montoPago)} registrado exitosamente. Capital restante: RD$ ${formatCurrency(nuevoCapitalRestante)}`);
        res.redirect(`/prestamos-especiales/${prestamoId}/recibo/${nuevoPagoId}`);

    } catch (err) {
        console.error('Error al procesar el pago:', err);
        req.flash('error', 'Error al procesar el pago: ' + err.message);
        res.redirect(`/prestamos-especiales/${prestamoId}/pago`);
    }
};

// Mostrar recibo de pago
exports.recibo = async (req, res) => {
    const prestamoId = req.params.id;
    const pagoId = req.params.pagoId;
    try {
        const pago = await PagoEspecial.findById(pagoId);

        if (!pago || pago.prestamo_especial_id != prestamoId) {
            req.flash('error', 'Recibo de pago no encontrado o no corresponde al préstamo.');
            return res.redirect(`/prestamos-especiales/${prestamoId}`);
        }

        const prestamo = await PrestamoEspecial.findById(prestamoId);
        if (!prestamo) {
            req.flash('error', 'Préstamo asociado al pago no encontrado.');
            return res.redirect(`/prestamos-especiales`);
        }

        const cliente = await Cliente.findById(prestamo.cliente_id);
        let ruta = null;
        if (cliente && cliente.ruta_id) {
            ruta = await Ruta.findById(cliente.ruta_id);
        }

        pago.cliente = cliente;
        pago.prestamoEspecial = prestamo;
        if (ruta) pago.ruta = ruta;

        // Asegurar capital_restante es número
        if (pago.prestamoEspecial.capital_restante != null) {
            pago.prestamoEspecial.capital_restante = safeParseFloat(pago.prestamoEspecial.capital_restante);
        }

        // Formatear fecha del pago
        if (pago.fecha) {
            pago.fecha_formatted = new Date(pago.fecha).toLocaleString('es-DO', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } else {
            pago.fecha_formatted = 'Fecha no disponible';
        }

        res.render('prestamosEspeciales/recibo', { pago, messages: req.flash() });

    } catch (err) {
        console.error('Error al generar recibo:', err);
        req.flash('error', 'Error al generar el recibo.');
        res.redirect(`/prestamos-especiales/${prestamoId}`);
    }
};
