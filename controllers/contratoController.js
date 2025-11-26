const Contrato = require('../models/Contrato');
const Cliente = require('../models/Cliente');
const Prestamo = require('../models/Prestamo');
const moment = require('moment');

// Template completo del contrato (versión simplificada para prueba)
const CONTRATO_TEMPLATE = `CONTRATO DE FINANCIAMIENTO DE VEHÍCULO DE MOTOR

Entre las partes:

CLIENTE:
Nombre: {{nombre_cliente}}
Cédula: {{numero_documento}}
Nacionalidad: {{nacionalidad}}
Ocupación: {{ocupacion}}
Dirección: {{direccion}}
Teléfono: {{telefono}}
Email: {{email}}

DATOS DEL VEHÍCULO:
Tipo: {{tipo_vehiculo}}
Marca: {{marca}}
Modelo: {{modelo}}
Año: {{anio}}
Placa: {{placa}}
Chasis: {{chasis}}
Color: {{color}}
Precio Total: {{precio_total}}

DATOS DEL FINANCIAMIENTO:
Monto Financiado: {{monto_financiado}}
Cantidad de Cuotas: {{cantidad_cuotas}}
Monto por Cuota: {{monto_cuota}}
Primera Cuota: {{fecha_primera_cuota}}
Última Cuota: {{fecha_ultima_cuota}}

DATOS DEL SEGURO:
Tipo de Seguro: {{tipo_seguro}}
Monto del Seguro: {{monto_seguro}}

CONDICIONES GENERALES:
1. El cliente se compromete a pagar las cuotas en las fechas establecidas.
2. En caso de mora, se aplicarán los intereses correspondientes.
3. El vehículo permanecerá como garantía hasta la cancelación total del financiamiento.

FECHA DE CONTRATO: ${new Date().toLocaleDateString()}

FIRMAS:
___________________________
{{nombre_cliente}}
Cliente

___________________________
Caribe Azul, S.R.L.
Empresa
`;

