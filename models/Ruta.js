// models/Ruta.js
const db = require('./db');
const { QueryTypes } = require('sequelize');

const Ruta = {
    findAll: async () => {
        const rows = await db.query(`
            SELECT id, nombre, zona FROM rutas WHERE activo = true ORDER BY zona, nombre
        `, { type: QueryTypes.SELECT });
        return rows;
    },
    findById: async (id) => {
        const [ruta] = await db.query(`SELECT * FROM rutas WHERE id = :id`, {
            replacements: { id },
            type: QueryTypes.SELECT
        });
        return ruta || null;
    }
};

module.exports = Ruta;
