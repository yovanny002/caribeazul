const express = require('express');
const router = express.Router();
const Prestamo = require('../models/Prestamo');
const PrestamoEspecial = require('../models/PrestamoEspecial');

// Aprobación préstamo normal
router.post('/:id/aprobar', async (req, res) => {
  try {
    const id = req.params.id;
    await Prestamo.updateEstado(id, 'aprobado');
    res.redirect('/prestamos/pendientes');
  } catch (err) {
    console.error('Error al aprobar préstamo normal:', err.message);
    res.status(500).send('Error al aprobar préstamo');
  }
});

// Aprobación préstamo especial
router.post('/especiales/:id/aprobar', async (req, res) => {
  try {
    const id = req.params.id;
    await PrestamoEspecial.update(id, { estado: 'aprobado' });
    res.redirect('/prestamos/pendientes');
  } catch (err) {
    console.error('Error al aprobar préstamo especial:', err.message);
    res.status(500).send('Error al aprobar préstamo especial');
  }
});

module.exports = router;
