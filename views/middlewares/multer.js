const multer = require('multer');
const path = require('path');

// Configuración del almacenamiento
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads');
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = `foto_${Date.now()}${ext}`;
    cb(null, filename);
  }
});

// Filtro de tipos de archivo permitidos (solo imágenes)
const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/jpg'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Solo se permiten imágenes JPEG o PNG'), false);
  }
};

const upload = multer({ storage, fileFilter });

module.exports = upload;
