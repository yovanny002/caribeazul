const db = require('./db');
const { QueryTypes } = require('sequelize'); // ✅ CORRECCIÓN

const Contrato = {
  // Crear tabla si no existe
  createTable: async () => {
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS contratos_financiamiento (
          id SERIAL PRIMARY KEY,
          cliente_id INTEGER REFERENCES clientes(id),
          prestamo_id INTEGER REFERENCES solicitudes_prestamos(id),
          datos_cliente JSONB NOT NULL,
          datos_vehiculo JSONB NOT NULL,
          datos_financiamiento JSONB NOT NULL,
          datos_seguro JSONB NOT NULL,
          contrato_texto TEXT NOT NULL,
          estado VARCHAR(50) DEFAULT 'activo',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ Tabla de contratos verificada/creada correctamente');
      return true;
    } catch (error) {
      console.error('❌ Error creando tabla de contratos:', error);
      throw error;
    }
  },

  // Crear nuevo contrato
  create: async (contratoData) => {
    try {
      const {
        cliente_id,
        prestamo_id,
        datos_cliente,
        datos_vehiculo,
        datos_financiamiento,
        datos_seguro,
        contrato_texto
      } = contratoData;

      console.log('📝 Creando contrato con datos:', {
        cliente_id,
        prestamo_id,
        datos_cliente: typeof datos_cliente,
        datos_vehiculo: typeof datos_vehiculo,
        datos_financiamiento: typeof datos_financiamiento,
        datos_seguro: typeof datos_seguro
      });

      const result = await db.query(`
        INSERT INTO contratos_financiamiento 
        (cliente_id, prestamo_id, datos_cliente, datos_vehiculo, datos_financiamiento, datos_seguro, contrato_texto)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `, {
        replacements: [
          cliente_id || null,
          prestamo_id || null,
          JSON.stringify(datos_cliente),
          JSON.stringify(datos_vehiculo),
          JSON.stringify(datos_financiamiento),
          JSON.stringify(datos_seguro),
          contrato_texto
        ],
        type: QueryTypes.INSERT
      });

      console.log('🔍 Resultado de inserción:', result);

      // Manejo robusto del resultado
      let insertedId = null;
      
      if (result && result[0] && result[0].id) {
        insertedId = result[0].id;
      } else if (result && Array.isArray(result) && result[0] && result[0].id) {
        insertedId = result[0].id;
      } else if (result && result[0] && Array.isArray(result[0]) && result[0][0] && result[0][0].id) {
        insertedId = result[0][0].id;
      }

      if (!insertedId) {
        console.error('❌ No se pudo obtener el ID del contrato creado');
        console.error('🔍 Estructura del resultado:', JSON.stringify(result, null, 2));
        throw new Error('No se pudo obtener el ID del contrato creado');
      }

      console.log('✅ Contrato creado con ID:', insertedId);
      return insertedId;
      
    } catch (error) {
      console.error('❌ Error creando contrato:', error);
      throw error;
    }
  },

  // Buscar por ID
  findById: async (id) => {
    try {
      const rows = await db.query(`
        SELECT 
          c.*, 
          cli.nombre as cliente_nombre,
          cli.apellidos as cliente_apellidos,
          cli.cedula as cliente_cedula,
          sp.monto_aprobado,
          sp.estado as prestamo_estado
        FROM contratos_financiamiento c
        LEFT JOIN clientes cli ON c.cliente_id = cli.id
        LEFT JOIN solicitudes_prestamos sp ON c.prestamo_id = sp.id
        WHERE c.id = $1 AND c.estado != 'eliminado'
      `, {
        replacements: [id],
        type: QueryTypes.SELECT
      });

      if (rows.length === 0) {
        console.log('⚠️ Contrato no encontrado ID:', id);
        return null;
      }

      const contrato = rows[0];
      
      // Parsear JSON fields de manera segura
      try {
        contrato.datos_cliente = typeof contrato.datos_cliente === 'string' ? 
          JSON.parse(contrato.datos_cliente) : contrato.datos_cliente;
        contrato.datos_vehiculo = typeof contrato.datos_vehiculo === 'string' ? 
          JSON.parse(contrato.datos_vehiculo) : contrato.datos_vehiculo;
        contrato.datos_financiamiento = typeof contrato.datos_financiamiento === 'string' ? 
          JSON.parse(contrato.datos_financiamiento) : contrato.datos_financiamiento;
        contrato.datos_seguro = typeof contrato.datos_seguro === 'string' ? 
          JSON.parse(contrato.datos_seguro) : contrato.datos_seguro;
      } catch (parseError) {
        console.error('⚠️ Error parseando JSON del contrato ID:', id, parseError);
      }

      console.log('✅ Contrato encontrado ID:', id);
      return contrato;
    } catch (error) {
      console.error('❌ Error buscando contrato por ID:', error);
      throw error;
    }
  },

  // Buscar todos los contratos - CORREGIDO
  findAll: async () => {
    try {
      const rows = await db.query(`
        SELECT 
          c.*, 
          cli.nombre as cliente_nombre,
          cli.apellidos as cliente_apellidos,
          cli.cedula as cliente_cedula,
          sp.monto_aprobado,
          sp.estado as prestamo_estado
        FROM contratos_financiamiento c
        LEFT JOIN clientes cli ON c.cliente_id = cli.id
        LEFT JOIN solicitudes_prestamos sp ON c.prestamo_id = sp.id
        WHERE c.estado != 'eliminado'
        ORDER BY c.created_at DESC
      `, {
        type: QueryTypes.SELECT // ✅ Ahora QueryTypes está definido
      });

      console.log(`📋 Encontrados ${rows.length} contratos`);

      const contratos = rows.map(row => {
        try {
          return {
            ...row,
            datos_cliente: typeof row.datos_cliente === 'string' ? 
              JSON.parse(row.datos_cliente) : row.datos_cliente,
            datos_vehiculo: typeof row.datos_vehiculo === 'string' ? 
              JSON.parse(row.datos_vehiculo) : row.datos_vehiculo,
            datos_financiamiento: typeof row.datos_financiamiento === 'string' ? 
              JSON.parse(row.datos_financiamiento) : row.datos_financiamiento,
            datos_seguro: typeof row.datos_seguro === 'string' ? 
              JSON.parse(row.datos_seguro) : row.datos_seguro
          };
        } catch (parseError) {
          console.error('⚠️ Error parseando JSON del contrato ID:', row.id, parseError);
          return row;
        }
      });

      return contratos;
    } catch (error) {
      console.error('❌ Error buscando todos los contratos:', error);
      throw error;
    }
  },

  // Buscar por cliente
  findByClienteId: async (clienteId) => {
    try {
      const rows = await db.query(`
        SELECT * FROM contratos_financiamiento 
        WHERE cliente_id = $1 AND estado != 'eliminado'
        ORDER BY created_at DESC
      `, {
        replacements: [clienteId],
        type: QueryTypes.SELECT
      });

      console.log(`📋 Encontrados ${rows.length} contratos para cliente ID: ${clienteId}`);

      const contratos = rows.map(row => {
        try {
          return {
            ...row,
            datos_cliente: typeof row.datos_cliente === 'string' ? 
              JSON.parse(row.datos_cliente) : row.datos_cliente,
            datos_vehiculo: typeof row.datos_vehiculo === 'string' ? 
              JSON.parse(row.datos_vehiculo) : row.datos_vehiculo,
            datos_financiamiento: typeof row.datos_financiamiento === 'string' ? 
              JSON.parse(row.datos_financiamiento) : row.datos_financiamiento,
            datos_seguro: typeof row.datos_seguro === 'string' ? 
              JSON.parse(row.datos_seguro) : row.datos_seguro
          };
        } catch (parseError) {
          console.error('⚠️ Error parseando JSON del contrato ID:', row.id, parseError);
          return row;
        }
      });

      return contratos;
    } catch (error) {
      console.error('❌ Error buscando contratos por cliente:', error);
      throw error;
    }
  },

  // Actualizar contrato
  update: async (id, contratoData) => {
    try {
      const {
        datos_cliente,
        datos_vehiculo,
        datos_financiamiento,
        datos_seguro,
        contrato_texto,
        estado
      } = contratoData;

      await db.query(`
        UPDATE contratos_financiamiento 
        SET datos_cliente = $1,
            datos_vehiculo = $2,
            datos_financiamiento = $3,
            datos_seguro = $4,
            contrato_texto = $5,
            estado = $6,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $7
      `, {
        replacements: [
          JSON.stringify(datos_cliente),
          JSON.stringify(datos_vehiculo),
          JSON.stringify(datos_financiamiento),
          JSON.stringify(datos_seguro),
          contrato_texto,
          estado || 'activo',
          id
        ],
        type: QueryTypes.UPDATE
      });

      console.log('✅ Contrato actualizado ID:', id);
      return true;
    } catch (error) {
      console.error('❌ Error actualizando contrato:', error);
      throw error;
    }
  },

  // Eliminar contrato (soft delete)
  delete: async (id) => {
    try {
      await db.query(`
        UPDATE contratos_financiamiento 
        SET estado = 'eliminado',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, {
        replacements: [id],
        type: QueryTypes.UPDATE
      });

      console.log('✅ Contrato marcado como eliminado ID:', id);
      return true;
    } catch (error) {
      console.error('❌ Error eliminando contrato:', error);
      throw error;
    }
  },

  // Verificar si la tabla existe
  checkTable: async () => {
    try {
      const result = await db.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'contratos_financiamiento'
        )
      `, { type: QueryTypes.SELECT });

      const exists = result[0].exists;
      console.log('📊 Tabla contratos_financiamiento existe:', exists);
      return exists;
    } catch (error) {
      console.error('❌ Error verificando tabla:', error);
      return false;
    }
  },

  // Contar contratos activos
  count: async () => {
    try {
      const result = await db.query(`
        SELECT COUNT(*) as total FROM contratos_financiamiento WHERE estado != 'eliminado'
      `, { type: QueryTypes.SELECT });

      const total = parseInt(result[0].total);
      console.log('📊 Total de contratos activos:', total);
      return total;
    } catch (error) {
      console.error('❌ Error contando contratos:', error);
      return 0;
    }
  }
};

module.exports = Contrato;