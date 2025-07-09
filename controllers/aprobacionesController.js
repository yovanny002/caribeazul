const Prestamo = require('../models/Prestamo');
const PrestamoEspecial = require('../models/PrestamoEspecial');

exports.vistaPendientes = async (req, res) => {
  try {
    const prestamosNormales = await Prestamo.findAllWithClientes('pendiente');
    const prestamosEspeciales = await PrestamoEspecial.findAllWithClienteYRuta();

    const filtradosEspeciales = prestamosEspeciales.filter(pe => pe.estado === 'pendiente');

    const prestamos = [
      ...prestamosNormales.map(p => ({ ...p, tipo: 'normal' })),
      ...filtradosEspeciales.map(pe => ({ ...pe, tipo: 'especial' }))
    ];

    res.render('prestamos/pendientes-aprobacion', {
      title: 'Préstamos Pendientes de Aprobación',
      prestamos
    });
  } catch (error) {
    console.error('Error al cargar préstamos pendientes:', error.message);
    res.status(500).send('Error interno del servidor');
  }
};
