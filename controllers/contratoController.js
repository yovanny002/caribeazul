const Contrato = require('../models/Contrato');
const Cliente = require('../models/Cliente');
const Prestamo = require('../models/Prestamo');
const db = require('../models/db');
const { QueryTypes } = require('sequelize');
const moment = require('moment');

// Template del contrato (versión resumida para ejemplo)
const CONTRATO_TEMPLATE = `CONTRATO DE FINANCIAMIENTO DE VEHÍCULO DE MOTOR AL AMPARO DE LA Ley No. 483 SOBRE VENTA CONDICIONAL DE MUEBLES
De una parte, CARIBE AZUL, S.R.L, entidad bancaria organizada y existente conforme a las leyes de la República Dominicana, r.n.c. num. 133-37493-5...
De otra parte: (1) {{nombre_cliente}}, de nacionalidad {{nacionalidad}}, de profesión u ocupación {{ocupacion}}, portador del {{tipo_documento}} Num. {{numero_documento}}, domiciliado (a) y residente en {{direccion}}...
VEHICULO TIPO {{tipo_vehiculo}}, MARCA {{marca}}, MODELO {{modelo}}, AÑO: {{anio}}, PLACA: {{placa}}, CHASIS: {{chasis}} COLOR: {{color}}.
PRECIO DE VENTA: RD$ {{precio_total}}
MONTO FINANCIADO: RD$ {{monto_financiado}}
CUOTAS: {{cantidad_cuotas}} meses de RD$ {{monto_cuota}}
FECHAS: {{fecha_primera_cuota}} a {{fecha_ultima_cuota}}
SEGURO: {{tipo_seguro}} - RD$ {{monto_seguro}}`;

exports.index = async (req, res) => {
  try {
    console.log('=== CARGANDO INDEX DE CONTRATOS ===');
    
    // Asegurar que la tabla existe
    await Contrato.createTable();
    
    const contratos = await Contrato.findAll();
    console.log(`Contratos encontrados: ${contratos.length}`);
    
    if (contratos.length > 0) {
      console.log('Primer contrato sample:', {
        id: contratos[0].id,
        cliente: contratos[0].datos_cliente?.nombre_cliente,
        vehiculo: contratos[0].datos_vehiculo?.marca
      });
    }
    
    res.render('contratos/index', { 
      contratos, 
      moment,
      messages: req.flash() 
    });
  } catch (error) {
    console.error('Error al obtener contratos:', error);
    req.flash('error', 'Error al cargar los contratos: ' + error.message);
    res.redirect('/');
  }
};

exports.createForm = async (req, res) => {
  try {
    const clientes = await Cliente.findAll();
    const prestamos = await Prestamo.findAllWithClientes('aprobado');
    
    console.log(`Formulario - Clientes: ${clientes.length}, Préstamos: ${prestamos.length}`);
    
    res.render('contratos/create', { 
      clientes, 
      prestamos,
      messages: req.flash() 
    });
  } catch (error) {
    console.error('Error cargando formulario de contrato:', error);
    req.flash('error', 'Error al cargar formulario: ' + error.message);
    res.redirect('/contratos');
  }
};

