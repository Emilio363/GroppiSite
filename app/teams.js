import { Router } from 'express';
import { query } from './db.js';
import { whereCreate } from './helpers.js';
import { verifyToken } from './auth.js';

const router = Router();

// GET /api/teams?q=
router.get('/teams', async (req, res) => {
  const { sql, params } = whereCreate(['sq.nome'], req.query.q);
  const rows = await query(
    `SELECT sq.id, sq.nome, sq.sport_id, sp.nome AS sport
       FROM squadra sq JOIN sport sp ON sq.sport_id = sp.id${sql}
      ORDER BY sq.nome`,
    params
  );
  res.json(rows);
});

// GET /api/teams/:id - dettagli squadra
router.get('/teams/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'id non valido' });
  const rows = await query(
    `SELECT sq.id, sq.nome, sq.sport_id, sp.nome AS sport
       FROM squadra sq JOIN sport sp ON sq.sport_id = sp.id
      WHERE sq.id = ?`,
    [id]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Squadra non trovata' });
  const giocatori = await query(
    `SELECT g.id, g.name, g.surname, g.numero
       FROM squadra_giocatore sg JOIN giocatore g ON sg.giocatore_id = g.id
      WHERE sg.squadra_id = ?
      ORDER BY g.surname, g.name`,
    [id]
  );
  res.json({ ...rows[0], giocatori });
});

// GET /api/players?q=
router.get('/players', async (req, res) => {
  const { sql, params } = whereCreate(['g.name', 'g.surname'], req.query.q);
  const rows = await query(
    `SELECT g.id, g.name, g.surname, g.numero
       FROM giocatore g${sql}
      ORDER BY g.surname, g.name`,
    params
  );
  res.json(rows);
});

// GET /api/players/:id - dettaglio giocatore
router.get('/players/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'id non valido' });
  const rows = await query('SELECT id, name, surname, numero FROM giocatore WHERE id = ?', [id]);
  if (rows.length === 0) return res.status(404).json({ error: 'Giocatore non trovato' });
  const squadre = await query(
    `SELECT sq.id, sq.nome
       FROM squadra_giocatore sg JOIN squadra sq ON sg.squadra_id = sq.id
      WHERE sg.giocatore_id = ?
      ORDER BY sq.nome`,
    [id]
  );
  res.json({ ...rows[0], squadre });
});

// POST /api/tournaments/:id/teams - aggiungo squadra
router.post('/tournaments/:id/teams', verifyToken, async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'id non valido' });
  const nome = req.body.nome;
  if (!nome) return res.status(400).json({ error: 'nome squadra richiesto' });

  const tor = await query('SELECT id, owner_id, sport_id, max_teams FROM torneo WHERE id = ?', [id]);
  const t = tor[0];
  if (!t) return res.status(404).json({ error: 'Torneo non trovato' });
  if (t.owner_id !== req.user.id) {
    return res.status(403).json({ error: 'Solo il creatore può aggiungere squadre' });
  }

  const count = await query('SELECT COUNT(*) AS n FROM torneo_squadra WHERE torneo_id = ?', [id]);
  if (Number(count[0].n) >= t.max_teams) {
    return res.status(409).json({ error: 'Numero massimo di squadre raggiunto' });
  }

  // la squadra deve già esistere (e appartenere allo sport del torneo)
  const squadre = await query(
    'SELECT id FROM squadra WHERE nome = ? AND sport_id = ?',
    [nome, t.sport_id]
  );
  if (squadre.length === 0) {
    return res.status(404).json({ error: 'Squadra non trovata: va prima creata' });
  }
  const squadraId = Number(squadre[0].id);

  // la squadra non deve essere già iscritta a questo torneo
  const esiste = await query(
    'SELECT 1 FROM torneo_squadra WHERE torneo_id = ? AND squadra_id = ?',
    [id, squadraId]
  );
  if (esiste.length > 0) {
    return res.status(409).json({ error: 'Squadra già presente nel torneo' });
  }

  await query('INSERT INTO torneo_squadra (torneo_id, squadra_id) VALUES (?, ?)', [id, squadraId]);
  res.status(201).json({ id: squadraId, nome, sport_id: t.sport_id, torneo_id: id, giocatori: [] });
});

// POST /api/teams/:teamId/players - associa un giocatore esistente alla squadra
router.post('/teams/:teamId/players', verifyToken, async (req, res) => {
  const teamId = Number(req.params.teamId);
  if (Number.isNaN(teamId)) return res.status(400).json({ error: 'id squadra non valido' });
  const giocatoreId = Number(req.body?.giocatore_id);
  if (Number.isNaN(giocatoreId)) return res.status(400).json({ error: 'id giocatore non valido' });

  const team = await query('SELECT id FROM squadra WHERE id = ?', [teamId]);
  if (team.length === 0) return res.status(404).json({ error: 'Squadra non trovata' });

  const player = await query('SELECT id FROM giocatore WHERE id = ?', [giocatoreId]);
  if (player.length === 0) return res.status(404).json({ error: 'Giocatore non trovato' });

  // il giocatore non deve essere già associato alla squadra
  const dup = await query(
    'SELECT 1 FROM squadra_giocatore WHERE squadra_id = ? AND giocatore_id = ?',
    [teamId, giocatoreId]
  );
  if (dup.length > 0) return res.status(409).json({ error: 'Giocatore già presente nella squadra' });

  await query('INSERT INTO squadra_giocatore (squadra_id, giocatore_id) VALUES (?, ?)', [teamId, giocatoreId]);
  res.status(201).json({ giocatore_id: giocatoreId, squadra_id: teamId });
});

// POST /api/teams - crea una nuova squadra (nome + sport)
router.post('/teams', verifyToken, async (req, res) => {
  const nome = (req.body?.nome || '').trim();
  const sport = req.body?.sport;
  if (!nome || sport == null) return res.status(400).json({ error: 'nome e sport richiesti' });

  // lo sport può arrivare come id numerico o come nome: risolvo l'id in entrambi i casi
  let sportRows;
  if (/^\d+$/.test(String(sport))) { // se è un numero
    // ricerca per id
    sportRows = await query('SELECT id FROM sport WHERE id = ?', [Number(sport)]);
  } else {
    // ricerca per stringa
    sportRows = await query('SELECT id FROM sport WHERE LOWER(nome) = LOWER(?)', [String(sport)]);
  }
  if (sportRows.length === 0) return res.status(400).json({ error: 'Sport non valido' });
  const sportId = sportRows[0].id;

  try {
    const r = await query('INSERT INTO squadra (nome, sport_id) VALUES (?, ?)', [nome, sportId]);
    res.status(201).json({ id: Number(r.insertId), nome, sport_id: sportId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Esiste già una squadra con questo nome' });
    }
    throw err;
  }
});

// POST /api/players - crea un nuovo giocatore (name, surname, numero opzionale)
router.post('/players', verifyToken, async (req, res) => {
  const name = (req.body?.name || '').trim();
  const surname = (req.body?.surname || '').trim();
  const numero = req.body?.numero;
  if (!name || !surname) return res.status(400).json({ error: 'name e surname richiesti' });
  if (numero != null && (!Number.isInteger(numero) || numero < 0)) {
    return res.status(400).json({ error: 'numero maglia non valido' });
  }

  // schema attuale: giocatore.utente_id NOT NULL -> registro chi lo crea
  const r = await query(
    'INSERT INTO giocatore (name, surname, numero, utente_id) VALUES (?, ?, ?, ?)',
    [name, surname, numero ?? null, req.user.id]
  );
  res.status(201).json({ id: Number(r.insertId), name, surname, numero: numero ?? null });
});

export default router;
