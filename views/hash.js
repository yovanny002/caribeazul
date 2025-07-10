const bcrypt = require('bcrypt');

// 👉 Cambia estas contraseñas por las que necesites hashear
const contrasenas = [
  { nombre: 'servicios@azul', valor: 'servicios@azul' },
  { nombre: 'cristian8181', valor: 'cristian8181' }
];

// Función para generar los hashes
async function generarHashes() {
  const saltRounds = 12; // Recomendado: 12
  for (const c of contrasenas) {
    try {
      const hash = await bcrypt.hash(c.valor, saltRounds);
      console.log(`Hash para ${c.nombre}:`);
      console.log(hash);
      console.log('---------------------------');
    } catch (err) {
      console.error(`Error al hashear ${c.nombre}:`, err);
    }
  }
}

generarHashes();
