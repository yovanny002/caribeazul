const express = require('express');
const router = express.Router();
const prestamoInteresController = require('../controllers/prestamoInteresController');
const { checkRole } = require('../middlewares/roles');

// Listado de préstamos
router.get('/', checkRole(['administrador', 'supervisor', 'servicio']), prestamoInteresController.index);

// Formulario de creación
router.get('/create', checkRole(['administrador', 'supervisor', 'servicio']), prestamoInteresController.createForm);

router.post('/create', checkRole(['administrador', 'supervisor', 'servicio']), prestamoInteresController.create);

// Crear nuevo préstamo
router.post('/', checkRole(['administrador', 'supervisor', 'servicio']), prestamoInteresController.create);

// Detalle de préstamo
router.get('/:id', checkRole(['administrador', 'supervisor', 'servicio']), prestamoInteresController.show);

// Formulario de pago
router.get('/:id/pago', checkRole(['administrador', 'supervisor', 'servicio']), prestamoInteresController.pagoForm);

// Registrar pago
router.post('/:id/pago', checkRole(['administrador', 'supervisor', 'servicio']), prestamoInteresController.registrarPago);

// Recibo de pago
router.get('/:id/recibo/:pagoId', checkRole(['administrador', 'supervisor', 'servicio']), prestamoInteresController.recibo);

module.exports = router;