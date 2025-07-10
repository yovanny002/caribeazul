const express = require('express');
const router = express.Router();
const documentoController = require('../controllers/documentoController');
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: path.join(__dirname, '../public/documents'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = `${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`;
    cb(null, filename);
  }
});

const upload = multer({ storage });

router.post('/:prestamoId/subir', upload.single('archivo'), documentoController.subirDocumento);
router.post('/:prestamoId/eliminar', documentoController.eliminarDocumento);

module.exports = router;
