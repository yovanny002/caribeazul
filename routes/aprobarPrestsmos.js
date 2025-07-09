const express = require('express');
const router = express.Router();
const ApprovalController = require('../controllers/aprobacionesController');

// Ruta consolidada
router.get('/pendientes', ApprovalController.listPending);

// O si prefieres mantener rutas separadas pero mismo controlador
router.get('/prestamos/pendientes', ApprovalController.listPending);
router.get('/prestamos-especiales/pendientes', ApprovalController.listPending);

module.exports = router;