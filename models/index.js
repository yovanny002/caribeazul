const Sequelize = require('sequelize');
const sequelize = require('./db'); // Asegúrate que este archivo exista y se conecta correctamente

// Importar modelos
const Cuota = require('./Cuota');
const Prestamo = require('./Prestamo');
const Ruta = require('./Ruta');
const Cobrador = require('./Cobrador');

// Relaciones Cuotas <-> Préstamos
Cuota.belongsTo(Prestamo, { foreignKey: 'prestamo_id', as: 'prestamo' });
Prestamo.hasMany(Cuota, { foreignKey: 'prestamo_id', as: 'cuotas' });

// Relaciones Cobrador <-> Ruta
Cobrador.belongsTo(Ruta, { foreignKey: 'ruta_id', as: 'ruta' });
Ruta.hasMany(Cobrador, { foreignKey: 'ruta_id', as: 'cobradores' });

module.exports = {
  sequelize,
  Sequelize,
  Cuota,
  Prestamo,
  Ruta,
  Cobrador
};
