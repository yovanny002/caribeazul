const express = require('express');
const router = express.Router();
const contratoController = require('../controllers/contratoController');

router.get('/financiamiento', contratoController.index);
router.get('/create', contratoController.createForm);
router.post('/create', contratoController.create);
router.get('/:id', contratoController.show);
router.get('/:id/download', contratoController.download);
router.get('/:id/print', contratoController.print);
router.delete('/:id', contratoController.delete);

module.exports = router;