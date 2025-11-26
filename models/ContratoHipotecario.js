const db = require('./db');
const { QueryTypes } = require('sequelize');

const ContratoHipotecario = {

    async findAll() {
        const rows = await db.query(`
            SELECT 
                id,
                datos_deudor->>'nombre_deudor' AS deudor,
                datos_deudor->>'numero_documento' AS documento,
                created_at
            FROM contrato_hipotecario
            ORDER BY id DESC
        `, { type: QueryTypes.SELECT });

        return rows;
    },

    async findById(id) {
        const rows = await db.query(`
            SELECT *
            FROM contrato_hipotecario
            WHERE id = $1
            LIMIT 1
        `, {
            type: QueryTypes.SELECT,
            bind: [id]
        });

        return rows[0];
    },

    async create(data) {
        const {
            datos_deudor,
            datos_prestamo,
            datos_propiedad1,
            datos_propiedad2,
            contrato_texto
        } = data;

        const row = await db.query(`
            INSERT INTO contrato_hipotecario
            (datos_deudor, datos_prestamo, datos_propiedad1, datos_propiedad2, contrato_texto)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id
        `, {
            type: QueryTypes.INSERT,
            bind: [
                datos_deudor,
                datos_prestamo,
                datos_propiedad1,
                datos_propiedad2,
                contrato_texto
            ]
        });

        return row[0].id;
    },

    async delete(id) {
        await db.query(`
            DELETE FROM contrato_hipotecario WHERE id = $1
        `, {
            bind: [id]
        });

        return true;
    }
};

module.exports = ContratoHipotecario;
