// backend/helpers/utils.js
const moment = require('moment');

const formatCurrency = (value) => {
  if (!value) return 'RD$ 0.00';
  return new Intl.NumberFormat('es-DO', {
    style: 'currency',
    currency: 'DOP'
  }).format(value);
};

const formatDate = (date) => {
  return moment(date).format('DD/MM/YYYY');
};

module.exports = {
  formatCurrency,
  formatDate
};