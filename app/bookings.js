import { Router } from 'express';
import { query } from './db.js';
import { verifyToken } from './auth.js';
import { parseInterval, findOverlaps } from './helpers.js';

// Router montato sotto '/api' in server.js: i path qui partono da '/fields' e '/bookings'.
const router = Router();

// Combina data (YYYY-MM-DD) e ora (HH:MM:SS) in un Date locale.
function slotStart(data, ora) {
  return new Date(`${data}T${ora}`);
}

// POST /api/fields/:id/bookings
router.post('/fields/:id/bookings', verifyToken, async (req, res) => {
  const campoIid = Number(req.params.id);
  if (!campoIid || Number.isNaN(campoIid)) return res.status(400).json({ error: 'id non valido' });

  const { date } = req.body || {};
  if (!date || !/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(date)) { // date validation
    return res.status(400).json({ error: 'Parametro date (YYYY-MM-DD) non valido' });
  }

  const interval = parseInterval(req.body.from, req.body.to);
  if (interval.error) return res.status(400).json({ error: interval.error });
  const { from, to } = interval;
  // non si possono prenotare slot nel passato
  if (slotStart(date, from) <= new Date()) {
    return res.status(400).json({ error: 'Non puoi prenotare uno slot nel passato' });
  }

  const field = await query('SELECT id FROM campo WHERE id = ?', [campoIid]);
  if (field.length === 0) return res.status(404).json({ error: 'Campo non trovato' });

  // controllo sovrapposizioni
  const esistenti = await query(
    'SELECT id, ora_inizio, ora_fine FROM prenotazione WHERE campo_id = ? AND data = ?',
    [campoIid, date]
  );
  if (findOverlaps(esistenti, from, to).length > 0) {
    return res.status(409).json({ error: 'Slot non disponibile: si sovrappone a una prenotazione esistente' });
  }

  try {
    const result = await query(
      'INSERT INTO prenotazione (campo_id, utente_id, data, ora_inizio, ora_fine) VALUES (?, ?, ?, ?, ?)',
      [campoIid, req.user.id, date, from, to]
    );
    res.status(201).json({
      id: Number(result.insertId),
      campo_id: campoIid, utente_id: req.user.id, data: date, ora_inizio: from, ora_fine: to,
    });
  } catch (err) {
    // non succede, ma se succede...
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Slot già prenotato' });
    throw err;
  }
});

// DELETE /api/fields/:id/bookings/:bookingId
// cancella una propria prenotazione futura
router.delete('/fields/:id/bookings/:bookingId', verifyToken, async (req, res) => {
  const id = Number(req.params.id);
  const bookingId = Number(req.params.bookingId);
  if (Number.isNaN(id) || Number.isNaN(bookingId)) {
    return res.status(400).json({ error: 'id non valido' });
  }
  const rows = await query(
    `SELECT id, utente_id, DATE_FORMAT(data, '%Y-%m-%d') AS data, ora_inizio
       FROM prenotazione WHERE id = ? AND campo_id = ?`,
    [bookingId, id]
  );
  const b = rows[0];
  if (!b) return res.status(404).json({ error: 'Prenotazione non trovata' });
  if (b.utente_id !== req.user.id) {
    return res.status(403).json({ error: 'Puoi cancellare solo le tue prenotazioni' });
  }
  if (slotStart(b.data, b.ora_inizio) <= new Date()) {
    return res.status(400).json({ error: 'Non puoi cancellare una prenotazione già passata' });
  }
  await query('DELETE FROM prenotazione WHERE id = ?', [bookingId]);
  res.json({ deleted: bookingId });
});

export default router;
