// models/PrestamoEspecial.js
const { DataTypes } = require('sequelize');
const sequelize = require('./db');

const PrestamoEspecial = sequelize.define('PrestamoEspecial', {
  cliente_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  ruta_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  monto_solicitado: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  monto_aprobado: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  interes_porcentaje: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false
  },
  forma_pago: {
    type: DataTypes.ENUM('diario', 'semanal', 'quincenal', 'mensual'),
    allowNull: false
  },
  estado: {
    type: DataTypes.ENUM('pendiente', 'activo', 'pagado'),
    defaultValue: 'pendiente'
  }
}, {
  tableName: 'prestamos_especiales',
  timestamps: true
});

module.exports = PrestamoEspecial;
