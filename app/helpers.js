const APERTURA = '09:00:00';
const CHIUSURA = '22:00:00';

// Ricerca case-insensitive di q in più colonne.
function whereCreate(columns, q) {
  if (!q) return { sql: '', params: [] };
  const sql = ' WHERE (' + columns.map((c) => `${c} LIKE CONCAT('%', ?, '%')`).join(' OR ') + ')';
  return { sql, params: columns.map(() => q) };
}

// Normalizza un orario in "HH:MM:SS"
function normalizeTime(value) {
  if (typeof value !== 'string') return null;
  const m = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/.exec(value);
  // in m[0] c'è tutta la stringa, negli altri i capture group (ore, minuti, secondi opzionali)
  if (!m) return null;
  return `${m[1]}:${m[2]}:${m[3] || '00'}`;
}

// Valida l'intervallo orario from/to (presi da req.body o req.query).
// Ritorna { from, to } normalizzati se presenti e validi, altrimenti { error } col messaggio.
function parseInterval(rawFrom, rawTo) {
  const from = normalizeTime(rawFrom);
  const to = normalizeTime(rawTo);
  if (!from || !to) return { error: 'Parametri from/to (HH:MM) non validi' };
  if (from >= to) return { error: "L'ora di fine deve essere successiva all'inizio" };
  if (from < APERTURA || to > CHIUSURA) {
    return { error: `Orario fuori dalla finestra di apertura (${APERTURA}–${CHIUSURA})` };
  }
  return { from, to };
}

// prenotazione accettabile
function findOverlaps(prenotazioni, from, to) {
  return prenotazioni.filter((p) => p.ora_inizio < to && p.ora_fine > from);
}

export { APERTURA, CHIUSURA, whereCreate, normalizeTime, parseInterval, findOverlaps };
