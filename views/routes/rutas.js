const express = require('express');
const router = express.Router();
const rutaController = require('../controllers/rutaController');
const auth = require('../middlewares/auth');
const { checkRole }  = require('../middlewares/roles');

router.get('/', checkRole(['administrador', 'supervisor']), rutaController.index);
router.get('/nuevo', auth.ensureAuthenticated, rutaController.create);
router.post('/', auth.ensureAuthenticated, rutaController.store);
router.get('/editar/:id', auth.ensureAuthenticated, rutaController.edit);
router.put('/:id', auth.ensureAuthenticated, rutaController.update);
router.delete('/:id', auth.ensureAuthenticated, rutaController.delete);

module.exports = router;
