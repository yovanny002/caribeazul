// models/PagoEspecial.js
const { DataTypes } = require('sequelize');
const sequelize = require('./db'); // ajusta según tu configuración

const PagoEspecial = sequelize.define('pago_especial', {
  prestamo_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  monto: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  interes_pagado: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  capital_pagado: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  metodo: {
    type: DataTypes.STRING,
    defaultValue: 'efectivo'
  },
  referencia: {
    type: DataTypes.STRING,
    allowNull: true
  },
  fecha: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  registrado_por: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  tableName: 'pagos_especiales',
  timestamps: false
});

module.exports = PagoEspecial;
