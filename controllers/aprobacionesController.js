const Prestamo = require('../models/Prestamo');
const PrestamoEspecial = require('../models/PrestamoEspecial');
const moment = require('moment');

class ApprovalController {
  // Método unificado para listar pendientes
  static async listPending(req, res) {
    try {
      const [normalLoans, specialLoans] = await Promise.all([
        this._getNormalLoans(),
        this._getSpecialLoans()
      ]);

      const allLoans = [...normalLoans, ...specialLoans]
        .sort((a, b) => new Date(b.fecha_creacion) - new Date(a.fecha_creacion));

      res.render('approval/pending', {
        loans: allLoans,
        helpers: this._getTemplateHelpers(),
        messages: req.flash()
      });
    } catch (error) {
      this._handleError(req, res, error);
    }
  }

  // Métodos privados
  static async _getNormalLoans() {
    const loans = await Prestamo.findAllWithClientes('pendiente');
    return loans.map(loan => ({
      ...loan,
      loanType: 'normal',
      displayType: 'Préstamo Normal',
      icon: 'fa-file-invoice-dollar'
    }));
  }

  static async _getSpecialLoans() {
    const loans = await PrestamoEspecial.findAllWithClienteYRuta({ 
      where: { estado: 'pendiente' } 
    });
    return loans.map(loan => ({
      ...loan,
      loanType: 'special',
      displayType: 'Préstamo Especial',
      icon: 'fa-star'
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

  static _handleError(req, res, error) {
    console.error('[ApprovalController] Error:', error);
    req.flash('error', 'Error al procesar solicitud');
    res.redirect('/dashboard');
  }
}

module.exports = ApprovalController;