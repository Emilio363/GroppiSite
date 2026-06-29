

import { Router } from 'express';
import { query } from './db.js';
import { whereCreate } from './helpers.js';
import { verifyToken } from './auth.js';

// Router montato sotto '/api' in server.js: i path qui partono da '/tournaments'.
const router = Router();

// squadre di un torneo, ciascuna con i propri giocatori.
async function getTournamentTeams(tournamentId) {
  const teams = await query(
    `SELECT sq.id, sq.nome, sq.sport_id
       FROM torneo_squadra ts
       JOIN squadra sq ON ts.squadra_id = sq.id
      WHERE ts.torneo_id = ?
      ORDER BY sq.nome`,
    [tournamentId]
  );
  if (teams.length === 0) return [];
  const idTeams = teams.map((t) => t.id);
  const placeholders = idTeams.map(() => '?').join(', ');
  const players = await query(
    `SELECT sg.squadra_id, g.id, g.name, g.surname, g.numero
       FROM squadra_giocatore sg
       JOIN giocatore g ON sg.giocatore_id = g.id
      WHERE sg.squadra_id IN (${placeholders})
      ORDER BY g.surname, g.name`,
    idTeams
  );
  // torna un oggetto con ogni squadra e i vari dettagli
  // per ogni squadra associa un oggetto con i dettagli dei giocatori
  return teams.map((t) => ({
    ...t,
    giocatori: players
      .filter((p) => p.squadra_id === t.id)
      .map(({ squadra_id, ...g }) => g),
  }));
}

// Partite di un torneo con nomi squadre/campo e stato derivato (giocata / da_giocare).
async function getTournamentMatches(tournamentId) {
  const rows = await query(
    `SELECT p.id, p.torneo_id, p.sport_id,
            p.squadra1_id, sq1.nome AS squadra1,
            p.squadra2_id, sq2.nome AS squadra2,
            p.risultato_squadra1, p.risultato_squadra2,
            p.prenotazione_id, pr.campo_id, c.nome AS campo,
            pr.data AS giorno, pr.ora_inizio, pr.ora_fine
       FROM partita p
       JOIN squadra sq1 ON p.squadra1_id = sq1.id
       JOIN squadra sq2 ON p.squadra2_id = sq2.id
       LEFT JOIN prenotazione pr ON p.prenotazione_id = pr.id
       LEFT JOIN campo c ON pr.campo_id = c.id
      WHERE p.torneo_id = ?
      ORDER BY pr.data, p.id`,
    [tournamentId]
  );
  return rows.map((m) => ({
    ...m,
    stato: m.risultato_squadra1 != null && m.risultato_squadra2 != null ? 'giocata' : 'da_giocare',
  }));
}

// Ordinamento: punti, poi differenza, poi reti/punti fatti. Ritorna null se il torneo non esiste.
async function getTournamentStandings(tournamentId) {
  const trows = await query( // wich sport
    `SELECT t.id, sp.nome AS sport
       FROM torneo t JOIN sport sp ON t.sport_id = sp.id
      WHERE t.id = ?`,
    [tournamentId]
  );
  if (trows.length === 0) return null;
  // il nome sport nel DB è capitalizzato ('Calcio'): confronto case-insensitive
  const isCalcio = trows[0].sport.toLowerCase() === 'calcio';
  const winPoints = isCalcio ? 3 : 2;

  const teams = await query( // squad in tournament
    `SELECT sq.id, sq.nome
       FROM torneo_squadra ts JOIN squadra sq ON ts.squadra_id = sq.id
      WHERE ts.torneo_id = ?`,
    [tournamentId]
  );
  const standings = [];
  for (const team of teams) {
    standings.push({
      squadra_id: team.id, nome: team.nome,
      punti: 0, giocate: 0, vinte: 0, pareggiate: 0, perse: 0,
      fatti: 0, subiti: 0, differenza: 0,
    });
  }
  // tutti le partite del torneo
  const matches = await query(
    `SELECT squadra1_id, squadra2_id, risultato_squadra1, risultato_squadra2
       FROM partita
      WHERE torneo_id = ? AND risultato_squadra1 IS NOT NULL AND risultato_squadra2 IS NOT NULL`,
    [tournamentId]
  );
  for (const partita of matches) {
    // trovo le due squadre della partita con tutte le info
    const sq1 = standings.find((r) => r.squadra_id === partita.squadra1_id);
    const sq2 = standings.find((r) => r.squadra_id === partita.squadra2_id);
    if (!sq1 || !sq2) continue; // vedo se le squadre esistono nel torneo
    const g1 = partita.risultato_squadra1;
    const g2 = partita.risultato_squadra2;
    sq1.giocate++; sq2.giocate++;
    sq1.fatti += g1; sq1.subiti += g2;
    sq2.fatti += g2; sq2.subiti += g1;
    if (g1 > g2) {
      sq1.vinte++; sq1.punti += winPoints; sq2.perse++;
    } else if (g1 < g2) {
      sq2.vinte++; sq2.punti += winPoints; sq1.perse++;
    } else {
      sq1.pareggiate++; sq2.pareggiate++;
      if (isCalcio) { // solo nel calcio dà punti
        sq1.punti += 1; 
        sq2.punti += 1; 
      } 
    }
  }

  for (const row of standings) row.differenza = row.fatti - row.subiti;
  standings.sort((x, y) => y.punti - x.punti || y.differenza - x.differenza || y.fatti - x.fatti);
  return standings;
}

