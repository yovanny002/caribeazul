const db = require('./db');

const Contrato = {
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
        datos_vehiculo: typeof datos_vehiculo
      });

      const [result] = await db.query(
        `INSERT INTO contratos_financiamiento 
        (cliente_id, prestamo_id, datos_cliente, datos_vehiculo, datos_financiamiento, datos_seguro, contrato_texto)
        VALUES (:cliente_id, :prestamo_id, :datos_cliente, :datos_vehiculo, :datos_financiamiento, :datos_seguro, :contrato_texto)`,
        {
          replacements: {
            cliente_id: cliente_id || null,
            prestamo_id: prestamo_id || null,
            datos_cliente: JSON.stringify(datos_cliente),
            datos_vehiculo: JSON.stringify(datos_vehiculo),
            datos_financiamiento: JSON.stringify(datos_financiamiento),
            datos_seguro: JSON.stringify(datos_seguro),
            contrato_texto: contrato_texto
          }
        }
      );

      console.log('✅ Contrato creado con ID:', result.insertId);
      return result.insertId;

    } catch (error) {
      console.error('❌ Error creando contrato:', error);
      throw error;
    }
  },

  // Buscar por ID
  findById: async (id) => {
    try {
      const [rows] = await db.query(
        `SELECT 
          c.*, 
          cli.nombre as cliente_nombre,
          cli.apellidos as cliente_apellidos,
          cli.cedula as cliente_cedula,
          sp.monto_aprobado,
          sp.estado as prestamo_estado
        FROM contratos_financiamiento c
        LEFT JOIN clientes cli ON c.cliente_id = cli.id
        LEFT JOIN solicitudes_prestamos sp ON c.prestamo_id = sp.id
        WHERE c.id = :id AND c.estado != 'eliminado'`,
        {
          replacements: { id }
        }
      );

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

  // Buscar todos los contratos
  findAll: async () => {
    try {
      const [rows] = await db.query(
        `SELECT 
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
        ORDER BY c.created_at DESC`
      );

      console.log(`📋 Encontrados ${rows.length} contratos`);

      // Parsear JSON fields para cada contrato
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
      const [rows] = await db.query(
        `SELECT * FROM contratos_financiamiento 
        WHERE cliente_id = :clienteId AND estado != 'eliminado'
        ORDER BY created_at DESC`,
        {
          replacements: { clienteId }
        }
      );

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

      await db.query(
        `UPDATE contratos_financiamiento 
        SET datos_cliente = :datos_cliente,
            datos_vehiculo = :datos_vehiculo,
            datos_financiamiento = :datos_financiamiento,
            datos_seguro = :datos_seguro,
            contrato_texto = :contrato_texto,
            estado = :estado,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = :id`,
        {
          replacements: {
            datos_cliente: JSON.stringify(datos_cliente),
            datos_vehiculo: JSON.stringify(datos_vehiculo),
            datos_financiamiento: JSON.stringify(datos_financiamiento),
            datos_seguro: JSON.stringify(datos_seguro),
            contrato_texto,
            estado: estado || 'activo',
            id
          }
        }
      );

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
      await db.query(
        `UPDATE contratos_financiamiento 
        SET estado = 'eliminado',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = :id`,
        {
          replacements: { id }
        }
      );

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
      const [rows] = await db.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'contratos_financiamiento'
        ) as table_exists`
      );

      const exists = rows[0].table_exists;
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
      const [rows] = await db.query(
        `SELECT COUNT(*) as total FROM contratos_financiamiento WHERE estado != 'eliminado'`
      );

      const total = parseInt(rows[0].total);
      console.log('📊 Total de contratos activos:', total);
      return total;

    } catch (error) {
      console.error('❌ Error contando contratos:', error);
      return 0;
    }
  }
};

module.exports = Contrato;