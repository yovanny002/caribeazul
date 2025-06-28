const { Model, DataTypes } = require('sequelize');
const sequelize = require('./db');

class Cuota extends Model {
  static async calcularMora(cuotaId) {
    const cuota = await this.findByPk(cuotaId);
    if (!cuota || cuota.estado === 'pagada') return 0;

    const hoy = new Date();
    const fechaVencimiento = new Date(cuota.fecha_vencimiento);
    
    // Calcular días de atraso (restamos 2 días de gracia)
    const diasAtraso = Math.max(0, Math.floor((hoy - fechaVencimiento) / (1000 * 60 * 60 * 24)) - 2);
    
    if (diasAtraso <= 0) return 0;
    
    // Calcular mora (5% por día)
    const mora = cuota.monto * 0.05 * diasAtraso;
    return parseFloat(mora.toFixed(2));
  }

  static async findCuotasByPrestamo(prestamoId) {
    const cuotas = await this.findAll({
      where: { prestamo_id: prestamoId },
      order: [['numero_cuota', 'ASC']]
    });

    // Calcular mora para cada cuota vencida
    const cuotasConMora = await Promise.all(cuotas.map(async cuota => {
      if (cuota.estado !== 'pagada' && new Date(cuota.fecha_vencimiento) < new Date()) {
        cuota.mora = await this.calcularMora(cuota.id);
      } else {
        cuota.mora = 0;
      }
      return cuota;
    }));

    return cuotasConMora;
  }
}

Cuota.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  prestamo_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  numero_cuota: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  monto: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  fecha_vencimiento: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  estado: {
    type: DataTypes.ENUM('pendiente', 'pagada'),
    allowNull: false,
    defaultValue: 'pendiente',
  },
  fecha_pago: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  pagado: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  }
}, {
  sequelize,
  modelName: 'Cuota',
  tableName: 'cuotas',
  timestamps: false,
});

module.exports = Cuota;