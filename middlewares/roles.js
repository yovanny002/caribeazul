// middlewares/roles.js

function checkRole(rolesPermitidos = []) {
  return (req, res, next) => {
    const user = req.session.user;

    if (!user) {
      req.flash('error_msg', 'Debes iniciar sesión');
      return res.redirect('/login');
    }

    if (!rolesPermitidos.includes(user.rol)) {
      req.flash('error_msg', 'No tienes permiso para acceder a esta página');
      return res.redirect('back');
    }

    next();
  };
}

module.exports = { checkRole };
