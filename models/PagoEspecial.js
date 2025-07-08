const db = require('./db');
const { QueryTypes } = require('sequelize');
const moment = require('moment'); // Para manejo de fechas

// Helper para parsear valores numéricos de forma segura
const safeParseFloat = (value, defaultValue = 0) => {
    const num = parseFloat(value);
    return isNaN(num) ? defaultValue : num;
};

const PagoEspecial = {
    findByPrestamo: async (prestamoId) => {
        try {
            const rows = await db.query(`
                SELECT * FROM pagos_especiales 
                WHERE prestamo_id = :prestamoId
                ORDER BY fecha DESC
            `, {
                replacements: { prestamoId },
                type: QueryTypes.SELECT
            });
            return rows;
        } catch (error) {
            console.error(`Error al buscar pagos por préstamo especial (${prestamoId}):`, error.message);
            throw error;
        }
    },

    findById: async (id) => {
        try {
            const rows = await db.query(`
                SELECT * FROM pagos_especiales 
                WHERE id = :id
            `, {
                replacements: { id },
                type: QueryTypes.SELECT
            });
            return rows[0] || null;
        } catch (error) {
            console.error(`Error al buscar pago especial por ID (${id}):`, error.message);
            throw error;
        }
    },

    create: async (data) => {
        const {
            prestamo_especial_id,
            monto,
            capital_pagado,
            interes_pagado,
            metodo,
            registrado_por = 'Sistema',
            fecha = moment().format('YYYY-MM-DD HH:mm:ss') // Usar fecha actual si no se provee
        } = data;

        try {
            const result = await db.query(`
                INSERT INTO pagos_especiales
                (prestamo_id, monto, capital_pagado, interes_pagado, metodo, registrado_por, fecha)
                VALUES (:prestamo_id, :monto, :capital_pagado, :interes_pagado, :metodo, :registrado_por, :fecha)
                RETURNING id
            `, {
                replacements: {
                    prestamo_especial_id,
                    monto: safeParseFloat(monto),
                    capital_pagado: safeParseFloat(capital_pagado),
                    interes_pagado: safeParseFloat(interes_pagado),
                    metodo,
                    registrado_por,
                    fecha
                },
                type: QueryTypes.INSERT
            });
            return result[0].id;
        } catch (error) {
            console.error('Error al crear pago especial:', error.message);
            throw error;
        }
    },

    update: async (id, data) => {
        const {
            monto,
            capital_pagado,
            interes_pagado,
            metodo,
            registrado_por,
            fecha
        } = data;

        try {
            await db.query(`
                UPDATE pagos_especiales SET
                monto = :monto,
                capital_pagado = :capital_pagado,
                interes_pagado = :interes_pagado,
                metodo = :metodo,
                registrado_por = :registrado_por,
                fecha = :fecha
                WHERE id = :id
            `, {
                replacements: {
                    id,
                    monto: safeParseFloat(monto),
                    capital_pagado: safeParseFloat(capital_pagado),
                    interes_pagado: safeParseFloat(interes_pagado),
                    metodo,
                    registrado_por,
                    fecha
                },
                type: QueryTypes.UPDATE
            });
        } catch (error) {
            console.error(`Error al actualizar pago especial (${id}):`, error.message);
            throw error;
        }
    },

    delete: async (id) => {
        try {
            await db.query('DELETE FROM pagos_especiales WHERE id = :id', {
                replacements: { id },
                type: QueryTypes.DELETE
            });
        } catch (error) {
            console.error(`Error al eliminar pago especial (${id}):`, error.message);
            throw error;
        }
    }
};

module.exports = PagoEspecial;