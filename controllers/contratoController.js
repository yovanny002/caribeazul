const Contrato = require('../models/Contrato');
const Cliente = require('../models/Cliente');
const Prestamo = require('../models/Prestamo');
const moment = require('moment');

// Template completo del contrato (coloca aquí el contrato real)
const CONTRATO_TEMPLATE = `CONTRATO DE FINANCIAMIENTO DE VEHÍCULO DE MOTOR AL AMPARO DE LA Ley No. 483 SOBRE VENTA CONDICIONAL DE MUEBLES
De una parte, CARIBE AZUL, S.R.L...
[PEGAR AQUÍ EL TEXTO COMPLETO]`;


// ================================================
// LISTADO
// ================================================
exports.index = async (req, res) => {
  try {
    const contratos = await Contrato.findAll();

    res.render('contratos/index', {
      contratos,
      moment,
      messages: req.flash()
    });

  } catch (error) {
    console.error('Error al obtener contratos:', error);
    req.flash('error', 'Error al cargar los contratos');
    res.redirect('/');
  }
};


// ================================================
// FORMULARIO DE CREACIÓN
// ================================================
exports.createForm = async (req, res) => {
  try {
    const clientes = await Cliente.findAll();
    const prestamos = await Prestamo.findAllWithClientes('aprobado');

    res.render('contratos/financiamiento', {
      clientes,
      prestamos,
      messages: req.flash()
    });

  } catch (error) {
    console.error('Error cargando formulario de contrato:', error);
    req.flash('error', 'Error al cargar formulario');
    res.redirect('/contratos');
  }
};


// ================================================
// CREAR CONTRATO
// ================================================
exports.create = async (req, res) => {
  try {
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


    // ORGANIZAR DATOS
    const datosCliente = {
      nombre_cliente,
      nacionalidad,
      ocupacion,
      tipo_documento,
      numero_documento,
      direccion,
      telefono,
      email
    };

    const datosVehiculo = {
      tipo_vehiculo,
      marca,
      modelo,
      anio,
      placa,
      chasis,
      color
    };

    const datosFinanciamiento = {
      precio_total,
      monto_financiado,
      cantidad_cuotas,
      monto_cuota,
      fecha_primera_cuota,
      fecha_ultima_cuota
    };

    const datosSeguro = {
      tipo_seguro,
      monto_seguro
    };


    // GENERAR CONTRATO
    let contratoTexto = CONTRATO_TEMPLATE;

    const allData = {
      ...datosCliente,
      ...datosVehiculo,
      ...datosFinanciamiento,
      ...datosSeguro
    };

    allData.fecha_primera_cuota = formatearFecha(fecha_primera_cuota);
    allData.fecha_ultima_cuota = formatearFecha(fecha_ultima_cuota);

    for (const key in allData) {
      const value = allData[key] || 'N/A';
      contratoTexto = contratoTexto.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }


    // GUARDAR EN BD
    const contrato = await Contrato.create({
      cliente_id: cliente_id || null,
      prestamo_id: prestamo_id || null,
      datos_cliente: datosCliente,
      datos_vehiculo: datosVehiculo,
      datos_financiamiento: datosFinanciamiento,
      datos_seguro: datosSeguro,
      contrato_texto: contratoTexto
    });


    req.flash('success', 'Contrato generado exitosamente');
    res.redirect(`/contratos/${contrato.id}`);

  } catch (error) {
    console.error('Error al crear contrato:', error);
    req.flash('error', 'Error al generar contrato: ' + error.message);
    res.redirect('/contratos/create');
  }
};


// ================================================
// VER CONTRATO
// ================================================
exports.show = async (req, res) => {
  try {
    const contrato = await Contrato.findById(req.params.id);

    if (!contrato) {
      req.flash('error', 'Contrato no encontrado');
      return res.redirect('/contratos');
    }

    res.render('contratos/show', {
      contrato,
      moment
    });

  } catch (error) {
    console.error('Error al mostrar contrato:', error);
    req.flash('error', 'Error al cargar contrato');
    res.redirect('/contratos');
  }
};


// ================================================
// DESCARGAR
// ================================================
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
    res.status(500).send('Error al descargar contrato');
  }
};


// ================================================
// IMPRIMIR
// ================================================
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
    req.flash('error', 'Error al generar vista de impresión');
    res.redirect('/contratos');
  }
};


// ================================================
// ELIMINAR
// ================================================
exports.delete = async (req, res) => {
  try {
    await Contrato.delete(req.params.id);

    req.flash('success', 'Contrato eliminado exitosamente');
    res.json({ success: true });

  } catch (error) {
    console.error('Error al eliminar contrato:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};


// ================================================
// HELPER: FORMATEAR FECHA
// ================================================
function formatearFecha(fechaStr) {
  if (!fechaStr) return '';
  const fecha = new Date(fechaStr);

  const dia = fecha.getDate();
  const meses = [
    'Enero','Febrero','Marzo','Abril','Mayo','Junio',
    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
  ];

  return `${dia} de ${meses[fecha.getMonth()]} del año ${fecha.getFullYear()}`;
}
