const express = require('express');
const router = express.Router();
const contratoController = require('../controllers/contratoController');

// Middleware de autenticación (si lo necesitas)
const { isAuthenticated } = require('../middlewares/auth');

// Aplicar middleware a todas las rutas si es necesario
// router.use(isAuthenticated);

// Rutas de contratos
router.get('/', contratoController.index);
router.get('/create', contratoController.createForm);
router.post('/create', contratoController.create);
router.get('/:id', contratoController.show);
router.get('/:id/download', contratoController.download);
router.get('/:id/print', contratoController.print);
router.delete('/:id', contratoController.delete);

module.exports = router;