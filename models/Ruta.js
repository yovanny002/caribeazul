  const { DataTypes } = require('sequelize');
  const sequelize = require('./db');

  const Ruta = sequelize.define('Ruta', {
    nombre: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    codigo: {
      type: DataTypes.STRING(20),
      unique: true
    },
    descripcion: {
      type: DataTypes.STRING(255)
    },
    zona: {
      type: DataTypes.STRING(100)
    },
    tipo_ruta: {
      type: DataTypes.ENUM('urbana', 'rural', 'mixta')
    },
    color_mapa: {
      type: DataTypes.STRING(7),
      defaultValue: '#007bff'
    },
    coordenadas: {
      type: DataTypes.TEXT
    },
    usuario_creacion: {
      type: DataTypes.STRING(50)
    },
    activo: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    fecha_creacion: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'rutas',
    timestamps: false
  });

  module.exports = Ruta;