exports.create = async (req, res) => {
  let transaction;
  
  try {
    console.log('=== INICIANDO CREACIÓN DE CONTRATO ===');
    console.log('Datos recibidos:', req.body);
    
    const {
      cliente_id,
      prestamo_id,
      nombre_cliente,
      nacionalidad,
      ocupacion,
      tipo_documento,
      numero_documento,
      direccion,
      telefono,
      email,
      tipo_vehiculo,
      marca,
      modelo,
      anio,
      placa,
      chasis,
      color,
      precio_total,
      monto_financiado,
      cantidad_cuotas,
      monto_cuota,
      fecha_primera_cuota,
      fecha_ultima_cuota,
      tipo_seguro,
      monto_seguro
    } = req.body;

    // Validar datos requeridos
    const requiredFields = [
      'nombre_cliente', 'ocupacion', 'tipo_documento', 'numero_documento', 
      'direccion', 'telefono', 'tipo_vehiculo', 'marca', 'modelo', 'anio',
      'placa', 'color', 'chasis', 'precio_total', 'monto_financiado',
      'cantidad_cuotas', 'monto_cuota', 'fecha_primera_cuota', 'fecha_ultima_cuota',
      'tipo_seguro', 'monto_seguro'
    ];

    const missingFields = requiredFields.filter(field => !req.body[field]);
    if (missingFields.length > 0) {
      throw new Error(`Campos requeridos faltantes: ${missingFields.join(', ')}`);
    }

    // Organizar datos en JSON
    const datosCliente = {
      nombre_cliente: nombre_cliente?.trim(),
      nacionalidad: nacionalidad?.trim() || 'Dominicana',
      ocupacion: ocupacion?.trim(),
      tipo_documento: tipo_documento?.trim(),
      numero_documento: numero_documento?.trim(),
      direccion: direccion?.trim(),
      telefono: telefono?.trim(),
      email: email?.trim() || ''
    };

    const datosVehiculo = {
      tipo_vehiculo: tipo_vehiculo?.trim(),
      marca: marca?.trim(),
      modelo: modelo?.trim(),
      anio: anio?.trim(),
      placa: placa?.trim(),
      chasis: chasis?.trim(),
      color: color?.trim()
    };

    const datosFinanciamiento = {
      precio_total: parseFloat(precio_total) || 0,
      monto_financiado: parseFloat(monto_financiado) || 0,
      cantidad_cuotas: parseInt(cantidad_cuotas) || 0,
      monto_cuota: parseFloat(monto_cuota) || 0,
      fecha_primera_cuota: fecha_primera_cuota,
      fecha_ultima_cuota: fecha_ultima_cuota
    };

    const datosSeguro = {
      tipo_seguro: tipo_seguro?.trim(),
      monto_seguro: parseFloat(monto_seguro) || 0
    };

    console.log('Datos organizados:', {
      datosCliente,
      datosVehiculo,
      datosFinanciamiento,
      datosSeguro
    });

    // Generar texto del contrato
    let contratoTexto = CONTRATO_TEMPLATE;
    const allData = { 
      ...datosCliente, 
      ...datosVehiculo, 
      ...datosFinanciamiento, 
      ...datosSeguro 
    };

    // Formatear montos como strings para el contrato
    allData.precio_total = Number(allData.precio_total).toLocaleString();
    allData.monto_financiado = Number(allData.monto_financiado).toLocaleString();
    allData.monto_cuota = Number(allData.monto_cuota).toLocaleString();
    allData.monto_seguro = Number(allData.monto_seguro).toLocaleString();
    
    // Formatear fechas para el contrato
    allData.fecha_primera_cuota = formatearFecha(allData.fecha_primera_cuota);
    allData.fecha_ultima_cuota = formatearFecha(allData.fecha_ultima_cuota);

    // Reemplazar placeholders
    for (const key in allData) {
      if (allData.hasOwnProperty(key)) {
        const value = allData[key] || 'N/A';
        const placeholder = new RegExp(`{{${key}}}`, 'g');
        contratoTexto = contratoTexto.replace(placeholder, value);
      }
    }

    console.log('Contrato texto generado (primeros 500 chars):', contratoTexto.substring(0, 500));

    // Guardar en base de datos
    console.log('Guardando en BD...');
    const contratoId = await Contrato.create({
      cliente_id: cliente_id || null,
      prestamo_id: prestamo_id || null,
      datos_cliente: datosCliente,
      datos_vehiculo: datosVehiculo,
      datos_financiamiento: datosFinanciamiento,
      datos_seguro: datosSeguro,
      contrato_texto: contratoTexto
    });

    console.log('✅ Contrato guardado con ID:', contratoId);

    req.flash('success', `Contrato #${contratoId} generado exitosamente`);
    res.redirect(`/contratos/${contratoId}`);

  } catch (error) {
    console.error('❌ Error al crear contrato:', error);
    
    if (transaction) {
      await transaction.rollback();
    }
    
    req.flash('error', `Error al generar contrato: ${error.message}`);
    
    // Recargar datos para el formulario
    try {
      const clientes = await Cliente.findAll();
      const prestamos = await Prestamo.findAllWithClientes('aprobado');
      
      res.render('contratos/create', {
        clientes,
        prestamos,
        messages: req.flash(),
        formData: req.body // Mantener datos del formulario
      });
    } catch (renderError) {
      console.error('Error al renderizar formulario:', renderError);
      res.redirect('/contratos/create');
    }
  }
};

