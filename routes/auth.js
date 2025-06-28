const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { ensureNotAuthenticated } = require('../middlewares/auth');
const csrf = require('csurf');
const rateLimit = require('express-rate-limit');

// Configuración de rate limiting
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // límite de 5 intentos por IP
  message: 'Demasiados intentos de login, por favor intente más tarde'
});

// Protección CSRF


// Ya NO pongas csrfProtection como middleware
router.get('/login', ensureNotAuthenticated, authController.formLogin);
router.post('/login', loginLimiter, authController.login);
router.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error al cerrar sesión:', err);
      return res.redirect('/');
    }
    res.clearCookie('connect.sid'); // importante si usas cookies
    res.redirect('/login');
  });
});
router.get('/reset', ensureNotAuthenticated, authController.formResetPassword);
router.post('/reset', ensureNotAuthenticated, authController.requestReset);
router.get('/reset/:token', ensureNotAuthenticated, authController.formNewPassword);
router.post('/reset/:token', ensureNotAuthenticated, authController.resetPassword);



module.exports = router;