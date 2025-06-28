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

      const [morosidadRes] = await db.query(`
        SELECT SUM(monto) AS total FROM cuotas 
        WHERE pagado = 0 AND fecha_vencimiento < CURRENT_DATE
      `);

      const [recuperadoRes] = await db.query(`
        SELECT SUM(monto) AS total FROM pagos
      `);

      const prestamosRecientes = await db.query(`
        SELECT p.id, p.monto_aprobado, c.nombre 
        FROM solicitudes_prestamos p
        JOIN clientes c ON p.cliente_id = c.id
        ORDER BY p.created_at DESC
        LIMIT 5
      `, { type: QueryTypes.SELECT });

      const pagosPendientes = await db.query(`
        SELECT cu.monto, cu.fecha_vencimiento, cu.prestamo_id, cl.nombre
        FROM cuotas cu
        JOIN solicitudes_prestamos p ON cu.prestamo_id = p.id
        JOIN clientes cl ON p.cliente_id = cl.id
        WHERE cu.pagado = 0
        AND cu.fecha_vencimiento <= CURRENT_DATE + INTERVAL '2 days'
        ORDER BY cu.fecha_vencimiento ASC
        LIMIT 5
      `, { type: QueryTypes.SELECT });

      return {
        total_clientes: clientesRes[0].total,
        total_prestamos: prestamosRes[0].total,
        total_cobradores: cobradoresRes[0].total,
        pagos_hoy: pagosHoyRes[0].total || 0,
        capital_prestado: capitalRes[0].total || 0,
        intereses_generados: interesRes[0].total || 0,
        morosidad: morosidadRes[0].total || 0,
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