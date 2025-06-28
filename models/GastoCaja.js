const { DataTypes } = require('sequelize');
const db = require('./db');

const GastoCaja = db.define('GastoCaja', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  descripcion: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      notEmpty: { msg: 'La descripción es obligatoria' }
    }
  },
  monto: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: {
      isDecimal: true,
      min: 0.01
    }
  },
  categoria: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  registrado_por: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      notEmpty: { msg: 'Debe indicarse quién registró el gasto' }
    }
  },
  sucursal_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: null
  },
  fecha: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  estado: {
    type: DataTypes.ENUM('activo', 'anulado'),
    allowNull: false,
    defaultValue: 'activo'
  }
}, {
  tableName: 'gastos_caja',
  timestamps: true,
  underscored: true
});

module.exports = GastoCaja;
