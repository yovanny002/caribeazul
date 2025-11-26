const express = require('express');
const router = express.Router(); // ✅ correcto
const path = require('path');
const app = express();
const methodOverride = require('method-override');
const expressLayouts = require('express-ejs-layouts');
const flash = require('connect-flash');
const session = require('express-session');
const authMiddleware = require('./middlewares/auth');
const cookieParser = require('cookie-parser');
// const csrf = require('csurf');
require('dotenv').config();

// HABILITAR trust proxy para Render (o cualquier proxy que uses)
app.set('trust proxy', 1);

// Configuración de EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layouts/layout'); // Layout por defecto

// Middlewares básicos
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(cookieParser());

// Configuración de sesión
app.use(session({
  secret: process.env.SESSION_SECRET || 'tu_secreto_super_seguro',
  resave: true,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true
  }
}));

// Flash messages
app.use(flash());

// Middleware para variables globales
app.use((req, res, next) => {
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  res.locals.user = req.session.user || null;
  next();
});
// En tu app.js o archivo principal
app.use((err, req, res, next) => {
  console.error('Error no manejado:', err.stack);
  req.flash('error', 'Ocurrió un error inesperado');
  res.redirect('back');
});

// Middleware de autenticación (para vistas)
app.use(authMiddleware.setUser);

// CORS para API
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  next();
});
app.use((req, res, next) => {
  res.locals.usuario = req.session.user || null;
  next();
});

// Rutas
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const clientesRoutes = require('./routes/clientes');
const prestamosRoutes = require('./routes/prestamos');
const cobradoresRoutes = require('./routes/cobradores');
const rutasRoutes = require('./routes/rutas');
const reportesRoutes = require('./routes/reportes');
const documentosRoutes = require('./routes/documentos');
const prestamosInteresRoutes = require('./routes/prestamosInteres');
const contratoRoutes = require('./routes/contratos');
const hipotecaRoutes = require('./routes/contratosHipotecarios');


app.use('/auth', authRoutes);
app.use('/dashboard', authMiddleware.ensureAuthenticated, dashboardRoutes);
app.use('/clientes', authMiddleware.ensureAuthenticated, clientesRoutes);
app.use('/prestamos', authMiddleware.ensureAuthenticated, prestamosRoutes);
app.use('/prestamos_interes', authMiddleware.ensureAuthenticated, prestamosInteresRoutes);
app.use('/reportes', authMiddleware.ensureAuthenticated, reportesRoutes);
app.use('/cobradores', authMiddleware.ensureAuthenticated, cobradoresRoutes);
app.use('/rutas', authMiddleware.ensureAuthenticated, rutasRoutes);
// Ruta para subir documentos
app.use('/documentos', authMiddleware.ensureAuthenticated, documentosRoutes);
app.use('/contratos',authMiddleware.ensureAuthenticated, contratoRoutes);
app.use('/financiamiento',authMiddleware.ensureAuthenticated, contratoRoutes);
app.use('/contratos-hipotecarios',authMiddleware.ensureAuthenticated, hipotecaRoutes);



app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error al cerrar sesión:', err);
      return res.redirect('/');
    }
    res.clearCookie('connect.sid'); 
    res.redirect('/auth/login');
  });
});

// Ruta principal
app.get('/', (req, res) => {
  res.redirect('/dashboard');
});

// Manejo de errores
app.use((err, req, res, next) => {
  console.error(err.stack);

  const statusCode = err.status || 500;
  const errorResponse = {
    error: {
      message: err.message || 'Error interno del servidor',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  };

  if (req.accepts('html')) {
    return res.status(statusCode).render('error', {
      title: 'Error',
      message: errorResponse.error.message,
      error: process.env.NODE_ENV === 'development' ? err : null
    });
  }

  res.status(statusCode).json(errorResponse);
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
