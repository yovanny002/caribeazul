const express = require('express');
const router = express.Router();
const ApprovalController = require('../controllers/aprobacionesController');
const { checkRole } = require('../middlewares/roles');
const { param } = require('express-validator');

// Validaciones comunes
const validateLoanParams = [
  param('type').isIn(['normal', 'special']).withMessage('Tipo de préstamo inválido'),
  param('id').isInt().withMessage('ID debe ser un número entero')
];

// Ruta para listar todos los préstamos pendientes
router.get('/', 
  checkRole(['administrador', 'supervisor']), 
  ApprovalController.listPending
);

// Rutas unificadas principales
router.post('/:type/:id/aprobar',
  checkRole(['administrador', 'supervisor']),
  validateLoanParams,
  ApprovalController.approveLoan
);

router.post('/:type/:id/rechazar',
  checkRole(['administrador', 'supervisor']),
  validateLoanParams,
  ApprovalController.rejectLoan
);

// Rutas alternativas (legacy)
router.post('/prestamos/:id/aprobar',
  checkRole(['administrador', 'supervisor']),
  param('id').isInt(),
  (req, res, next) => {
    req.params.type = 'normal';
    next();
  },
  ApprovalController.approveLoan
);

router.post('/prestamos/:id/rechazar',
  checkRole(['administrador', 'supervisor']),
  param('id').isInt(),
  (req, res, next) => {
    req.params.type = 'normal';
    next();
  },
  ApprovalController.rejectLoan
);

router.post('/prestamos-especiales/:id/aprobar',
  checkRole(['administrador', 'supervisor']),
  param('id').isInt(),
  (req, res, next) => {
    req.params.type = 'special';
    next();
  },
  ApprovalController.approveLoan
);

router.post('/prestamos-especiales/:id/rechazar',
  checkRole(['administrador', 'supervisor']),
  param('id').isInt(),
  (req, res, next) => {
    req.params.type = 'special';
    next();
  },
  ApprovalController.rejectLoan
);

module.exports = router;