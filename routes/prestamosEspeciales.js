// routes/prestamosEspeciales.js
const express = require('express');
const router = express.Router();
const prestamosEspecialesController = require('../controllers/prestamosEspecialesController');

// Listado de préstamos especiales
router.get('/', prestamosEspecialesController.index);

// Formulario para nuevo préstamo especial
router.get('/nuevo', prestamosEspecialesController.createForm);

// Guardar nuevo préstamo especial
router.post('/crear', prestamosEspecialesController.create);

// Ver detalle de un préstamo especial
router.get('/:id', prestamosEspecialesController.show);

// Formulario para editar préstamo especial
router.get('/:id/editar', prestamosEspecialesController.editForm);

// Actualizar préstamo especial
router.post('/:id/actualizar', prestamosEspecialesController.update);

// Formulario para registrar pago
router.get('/:id/pago', prestamosEspecialesController.pagoForm);

// Procesar pago
router.post('/:id/pago', prestamosEspecialesController.procesarPago);

// Generar recibo de pago
router.get('/:id/recibo/:pagoId', prestamosEspecialesController.recibo);

// Ruta para aprobar préstamos especiales
router.post('/:id/aprobar', prestamosEspecialesController.aprobarPrestamoEspecial);

module.exports = router;