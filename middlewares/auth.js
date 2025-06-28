const jwt = require('jsonwebtoken');
const User = require('../models/User');
const rateLimit = require('express-rate-limit');

module.exports = {
  // Middleware para verificar autenticación en vistas
  ensureAuthenticated: (req, res, next) => {
    // Verificar sesión tradicional
    if (req.session?.user) {
      return next();
    }
    
    // Verificar token JWT (para APIs)
    const token = req.cookies.token || req.headers['x-access-token'];
    if (token) {
      jwt.verify(token, process.env.JWT_SECRET || 'secret_key', async (err, decoded) => {
        if (err) {
          req.flash('error_msg', 'Sesión inválida o expirada');
          return res.redirect('/auth/login');
        }
        
        // Verificar que el usuario aún existe y está activo
        const user = await User.findByPk(decoded.id);
        if (!user || user.estado !== 'activo') {
          req.flash('error_msg', 'Usuario no encontrado o inactivo');
          return res.clearCookie('token').redirect('/auth/login');
        }
        
        // Establecer usuario en la sesión
        req.session.user = {
          id: user.id,
          nombre: user.nombre,
          email: user.email,
          rol: user.rol,
          sucursal_id: user.sucursal_id
        };
        
        next();
      });
    } else {
      req.flash('error_msg', 'Por favor inicia sesión');
      res.redirect('/auth/login');
    }
  },

  // Middleware para usuarios no autenticados
  ensureNotAuthenticated: (req, res, next) => {
    if (!req.session?.user && !req.cookies?.token) {
      return next();
    }
    res.redirect('/dashboard');
  },

  // Middleware para establecer usuario en res.locals (mejorado)
  setUser: async (req, res, next) => {
    if (req.session?.user) {
      res.locals.user = req.session.user;
    } else if (req.cookies?.token) {
      try {
        const decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET || 'secret_key');
        const user = await User.findByPk(decoded.id, {
          attributes: ['id', 'nombre', 'email', 'rol', 'sucursal_id']
        });
        if (user) res.locals.user = user;
      } catch (err) {
        // Limpiar cookie inválida
        res.clearCookie('token');
      }
    }
    next();
  },

  // Generador de tokens JWT mejorado
  generateToken: (user) => {
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
        rol: user.rol,
        sucursal_id: user.sucursal_id,
        iss: 'CiwitaPrint',
        aud: 'ciwitaprint-app'
      },
      process.env.JWT_SECRET || 'secret_key',
      { 
        expiresIn: '8h',
        algorithm: 'HS256'
      }
    );
  },

  // Middleware para verificar roles (mejorado)
  checkRole: (roles) => {
    return async (req, res, next) => {
      const user = req.session?.user;
      
      if (!user) {
        req.flash('error_msg', 'No autenticado');
        return res.redirect('/auth/login');
      }

      // Verificar rol del usuario en la base de datos (actualizado)
      const currentUser = await User.findByPk(user.id);
      if (!currentUser || !roles.includes(currentUser.rol)) {
        req.flash('error_msg', 'No tienes permisos para esta acción');
        return res.redirect('/dashboard');
      }

      next();
    };
  },

  // Middleware para protección contra fuerza bruta
  loginLimiter: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 5, // máximo 5 intentos por IP
    message: 'Demasiados intentos de login, por favor intente nuevamente más tarde',
    standardHeaders: true,
    legacyHeaders: false
  }),

  // Middleware para verificar token JWT (para APIs)
  verifyToken: (req, res, next) => {
    const token = req.cookies.token || req.headers['x-access-token'];
    
    if (!token) {
      return res.status(401).json({ 
        success: false,
        message: 'Token no proporcionado'
      });
    }

    jwt.verify(token, process.env.JWT_SECRET || 'secret_key', async (err, decoded) => {
      if (err) {
        return res.status(401).json({ 
          success: false,
          message: 'Token inválido o expirado'
        });
      }
      
      // Verificar que el usuario existe y está activo
      const user = await User.findByPk(decoded.id);
      if (!user || user.estado !== 'activo') {
        return res.status(401).json({ 
          success: false,
          message: 'Usuario no encontrado o inactivo'
        });
      }

      req.user = user;
      next();
    });
  },

  // Middleware para CORS seguro
  secureHeaders: (req, res, next) => {
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
  }
};

