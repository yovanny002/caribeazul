module.exports = (req, res, next) => {
  // Lista de rutas que no requieren validación de ID
  const excludedRoutes = [
    '/prestamos-especiales/create',
    '/prestamos-especiales/crear',
    '/prestamos-especiales'
  ];

  if (excludedRoutes.includes(req.path) || req.method === 'POST' && req.path === '/') {
    return next();
  }

  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ 
      error: 'ID inválido',
      details: `El ID proporcionado (${req.params.id}) no es un número válido`
    });
  }

  req.id = id;
  next();
};