const express = require('express');
const router = express.Router();
const prestamoController = require('../controllers/prestamoController');
const { checkRole } = require('../middlewares/roles');

// Rutas accesibles por múltiples roles
router.get('/', checkRole(['administrador', 'supervisor', 'servicio']), prestamoController.index);
router.get('/create', checkRole(['administrador', 'supervisor']), prestamoController.createForm);
router.post('/create', checkRole(['administrador', 'supervisor']), prestamoController.create);

// Vista de préstamos pendientes de aprobación (normal + especial)
router.get('/pendientes', checkRole(['administrador']), prestamoController.pendientes);

// Aprobación de préstamos normales
router.post('/:id/aprobar', checkRole(['administrador']), prestamoController.aprobarPrestamo);

// Aprobación de préstamos especiales
router.post('/especiales/:id/aprobar', checkRole(['administrador']), prestamoController.aprobarPrestamoEspecial);

// BONUS: Rechazo de préstamos normales
router.post('/:id/rechazar', checkRole(['administrador']), prestamoController.rechazarPrestamo);

// BONUS: Rechazo de préstamos especiales
router.post('/especiales/:id/rechazar', checkRole(['administrador']), prestamoController.rechazarPrestamoEspecial);

// Mostrar formulario de edición de préstamo
router.get('/:id/edit', checkRole(['administrador', 'supervisor']), prestamoController.editForm);
router.put('/:id', checkRole(['administrador', 'supervisor']), prestamoController.update);

// Detalles de préstamo
router.get('/:id', checkRole(['administrador', 'supervisor', 'servicio']), prestamoController.show);

// Registrar pagos
router.post('/:id/pagar', checkRole(['administrador', 'supervisor']), prestamoController.pagar);
router.post('/:id/pagar-cuota', checkRole(['administrador', 'supervisor']), prestamoController.pagarCuota);

// Recibo e impresión
router.get('/:id/recibo', prestamoController.recibo);
router.get('/:id/imprimir', prestamoController.imprimir);
router.get('/:id/imprimir-ticket', prestamoController.imprimirTicket);
router.post('/api/imprimir-ticket', prestamoController.imprimirTicketApi);

module.exports = router;
