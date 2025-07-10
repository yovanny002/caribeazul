const { DataTypes } = require('sequelize');
const sequelize = require('./db');
const Ruta = require('./Ruta'); // Asegúrate de que este modelo exista

const Cobrador = sequelize.define('Cobrador', {
  nombre: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  cedula: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  telefono: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  direccion: {
    type: DataTypes.STRING(150),
    allowNull: true
  },
  email: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  foto: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  zona: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  tipo_contrato: {
    type: DataTypes.ENUM('fijo', 'comision', 'mixto'),
    allowNull: true
  },
  fecha_inicio: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  fecha_retiro: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  notas: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  usuario_creacion: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  activo: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  ruta_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'rutas',
      key: 'id'
    }
  },
  fecha_creacion: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'cobradores',
  timestamps: false
});

// Relación con Ruta
Cobrador.belongsTo(Ruta, { foreignKey: 'ruta_id', as: 'ruta' });

module.exports = Cobrador;
