const express = require('express');
const router = express.Router();
const controller = require('../controllers/contratoHipotecarioController');

router.get('/', controller.index);
router.get('/create', controller.createForm);
router.post('/create', controller.create);
router.get('/:id', controller.show);
router.get('/:id/print', controller.print);
router.get('/:id/download', controller.download);

module.exports = router;
