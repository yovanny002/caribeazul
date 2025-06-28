const Cuota = require('./Cuota');
const Prestamo = require('./Prestamo');

// Relación
Cuota.belongsTo(Prestamo, { foreignKey: 'prestamo_id', as: 'prestamo' });
Prestamo.hasMany(Cuota, { foreignKey: 'prestamo_id', as: 'cuotas' });

module.exports = {
  Cuota,
  Prestamo
};
