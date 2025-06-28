const { DataTypes } = require('sequelize');
const sequelize = require('./db');

const CobradorRuta = sequelize.define('cobrador_rutas', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  cobrador_id: { type: DataTypes.INTEGER, allowNull: false },
  ruta_id: { type: DataTypes.INTEGER, allowNull: false },
  asignado_por: { type: DataTypes.INTEGER },
  fecha_asignacion: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
  timestamps: false,
  tableName: 'cobrador_rutas'
});

module.exports = CobradorRuta;
