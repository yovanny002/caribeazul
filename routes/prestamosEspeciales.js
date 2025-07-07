const express = require('express');
const router = express.Router();
const prestamosEspecialesController = require('../controllers/prestamosEspecialesController');

// Mostrar formulario para nuevo préstamo especial
router.get('/nuevo', prestamosEspecialesController.createForm);

// Guardar nuevo préstamo especial
router.post('/crear', prestamosEspecialesController.create);

// Ver detalle de un préstamo especial
router.get('/:id', prestamosEspecialesController.show);

// Listado de préstamos especiales
router.get('/', prestamosEspecialesController.index);

module.exports = router;
