const Contrato = require('../models/Contrato');
const Cliente = require('../models/Cliente');
const Prestamo = require('../models/Prestamo');
const moment = require('moment');

// Mostrar formulario de creación de contrato
exports.showCreateForm = async (req, res) => {
    try {
        const clientes = await Cliente.getAll();
        const prestamos = await Prestamo.getAll();

        res.render('contratos/create', {
            title: 'Crear Contrato',
            clientes,
            prestamos
        });

    } catch (error) {
        console.error('Error al mostrar formulario de contrato:', error);
        res.status(500).send('Error al cargar la vista de creación del contrato.');
    }
};

// Crear contrato
exports.createContrato = async (req, res) => {
    try {
        const data = {
            cliente_id: req.body.cliente_id,
            prestamo_id: req.body.prestamo_id,
            monto: req.body.monto,
            fecha: moment().format('YYYY-MM-DD'),
            descripcion: req.body.descripcion || '',
        };

        await Contrato.create(data);

        res.redirect('/contratos');

    } catch (error) {
        console.error('Error al crear contrato:', error);
        res.status(500).send('Ocurrió un error al guardar el contrato.');
    }
};

// Listar contratos
exports.listContratos = async (req, res) => {
    try {
        const contratos = await Contrato.getAll();

        res.render('contratos/index', {
            title: 'Lista de Contratos',
            contratos
        });

    } catch (error) {
        console.error('Error al listar contratos:', error);
        res.status(500).send('Error al obtener los contratos.');
    }
};

// Mostrar contrato individual
exports.showContrato = async (req, res) => {
    try {
        const contrato = await Contrato.getById(req.params.id);

        if (!contrato) {
            return res.status(404).send('Contrato no encontrado');
        }

        res.render('contratos/show', {
            title: 'Detalle de Contrato',
            contrato
        });

    } catch (error) {
        console.error('Error al mostrar contrato:', error);
        res.status(500).send('Error al cargar el contrato.');
    }
};

// Editar contrato
exports.showEditForm = async (req, res) => {
    try {
        const contrato = await Contrato.getById(req.params.id);
        const clientes = await Cliente.getAll();
        const prestamos = await Prestamo.getAll();

        if (!contrato) {
            return res.status(404).send('Contrato no encontrado');
        }

        res.render('contratos/edit', {
            title: 'Editar Contrato',
            contrato,
            clientes,
            prestamos
        });

    } catch (error) {
        console.error('Error al cargar la vista de edición:', error);
        res.status(500).send('Error al cargar el formulario de edición.');
    }
};

// Actualizar contrato
exports.updateContrato = async (req, res) => {
    try {
        const data = {
            cliente_id: req.body.cliente_id,
            prestamo_id: req.body.prestamo_id,
            monto: req.body.monto,
            descripcion: req.body.descripcion || '',
        };

        await Contrato.update(req.params.id, data);

        res.redirect('/contratos');

    } catch (error) {
        console.error('Error al actualizar contrato:', error);
        res.status(500).send('Error al actualizar el contrato.');
    }
};

// Eliminar contrato
exports.deleteContrato = async (req, res) => {
    try {
        await Contrato.delete(req.params.id);

        res.redirect('/contratos');

    } catch (error) {
        console.error('Error al eliminar contrato:', error);
        res.status(500).send('Error al eliminar el contrato.');
    }
};