// GET /api/tournaments?q= - elenco tornei (ricerca su nome torneo e sport)
router.get('/tournaments', async (req, res) => {
  const { sql, params } = whereCreate(['t.nome', 'sp.nome'], req.query.q);
  const rows = await query(
    `SELECT t.id, t.nome, t.sport_id, sp.nome AS sport,
            t.owner_id, u.username AS owner, t.max_teams, t.min_player, t.start_date,
            (SELECT COUNT(*) FROM partita p WHERE p.torneo_id = t.id) AS total_matches,
            (SELECT COUNT(*) FROM partita p WHERE p.torneo_id = t.id
               AND p.risultato_squadra1 IS NOT NULL AND p.risultato_squadra2 IS NOT NULL) AS played_matches
       FROM torneo t
       JOIN sport sp ON t.sport_id = sp.id
       JOIN utente u ON t.owner_id = u.id${sql}
      ORDER BY t.start_date DESC`,
    params
  );
  const out = rows.map((t) => {
    const total = Number(t.total_matches);
    const played = Number(t.played_matches);
    const { total_matches, played_matches, ...rest } = t;
    return { ...rest, stato: total > 0 && played === total ? 'completed' : 'active' };
  });
  res.json(out);
});

// GET /api/tournaments/:id - dettaglio completo: info + squadre + partite + classifica
router.get('/tournaments/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'id non valido' });
  const rows = await query(
    `SELECT t.id, t.nome, t.sport_id, sp.nome AS sport,
            t.owner_id, u.username AS owner, t.max_teams, t.min_player, t.start_date
       FROM torneo t
       JOIN sport sp ON t.sport_id = sp.id
       JOIN utente u ON t.owner_id = u.id
      WHERE t.id = ?`,
    [id]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Torneo non trovato' });
  const [squadre, partite, classifica] = await Promise.all([
    getTournamentTeams(id),
    getTournamentMatches(id),
    getTournamentStandings(id),
  ]);
  res.json({ ...rows[0], squadre, partite, classifica });
});

// GET /api/tournaments/:id/matches - elenco partite del torneo
router.get('/tournaments/:id/matches', async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'id non valido' });
  const exists = await query('SELECT id FROM torneo WHERE id = ?', [id]);
  if (exists.length === 0) return res.status(404).json({ error: 'Torneo non trovato' });
  res.json(await getTournamentMatches(id));
});

// GET /api/tournaments/:id/standings - classifica del torneo
router.get('/tournaments/:id/standings', async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'id non valido' });
  const standings = await getTournamentStandings(id);
  if (standings === null) return res.status(404).json({ error: 'Torneo non trovato' });
  res.json(standings);
});

