require('dotenv').config();
const { Sequelize } = require('sequelize');

let sequelize;

if (process.env.DATABASE_URL) {
  // 🔁 Producción (Render u otro host que usa URL completa)
  sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    protocol: 'postgres',
    logging: false,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false // necesario para Render y otras nubes
      }
    }
  });
} else {
  // 🖥️ Desarrollo local
  sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASS,
    {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 5432,
      dialect: 'postgres',
      logging: false
    }
  );
}

sequelize.authenticate()
  .then(() => console.log('✅ Conexión con PostgreSQL exitosa'))
  .catch(err => console.error('❌ Error al conectar con PostgreSQL:', err));

module.exports = sequelize;
