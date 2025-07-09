const express = require('express');
const router = express.Router();
const { checkRole } = require('../middlewares/roles');
const prestamoController = require('../controllers/prestamoController');


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


router.get('/', checkRole(['administrador', 'supervisor', 'servicio']), prestamoController.index);
router.get('/create', checkRole(['administrador', 'supervisor']), prestamoController.createForm);
router.post('/create', checkRole(['administrador', 'supervisor']), prestamoController.create);

router.route('/:id')
  .all(validateId)
  .get(checkRole(['administrador', 'supervisor', 'servicio']), prestamoController.show)
  .put(checkRole(['administrador', 'supervisor']), prestamoController.update);

router.get('/:id/edit', validateId, checkRole(['administrador', 'supervisor']), prestamoController.editForm);

router.post('/:id/aprobar', validateId, checkRole(['administrador']), prestamoController.aprobarPrestamo);
router.post('/:id/rechazar', validateId, checkRole(['administrador']), prestamoController.rechazarPrestamo);

router.post('/:id/pagar', validateId, checkRole(['administrador', 'supervisor']), prestamoController.pagar);

router.get('/:id/recibo', validateId, prestamoController.recibo);


module.exports = router;