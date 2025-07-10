const db = require('../models/db');
const { Op, QueryTypes } = require('sequelize');

const dashboardController = {
getDashboardData: async () => {
  try {
    // Consultas SQL adaptadas para PostgreSQL
    const [clientesRes] = await db.query(`
      SELECT COUNT(*) AS total FROM clientes WHERE estado = 'activo'
    `);

    const [prestamosRes] = await db.query(`
      SELECT COUNT(*) AS total FROM solicitudes_prestamos WHERE estado = 'aprobado'
    `);

    const [cobradoresRes] = await db.query(`
      SELECT COUNT(*) AS total FROM users WHERE rol = 'cobrador'
    `);

    const [pagosHoyRes] = await db.query(`
      SELECT SUM(monto) AS total FROM pagos 
      WHERE DATE(fecha) = CURRENT_DATE
    `);

    const [capitalRes] = await db.query(`
      SELECT SUM(monto_aprobado) AS total FROM solicitudes_prestamos 
      WHERE estado = 'aprobado'
    `);

    const [interesRes] = await db.query(`
      SELECT SUM(monto_aprobado * 0.43) AS total FROM solicitudes_prestamos 
      WHERE estado = 'aprobado'
    `);

    // CONSULTA CORREGIDA PARA MOROSIDAD (incluye cálculo de mora del 5% después de 3 días)
    const morosidadRes = await db.query(`
      SELECT 
        COALESCE(SUM(
          CASE 
            WHEN c.fecha_vencimiento < CURRENT_DATE - INTERVAL '3 days' THEN c.monto * 1.05
            WHEN c.fecha_vencimiento < CURRENT_DATE THEN c.monto
            ELSE 0
          END
        ), 0) AS total_moras_calculadas,
        COALESCE(SUM(p.moras), 0) AS total_moras_registradas
      FROM cuotas c
      JOIN solicitudes_prestamos p ON c.prestamo_id = p.id
      WHERE (c.pagado = 0 OR c.estado = 'pendiente')
      AND c.fecha_vencimiento < CURRENT_DATE
    `, { type: QueryTypes.SELECT });

    const [recuperadoRes] = await db.query(`
      SELECT SUM(monto) AS total FROM pagos
    `);

      // CONSULTA MEJORADA PARA PRÉSTAMOS RECIENTES (incluye más datos relevantes)
      const prestamosRecientes = await db.query(`
        SELECT 
          p.id, 
          p.monto_aprobado, 
          c.nombre,
          c.cedula,
          p.estado,
          p.created_at
        FROM solicitudes_prestamos p
        JOIN clientes c ON p.cliente_id = c.id
        WHERE p.estado = 'aprobado'
        ORDER BY p.created_at DESC
        LIMIT 5
      `, { type: QueryTypes.SELECT });

      // CONSULTA MEJORADA PARA PAGOS PENDIENTES (incluye cálculo de mora)
      const pagosPendientes = await db.query(`
        SELECT 
          cu.id AS cuota_id,
          cu.monto,
          CASE
            WHEN cu.fecha_vencimiento < CURRENT_DATE - INTERVAL '3 days' THEN cu.monto * 1.05
            WHEN cu.fecha_vencimiento < CURRENT_DATE THEN cu.monto
            ELSE cu.monto
          END AS monto_con_mora,
          cu.fecha_vencimiento, 
          cu.prestamo_id, 
          cl.nombre,
          cl.telefono1,
          p.monto_aprobado
        FROM cuotas cu
        JOIN solicitudes_prestamos p ON cu.prestamo_id = p.id
        JOIN clientes cl ON p.cliente_id = cl.id
        WHERE (cu.pagado = 0 OR cu.estado = 'pendiente')
        AND cu.fecha_vencimiento <= CURRENT_DATE + INTERVAL '7 days'
        ORDER BY 
          CASE
            WHEN cu.fecha_vencimiento < CURRENT_DATE THEN 0
            ELSE 1
          END,
          cu.fecha_vencimiento ASC
        LIMIT 10
      `, { type: QueryTypes.SELECT });

      // Cálculo de morosidad total (calculada + registrada)
     // Cálculo de morosidad total (calculada + registrada)
    const morosidadTotal = parseFloat(morosidadRes.total_moras_calculadas || 0) + 
                         parseFloat(morosidadRes.total_moras_registradas || 0);

    return {
      total_clientes: clientesRes[0].total,
      total_prestamos: prestamosRes[0].total,
      total_cobradores: cobradoresRes[0].total,
      pagos_hoy: pagosHoyRes[0].total || 0,
      capital_prestado: capitalRes[0].total || 0,
      intereses_generados: interesRes[0].total || 0,
      morosidad: morosidadTotal,
      recuperado: recuperadoRes[0].total || 0,
      prestamosRecientes,
      pagosPendientes
    };
  } catch (error) {
    console.error('❌ Error obteniendo datos del dashboard:', error);
    throw error;
  }
},

  index: async (req, res) => {
    try {
      const user = req.session.user;

      // Redirección basada en rol
      switch (user.rol) {
        case 'caja':
          return res.redirect('/pagos');
        case 'servicio':
          return res.redirect('/prestamos');
        case 'cobrador':
          return res.redirect('/clientes/ruta');
      }

      const dashboardData = await dashboardController.getDashboardData();

      res.render('dashboard/index', {
        ...dashboardData,
        user,
        title: 'Panel de Control'
      });

    } catch (error) {
      console.error('❌ Error cargando dashboard:', error);
      req.flash('error', 'Error al cargar el dashboard');
      res.redirect('/');
    }
  },

  getData: async (req, res) => {
    try {
      const dashboardData = await dashboardController.getDashboardData();
      res.json(dashboardData);
    } catch (error) {
      console.error('❌ Error obteniendo datos del dashboard:', error);
      res.status(500).json({ error: 'Error al obtener datos del dashboard' });
    }
  }
};

module.exports = dashboardController;