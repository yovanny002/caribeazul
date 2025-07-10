const express = require('express');
const router = express.Router();
const { checkRole } = require('../middlewares/roles');
const controller = require('../controllers/prestamosEspecialesController');

// Middleware de validación de ID para rutas con :id
const validateId = (req, res, next) => {
  const id = parseInt(req.params.id);
  if (isNaN(id) || id <= 0) {
    return res.status(400).json({ error: 'ID inválido' });
  }
  req.id = id;
  next();
};

// Rutas sin ID
router.get('/', checkRole(['administrador', 'supervisor']), controller.index);
router.get('/crear', checkRole(['administrador', 'supervisor']), controller.createForm);
router.post('/crear', checkRole(['administrador', 'supervisor']), controller.create);

// Middleware que se aplica sólo a rutas con ID
router.use('/:id', validateId);

// Rutas con ID
router.route('/:id')
  .get(checkRole(['administrador', 'supervisor', 'servicio']), controller.show)
  .put(checkRole(['administrador', 'supervisor']), controller.update);

router.get('/:id/editar', checkRole(['administrador', 'supervisor']), controller.editForm);

// Rutas para aprobación y rechazo
router.post('/:id/aprobar', checkRole(['administrador']), controller.aprobar);
router.post('/:id/rechazar', checkRole(['administrador']), controller.rechazar);

// Rutas de pagos
router.get('/:id/pago', checkRole(['administrador', 'supervisor']), controller.pagoForm);
router.post('/:id/pago', checkRole(['administrador', 'supervisor']), controller.procesarPago);

// Ruta para recibo de pago
router.get('/:id/recibo/:pagoId', controller.recibo);

module.exports = router;
