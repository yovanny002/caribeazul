const ContratoHipotecario = require('../models/ContratoHipotecario');
const moment = require('moment');

// Asume que tienes un template string (templateHipotecario) cargado en el controller o importado.
// Puedes reutilizar el docx que subiste como base y pasarlo a string con placeholders.

function formatearFecha(fechaStr) {
  if (!fechaStr) return '';
  const f = new Date(fechaStr);
  if (isNaN(f.getTime())) return fechaStr;
  const dia = f.getDate();
  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  return `${dia} de ${meses[f.getMonth()]} del año ${f.getFullYear()}`;
}

exports.index = async (req, res) => {
  try {
    const all = await ContratoHipotecario.findAll();
    res.render('contratos_hipotecarios/index', { contratos: all, moment, messages: req.flash(), title: 'Hipotecas' });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Error cargando hipotecas');
    res.redirect('/');
  }
};

exports.createForm = async (req, res) => {
  try {
    res.render('contratos_hipotecarios/create', { moment, messages: req.flash(), title: 'Crear Hipoteca' });
  } catch (err) {
    console.error(err);
    req.flash('error','Error cargando formulario');
    res.redirect('/contratos-hipotecarios');
  }
};

exports.create = async (req, res) => {
  try {
    console.log('Datos recibidos (hipotecario):', req.body);

    // Extract and validate minimal fields
    const {
      nombre_deudor, nacionalidad, ocupacion, tipo_documento, numero_documento,
      telefono, direccion,
      monto_prestamo, plazo_meses, monto_cuota, tasa_interes,
      fecha_primera_cuota, fecha_ultima_cuota, cuota_extraordinaria, fecha_cuota_extraordinaria,
      area_propiedad1, mejora_propiedad1, direccion_propiedad1, parcela_propiedad1, distrito_propiedad1,
      area_propiedad2, mejora_propiedad2, direccion_propiedad2, parcela_propiedad2, distrito_propiedad2,
      certificado_titulo
    } = req.body;

    if (!nombre_deudor || !numero_documento) {
      return res.status(400).json({ success: false, error: 'Nombre y documento son obligatorios' });
    }

    // Build structured objects
    const datos_financiamiento = {
      monto_prestamo: parseFloat(monto_prestamo) || 0,
      plazo_meses: parseInt(plazo_meses) || 0,
      monto_cuota: parseFloat(monto_cuota) || 0,
      tasa_interes: parseFloat(tasa_interes) || 0,
      fecha_primera_cuota,
      fecha_ultima_cuota,
      cuota_extraordinaria: cuota_extraordinaria ? parseFloat(cuota_extraordinaria) : null,
      fecha_cuota_extraordinaria: fecha_cuota_extraordinaria || null
    };

    const propiedades = [
      {
        area: area_propiedad1,
        mejora: mejora_propiedad1,
        direccion: direccion_propiedad1,
        parcela: parcela_propiedad1,
        distrito: distrito_propiedad1
      },
      {
        area: area_propiedad2,
        mejora: mejora_propiedad2,
        direccion: direccion_propiedad2,
        parcela: parcela_propiedad2,
        distrito: distrito_propiedad2
      }
    ];

    // Build contract text (templateHipotecario should be defined or imported)
    const allDataForTemplate = {
      nombre_deudor,
      numero_documento,
      nacionalidad,
      ocupacion,
      telefono,
      direccion,
      monto_prestamo,
      plazo_meses,
      monto_cuota,
      tasa_interes,
      fecha_primera_cuota: formatearFecha(fecha_primera_cuota),
      fecha_ultima_cuota: formatearFecha(fecha_ultima_cuota),
      cuota_extraordinaria,
      fecha_cuota_extraordinaria: formatearFecha(fecha_cuota_extraordinaria),
      area_propiedad1, mejora_propiedad1, direccion_propiedad1, parcela_propiedad1, distrito_propiedad1,
      area_propiedad2, mejora_propiedad2, direccion_propiedad2, parcela_propiedad2, distrito_propiedad2,
      certificado_titulo
    };

    // Si tu frontend ya mandó contrato_texto (lo hace en el código que me pasaste) úsalo,
    // si no, genera con tu template en server:
    const contrato_texto = req.body.contrato_texto || generateServerContractText(allDataForTemplate);

    const id = await ContratoHipotecario.create({
      cliente_nombre: nombre_deudor,
      cliente_nacionalidad: nacionalidad,
      cliente_ocupacion: ocupacion,
      cliente_tipo_documento: tipo_documento,
      cliente_numero_documento: numero_documento,
      cliente_telefono: telefono,
      cliente_direccion: direccion,
      datos_financiamiento,
      propiedades,
      contrato_texto
    });

    return res.json({ success: true, id, message: 'Contrato hipotecario creado' });
  } catch (err) {
    console.error('Error create hipoteca:', err);
    return res.status(500).json({ success: false, error: err.message || 'Error interno' });
  }
};

exports.show = async (req, res) => {
  try {
    const id = req.params.id;
    const contrato = await ContratoHipotecario.findById(id);
    if (!contrato) {
      req.flash('error', 'Contrato no encontrado');
      return res.redirect('/contratos-hipotecarios');
    }
    res.render('contratos_hipotecarios/show', { contrato, moment, messages: req.flash(), title: `Contr. Hipotecario #${id}` });
  } catch (err) {
    console.error(err);
    req.flash('error','Error cargando contrato');
    res.redirect('/contratos-hipotecarios');
  }
};

exports.download = async (req, res) => {
  try {
    const contrato = await ContratoHipotecario.findById(req.params.id);
    if (!contrato) return res.status(404).send('No encontrado');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="contrato-hipotecario-${contrato.id}.txt"`);
    res.send(contrato.contrato_texto);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error');
  }
};

exports.print = async (req, res) => {
  try {
    const contrato = await ContratoHipotecario.findById(req.params.id);
    if (!contrato) {
      req.flash('error','Contrato no encontrado');
      return res.redirect('/contratos-hipotecarios');
    }
    res.render('contratos_hipotecarios/print', { contrato, layout: false, title: `Contrato #${contrato.id}` });
  } catch (err) {
    console.error(err);
    req.flash('error','Error en impresión');
    res.redirect('/contratos-hipotecarios');
  }
};

/* Helper: si quieres generar texto en servidor en caso de que frontend no lo envíe */
function generateServerContractText(data) {
  // Implementa tu plantilla aquí o importa el .docx convertido. 
  // Para now, construimos un texto simple:
  return `CONTRATO HIPOTECARIO - Deudor: ${data.nombre_deudor || 'N/A'} - Monto: RD$ ${data.monto_prestamo || 0}`;
}
