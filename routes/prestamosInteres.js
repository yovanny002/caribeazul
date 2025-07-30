const express = require('express');
const router = express.Router();
const prestamoInteresController = require('../controllers/prestamoInteresController');
const { checkRole } = require('../middlewares/roles');

// Listado de préstamos (GET)
router.get('/', 
  checkRole(['administrador', 'supervisor', 'servicio']), 
  prestamoInteresController.index
);

// Formulario de creación (GET)
router.get('/create', 
  checkRole(['administrador', 'supervisor', 'servicio']), 
  prestamoInteresController.createForm
);

// Crear nuevo préstamo (POST)
router.post('/', 
  checkRole(['administrador', 'supervisor', 'servicio']), 
  prestamoInteresController.create
);

// Detalle de préstamo (GET)
// === ESTA ES LA RUTA QUE DEBE CAPTURAR EL ID ===
router.get('/:id', 
  checkRole(['administrador', 'supervisor', 'servicio']), 
  prestamoInteresController.show
);

// Formulario de pago (GET)
router.get('/:id/pago', 
  checkRole(['administrador', 'supervisor', 'servicio']), 
  prestamoInteresController.pagoForm
);

// Registrar pago (POST)
router.post('/:id/pago', 
  checkRole(['administrador', 'supervisor', 'servicio']), 
  prestamoInteresController.registrarPago
);

// Recibo de pago (GET)
router.get('/:id/recibo/:pagoId', 
  checkRole(['administrador', 'supervisor', 'servicio']), 
  prestamoInteresController.recibo
);

// Ruta para imprimir el contrato del préstamo por interés
router.get('/:id/imprimir-contrato',
  checkRole(['administrador', 'supervisor', 'servicio']),
  prestamoInteresController.imprimirContrato
);

module.exports = router;