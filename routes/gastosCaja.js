const express = require('express');
const router = express.Router();
const gastoCajaController = require('../controllers/gastoCajaController');
const { checkRole } = require('../middlewares/roles');

router.get('/reportes/gastos', checkRole(['administrador', 'caja', 'supervisor']), gastoCajaController.index);
router.get('/reportes/gastos/create', checkRole(['administrador', 'caja']), gastoCajaController.createForm);
router.post('/reportes/gastos', checkRole(['administrador', 'caja']), gastoCajaController.store);
router.post('/reportes/gastos/:id/delete', checkRole(['administrador', 'caja']), gastoCajaController.delete);

module.exports = router;
