// backend/middlewares/validateFields.js
const { validationResult } = require('express-validator');

const validateFields = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    // Si hay errores de validación
    const errorMessages = errors.array().map(error => error.msg);
    
    if (req.accepts('json')) {
      return res.status(400).json({ 
        success: false, 
        errors: errorMessages 
      });
    }
    
    // Para formularios tradicionales (usando flash messages)
    req.flash('error', errorMessages.join(', '));
    return res.redirect('back');
  }
  
  next();
};

module.exports = validateFields;