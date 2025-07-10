const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');


exports.formLogin = (req, res) => {
  res.render('auth/login', {
    title: 'Iniciar Sesión',
    layout: 'layouts/auth',
    error: req.flash('error')
  });
};



exports.formResetPassword = (req, res) => {
  res.render('auth/reset', {
    title: 'Recuperar Contraseña',
    layout: 'layouts/auth',
    csrfToken: req.csrfToken()
  });
};

// authController.js (simplificado)
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email, estado: 'activo' } });
    if (!user) {
      return res.render('auth/login', { error: 'Usuario no encontrado' });
    }
    const valid = await user.validPassword(password);
    if (!valid) {
      return res.render('auth/login', { error: 'Contraseña incorrecta' });
    }
    // Guardar en sesión
      req.session.user = {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        rol: user.rol,
        sucursal_id: user.sucursal_id
      };


    // Redirigir al dashboard
    return res.redirect('/dashboard');
  } catch (error) {
    console.error('Error en login:', error);
    return res.render('auth/login', { error: 'Error inesperado' });
  }
};


exports.logout = (req, res) => {
  // Destruir sesión
  req.session.destroy(() => {
    // Limpiar cookie
    res.clearCookie('token');
    res.clearCookie('connect.sid');
    res.redirect('/auth/login');
  });
};

exports.requestReset = async (req, res) => {
  try {
    const user = await User.findOne({ where: { email: req.body.email } });
    
    if (!user) {
      req.flash('error_msg', 'No existe una cuenta con ese email');
      return res.redirect('/auth/reset');
    }

    // Generar token y fecha de expiración
    const resetUser = user.generateResetToken();
    await resetUser.save();

    // Enviar email
    await sendResetEmail(user.email, user.reset_password_token);

    req.flash('success_msg', 'Se ha enviado un email con instrucciones para resetear tu contraseña');
    res.redirect('/auth/login');

  } catch (error) {
    console.error('Error en requestReset:', error);
    req.flash('error_msg', 'Error al procesar la solicitud');
    res.redirect('/auth/reset');
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const user = await User.findOne({
      where: {
        reset_password_token: req.params.token,
        reset_password_expires: { [Op.gt]: Date.now() }
      }
    });

    if (!user) {
      req.flash('error_msg', 'El token es inválido o ha expirado');
      return res.redirect('/auth/reset');
    }

    // Actualizar contraseña
    user.password = req.body.password;
    user.reset_password_token = null;
    user.reset_password_expires = null;
    await user.save();

    req.flash('success_msg', 'Tu contraseña ha sido actualizada correctamente');
    res.redirect('/auth/login');

  } catch (error) {
    console.error('Error en resetPassword:', error);
    req.flash('error_msg', 'Error al actualizar la contraseña');
    res.redirect(`/auth/reset/${req.params.token}`);
  }
};
exports.formNewPassword = async (req, res) => {
  try {
    const token = req.params.token;
    const user = await User.findOne({
      where: {
        reset_password_token: token,
        reset_password_expires: { [Op.gt]: Date.now() }
      }
    });

    if (!user) {
      req.flash('error_msg', 'El token es inválido o ha expirado');
      return res.redirect('/auth/reset');
    }

    res.render('auth/new-password', {
      title: 'Nueva Contraseña',
      layout: 'layouts/auth',
      csrfToken: req.csrfToken(),
      token
    });
  } catch (error) {
    console.error('Error en formNewPassword:', error);
    req.flash('error_msg', 'Error al cargar la página');
    res.redirect('/auth/reset');
  }
};
