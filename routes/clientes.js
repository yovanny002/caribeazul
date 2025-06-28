const express = require('express');
const router = express.Router();
const clienteController = require('../controllers/clienteController');
const multer = require('multer');

// Configurar almacenamiento de imágenes
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + file.originalname.replace(/\s+/g, '_');
    cb(null, uniqueName);
  }
});

const upload = multer({ storage });


// Mostrar todos los clientes
router.get('/', clienteController.getAllClientes);

// Mostrar formulario para crear nuevo cliente
router.get('/create', clienteController.showCreateForm);

// Crear nuevo cliente (con carga de imagen)
router.post('/', upload.single('foto'), clienteController.createCliente);

// Mostrar formulario de edición
router.get('/:id/edit', clienteController.showEditForm);

// Actualizar cliente (con carga de nueva imagen)
router.put('/:id', upload.single('foto'), clienteController.updateCliente);

// Mostrar un cliente específico (debe ir al final)
router.get('/:id', clienteController.getClienteById);

module.exports = router;
