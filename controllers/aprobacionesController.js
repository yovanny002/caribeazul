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

      // Formatear y unificar los datos
      const formattedNormalLoans = normalLoans.map(loan => ({
        ...loan,
        loanType: 'normal',
        displayType: 'Préstamo Normal',
        icon: 'fa-file-invoice-dollar',
        fecha_creacion: loan.created_at, // Mapear created_at a fecha_creacion
        detalles: `${loan.cuotas} cuotas de ${loan.monto_por_cuota}`
      }));

      const formattedSpecialLoans = specialLoans.map(loan => ({
        ...loan,
        loanType: 'special',
        displayType: 'Préstamo Especial',
        icon: 'fa-star',
        fecha_creacion: loan.fecha_creacion || loan.created_at, // Usar fecha_creacion si existe
        detalles: loan.observaciones || 'Préstamo especial'
      }));

      // Combinar y ordenar
      const allLoans = [...formattedNormalLoans, ...formattedSpecialLoans]
        .sort((a, b) => new Date(b.fecha_creacion) - new Date(a.fecha_creacion));

      console.log('🔄 [ApprovalController] Total de préstamos combinados:', allLoans.length);
      
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
  // Obtener préstamos normales
  static async _getNormalLoans() {
    try {
      console.log('🔎 Buscando préstamos normales pendientes...');
      const loans = await Prestamo.findAllWithClientes('pendiente');
      console.log(`✅ Encontrados ${loans.length} préstamos normales`);
      return loans;
    } catch (error) {
      console.error('Error al obtener préstamos normales:', error);
      return [];
    }
  }

  // Obtener préstamos especiales
  static async _getSpecialLoans() {
    try {
      console.log('🔎 Buscando préstamos especiales pendientes...');
      const loans = await PrestamoEspecial.findAllWithClienteYRuta('pendiente');
      console.log(`✅ Encontrados ${loans.length} préstamos especiales`);
      return loans;
    } catch (error) {
      console.error('Error al obtener préstamos especiales:', error);
      return [];
    }
  }
  // Helpers para la vista
  static _getTemplateHelpers() {
    return {
      formatCurrency: (amount) => new Intl.NumberFormat('es-DO', {
        style: 'currency',
        currency: 'DOP'
      }).format(amount || 0),

      formatDate: (dateString) => 
        dateString ? moment(dateString).format('DD/MM/YYYY HH:mm') : 'Sin fecha',

      getLoanIcon: (loanType) => 
        loanType === 'normal' ? 'fa-file-invoice-dollar' : 'fa-star',

      getLoanType: (loanType) =>
        loanType === 'normal' ? 'Préstamo Normal' : 'Préstamo Especial'
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
