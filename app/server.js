import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { query } from './db.js';
import { whereCreate, APERTURA, CHIUSURA, parseInterval, findOverlaps } from './helpers.js';
import authRouter, { verifyToken } from './auth.js';
import tournamentsRouter from './tournaments.js';
import bookingsRouter from './bookings.js';
import teamsRouter from './teams.js';

// cartella del frontend: sta accanto ad app/ (../frontend rispetto a questo file)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');

const app = express();
app.use(express.json());
app.use(cookieParser());

// reindirizzo le richieste '/api/auth'
app.use('/api/auth', authRouter);
// router montati sotto '/api' (i path interni sono relativi: '/tournaments', '/fields/:id/bookings', '/teams', ...)
app.use('/api', tournamentsRouter);
app.use('/api', bookingsRouter);
app.use('/api', teamsRouter);

// GET /api/whoami - se autenticato, restituisce i dati dell'utente corrente
app.get('/api/whoami', verifyToken, async (req, res) => {
  // req.user contiene solo { id, username } dal token: leggo name e surname dal DB
  const rows = await query(
    'SELECT id, username, name, surname FROM utente WHERE id = ?',
    [req.user.id]
  );
  const user = rows[0];
  if (!user) {
    return res.status(404).json({
      error: 'Utente non trovato',
      id: req.user.id,
      username: req.user.username,
    });
  }
  res.json(user);
});

// GET /api/debug/where?q=...
// app.get('/api/debug/where', (req, res) => {
//   const columns = ['c.nome', 'sp.nome', 'c.indirizzo'];
//   // se q manca uso un valore di esempio, così sql non è mai vuoto
//   const q = req.query.q || 'ciao';
//   const { sql, params } = whereCreate(columns, q);
//   res.json({ q, columns, sql, params });
// });

app.get('/api/debug/where', (req, res) => {
  const columns = ['c.nome', 'sp.nome', 'c.indirizzo'];
  // se q manca uso un valore di esempio, così sql non è mai vuoto
  const q = req.query.q || 'ciao';
  const params= whereCreate(columns, q);
  res.json( params );
});
// ----- Campi -----

// GET /api/fields?q=
app.get('/api/fields', async (req, res) => {
  const { sql, params } = whereCreate(['c.nome', 'sp.nome', 'c.indirizzo'], req.query.q);
  const rows = await query(
    `SELECT c.id, c.nome, c.indirizzo, c.sport_id, sp.nome AS sport
       FROM campo c JOIN sport sp ON c.sport_id = sp.id${sql}
      ORDER BY c.nome`,
    params
  );
  res.json(rows);
});


// GET /api/fields/:id
app.get('/api/fields/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'id non valido' });
  const rows = await query(
    `SELECT c.id, c.nome, c.indirizzo, c.sport_id, sp.nome AS sport
       FROM campo c JOIN sport sp ON c.sport_id = sp.id
      WHERE c.id = ?`,
    [id]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Campo non trovato' });
  res.json({ ...rows[0]});
});

// GET /api/fields/:id/slots?date=YYYY-MM-DD[&from=HH:MM&to=HH:MM] - disponibilità per una data
// Senza from/to: elenca le prenotazioni di quella data.
// Con from/to: dice se l'intervallo richiesto è libero (disponibile) e quali prenotazioni lo bloccano.
app.get('/api/fields/:id/slots', async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'id non valido' });
  const date = req.query.date;
  // YYYY-MM-DD con mese 01-12 e giorno 01-31 (non controlla la coerenza giorno/mese)
  if (!date || !/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(date)) {
    return res.status(400).json({ error: 'Parametro date non corretto' });
  }
  const field = await query('SELECT id FROM campo WHERE id = ?', [id]);
  if (field.length === 0) return res.status(404).json({ error: 'Campo non trovato' });

  const prenotazioni = await query(
    `SELECT id, utente_id, ora_inizio, ora_fine
       FROM prenotazione
      WHERE campo_id = ? AND data = ?
      ORDER BY ora_inizio`,
    [id, date]
  );

  // Se non viene passato un intervallo, restituisco solo le prenotazioni esistenti della data.
  if (req.query.from === undefined || req.query.to === undefined) {
    return res.json({ campo_id: id, data: date, apertura: APERTURA, chiusura: CHIUSURA, prenotazioni });
  }

  // Altrimenti verifico la disponibilità dell'intervallo richiesto.
  const interval = parseInterval(req.query.from, req.query.to);
  if (interval.error) return res.status(400).json({ error: interval.error });
  const { from, to } = interval;

  const conflitti = findOverlaps(prenotazioni, from, to);
  res.json({ campo_id: id, data: date, from, to, disponibile: conflitti.length === 0, conflitti });
});

// GET /api/matches/:id - dettaglio singola partita
app.get('/api/matches/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'id non valido' });
  const rows = await query(
    `SELECT p.id, p.torneo_id, t.nome AS torneo, p.sport_id, sp.nome AS sport,
            p.squadra1_id, sq1.nome AS squadra1,
            p.squadra2_id, sq2.nome AS squadra2,
            p.risultato_squadra1, p.risultato_squadra2,
            p.prenotazione_id, pr.campo_id, c.nome AS campo,
            pr.data AS giorno, pr.ora_inizio, pr.ora_fine
       FROM partita p
       JOIN squadra sq1 ON p.squadra1_id = sq1.id
       JOIN squadra sq2 ON p.squadra2_id = sq2.id
       JOIN sport sp ON p.sport_id = sp.id
       LEFT JOIN torneo t ON p.torneo_id = t.id
       LEFT JOIN prenotazione pr ON p.prenotazione_id = pr.id
       LEFT JOIN campo c ON pr.campo_id = c.id
      WHERE p.id = ?`,
    [id]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Partita non trovata' });
  const m = rows[0];
  res.json({
    ...m,
    stato: m.risultato_squadra1 != null && m.risultato_squadra2 != null ? 'giocata' : 'da_giocare',
  });
});

// GET /api/users?q=
app.get('/api/users', async (req, res) => {
  const { sql, params } = whereCreate(['username', 'name', 'surname'], req.query.q);
  const users = await query(
    `SELECT id, username, name, surname FROM utente${sql} ORDER BY surname, name`,
    params
  );
  if (users.length === 0) return res.json([]);
  const ids = users.map((u) => u.id);
  const placeholders = ids.map(() => '?').join(', ');
  const tornei = await query(
    `SELECT id, nome, owner_id, sport_id, start_date FROM torneo
      WHERE owner_id IN (${placeholders}) ORDER BY start_date DESC`,
    ids
  );
  res.json(users.map((u) => ({ ...u, tornei: tornei.filter((t) => t.owner_id === u.id) })));
});

// GET /api/users/:id
app.get('/api/users/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'id non valido' });
  const rows = await query('SELECT id, username, name, surname FROM utente WHERE id = ?', [id]);
  if (rows.length === 0) return res.status(404).json({ error: 'Utente non trovato' });
  const tornei = await query(
    'SELECT id, nome, owner_id, sport_id, start_date FROM torneo WHERE owner_id = ? ORDER BY start_date DESC',
    [id]
  );
  res.json({ ...rows[0], tornei });
});

// File statici del frontend (cartella ../frontend servita da Express, stessa origine dell'API)
app.use(express.static(FRONTEND_DIR));

// Gestore errori centralizzato: con Express 5 le route async che lanciano arrivano qui.
app.use((err, req, res, next) => {
  console.error('Errore non gestito:', err);
  res.status(500).json({ error: 'Errore interno' });
});

app.listen(3000, () => {
  console.log('Server in ascolto sulla porta 3000');
});
