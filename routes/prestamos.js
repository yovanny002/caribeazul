const express = require('express');
const router = express.Router();
const prestamoController = require('../controllers/prestamoController');
const { checkRole } = require('../middlewares/roles');

// Rutas principales
router.get('/', checkRole(['administrador', 'supervisor', 'servicio']), prestamoController.index);
router.get('/create', prestamoController.createForm);
router.post('/create', prestamoController.create);

// Rutas específicas para admin
router.get('/pendientes', checkRole(['administrador']), prestamoController.pendientes);
router.post('/:id/aprobar', checkRole(['administrador']), prestamoController.aprobarPrestamo);

// Rutas dinámicas (editar, actualizar, mostrar)
router.get('/:id/edit', prestamoController.editForm);
router.put('/:id', prestamoController.update);
router.get('/:id', prestamoController.show);

// Rutas de pagos y otras
router.post('/:id/pagar', prestamoController.pagar);
router.get('/:id/recibo', prestamoController.recibo);
router.post('/:id/pagar-cuota', prestamoController.pagarCuota);

router.get('/:id/imprimir-ticket', prestamoController.imprimirTicket);
router.post('/api/imprimir-ticket', prestamoController.imprimirTicketApi);

module.exports = router;
