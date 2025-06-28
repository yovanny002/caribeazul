const Ruta = require('../models/Ruta');

const rutaController = {
  index: async (req, res) => {
    const rutas = await Ruta.findAll({ order: [['id', 'DESC']] });
    res.render('rutas/index', { title: 'Rutas', rutas });
  },

  create: (req, res) => {
    res.render('rutas/create', { title: 'Crear Ruta' });
  },

  store: async (req, res) => {
    try {
      await Ruta.create({
        ...req.body,
        usuario_creacion: req.session.user?.nombre || 'admin'
      });
      req.flash('success_msg', 'Ruta creada con éxito');
      res.redirect('/rutas');
    } catch (err) {
      console.error(err);
      req.flash('error_msg', 'Error al crear la ruta');
      res.redirect('/rutas');
    }
  },

  edit: async (req, res) => {
    const ruta = await Ruta.findByPk(req.params.id);
    res.render('rutas/edit', { title: 'Editar Ruta', ruta });
  },

  update: async (req, res) => {
    try {
      await Ruta.update(req.body, { where: { id: req.params.id } });
      req.flash('success_msg', 'Ruta actualizada');
      res.redirect('/rutas');
    } catch (err) {
      console.error(err);
      req.flash('error_msg', 'Error al actualizar ruta');
      res.redirect('/rutas');
    }
  },

  delete: async (req, res) => {
    try {
      await Ruta.destroy({ where: { id: req.params.id } });
      req.flash('success_msg', 'Ruta eliminada');
      res.redirect('/rutas');
    } catch (err) {
      console.error(err);
      req.flash('error_msg', 'No se pudo eliminar la ruta');
      res.redirect('/rutas');
    }
  }
};

module.exports = rutaController;
