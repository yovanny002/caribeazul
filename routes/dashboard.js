const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');

router.get('/', dashboardController.index);
router.get('/data', dashboardController.getData);

module.exports = router;