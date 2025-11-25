const express = require('express');
const router = express.Router();
const contratoController = require('../controllers/contratoController');

router.get('/', contratoController.index);
router.get('financiamiento/create', contratoController.createForm);
router.post('financiamiento/create', contratoController.create);
router.get('/:id', contratoController.show);
router.get('/:id/download', contratoController.download);
router.get('/:id/print', contratoController.print);
router.delete('/:id', contratoController.delete);

module.exports = router;