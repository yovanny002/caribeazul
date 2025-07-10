const Cliente = require('../models/Cliente');

const clienteController = {
  // Método para obtener todos los clientes
  getAllClientes: async (req, res) => {
    try {
      const clientes = await Cliente.findAll();
      res.render('clientes/index', {
        title: 'Clientes',
        currentPage: 'clientes',
        user: res.locals.user,
        clientes: clientes
      });
    } catch (error) {
      console.error(error);
      res.status(500).send('Error al obtener los clientes');
    }
  },

  // Método para obtener un cliente por ID
getClienteById: async (req, res) => {
  try {
    const cliente = await Cliente.findById(req.params.id);
    if (!cliente) {
      req.flash('error', 'Cliente no encontrado');
      return res.redirect('/clientes');
    }
    res.render('clientes/detail', {
      title: 'Detalle del Cliente',
      user: req.user,
      cliente: cliente
    });
  } catch (error) {
    console.error(error);
    req.flash('error', 'Error al obtener el cliente');
    res.redirect('/clientes');
  }
},


  // Método para mostrar el formulario de creación de un nuevo cliente
showCreateForm: (req, res) => {
  res.render('clientes/create', {
    title: 'Crear Cliente',
    currentPage: 'clientes',
    user: res.locals.user
  });
},

// Método para manejar la creación de un nuevo cliente
createCliente: async (req, res) => {
  console.log('req.body:', req.body);
  console.log('req.file:', req.file);
  try {
    const datos = {
      ...req.body,
      foto: req.file ? `/uploads/${req.file.filename}` : null
    };
    console.log('📦 Datos recibidos para crear cliente:', datos);
    await Cliente.create(datos);
    res.redirect('/clientes');
  } catch (error) {
    console.error('❌ Error en createCliente:', error);
    res.status(500).send('Error al crear el cliente');
  }
},

showEditForm: async (req, res) => {
  try {
    const cliente = await Cliente.findById(req.params.id);
    if (!cliente) {
      req.flash('error', 'Cliente no encontrado');
      return res.redirect('/clientes');
    }
    res.render('clientes/edit', {
      title: 'Editar Cliente',
      user: req.user,
      cliente: cliente
    });
  } catch (error) {
    console.error(error);
    req.flash('error', 'Error al cargar el formulario de edición');
    res.redirect('/clientes');
  }
},

  // Método para manejar la actualización de un cliente
updateCliente: async (req, res) => {
  try {
    const datos = {
      ...req.body,
      foto: req.file ? `/uploads/${req.file.filename}` : req.body.foto_actual || null
    };

    console.log('🛠 Datos para actualizar cliente:', datos);

    await Cliente.update(req.params.id, datos);
    res.redirect('/clientes');
  } catch (error) {
    console.error('❌ Error al actualizar el cliente:', error);
    res.status(500).send('Error al actualizar el cliente');
  }
}

};

module.exports = clienteController;
