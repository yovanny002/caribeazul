// File: controllers/aprobacionesController.js
// Controlador para manejar la aprobación de préstamos normales y especiales

const Prestamo = require('../models/Prestamo');
const PrestamoEspecial = require('../models/PrestamoEspecial');
const moment = require('moment');

class ApprovalController {
  // Método unificado para listar pendientes
// Método unificado para listar pendientes
static async listPending(req, res) {
  try {
    console.log('🔍 [ApprovalController] Iniciando listado de préstamos pendientes...');
    
    const [normalLoans, specialLoans] = await Promise.all([
      ApprovalController._getNormalLoans(),
      ApprovalController._getSpecialLoans()
    ]);

    console.log('📊 [ApprovalController] Resultados obtenidos:');
    console.log(`- Préstamos normales: ${normalLoans.length} registros`);
    console.log(`- Préstamos especiales: ${specialLoans.length} registros`);
    
    if (normalLoans.length > 0) {
      console.log('📝 Ejemplo de préstamo normal:', JSON.stringify(normalLoans[0], null, 2));
    }
    
    if (specialLoans.length > 0) {
      console.log('📝 Ejemplo de préstamo especial:', JSON.stringify(specialLoans[0], null, 2));
    }

    const allLoans = [...normalLoans, ...specialLoans]
      .sort((a, b) => new Date(b.fecha_creacion) - new Date(a.fecha_creacion));

    console.log('🔄 [ApprovalController] Total de préstamos combinados:', allLoans.length);
    console.log('📅 Préstamos ordenados por fecha (nuevos primero):');
    allLoans.forEach((loan, index) => {
      console.log(`${index + 1}. ${loan.loanType} - ${loan.cliente_nombre} - ${loan.fecha_creacion}`);
    });

    console.log('🎨 [ApprovalController] Renderizando vista con datos...');
    res.render('approval/pending', {
      loans: allLoans,
      helpers: ApprovalController._getTemplateHelpers(),
      messages: req.flash()
    });

  } catch (error) {
    console.error('❌ [ApprovalController] Error en listPending:', error);
    ApprovalController._handleError(req, res, error);
  }
}

  // Métodos privados
static async _getNormalLoans() {
  console.log('🔎 Buscando préstamos normales pendientes...');
  const loans = await Prestamo.findAllWithClientes('pendiente');
  console.log(`✅ Encontrados ${loans.length} préstamos normales`);
  return loans.map(loan => ({
    ...loan,
    loanType: 'normal',
    displayType: 'Préstamo Normal',
    icon: 'fa-file-invoice-dollar',
    fecha_creacion: loan.created_at // Añadir esta línea
  }));
}
static async _getSpecialLoans() {
  console.log('🔎 Buscando préstamos especiales pendientes...');
  const loans = await PrestamoEspecial.findAllWithClienteYRuta('pendiente');
  console.log(`✅ Encontrados ${loans.length} préstamos especiales`);
  return loans.map(loan => ({
    ...loan,
    loanType: 'special',
    displayType: 'Préstamo Especial',
    icon: 'fa-star',
    echa_creacion: loan.fecha_creacion // Ya existe, pero para consistencia
  }));
}
  static _getTemplateHelpers() {
    return {
      formatCurrency: (amount) => new Intl.NumberFormat('es-DO', {
        style: 'currency',
        currency: 'DOP'
      }).format(amount || 0),

      formatDate: (dateString) =>
        dateString ? moment(dateString).format('DD/MM/YYYY') : 'Sin fecha'
    };
  }

  static async approveNormal(req, res) {
    try {
      const { id } = req.params;
      const { approved_amount, interest_rate } = req.body;

      await Prestamo.aprobar(id, {
        monto_aprobado: approved_amount,
        interes_porcentaje: interest_rate,
        estado: 'aprobado'
      });

      req.flash('success', 'Préstamo normal aprobado');
      res.redirect('/pendientes');
    } catch (error) {
      ApprovalController._handleError(req, res, error);
    }
  }

  static async approveSpecial(req, res) {
    try {
      const { id } = req.params;
      const { approved_amount } = req.body;

      await PrestamoEspecial.update(id, {
        monto_aprobado: approved_amount,
        estado: 'aprobado',
        fecha_aprobacion: new Date()
      });

      req.flash('success', 'Préstamo especial aprobado');
      res.redirect('/pendientes');
    } catch (error) {
      ApprovalController._handleError(req, res, error);
    }
  }

  static async approveLoan(req, res) {
    if (req.params.type === 'normal') {
      return ApprovalController.approveNormal(req, res);
    } else if (req.params.type === 'special') {
      return ApprovalController.approveSpecial(req, res);
    } else {
      req.flash('error', 'Tipo de préstamo inválido');
      return res.redirect('/pendientes');
    }
  }

  static async rejectLoan(req, res) {
    if (req.params.type === 'normal') {
      return ApprovalController.rejectNormal(req, res);
    } else if (req.params.type === 'special') {
      return ApprovalController.rejectSpecial(req, res);
    } else {
      req.flash('error', 'Tipo de préstamo inválido');
      return res.redirect('/pendientes');
    }
  }

  static async rejectNormal(req, res) {
    try {
      const { id } = req.params;
      const { rejection_reason } = req.body;

      await Prestamo.rechazar(id, {
        estado: 'rechazado',
        motivo_rechazo: rejection_reason || 'Sin motivo especificado'
      });

      req.flash('success', 'Préstamo normal rechazado');
      res.redirect('/pendientes');
    } catch (error) {
      ApprovalController._handleError(req, res, error);
    }
  }

  static async rejectSpecial(req, res) {
    try {
      const { id } = req.params;
      const { rejection_reason } = req.body;

      await PrestamoEspecial.update(id, {
        estado: 'rechazado',
        motivo_rechazo: rejection_reason || 'Sin motivo especificado',
        fecha_aprobacion: null
      });

      req.flash('success', 'Préstamo especial rechazado');
      res.redirect('/pendientes');
    } catch (error) {
      ApprovalController._handleError(req, res, error);
    }
  }

  static _handleError(req, res, error) {
    console.error('[ApprovalController] Error:', error);
    req.flash('error', 'Error al procesar solicitud');
    res.redirect('/dashboard');
  }
}

module.exports = ApprovalController;
