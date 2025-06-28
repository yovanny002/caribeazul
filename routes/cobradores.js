const express = require('express');
const router = express.Router();
const cobradorController = require('../controllers/cobradorController');
const cobradorRutaController = require('../controllers/cobradorRutaController');
const auth = require('../middlewares/auth');
const { checkRole } = require('../middlewares/roles');
const upload = require('../middlewares/multer'); // ⬅️ Aquí importamos multer

router.get('/', auth.ensureAuthenticated, cobradorController.index);
router.get('/nuevo', auth.ensureAuthenticated, cobradorController.create);
router.post('/', auth.ensureAuthenticated, upload.single('foto'), cobradorController.store);
router.get('/asignar_rutas', checkRole(['administrador']), cobradorRutaController.vistaAsignacion);
router.post('/asignar_rutas', checkRole(['administrador']), cobradorRutaController.guardarAsignacion);
router.get('/editar/:id', auth.ensureAuthenticated, cobradorController.edit);
router.put('/:id', auth.ensureAuthenticated, upload.single('foto'), cobradorController.update);
router.delete('/:id', auth.ensureAuthenticated, cobradorController.delete);

module.exports = router;
