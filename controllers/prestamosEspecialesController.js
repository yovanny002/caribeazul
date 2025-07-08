const PrestamoEspecial = require('../models/PrestamoEspecial');
const PagoEspecial = require('../models/PagoEspecial');
const Cliente = require('../models/Cliente');
const Ruta = require('../models/Ruta');
const moment = require('moment');

// Helper functions
const formatFecha = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-DO', { year: 'numeric', month: '2-digit', day: '2-digit' });
};

const formatCurrency = (amount) => {
    return parseFloat(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const safeParseFloat = (value, defaultValue = 0) => {
    const num = parseFloat(value);
    return isNaN(num) ? defaultValue : num;
};

// Controller methods
exports.index = async (req, res) => {
    try {
        const prestamos = await PrestamoEspecial.findAll();
        const prestamosFormatted = prestamos.map(p => ({
            ...p,
            fecha_creacion_formatted: formatFecha(p.fecha_creacion)
        }));
        res.render('prestamosEspeciales/index', { prestamos: prestamosFormatted, messages: req.flash() });
    } catch (err) {
        console.error('Error al obtener préstamos especiales:', err);
        req.flash('error', 'Error al cargar los préstamos especiales.');
        res.redirect('/');
    }
};

exports.createForm = async (req, res) => {
    try {
        const clientes = await Cliente.findAll();
        const rutas = await Ruta.findAll();
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

exports.create = async (req, res) => {
    const { cliente_id, monto_solicitado, interes_porcentaje, forma_pago, observaciones } = req.body;
    try {
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

exports.show = async (req, res) => {
    const prestamoId = parseInt(req.params.id);
    
    if (isNaN(prestamoId)) {
        req.flash('error', 'ID de préstamo inválido.');
        return res.redirect('/prestamos-especiales');
    }

    try {
        const prestamo = await PrestamoEspecial.findById(prestamoId);
        
        if (!prestamo) {
            req.flash('error', 'Préstamo especial no encontrado.');
            return res.redirect('/prestamos-especiales');
        }

        // Parse numeric fields
        prestamo.monto_solicitado = safeParseFloat(prestamo.monto_solicitado);
        prestamo.monto_aprobado = safeParseFloat(prestamo.monto_aprobado);
        prestamo.interes_porcentaje = safeParseFloat(prestamo.interes_porcentaje);
        prestamo.capital_restante = safeParseFloat(prestamo.capital_restante);

        const pagos = await PagoEspecial.findByPrestamo(prestamoId);
        
        // Format dates
        prestamo.fecha_creacion_formatted = formatFecha(prestamo.fecha_creacion);
        prestamo.fecha_aprobacion_formatted = formatFecha(prestamo.fecha_aprobacion);

        // Calculate payment status
        let totalPagado = 0;
        let capitalPagado = 0;
        let interesPagado = 0;

        pagos.forEach(pago => {
            pago.monto = safeParseFloat(pago.monto);
            pago.capital_pagado = safeParseFloat(pago.capital_pagado);
            pago.interes_pagado = safeParseFloat(pago.interes_pagado);

            totalPagado += pago.monto;
            capitalPagado += pago.capital_pagado;
            interesPagado += pago.interes_pagado;
            pago.fecha_formatted = new Date(pago.fecha).toLocaleDateString('es-DO', { 
                year: 'numeric', 
                month: '2-digit', 
                day: '2-digit' 
            });
        });

        res.render('prestamosEspeciales/show', {
            prestamo,
            pagos,
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

// ... (rest of the controller methods remain the same, just add the parseInt check at the beginning of each method that uses req.params.id)

exports.editForm = async (req, res) => {
    const prestamoId = parseInt(req.params.id);
    
    if (isNaN(prestamoId)) {
        req.flash('error', 'ID de préstamo inválido.');
        return res.redirect('/prestamos-especiales');
    }

    try {
        const prestamo = await PrestamoEspecial.findById(prestamoId);
        if (!prestamo) {
            req.flash('error', 'Préstamo especial no encontrado para editar.');
            return res.redirect('/prestamos-especiales');
        }
        const clientes = await Cliente.findAll();
        res.render('prestamosEspeciales/edit', { prestamo, clientes, messages: req.flash() });
    } catch (err) {
        console.error('Error al cargar formulario de edición:', err);
        req.flash('error', 'Error al cargar el formulario de edición.');
        res.redirect(`/prestamos-especiales/${prestamoId}`);
    }
};

exports.update = async (req, res) => {
    const prestamoId = parseInt(req.params.id);
    
    if (isNaN(prestamoId)) {
        req.flash('error', 'ID de préstamo inválido.');
        return res.redirect('/prestamos-especiales');
    }

    const { monto_solicitado, interes_porcentaje, forma_pago, observaciones } = req.body;
    try {
        const prestamo = await PrestamoEspecial.findById(prestamoId);
        if (!prestamo) {
            req.flash('error', 'Préstamo no encontrado para actualizar.');
            return res.redirect(`/prestamos-especiales/${prestamoId}`);
        }
        
        const updateData = {
            monto_solicitado,
            monto_aprobado: prestamo.monto_aprobado,
            interes_porcentaje,
            forma_pago,
            estado: prestamo.estado,
            fecha_aprobacion: prestamo.fecha_aprobacion,
            observaciones,
            capital_restante: prestamo.capital_restante
        };

        await PrestamoEspecial.update(prestamoId, updateData);

        req.flash('success', 'Préstamo especial actualizado exitosamente.');
        res.redirect(`/prestamos-especiales/${prestamoId}`);
    } catch (err) {
        console.error('Error al actualizar préstamo especial:', err);
        req.flash('error', 'Error al actualizar el préstamo especial: ' + err.message);
        res.redirect(`/prestamos-especiales/${prestamoId}/editar`);
    }
};

exports.aprobarPrestamoEspecial = async (req, res) => {
    const prestamoId = parseInt(req.params.id);
    
    if (isNaN(prestamoId)) {
        req.flash('error', 'ID de préstamo inválido.');
        return res.redirect('/prestamos-especiales');
    }

    const { monto_aprobado } = req.body;

    try {
        const prestamo = await PrestamoEspecial.findById(prestamoId);
        if (!prestamo) {
            req.flash('error', 'Préstamo no encontrado.');
            return res.redirect('/prestamos-especiales');
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

        await PrestamoEspecial.update(prestamoId, {
            ...prestamo,
            estado: 'aprobado',
            monto_aprobado: montoAprobadoNum,
            capital_restante: montoAprobadoNum,
            fecha_aprobacion: moment().format('YYYY-MM-DD')
        });

        req.flash('success', `Préstamo ${prestamoId} aprobado con un monto de RD$ ${formatCurrency(montoAprobadoNum)}.`);
        res.redirect(`/prestamos-especiales/${prestamoId}`);

    } catch (err) {
        console.error('Error al aprobar préstamo especial:', err);
        req.flash('error', 'Error al aprobar el préstamo especial: ' + err.message);
        res.redirect(`/prestamos-especiales/${prestamoId}`);
    }
};

// ... (other methods should follow the same pattern of validating the ID)

exports.recibo = async (req, res) => {
    const prestamoId = parseInt(req.params.id);
    const pagoId = parseInt(req.params.pagoId);
    
    if (isNaN(prestamoId) || isNaN(pagoId)) {
        req.flash('error', 'ID de préstamo o pago inválido.');
        return res.redirect('/prestamos-especiales');
    }

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

        if (pago.prestamoEspecial.capital_restante != null) {
            pago.prestamoEspecial.capital_restante = safeParseFloat(pago.prestamoEspecial.capital_restante);
        }

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