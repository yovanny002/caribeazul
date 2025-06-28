const db = require('../models/db');

exports.asignarRutas = async (req, res) => {
  try {
    const [cobradores] = await db.query('SELECT id, nombre, apellidos FROM cobradores WHERE activo = 1');
    const [rutas] = await db.query('SELECT id, nombre, zona, tipo_ruta FROM rutas WHERE activo = 1');

    const selectedCobradorId = req.query.cobrador_id || null;
    let rutasAsignadas = [];

    if (selectedCobradorId) {
      const [asignaciones] = await db.query('SELECT ruta_id FROM rutas_cobradores WHERE cobrador_id = ?', [selectedCobradorId]);
      rutasAsignadas = asignaciones.map(row => row.ruta_id);
    }

    res.render('cobradores/asignar_rutas', {
      title: 'Asignar Rutas',
      cobradores,
      rutas,
      rutasAsignadas,
      selectedCobradorId,
      messages: req.flash()
    });

  } catch (error) {
    console.error('Error al cargar la vista de asignación de rutas:', error);
    req.flash('error', 'No se pudo cargar la vista de asignación de rutas');
    res.redirect('/cobradores');
  }
};
exports.vistaAsignacion = async (req, res) => {
  try {
    const [cobradores] = await db.query(`SELECT id, nombre, correo FROM users WHERE rol = 'cobrador'`);
    const [rutas] = await db.query(`SELECT id, nombre FROM rutas WHERE activo = 1`);
    const [asignaciones] = await db.query(`
      SELECT cr.*, u.nombre AS cobrador_nombre, r.nombre AS ruta_nombre
      FROM cobrador_rutas cr
      JOIN users u ON cr.cobrador_id = u.id
      JOIN rutas r ON cr.ruta_id = r.id
    `);

    res.render('cobradores/asignar_rutas', {
      cobradores,
      rutas,
      asignaciones,
      messages: req.flash()
    });
  } catch (error) {
    console.error('Error cargando asignación de rutas:', error);
    req.flash('error', 'No se pudo cargar la vista');
    res.redirect('/');
  }
};

exports.guardarAsignacion = async (req, res) => {
  const { cobrador_id, ruta_id } = req.body;
  const asignado_por = req.session.userId || null;

  try {
    await db.query(`
      INSERT INTO cobrador_rutas (cobrador_id, ruta_id, asignado_por)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE ruta_id = VALUES(ruta_id), asignado_por = VALUES(asignado_por), fecha_asignacion = CURRENT_TIMESTAMP
    `, [cobrador_id, ruta_id, asignado_por]);

    req.flash('success', 'Ruta asignada correctamente');
    res.redirect('/cobradores/asignar_rutas');
  } catch (error) {
    console.error('Error guardando asignación:', error);
    req.flash('error', 'Hubo un error al asignar la ruta');
    res.redirect('/cobradores/asignar_rutas');
  }
};