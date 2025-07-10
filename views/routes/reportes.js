const express = require('express');
const router = express.Router();
const reporteCajaController = require('../controllers/reporteCajaController');
const reportePrestamosController = require('../controllers/reportePrestamosController');
const { checkRole } = require('../middlewares/roles');

// Listado de reportes generales
router.get('/', checkRole(['administrador', 'supervisor']), (req, res) => {
  res.render('reportes/index', {
    title: 'Panel de Reportes',
    messages: req.flash()
  });
});

// ✅ Listado de gastos de caja
router.get('/gastos', checkRole(['administrador', 'caja']), reporteCajaController.index);

// Formulario de creación
router.get('/gastos/nuevo', checkRole(['administrador', 'caja']), reporteCajaController.formCreate);

// Registro en DB
router.post('/create', checkRole(['administrador', 'caja']), reporteCajaController.create);

// Anulación de gasto
router.post('/gastos/:id/anular', checkRole(['administrador']), reporteCajaController.anular);

// Reportes de préstamos
router.get('/prestamos_morosos', reportePrestamosController.prestamosMorosos);
router.get('/cuentas_por_cobrar_hoy', reportePrestamosController.cuentasPorCobrarHoy);
router.get('/clientes_nuevos', reportePrestamosController.clientesNuevos);
router.get('/clientes_antiguos_al_dia', reportePrestamosController.clientesAntiguosAlDia);



module.exports = router;
