const express = require('express');
const router = express.Router();
const prestamoInteresController = require('../controllers/prestamoInteresController');
const { ensureAuthenticated } = require('../middleware/auth');

// Listado de préstamos
router.get('/', ensureAuthenticated, prestamoInteresController.index);

// Formulario de creación
router.get('/create', ensureAuthenticated, prestamoInteresController.createForm);

// Crear nuevo préstamo
router.post('/', ensureAuthenticated, prestamoInteresController.create);

// Detalle de préstamo
router.get('/:id', ensureAuthenticated, prestamoInteresController.show);

// Formulario de pago
router.get('/:id/pago', ensureAuthenticated, prestamoInteresController.pagoForm);

// Registrar pago
router.post('/:id/pago', ensureAuthenticated, prestamoInteresController.registrarPago);

// Recibo de pago
router.get('/:id/recibo/:pagoId', ensureAuthenticated, prestamoInteresController.recibo);

module.exports = router;