exports.show = async (req, res) => {
  try {
    const contrato = await Contrato.findById(req.params.id);
    if (!contrato) {
      req.flash('error', 'Contrato no encontrado');
      return res.redirect('/contratos');
    }

    console.log('Mostrando contrato ID:', contrato.id);
    
    res.render('contratos/show', {
      contrato,
      moment
    });
  } catch (error) {
    console.error('Error al mostrar contrato:', error);
    req.flash('error', 'Error al cargar contrato: ' + error.message);
    res.redirect('/contratos');
  }
};

exports.download = async (req, res) => {
  try {
    const contrato = await Contrato.findById(req.params.id);
    if (!contrato) {
      return res.status(404).send('Contrato no encontrado');
    }

    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="contrato-${contrato.id}.txt"`);
    res.send(contrato.contrato_texto);
  } catch (error) {
    console.error('Error al descargar contrato:', error);
    res.status(500).send('Error al descargar contrato: ' + error.message);
  }
};

exports.print = async (req, res) => {
  try {
    const contrato = await Contrato.findById(req.params.id);
    if (!contrato) {
      req.flash('error', 'Contrato no encontrado');
      return res.redirect('/contratos');
    }

    res.render('contratos/print', {
      contrato,
      layout: false
    });
  } catch (error) {
    console.error('Error al imprimir contrato:', error);
    req.flash('error', 'Error al generar vista de impresión: ' + error.message);
    res.redirect('/contratos');
  }
};

exports.delete = async (req, res) => {
  try {
    console.log('Eliminando contrato ID:', req.params.id);
    
    await Contrato.delete(req.params.id);
    
    req.flash('success', 'Contrato eliminado exitosamente');
    res.json({ success: true });
  } catch (error) {
    console.error('Error al eliminar contrato:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al eliminar contrato: ' + error.message 
    });
  }
};

// Helper function para formatear fechas
function formatearFecha(fechaStr) {
  if (!fechaStr) return '';
  
  try {
    const fecha = new Date(fechaStr);
    if (isNaN(fecha.getTime())) {
      return fechaStr; // Retornar original si no es fecha válida
    }
    
    const dia = fecha.getDate();
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const mes = meses[fecha.getMonth()];
    const anio = fecha.getFullYear();
    
    return `${dia} de ${mes} del año ${anio}`;
  } catch (error) {
    console.error('Error formateando fecha:', error);
    return fechaStr;
  }
}

// Endpoint de diagnóstico
exports.diagnostic = async (req, res) => {
  try {
    console.log('=== DIAGNÓSTICO CONTRATOS ===');
    
    // Verificar si la tabla existe
    const tableExists = await Contrato.checkTable();
    console.log('Tabla existe:', tableExists);
    
    // Contar contratos existentes
    const count = await Contrato.count();
    console.log('Contratos en BD:', count);
    
    // Ver estructura de la tabla
    const structure = await db.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'contratos_financiamiento'
      ORDER BY ordinal_position
    `, { type: QueryTypes.SELECT });
    
    console.log('Estructura tabla:', structure);
    
    // Ver últimos 5 contratos
    const recentContracts = await db.query(`
      SELECT id, cliente_id, prestamo_id, estado, created_at 
      FROM contratos_financiamiento 
      ORDER BY created_at DESC 
      LIMIT 5
    `, { type: QueryTypes.SELECT });
    
    res.json({
      tableExists,
      contractCount: count,
      tableStructure: structure,
      recentContracts
    });
    
  } catch (error) {
    console.error('Error en diagnóstico:', error);
    res.status(500).json({ error: error.message });
  }
};