const GastosCaja = require('../models/GastoCaja');
const db = require('../models/db'); // 👈 Esto falta
const moment = require('moment');


// Mostrar listado
exports.index = async (req, res) => {
  try {
    const gastos = await GastoCaja.findAll({
      order: [['fecha', 'DESC']]
    });
    res.render('reportes/gastos', {
      gastos,
      messages: req.flash()
    });
  } catch (error) {
    console.error('Error al cargar gastos:', error);
    req.flash('error', 'Error al cargar reporte de caja chica');
    res.redirect('/dashboard');
  }
};

// Mostrar formulario de nuevo gasto
exports.formCreate = (req, res) => {
  res.render('reportes/create', {
    title: 'Nuevo Gasto',
    messages: req.flash()
  });
};

// Registrar nuevo gasto
exports.create = async (req, res) => {
  try {
    const { descripcion, monto, categoria } = req.body;

    await GastoCaja.create({
      descripcion,
      monto: parseFloat(monto),
      categoria,
      registrado_por: req.user?.nombre || 'Sistema',
      sucursal_id: req.user?.sucursal_id || null
    });

    req.flash('success', 'Gasto registrado correctamente');
    res.redirect('/reportes/gastos');
  } catch (error) {
    console.error('Error al registrar gasto:', error);
    req.flash('error', 'Error al registrar gasto');
    res.redirect('/reportes/gastos');
  }
};

// Anular gasto
exports.anular = async (req, res) => {
  try {
    const { id } = req.params;
    await GastoCaja.update({ estado: 'anulado' }, { where: { id } });
    req.flash('success', 'Gasto anulado correctamente');
    res.redirect('/reportes/gastos');
  } catch (error) {
    console.error('Error al anular gasto:', error);
    req.flash('error', 'Error al anular gasto');
    res.redirect('/reportes/gastos');
  }
};
