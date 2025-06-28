// controllers/cobradorController.js

const Cobrador = require('../models/Cobrador'); // modelo Sequelize (o similar)
const Ruta = require('../models/Ruta');
const CobradorRuta = require('../models/CobradorRuta'); // modelo para la relación entre cobradores y rutas
const path = require('path');
const fs = require('fs');

exports.index = async (req, res) => {
  const cobradores = await Cobrador.findAll();
  res.render('cobradores/index', { cobradores });
};


exports.create = async (req, res) => {
  try {
    const rutas = await Ruta.findAll({ where: { activo: 1 } });
    res.render('cobradores/create', { rutas, messages: req.flash() });
  } catch (error) {
    console.error('Error cargando formulario de nuevo cobrador:', error);
    req.flash('error', 'No se pudo cargar el formulario');
    res.redirect('/cobradores');
  }
};


exports.store = async (req, res) => {
  try {
    const { nombre, telefono, cedula } = req.body;
    let foto = null;

    if (req.file) {
      foto = req.file.filename;
    }

    await Cobrador.create({
      nombre,
      telefono,
      cedula,
      foto,
      activo: 1
    });

    req.flash('success', 'Cobrador creado correctamente');
    res.redirect('/cobradores');
  } catch (error) {
    console.error('Error al guardar el cobrador:', error);
    req.flash('error', 'No se pudo crear el cobrador');
    res.redirect('/cobradores');
  }
};

exports.edit = async (req, res) => {
  const cobrador = await Cobrador.findByPk(req.params.id);
  if (!cobrador) return res.redirect('/cobradores');

  res.render('cobradores/edit', { cobrador });
};

exports.update = async (req, res) => {
  try {
    const { nombre, telefono, cedula } = req.body;
    const cobrador = await Cobrador.findByPk(req.params.id);

    if (!cobrador) return res.redirect('/cobradores');

    let foto = cobrador.foto;

    if (req.file) {
      // Elimina la antigua si existe
      if (foto) {
        const oldPath = path.join(__dirname, '..', 'public', 'uploads', foto);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      foto = req.file.filename;
    }

    await cobrador.update({
      nombre,
      telefono,
      cedula,
      foto
    });

    req.flash('success', 'Cobrador actualizado');
    res.redirect('/cobradores');
  } catch (error) {
    console.error('Error al actualizar:', error);
    req.flash('error', 'Error al actualizar el cobrador');
    res.redirect('/cobradores');
  }
};

exports.delete = async (req, res) => {
  try {
    const cobrador = await Cobrador.findByPk(req.params.id);
    if (!cobrador) return res.status(404).json({ success: false });

    // Opcional: eliminar imagen
    if (cobrador.foto) {
      const filePath = path.join(__dirname, '..', 'public', 'uploads', cobrador.foto);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    await cobrador.destroy();
    res.json({ success: true });
  } catch (error) {
    console.error('Error al eliminar:', error);
    res.status(500).json({ success: false });
  }
};