// POST /api/tournaments - crea un torneo
router.post('/tournaments', verifyToken, async (req, res) => {
  const nome = (req.body?.nome || '').trim();
  const sport = req.body?.sport;
  const maxTeams = Number(req.body?.max_teams);
  const startDate = req.body?.start_date; // 'YYYY-MM-DD HH:MM:SS'
  const minPlayer = req.body?.min_player != null ? Number(req.body.min_player) : 1;

  if (!nome || sport == null || !startDate) {
    return res.status(400).json({ error: 'nome, sport e start_date sono richiesti' });
  }
  if (!Number.isInteger(maxTeams) || maxTeams < 2) {
    return res.status(400).json({ error: 'max_teams deve essere un intero >= 2' });
  }
  if (!Number.isInteger(minPlayer) || minPlayer < 1) {
    return res.status(400).json({ error: 'min_player non valido' });
  }

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
    const r = await query(
      `INSERT INTO torneo (nome, sport_id, owner_id, max_teams, min_player, start_date)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [nome, sportId, req.user.id, maxTeams, minPlayer, startDate]
    );
    res.status(201).json({
      id: Number(r.insertId), nome, sport_id: sportId, owner_id: req.user.id,
      max_teams: maxTeams, min_player: minPlayer, start_date: startDate,
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Esiste già un torneo con questo nome' });
    }
    throw err;
  }
});

// PUT /api/tournaments/:id - modifica del torneo
router.put('/tournaments/:id', verifyToken, async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'id non valido' });
  const tor = await query('SELECT id, owner_id FROM torneo WHERE id = ?', [id]);
  const t = tor[0];
  if (!t) return res.status(404).json({ error: 'Torneo non trovato' });
  if (t.owner_id !== req.user.id) {
    return res.status(403).json({ error: 'Solo il creatore può modificare il torneo' });
  }

  // costruisco l'UPDATE solo con i campi presenti nel body
  const fields = [];
  const params = [];
  if (req.body?.nome != null) {
    const nome = String(req.body.nome).trim();
    if (!nome) return res.status(400).json({ error: 'nome non valido' });
    fields.push('nome = ?'); params.push(nome);
  }
  if (req.body?.max_teams != null) {
    const mt = Number(req.body.max_teams);
    if (!Number.isInteger(mt) || mt < 2) return res.status(400).json({ error: 'max_teams non valido' });
    fields.push('max_teams = ?'); params.push(mt);
  }
  if (req.body?.start_date != null) {
    fields.push('start_date = ?'); params.push(req.body.start_date);
  }
  if (req.body?.min_player != null) {
    const mp = Number(req.body.min_player);
    if (!Number.isInteger(mp) || mp < 1) return res.status(400).json({ error: 'min_player non valido' });
    fields.push('min_player = ?'); params.push(mp);
  }
  if (fields.length === 0) return res.status(400).json({ error: 'Nessun campo da aggiornare' });

  params.push(id);
  try {
    await query(`UPDATE torneo SET ${fields.join(', ')} WHERE id = ?`, params);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Nome torneo già in uso' });
    throw err;
  }
  const updated = await query(
    `SELECT t.id, t.nome, t.sport_id, sp.nome AS sport,
            t.owner_id, t.max_teams, t.min_player, t.start_date
       FROM torneo t JOIN sport sp ON t.sport_id = sp.id WHERE t.id = ?`,
    [id]
  );
  res.json(updated[0]);
});

// DELETE /api/tournaments/:id
router.delete('/tournaments/:id', verifyToken, async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'id non valido' });
  const tor = await query('SELECT id, owner_id FROM torneo WHERE id = ?', [id]);
  const t = tor[0];
  if (!t) return res.status(404).json({ error: 'Torneo non trovato' });
  if (t.owner_id !== req.user.id) {
    return res.status(403).json({ error: 'Solo il creatore può eliminare il torneo' });
  }
  // ordine per rispettare le foreign key; le squadre restano (possono essere condivise).
  await query('DELETE FROM partita WHERE torneo_id = ?', [id]);
  await query('DELETE FROM torneo_squadra WHERE torneo_id = ?', [id]);
  await query('DELETE FROM torneo WHERE id = ?', [id]);
  res.json({ deleted: id });
});

// POST /api/tournaments/:id/matches/generate - calendario all'italiana (single round-robin)
router.post('/tournaments/:id/matches/generate', verifyToken, async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'id non valido' });
  const tor = await query('SELECT id, owner_id, sport_id FROM torneo WHERE id = ?', [id]);
  const t = tor[0];
  if (!t) return res.status(404).json({ error: 'Torneo non trovato' });
  if (t.owner_id !== req.user.id) {
    return res.status(403).json({ error: 'Solo il creatore può generare il calendario' });
  }

  const already = await query('SELECT COUNT(*) AS n FROM partita WHERE torneo_id = ?', [id]);
  if (Number(already[0].n) > 0) {
    return res.status(409).json({ error: 'Calendario già generato per questo torneo' });
  }

  const teams = await query(
    'SELECT squadra_id FROM torneo_squadra WHERE torneo_id = ? ORDER BY squadra_id',
    [id]
  );
  if (teams.length < 2) {
    return res.status(400).json({ error: 'Servono almeno 2 squadre per generare il calendario' });
  }

  // ogni coppia di squadre si affronta una volta
  const ids = teams.map((r) => r.squadra_id);
  const tuples = [];
  const params = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      tuples.push('(?, ?, ?, ?, ?)');
      params.push(req.user.id, t.sport_id, id, ids[i], ids[j]);
    }
  }
  await query(
    `INSERT INTO partita (owner_id, sport_id, torneo_id, squadra1_id, squadra2_id)
     VALUES ${tuples.join(', ')}`,
    params
  );
  res.status(201).json(await getTournamentMatches(id));
});

// PUT /api/matches/:id/result - il creatore del torneo inserisce il risultato finale
router.put('/matches/:id/result', verifyToken, async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'id non valido' });
  const r1 = Number(req.body?.risultato_squadra1);
  const r2 = Number(req.body?.risultato_squadra2);
  if (!Number.isInteger(r1) || !Number.isInteger(r2) || r1 < 0 || r2 < 0) {
    return res.status(400).json({ error: 'Risultati non validi (interi >= 0)' });
  }

  const rows = await query(
    `SELECT p.id, t.owner_id,
            DATE_FORMAT(pr.data, '%Y-%m-%d') AS data, pr.ora_inizio
       FROM partita p
       LEFT JOIN torneo t ON p.torneo_id = t.id
       LEFT JOIN prenotazione pr ON p.prenotazione_id = pr.id
      WHERE p.id = ?`,
    [id]
  );
  const m = rows[0];
  if (!m) return res.status(404).json({ error: 'Partita non trovata' });
  if (m.owner_id == null || m.owner_id !== req.user.id) {
    return res.status(403).json({ error: 'Solo il creatore del torneo può inserire il risultato' });
  }
  // se la partita ha una data/ora prenotata, il risultato si inserisce solo dopo che è passata
  if (m.data && m.ora_inizio && new Date(`${m.data}T${m.ora_inizio}`) > new Date()) {
    return res.status(400).json({ error: 'Il risultato si può inserire solo dopo la data della partita' });
  }

  await query(
    'UPDATE partita SET risultato_squadra1 = ?, risultato_squadra2 = ? WHERE id = ?',
    [r1, r2, id]
  );
  res.json({ id, risultato_squadra1: r1, risultato_squadra2: r2, stato: 'giocata' });
});

router.put('/matches/:id/reserv', verifyToken, async (req, res) => {
  const matchId = Number(req.params.id);
  const reservId = Number(req.body.reserv_id);
  if (Number.isNaN(matchId)) return res.status(400).json({ error: 'id non valido' });

  // la persona a cui appartiene il torneo che ha questa partita sei tu?
  const rows = await query(
    `SELECT p.id, t.owner_id,
            DATE_FORMAT(pr.data, '%Y-%m-%d') AS data, pr.ora_inizio
       FROM partita p
       LEFT JOIN torneo t ON p.torneo_id = t.id
       LEFT JOIN prenotazione pr ON p.prenotazione_id = pr.id
      WHERE p.id = ?`,
    [matchId]
  );
  const m = rows[0];
  if (!m) return res.status(404).json({ error: 'Partita non trovata' });
  if (m.owner_id == null || m.owner_id !== req.user.id) {
    return res.status(403).json({ error: 'Solo il creatore del torneo può cambiare la prenotazione' });
  }
  // il proprietario della prenotazione sei tu?
  const good = await query(
    `SELECT p.utente_id, u.name FROM prenotazione p
      JOIN utente u ON u.id = p.utente_id
      WHERE p.id = ?`,
    [reservId]
  );
  const r = good[0];
  if (!r) return res.status(404).json({ error: 'Prenotazione non trovata' });
  if (r.utente_id == null || r.utente_id !== req.user.id) {
    return res.status(403).json({ error: 'Solo il creatore della prenotazione può assegnarla a una partita' });
  }

  await query(
    'UPDATE partita SET prenotazione_id = ? WHERE id = ?',
    [reservId, matchId]
  );
  res.json({ partita : matchId, prenotazione : reservId });
});

router.get('/matches/:id/reserv', verifyToken, async (req,res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'id non valido' });
  const res_id = await query('SELECT prenotazione_id FROM partita WHERE id = ?', [id]);
  if (res_id.length === 0) return res.status(404).json({ error: 'Partita non trovata' });
  res.json({reserv_id : res_id});
});

export default router;


