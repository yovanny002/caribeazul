const express = require('express');
const router = express.Router();
const { checkRole } = require('../middlewares/roles');
const controller = require('../controllers/prestamosEspecialesController');

// Middleware de validación de ID (versión mejorada)
const validateId = (req, res, next) => {
  // Excluir rutas que no necesitan validación de ID
  if (req.path === '/create' || req.path.endsWith('/crear')) {
    return next();
  }

  const id = parseInt(req.params.id);
  if (isNaN(id) || id <= 0) {
    return res.status(400).json({ error: 'ID inválido' });
  }
  req.id = id;
  next();
};

// Rutas que NO requieren ID
router.get('/', checkRole(['administrador', 'supervisor']), controller.index);
router.get('/create', checkRole(['administrador', 'supervisor']), controller.createForm);
router.post('/create', checkRole(['administrador', 'supervisor']), controller.create);

// Rutas que SÍ requieren ID
router.use('/:id', validateId); // Aplica validateId solo a rutas con :id

router.route('/:id')
  .get(checkRole(['administrador', 'supervisor', 'servicio']), controller.show)
  .put(checkRole(['administrador', 'supervisor']), controller.update);

router.get('/:id/edit', checkRole(['administrador', 'supervisor']), controller.editForm);

// Rutas de aprobación/rechazo
router.post('/:id/aprobar', checkRole(['administrador']), controller.aprobar);
router.post('/:id/rechazar', checkRole(['administrador']), controller.rechazar);

// Rutas de pagos
router.get('/:id/pago', checkRole(['administrador', 'supervisor']), controller.pagoForm);
router.post('/:id/pago', checkRole(['administrador', 'supervisor']), controller.procesarPago);

// Ruta de recibo
router.get('/:id/recibo/:pagoId', controller.recibo);

module.exports = router;