const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/contratoHipotecarioController');

router.get('/', ctrl.index);
router.get('/create', ctrl.createForm);
router.post('/create', ctrl.create);
router.get('/:id', ctrl.show);
router.get('/:id/download', ctrl.download);
router.get('/:id/print', ctrl.print);
router.delete('/:id', async (req, res) => {
  try {
    await require('../models/ContratoHipotecario').delete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
