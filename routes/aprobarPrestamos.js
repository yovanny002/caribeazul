// routes/aprobaciones.js
const express = require('express');
const router = express.Router();
const ApprovalController = require('../controllers/aprobacionesController');
const { isAuthorized } = require('../middlewares/auth'); // Middleware opcional de autenticación

// Ruta para listar todos los préstamos pendientes (unificada)
router.get('/pendientes', isAuthorized(['admin', 'supervisor']), ApprovalController.listPending);

// Rutas para acciones de aprobación/rechazo (unificadas)
router.post('/aprobar/:type/:id', 
  isAuthorized(['admin', 'supervisor']), 
  ApprovalController.approveLoan
);

router.post('/rechazar/:type/:id', 
  isAuthorized(['admin', 'supervisor']), 
  ApprovalController.rejectLoan
);

// Rutas alternativas para compatibilidad con frontend si es necesario
router.post('/prestamos/aprobar/:id', 
  isAuthorized(['admin', 'supervisor']), 
  (req, res) => {
    req.params.type = 'normal';
    ApprovalController.approveLoan(req, res);
  }
);

router.post('/prestamos/rechazar/:id', 
  isAuthorized(['admin', 'supervisor']), 
  (req, res) => {
    req.params.type = 'normal';
    ApprovalController.rejectLoan(req, res);
  }
);

router.post('/prestamos-especiales/aprobar/:id', 
  isAuthorized(['admin', 'supervisor']), 
  (req, res) => {
    req.params.type = 'special';
    ApprovalController.approveLoan(req, res);
  }
);

router.post('/prestamos-especiales/rechazar/:id', 
  isAuthorized(['admin', 'supervisor']), 
  (req, res) => {
    req.params.type = 'special';
    ApprovalController.rejectLoan(req, res);
  }
);

module.exports = router;