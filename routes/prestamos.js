const express = require('express');
const router = express.Router();
const { checkRole } = require('../middlewares/roles');
const prestamoController = require('../controllers/prestamoController');
const prestamoEspecialController = require('../controllers/prestamosEspecialesController');

// Middleware de validación de ID
const validateId = (req, res, next) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'ID inválido' });
  }
  req.id = id;
  next();
};

// Rutas para préstamos normales
router.get('/', checkRole(['administrador', 'supervisor', 'servicio']), prestamoController.index);
router.get('/create', checkRole(['administrador', 'supervisor']), prestamoController.createForm);
router.post('/create', checkRole(['administrador', 'supervisor']), prestamoController.create);

router.get('/pendientes', checkRole(['administrador']), prestamoController.pendientes);

// Rutas para un préstamo específico
router.route('/:id')
  .all(validateId)
  .get(checkRole(['administrador', 'supervisor', 'servicio']), prestamoController.show)
  .put(checkRole(['administrador', 'supervisor']), prestamoController.update);

router.get('/:id/edit', validateId, checkRole(['administrador', 'supervisor']), prestamoController.editForm);

// Aprobación/rechazo
router.post('/:id/aprobar', validateId, checkRole(['administrador']), prestamoController.aprobar);
router.post('/:id/rechazar', validateId, checkRole(['administrador']), prestamoController.rechazar);

// Pagos
router.post('/:id/pagar', validateId, checkRole(['administrador', 'supervisor']), prestamoController.pagar);
router.post('/:id/pagar-cuota', validateId, checkRole(['administrador', 'supervisor']), prestamoController.pagarCuota);

// Impresión y recibos
router.get('/:id/recibo', validateId, prestamoController.recibo);
router.get('/:id/imprimir', validateId, prestamoController.imprimir);
router.get('/:id/imprimir-ticket', validateId, prestamoController.imprimirTicket);

// API para impresión
router.post('/api/imprimir-ticket', prestamoController.imprimirTicketApi);

module.exports = router;