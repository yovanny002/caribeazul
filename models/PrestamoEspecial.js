const db = require('./db');
const { QueryTypes } = require('sequelize');
const moment = require('moment');

const safeParseFloat = (value, defaultValue = 0) => {
    const num = parseFloat(value);
    return isNaN(num) ? defaultValue : num;
};

const PrestamoEspecial = {
    findAll: async () => {
        try {
            const rows = await db.query(`
                SELECT pe.*, c.nombre AS cliente_nombre, c.apellidos AS cliente_apellidos, c.cedula AS cliente_cedula,
                FROM prestamos_especiales pe
                JOIN clientes c ON pe.cliente_id = c.id
                ORDER BY pe.fecha_creacion DESC
            `, { type: QueryTypes.SELECT });
            return rows;
        } catch (error) {
            console.error('Error al buscar todos los préstamos especiales:', error.message);
            throw error;
        }
    },

    findById: async (id) => {
        try {
            const rows = await db.query(`
                SELECT pe.*, 
                       c.nombre AS cliente_nombre, 
                       c.apellidos AS cliente_apellidos,
                       c.cedula AS cliente_cedula,
                       c.telefono1 AS cliente_telefono1,
                       c.telefono2 AS cliente_telefono2,
                       c.direccion AS cliente_direccion
                FROM prestamos_especiales pe
                JOIN clientes c ON pe.cliente_id = c.id
                WHERE pe.id = :id
            `, {
                replacements: { id },
                type: QueryTypes.SELECT
            });
            return rows[0] || null;
        } catch (error) {
            console.error(`Error al buscar préstamo especial por ID (${id}):`, error.message);
            throw error;
        }
    },

    create: async (data) => {
        const {
            cliente_id,
            monto_solicitado,
            monto_aprobado = 0,
            interes_porcentaje,
            forma_pago,
            estado = 'pendiente',
            observaciones = null
        } = data;

        try {
            const result = await db.query(`
                INSERT INTO prestamos_especiales
                (cliente_id, monto_solicitado, monto_aprobado, interes_porcentaje, forma_pago, estado, observaciones, fecha_creacion, capital_restante)
                VALUES (:cliente_id, :monto_solicitado, :monto_aprobado, :interes_porcentaje, :forma_pago, :estado, :observaciones, NOW(), :capital_restante)
                RETURNING id
            `, {
                replacements: {
                    cliente_id,
                    monto_solicitado: safeParseFloat(monto_solicitado),
                    monto_aprobado: safeParseFloat(monto_aprobado),
                    interes_porcentaje: safeParseFloat(interes_porcentaje),
                    forma_pago,
                    estado,
                    observaciones,
                    capital_restante: safeParseFloat(monto_aprobado)
                },
                type: QueryTypes.INSERT
            });

            return result[0]?.id || null;
        } catch (error) {
            console.error('Error al crear préstamo especial:', error.message);
            throw error;
        }
    },

    update: async (id, data) => {
        const {
            monto_solicitado,
            monto_aprobado,
            interes_porcentaje,
            forma_pago,
            estado,
            fecha_aprobacion,
            observaciones,
            capital_restante
        } = data;

        try {
            await db.query(`
                UPDATE prestamos_especiales SET
                monto_solicitado = :monto_solicitado,
                monto_aprobado = :monto_aprobado,
                interes_porcentaje = :interes_porcentaje,
                forma_pago = :forma_pago,
                estado = :estado,
                fecha_aprobacion = :fecha_aprobacion,
                observaciones = :observaciones,
                capital_restante = :capital_restante
                WHERE id = :id
            `, {
                replacements: {
                    id,
                    monto_solicitado: safeParseFloat(monto_solicitado),
                    monto_aprobado: safeParseFloat(monto_aprobado),
                    interes_porcentaje: safeParseFloat(interes_porcentaje),
                    forma_pago,
                    estado,
                    fecha_aprobacion: fecha_aprobacion || null,
                    observaciones,
                    capital_restante: safeParseFloat(capital_restante)
                },
                type: QueryTypes.UPDATE
            });
        } catch (error) {
            console.error(`Error al actualizar préstamo especial (${id}):`, error.message);
            throw error;
        }
    },

    delete: async (id) => {
        try {
            await db.query('DELETE FROM prestamos_especiales WHERE id = :id', {
                replacements: { id },
                type: QueryTypes.DELETE
            });
        } catch (error) {
            console.error(`Error al eliminar préstamo especial (${id}):`, error.message);
            throw error;
        }
    }
};

module.exports = PrestamoEspecial;
