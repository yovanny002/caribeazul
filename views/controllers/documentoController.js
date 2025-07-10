const path = require('path');
const fs = require('fs');
const db = require('../models/db');

exports.subirDocumento = async (req, res) => {
  const { prestamoId } = req.params;
  const tipo = req.body.tipo;

  if (!['contrato', 'identificacion', 'garantias'].includes(tipo)) {
    return res.status(400).json({ success: false, message: 'Tipo inválido' });
  }

  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Archivo no recibido' });
  }

  const filePath = `/documents/${req.file.filename}`;

  try {
    await db.query(
      `UPDATE solicitudes_prestamos SET ${tipo}_url = :filePath WHERE id = :prestamoId`,
      {
        replacements: { filePath, prestamoId }
      }
    );

    return res.json({ success: true, url: filePath });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.eliminarDocumento = async (req, res) => {
  const { prestamoId } = req.params;
  const tipo = req.body.tipo;

  if (!['contrato', 'identificacion', 'garantias'].includes(tipo)) {
    return res.status(400).json({ success: false, message: 'Tipo inválido' });
  }

  try {
    const [rows] = await db.query(
      `SELECT ${tipo}_url FROM solicitudes_prestamos WHERE id = :prestamoId`,
      { replacements: { prestamoId } }
    );

    const fileUrl = rows[0]?.[`${tipo}_url`];

    if (fileUrl) {
      const filePath = path.join(__dirname, '../public', fileUrl);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      await db.query(
        `UPDATE solicitudes_prestamos SET ${tipo}_url = NULL WHERE id = :prestamoId`,
        { replacements: { prestamoId } }
      );
    }

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