// Helper function para formatear fechas
function formatearFecha(fechaStr) {
  if (!fechaStr) return '';
  try {
    const fecha = new Date(fechaStr);
    if (isNaN(fecha.getTime())) return fechaStr;
    
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

/**
 * Página principal de contratos
 */
exports.index = async (req, res) => {
  try {
    console.log('🏠 Cargando página principal de contratos...');
    const contratos = await Contrato.findAll();
    
    res.render('contratos/index', { 
      contratos, 
      moment,
      messages: req.flash(),
      title: 'Gestión de Contratos'
    });
  } catch (error) {
    console.error('❌ Error en index:', error);
    req.flash('error', 'Error al cargar los contratos: ' + error.message);
    res.redirect('/');
  }
};

/**
 * Renderiza el formulario para crear contrato
 */
exports.createForm = async (req, res) => {
  try {
    console.log('📋 Cargando formulario de contrato...');
    
    // Obtener clientes y préstamos aprobados
    const clientes = await Cliente.findAll();
    console.log(`👥 Clientes encontrados: ${clientes.length}`);
    
    let prestamos = [];
    try {
      prestamos = await Prestamo.findAllWithClientes('aprobado');
      console.log(`💰 Préstamos aprobados encontrados: ${prestamos ? prestamos.length : 0}`);
    } catch (prestamoError) {
      console.warn('⚠️ No se pudieron cargar los préstamos:', prestamoError.message);
      prestamos = [];
    }
    
    console.log('🎯 Renderizando vista: contratos/financiamiento');
    
    res.render('contratos/financiamiento', { 
      clientes, 
      prestamos,
      moment,
      messages: req.flash(),
      title: 'Crear Nuevo Contrato'
    });
    
  } catch (error) {
    console.error('❌ Error en createForm:', error);
    req.flash('error', 'Error al cargar formulario: ' + error.message);
    res.redirect('/contratos');
  }
};

/**
 * Procesa la creación del contrato
 */
exports.create = async (req, res) => {
  try {
    console.log('🚀 Iniciando creación de contrato...');
    console.log('📦 Datos recibidos:', req.body);

    const {
      cliente_id, prestamo_id, nombre_cliente, nacionalidad, ocupacion,
      tipo_documento, numero_documento, direccion, telefono, email,
      tipo_vehiculo, marca, modelo, anio, placa, chasis, color,
      precio_total, monto_financiado, cantidad_cuotas, monto_cuota,
      fecha_primera_cuota, fecha_ultima_cuota, tipo_seguro, monto_seguro
    } = req.body;

    if (!nombre_cliente || !numero_documento) {
      return res.status(400).json({
        success: false,
        error: 'Nombre del cliente y número de documento son obligatorios'
      });
    }

    const datosCliente = { 
      nombre_cliente, nacionalidad, ocupacion, tipo_documento, 
      numero_documento, direccion, telefono, email 
    };
    
    const datosVehiculo = { 
      tipo_vehiculo, marca, modelo, anio, placa, chasis, color 
    };
    
    const datosFinanciamiento = { 
      precio_total: parseFloat(precio_total) || 0,
      monto_financiado: parseFloat(monto_financiado) || 0,
      cantidad_cuotas: parseInt(cantidad_cuotas) || 0,
      monto_cuota: parseFloat(monto_cuota) || 0,
      fecha_primera_cuota,
      fecha_ultima_cuota
    };
    
    const datosSeguro = { 
      tipo_seguro, 
      monto_seguro: parseFloat(monto_seguro) || 0 
    };

    const allData = { 
      ...datosCliente, 
      ...datosVehiculo, 
      ...datosFinanciamiento, 
      ...datosSeguro 
    };

    allData.fecha_primera_cuota = formatearFecha(fecha_primera_cuota);
    allData.fecha_ultima_cuota = formatearFecha(fecha_ultima_cuota);

    let contratoTexto = CONTRATO_TEMPLATE;
    for (const key in allData) {
      const placeholder = new RegExp(`{{${key}}}`, 'g');
      contratoTexto = contratoTexto.replace(placeholder, allData[key] || 'N/A');
    }

    const contratoId = await Contrato.create({
      cliente_id: cliente_id || null,
      prestamo_id: prestamo_id || null,
      datos_cliente: datosCliente,
      datos_vehiculo: datosVehiculo,
      datos_financiamiento: datosFinanciamiento,
      datos_seguro: datosSeguro,
      contrato_texto: contratoTexto
    });

    console.log('✅ Contrato creado exitosamente ID:', contratoId);

    return res.json({
      success: true,
      id: contratoId,
      message: `Contrato #${contratoId} generado exitosamente`
    });

  } catch (error) {
    console.error('❌ Error en create:', error);

    return res.status(500).json({
      success: false,
      error: 'Error al generar contrato: ' + error.message
    });
  }
};

/**
 * Muestra un contrato específico
 */
exports.show = async (req, res) => {
  try {
    const contratoId = req.params.id;
    console.log('👀 Mostrando contrato ID:', contratoId);
    
    const contrato = await Contrato.findById(contratoId);
    
    if (!contrato) {
      console.log('⚠️ Contrato no encontrado ID:', contratoId);
      req.flash('error', 'Contrato no encontrado');
      return res.redirect('/contratos');
    }

    console.log('✅ Contrato cargado exitosamente');
    
    res.render('contratos/show', {
      contrato,
      moment,
      messages: req.flash(),
      title: `Contrato #${contrato.id}`
    });
  } catch (error) {
    console.error('❌ Error en show:', error);
    req.flash('error', 'Error al cargar contrato: ' + error.message);
    res.redirect('/contratos');
  }
};

/**
 * Descarga el contrato como archivo de texto
 */
exports.download = async (req, res) => {
  try {
    const contratoId = req.params.id;
    console.log('📥 Descargando contrato ID:', contratoId);
    
    const contrato = await Contrato.findById(contratoId);
    
    if (!contrato) {
      return res.status(404).send('Contrato no encontrado');
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="contrato-${contratoId}.txt"`);
    res.send(contrato.contrato_texto);
    
    console.log('✅ Contrato descargado exitosamente');
  } catch (error) {
    console.error('❌ Error en download:', error);
    res.status(500).send('Error al descargar contrato: ' + error.message);
  }
};

/**
 * Vista para imprimir contrato
 */
exports.print = async (req, res) => {
  try {
    const contratoId = req.params.id;
    console.log('🖨️ Preparando vista de impresión para contrato ID:', contratoId);
    
    const contrato = await Contrato.findById(contratoId);
    
    if (!contrato) {
      req.flash('error', 'Contrato no encontrado');
      return res.redirect('/contratos');
    }

    res.render('contratos/print', {
      contrato,
      moment,
      layout: false,
      title: `Contrato #${contrato.id}`
    });
    
    console.log('✅ Vista de impresión generada');
  } catch (error) {
    console.error('❌ Error en print:', error);
    req.flash('error', 'Error al generar vista de impresión: ' + error.message);
    res.redirect('/contratos');
  }
};

/**
 * Elimina un contrato (soft delete)
 */
exports.delete = async (req, res) => {
  try {
    const contratoId = req.params.id;
    console.log('🗑️ Eliminando contrato ID:', contratoId);
    
    await Contrato.delete(contratoId);
    
    console.log('✅ Contrato eliminado exitosamente');
    
    req.flash('success', 'Contrato eliminado exitosamente');
    res.json({ success: true, message: 'Contrato eliminado exitosamente' });
    
  } catch (error) {
    console.error('❌ Error en delete:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al eliminar contrato: ' + error.message 
    });
  }
};