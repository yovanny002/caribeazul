const express = require('express');
const router = express.Router();
const prestamosEspecialesController = require('../controllers/prestamosEspecialesController');

// Mostrar formulario para nuevo préstamo especial
router.get('/nuevo', prestamosEspecialesController.formulario);

// Guardar nuevo préstamo especial
router.post('/crear', prestamosEspecialesController.crear);

// Ver detalle de un préstamo especial
router.get('/:id', prestamosEspecialesController.show);

// Formulario de pago
router.get('/:id/pago', prestamosEspecialesController.pagoForm);

// Procesar pago
router.post('/:id/pago', prestamosEspecialesController.procesarPago);

// Generar recibo de pago
router.get('/:id/recibo/:pagoId', prestamosEspecialesController.reciboPago);

// Listado de préstamos especiales
router.get('/', prestamosEspecialesController.index);

module.exports = router;
