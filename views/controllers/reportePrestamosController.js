const db = require('../models/db');
const moment = require('moment');

// Función para actualizar estados de préstamos según cuotas
const actualizarEstadosPrestamos = async () => {
  // 1. Marcar préstamos como morosos si tienen cuotas pendientes vencidas
  await db.query(`
    UPDATE solicitudes_prestamos sp
    SET estado = 'moroso'
    WHERE EXISTS (
      SELECT 1 FROM cuotas cu
      WHERE cu.prestamo_id = sp.id
        AND cu.estado = 'pendiente'
        AND cu.fecha_vencimiento < CURRENT_DATE
    )
  `);

  // 2. Marcar préstamos como por vencer si tienen cuotas pendientes que vencen en los próximos 3 días
  await db.query(`
    UPDATE solicitudes_prestamos sp
    SET estado = 'por_vencer'
    WHERE estado != 'moroso'
      AND EXISTS (
        SELECT 1 FROM cuotas cu
        WHERE cu.prestamo_id = sp.id
          AND cu.estado = 'pendiente'
          AND cu.fecha_vencimiento BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '3 days')
      )
  `);

  // 3. Marcar préstamos como aprobados si no tienen cuotas vencidas ni por vencer
  await db.query(`
    UPDATE solicitudes_prestamos sp
    SET estado = 'aprobado'
    WHERE NOT EXISTS (
      SELECT 1 FROM cuotas cu
      WHERE cu.prestamo_id = sp.id
        AND cu.estado = 'pendiente'
        AND (
          cu.fecha_vencimiento < CURRENT_DATE OR
          cu.fecha_vencimiento BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '3 days')
        )
    )
  `);
};

// Reporte de préstamos morosos
// En el controlador (reportesController.js)
exports.prestamosMorosos = async (req, res) => {
  try {
    await actualizarEstadosPrestamos();

    const [result] = await db.query(`
      SELECT 
        s.id AS prestamo_id,
        c.nombre,
        c.apellidos,
        c.cedula,
        cu.id AS cuota_id,
        cu.numero_cuota,
        cu.monto,
        cu.fecha_vencimiento,
        CURRENT_DATE - cu.fecha_vencimiento AS dias_vencido
      FROM cuotas cu
      JOIN solicitudes_prestamos s ON cu.prestamo_id = s.id
      JOIN clientes c ON s.cliente_id = c.id
      WHERE cu.estado = 'pendiente'
        AND s.estado = 'moroso'
      ORDER BY cu.fecha_vencimiento ASC
    `);

    // Calcular mora para cada préstamo (5% por día después de 2 días de gracia)
    const prestamosConMora = result.map(p => {
      const diasMora = Math.max(0, p.dias_vencido - 2);
      const mora = diasMora > 0 ? p.monto * 0.05 * diasMora : 0;
      return {
        ...p,
        dias_mora: diasMora,
        mora: parseFloat(mora.toFixed(2)),
        total_a_pagar: parseFloat((p.monto + mora).toFixed(2))
      };
    });

    res.render('reportes/prestamos_morosos', {
      title: 'Préstamos Morosos',
      prestamos: prestamosConMora,
      moment,
      messages: req.flash()
    });
  } catch (error) {
    console.error('Error cargando reporte de préstamos morosos:', error);
    req.flash('error_msg', 'No se pudieron cargar los préstamos morosos');
    res.redirect('/');
  }
};

// Reporte de cuentas por cobrar hoy
exports.cuentasPorCobrarHoy = async (req, res) => {
  try {
    await actualizarEstadosPrestamos();

    const [result] = await db.query(`
      SELECT 
        s.id AS prestamo_id,
        c.nombre,
        c.apellidos,
        c.cedula,
        cu.numero_cuota,
        cu.monto,
        cu.fecha_vencimiento
      FROM cuotas cu
      JOIN solicitudes_prestamos s ON cu.prestamo_id = s.id
      JOIN clientes c ON s.cliente_id = c.id
      WHERE cu.estado = 'pendiente'
        AND cu.fecha_vencimiento = CURRENT_DATE
        AND s.estado = 'aprobado'
      ORDER BY cu.numero_cuota ASC
    `);

    res.render('reportes/cuentas_por_cobrar_hoy', {
      title: 'Cuentas por Cobrar Hoy',
      cuentas: result,
      moment,
      messages: req.flash()
    });
  } catch (error) {
    console.error('Error cargando cuentas por cobrar hoy:', error);
    req.flash('error_msg', 'No se pudieron cargar las cuentas por cobrar hoy');
    res.redirect('/');
  }
};

// Reporte clientes nuevos últimos 30 días
exports.clientesNuevos = async (req, res) => {
  try {
    await actualizarEstadosPrestamos();

    const [clientes] = await db.query(`
      SELECT 
        c.id,
        c.nombre,
        c.apellidos,
        c.cedula,
        s.id AS prestamo_id,
        s.monto_aprobado,
        s.created_at
      FROM clientes c
      JOIN solicitudes_prestamos s ON c.id = s.cliente_id
      WHERE c.estado = 'activo'
        AND s.estado = 'aprobado'
        AND s.created_at >= (CURRENT_DATE - INTERVAL '30 days')
      ORDER BY s.created_at DESC
    `);

    res.render('reportes/clientes_nuevos', {
      title: 'Clientes Nuevos (últimos 30 días)',
      clientes,
      moment,
      messages: req.flash()
    });
  } catch (error) {
    console.error('Error cargando clientes nuevos:', error);
    req.flash('error_msg', 'No se pudieron cargar los clientes nuevos');
    res.redirect('/');
  }
};

// Reporte clientes antiguos al día
exports.clientesAntiguosAlDia = async (req, res) => {
  try {
    await actualizarEstadosPrestamos();

    const [clientes] = await db.query(`
      SELECT DISTINCT
        c.id,
        c.nombre,
        c.apellidos,
        c.cedula,
        s.id AS prestamo_id,
        s.monto_aprobado,
        s.created_at
      FROM clientes c
      JOIN solicitudes_prestamos s ON c.id = s.cliente_id
      WHERE c.estado = 'activo'
        AND s.estado = 'aprobado'
        AND s.created_at < (CURRENT_DATE - INTERVAL '1 day')
        AND NOT EXISTS (
          SELECT 1 FROM cuotas cu 
          WHERE cu.prestamo_id = s.id 
            AND cu.estado = 'pendiente'
            AND cu.fecha_vencimiento < CURRENT_DATE
        )
      ORDER BY s.created_at ASC
    `);

    res.render('reportes/clientes_antiguos_al_dia', {
      title: 'Clientes Antiguos al Día',
      clientes,
      moment,
      messages: req.flash()
    });
  } catch (error) {
    console.error('Error cargando clientes antiguos al día:', error);
    req.flash('error_msg', 'No se pudieron cargar los clientes al día');
    res.redirect('/');
  }
};