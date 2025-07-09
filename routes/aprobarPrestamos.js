// routes/aprobaciones.js
const express = require('express');
const router = express.Router();
const ApprovalController = require('../controllers/aprobacionesController');
const { checkRole } = require('../middlewares/roles');


// Ruta para listar todos los préstamos pendientes (unificada)
router.get('/', checkRole(['administrador', 'supervisor']), ApprovalController.listPending);

// Rutas para acciones de aprobación/rechazo (unificadas)
router.post('/aprobar/:type/:id', 
  checkRole(['administrador', 'supervisor']), 
  ApprovalController.approveLoan
);

router.post('/rechazar/:type/:id', 
  checkRole(['administrador', 'supervisor']), 
  ApprovalController.rejectLoan
);

// Rutas alternativas para compatibilidad con frontend si es necesario
router.post('/prestamos/aprobar/:id', 
  checkRole(['administrador', 'supervisor']), 
  (req, res) => {
    req.params.type = 'normal';
    ApprovalController.approveLoan(req, res);
  }
);

router.post('/prestamos/rechazar/:id', 
  checkRole(['administrador', 'supervisor']), 
  (req, res) => {
    req.params.type = 'normal';
    ApprovalController.rejectLoan(req, res);
  }
);

router.post('/prestamos-especiales/aprobar/:id', 
  checkRole(['administrador', 'supervisor']), 
  (req, res) => {
    req.params.type = 'special';
    ApprovalController.approveLoan(req, res);
  }
);

router.post('/prestamos-especiales/rechazar/:id', 
  checkRole(['administrador', 'supervisor']), 
  (req, res) => {
    req.params.type = 'special';
    ApprovalController.rejectLoan(req, res);
  }
);

module.exports = router;