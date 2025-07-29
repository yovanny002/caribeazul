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

// Crear nuevo préstamo (POST) - Versión recomendada (RESTful)
router.post('/', 
  checkRole(['administrador', 'supervisor', 'servicio']), 
  prestamoInteresController.create
);

// Alternativa: Ruta POST /create (mantener solo una de las dos)
// router.post('/create', 
//   checkRole(['administrador', 'supervisor', 'servicio']), 
//   prestamoInteresController.create
// );

// Detalle de préstamo (GET)
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

module.exports = router;