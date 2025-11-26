const ContratoHipotecario = require('../models/ContratoHipotecario');
const moment = require('moment');

/**
 * LISTADO GENERAL
 */
exports.index = async (req, res) => {
    try {
        const hipotecas = await ContratoHipotecario.findAll();

        res.render('hipotecas/index', {
            hipotecas,
            moment,
            messages: req.flash(),
            title: 'Contratos Hipotecarios'
        });
    } catch (error) {
        console.error('Error en index hipotecario:', error);
        req.flash('error', 'Error al cargar contratos hipotecarios');
        res.redirect('/');
    }
};

/**
 * FORMULARIO
 */
exports.createForm = async (req, res) => {
    try {
        res.render('hipotecas/create', {
            title: 'Nuevo Contrato Hipotecario',
            messages: req.flash()
        });
    } catch (error) {
        console.error('Error en createForm hipotecario:', error);
        req.flash('error', 'No se pudo cargar el formulario');
        res.redirect('/contratos-hipotecarios');
    }
};

/**
 * GUARDAR CONTRATO (POST desde fetch)
 */
exports.create = async (req, res) => {
    try {
        console.log('📄 Datos recibidos contrato hipotecario:', req.body);

        const data = req.body;

        const datos_deudor = {
            nombre_deudor: data.nombre_deudor,
            nacionalidad: data.nacionalidad,
            ocupacion: data.ocupacion,
            tipo_documento: data.tipo_documento,
            numero_documento: data.numero_documento,
            telefono: data.telefono,
            direccion: data.direccion
        };

        const datos_prestamo = {
            monto_prestamo: parseFloat(data.monto_prestamo),
            plazo_meses: parseInt(data.plazo_meses),
            monto_cuota: parseFloat(data.monto_cuota),
            tasa_interes: parseFloat(data.tasa_interes),
            fecha_primera_cuota: data.fecha_primera_cuota,
            fecha_ultima_cuota: data.fecha_ultima_cuota,
            cuota_extraordinaria: data.cuota_extraordinaria || null,
            fecha_cuota_extraordinaria: data.fecha_cuota_extraordinaria || null,
            monto_prestamo_letras: data.monto_prestamo_letras,
            monto_cuota_letras: data.monto_cuota_letras,
            plazo_anios: data.plazo_anios
        };

        const datos_propiedad1 = {
            area: data.area_propiedad1,
            mejora: data.mejora_propiedad1,
            direccion: data.direccion_propiedad1,
            parcela: data.parcela_propiedad1,
            distrito: data.distrito_propiedad1
        };

        const datos_propiedad2 = {
            area: data.area_propiedad2,
            mejora: data.mejora_propiedad2,
            direccion: data.direccion_propiedad2,
            parcela: data.parcela_propiedad2,
            distrito: data.distrito_propiedad2
        };

        const contrato_texto = data.contrato_texto;

        const id = await ContratoHipotecario.create({
            datos_deudor,
            datos_prestamo,
            datos_propiedad1,
            datos_propiedad2,
            contrato_texto
        });

        return res.json({ success: true, id });
    } catch (error) {
        console.error('Error creando contrato hipotecario:', error);
        return res.json({ success: false, error: error.message });
    }
};

/**
 * MOSTRAR CONTRATO
 */
exports.show = async (req, res) => {
    try {
        const contrato = await ContratoHipotecario.findById(req.params.id);

        if (!contrato) {
            req.flash('error', 'Contrato no encontrado');
            return res.redirect('/contratos-hipotecarios');
        }

        res.render('hipotecas/show', {
            contrato,
            title: `Contrato Hipotecario #${contrato.id}`
        });

    } catch (error) {
        console.error('Error en show hipotecario:', error);
        req.flash('error', 'Error al cargar contrato');
        res.redirect('/contratos-hipotecarios');
    }
};

/**
 * IMPRIMIR
 */
exports.print = async (req, res) => {
    try {
        const contrato = await ContratoHipotecario.findById(req.params.id);

        if (!contrato) {
            req.flash('error', 'Contrato no encontrado');
            return res.redirect('/contratos-hipotecarios');
        }

        res.render('hipotecas/print', {
            contrato,
            layout: false
        });

    } catch (error) {
        console.error('Error en print hipotecario:', error);
        req.flash('error', 'Error al generar impresión');
        res.redirect('/contratos-hipotecarios');
    }
};

/**
 * DESCARGA
 */
exports.download = async (req, res) => {
    try {
        const contrato = await ContratoHipotecario.findById(req.params.id);

        if (!contrato) {
            return res.status(404).send('No encontrado');
        }

        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="contrato-hipotecario-${contrato.id}.txt"`);
        res.send(contrato.contrato_texto);

    } catch (error) {
        console.error('Error en download hipotecario:', error);
        res.status(500).send('Error al descargar');
    }
};
