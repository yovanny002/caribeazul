const express = require('express');
const router = express.Router();
const { checkRole } = require('../middlewares/roles');
const controller = require('../controllers/prestamosEspecialesController');

// Middleware de validación de ID
const validateId = (req, res, next) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'ID inválido' });
  }
  req.id = id;
  next();
};

// Rutas CRUD básicas
router.get('/', checkRole(['administrador', 'supervisor']), controller.index);
router.get('/create', checkRole(['administrador', 'supervisor']), controller.createForm);
router.post('/create', checkRole(['administrador', 'supervisor']), controller.create);



// Rutas para un préstamo específico
router.route('/:id')
  .all(validateId)
  .get(checkRole(['administrador', 'supervisor', 'servicio']), controller.show)
  .put(checkRole(['administrador', 'supervisor']), controller.update);

router.get('/:id/edit', validateId, checkRole(['administrador', 'supervisor']), controller.editForm);

// Aprobación/rechazo
router.post('/:id/aprobar', validateId, checkRole(['administrador']), controller.aprobar);
router.post('/:id/rechazar', validateId, checkRole(['administrador']), controller.rechazar);

// Pagos
router.get('/:id/pago', validateId, checkRole(['administrador', 'supervisor']), controller.pagoForm);
router.post('/:id/pago', validateId, checkRole(['administrador', 'supervisor']), controller.procesarPago);

// Recibos
router.get('/:id/recibo/:pagoId', validateId, controller.recibo);

module.exports = router;