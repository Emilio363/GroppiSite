// Pagina dettaglio + gestione di un torneo.
// Legge ?id=, mostra info + classifica + partite + squadre (da GET /tournaments/:id).
// Le azioni di gestione (modifica/elimina, genera calendario, aggiungi squadra/giocatore,
// inserisci risultato) sono mostrate solo al creatore (getUser().id === data.owner_id).
import { apiGet, apiPost, apiPut, apiDelete } from './api.js';
import { initLayout, getUser, onAuthChange, escapeHtml } from './layout.js';

const messageEl = document.getElementById('message');
const infoEl = document.getElementById('info');
const editPanelEl = document.getElementById('edit-panel');
const contentEl = document.getElementById('content');
const standingsEl = document.getElementById('standings');
const matchesEl = document.getElementById('matches');
const addTeamEl = document.getElementById('add-team');
const teamsEl = document.getElementById('teams');

const id = Number(new URLSearchParams(location.search).get('id'));

let data = null;        // dettaglio torneo corrente
let allTeams = [];      // tutte le squadre (per associare squadre esistenti) — solo owner
let allPlayers = [];    // tutti i giocatori (per associare giocatori esistenti) — solo owner

// ---- utility ----
const hhmm = (t) => String(t).slice(0, 5);
function showMessage(html) { messageEl.innerHTML = html; }
function showError(msg) { showMessage(`<div class="alert error">${escapeHtml(msg)}</div>`); }
function showOk(msg) { showMessage(`<div class="alert ok">${escapeHtml(msg)}</div>`); }
function isOwner() { const u = getUser(); return !!u && data && u.id === data.owner_id; }

function formatDateTime(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? String(value)
    : d.toLocaleString('it-IT', { dateStyle: 'medium', timeStyle: 'short' });
}

// data.start_date -> valore per <input type="datetime-local"> ('YYYY-MM-DDTHH:MM')
function toLocalInput(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// orario di una partita (se ha una prenotazione collegata) oppure null
function matchSchedule(m) {
  if (!m.giorno) return null;
  const day = formatDateTime(m.giorno).split(',')[0]; // solo la data
  const ora = m.ora_inizio ? ` ${hhmm(m.ora_inizio)}–${hhmm(m.ora_fine)}` : '';
  const campo = m.campo ? ` · ${m.campo}` : '';
  return `${day}${ora}${campo}`;
}

// ---- caricamento ----
async function reload() {
  try {
    data = await apiGet(`/tournaments/${id}`);
    document.title = `GroppiSite — ${data.nome}`;
    contentEl.hidden = false;
    if (isOwner()) {
      // servono solo al creatore per popolare i select "associa esistente"
      [allTeams, allPlayers] = await Promise.all([apiGet('/teams'), apiGet('/players')]);
    }
    renderAll();
  } catch (err) {
    showError(err.message);
  }
}

function renderAll() {
  renderInfo();
  renderStandings();
  renderMatches();
  renderAddTeam();
  renderTeams();
}

// ---- intestazione + azioni torneo ----
function renderInfo() {
  const owner = isOwner();
  const start = formatDateTime(data.start_date) || '—';
  const actions = owner
    ? `<div class="toolbar" style="margin-top:0.5rem;">
         <button class="btn secondary" id="btn-edit">Modifica</button>
         <button class="btn danger" id="btn-delete">Elimina</button>
         ${data.partite.length === 0 ? '<button class="btn" id="btn-generate">Genera calendario</button>' : ''}
       </div>`
    : '';
  infoEl.innerHTML = `
    <h1>${escapeHtml(data.nome)} <span class="badge">${escapeHtml(data.sport)}</span></h1>
    <p class="muted">Inizio: ${escapeHtml(start)} · Squadre max: ${escapeHtml(String(data.max_teams))}
       · Min. giocatori: ${escapeHtml(String(data.min_player))} · Creato da ${escapeHtml(data.owner)}</p>
    ${actions}`;

  if (owner) {
    document.getElementById('btn-edit').addEventListener('click', toggleEditPanel);
    document.getElementById('btn-delete').addEventListener('click', onDelete);
    const gen = document.getElementById('btn-generate');
    if (gen) gen.addEventListener('click', onGenerate);
  } else {
    editPanelEl.hidden = true;
    editPanelEl.innerHTML = '';
  }
}

function toggleEditPanel() {
  if (!editPanelEl.hidden) { editPanelEl.hidden = true; editPanelEl.innerHTML = ''; return; }
  editPanelEl.innerHTML = `
    <form id="form-edit" class="card" style="max-width:480px;">
      <h3 style="margin-top:0;">Modifica torneo</h3>
      <div class="field"><label for="e-nome">Nome</label>
        <input id="e-nome" name="nome" value="${escapeHtml(data.nome)}" required></div>
      <div class="field"><label for="e-max">Numero massimo di squadre</label>
        <input id="e-max" name="max_teams" type="number" min="2" value="${escapeHtml(String(data.max_teams))}" required></div>
      <div class="field"><label for="e-min">Giocatori minimi per squadra</label>
        <input id="e-min" name="min_player" type="number" min="1" value="${escapeHtml(String(data.min_player))}" required></div>
      <div class="field"><label for="e-start">Data e ora di inizio</label>
        <input id="e-start" name="start_date" type="datetime-local" value="${toLocalInput(data.start_date)}" required></div>
      <button class="btn" type="submit">Salva modifiche</button>
    </form>`;
  editPanelEl.hidden = false;
  editPanelEl.querySelector('#form-edit').addEventListener('submit', onEdit);
}

async function onEdit(e) {
  e.preventDefault();
  const f = e.target;
  const start = f.start_date.value;
  try {
    await apiPut(`/tournaments/${id}`, {
      nome: f.nome.value.trim(),
      max_teams: Number(f.max_teams.value),
      min_player: Number(f.min_player.value),
      start_date: `${start.replace('T', ' ')}:00`,
    });
    showOk('Torneo aggiornato.');
    editPanelEl.hidden = true; editPanelEl.innerHTML = '';
    await reload();
  } catch (err) { showError(err.message); }
}

async function onDelete() {
  if (!confirm(`Eliminare il torneo "${data.nome}"? L'operazione è irreversibile.`)) return;
  try {
    await apiDelete(`/tournaments/${id}`);
    location.href = 'tournaments.html';
  } catch (err) { showError(err.message); }
}

async function onGenerate() {
  if (!confirm('Generare il calendario (girone all\'italiana)? Non sarà più modificabile.')) return;
  try {
    await apiPost(`/tournaments/${id}/matches/generate`);
    showOk('Calendario generato.');
    await reload();
  } catch (err) { showError(err.message); }
}

// ---- classifica ----
function renderStandings() {
  const rows = data.classifica || [];
  if (rows.length === 0) {
    standingsEl.innerHTML = '<p class="empty">Nessuna squadra in classifica.</p>';
    return;
  }
  standingsEl.innerHTML = `
    <table>
      <thead><tr>
        <th>#</th><th>Squadra</th><th>Pt</th><th>G</th><th>V</th><th>N</th><th>P</th>
        <th>Fatti</th><th>Subiti</th><th>Diff</th>
      </tr></thead>
      <tbody>${rows
        .map((r, i) => `<tr>
          <td>${i + 1}</td><td>${escapeHtml(r.nome)}</td><td><strong>${r.punti}</strong></td>
          <td>${r.giocate}</td><td>${r.vinte}</td><td>${r.pareggiate}</td><td>${r.perse}</td>
          <td>${r.fatti}</td><td>${r.subiti}</td><td>${r.differenza}</td>
        </tr>`)
        .join('')}</tbody>
    </table>`;
}

// ---- partite ----
async function renderMatches() {
  const partite = data.partite || [];
  if (partite.length === 0) {
    matchesEl.innerHTML = '<p class="empty">Calendario non ancora generato.</p>';
    return;
  }
  const owner = isOwner();
  matchesEl.innerHTML = `<table><thead><tr>
      <th>Partita</th><th>Quando</th><th>Risultato</th>${owner ? '<th></th>' : ''}
    </tr></thead><tbody>${(await Promise.all(partite
      .map( async (m) => {
        const ris = m.stato === 'giocata'
          ? `<strong>${m.risultato_squadra1} - ${m.risultato_squadra2}</strong>`
          : '<span class="muted">—</span>';
        let action = '';
        let reserv = '';
        if (owner && m.stato !== 'giocata'){
          const dati = await apiGet(`/users/${getUser().id}`);
          const precReserv = m.prenotazione_id; 
          console.log(dati);
          reserv = `
          <form class="reserv-form" data-match="${m.id}" style="display:flex; gap:0.3rem; align-items:center;">
            <select name="prenotazione" ${dati.prenotazioni.length ? '' : 'disabled'}>
            <option value = "default" ${precReserv ? '' : 'selected'} disabled>da definire</option>
            ${
              dati.prenotazioni.map(
                (pre) => {
                  // `<option value = "${pre.id}">ciao</option>`
                  return `<option value = "${pre.id}" ${precReserv == pre.id ? 'selected' : ''}>${pre.nome} - 
                  ${formatDateTime(pre.data).slice(0,-7)} (${pre.ora_inizio.slice(0,-3)} - ${pre.ora_fine.slice(0,-3)})</option>`
                }
              ).join('')}
              </select>
              <button class="btn" type="submit">Salva</button>
            </form>`;
        }
        else{
          reserv = matchSchedule(m) || '<span class="muted">da definire</span>';
        }
        if (owner) {
          action = m.stato === 'giocata'
            ? '<span class="muted">giocata</span>'
            : `<form class="result-form" data-match="${m.id}" style="display:flex; gap:0.3rem; align-items:center;">
                 <input name="r1" type="number" min="0" style="width:4rem;" required>
                 <span>–</span>
                 <input name="r2" type="number" min="0" style="width:4rem;" required>
                 <button class="btn" type="submit">Salva</button>
               </form>`;
        }
        return `<tr>
          <td>${escapeHtml(m.squadra1)} <span class="muted">vs</span> ${escapeHtml(m.squadra2)}</td>
          <td>${reserv}</td><td>${ris}</td>${owner ? `<td>${action}</td>` : ''}
        </tr>`;
      }))).join('')}</tbody></table>`;

  if (owner) {
    matchesEl.querySelectorAll('.result-form').forEach((form) =>
      form.addEventListener('submit', onResult)
    );
    matchesEl.querySelectorAll('.reserv-form').forEach((form) =>
      form.addEventListener('submit', onReserv)
    );
  }
}

async function onReserv(e) {
  e.preventDefault();
  const f = e.target;
  const matchId = f.dataset.match;
  if (f.prenotazione.value == 'default') return;

  try {
    await apiPut(`/matches/${matchId}/reserv`, {
      reserv_id: f.prenotazione.value,
    });
    showOk('Risultato salvato.');
    await reload();
  } catch (err) { showError(err.message); }
}

async function onResult(e) {
  e.preventDefault();
  const f = e.target;
  const matchId = f.dataset.match;
  try {
    await apiPut(`/matches/${matchId}/result`, {
      risultato_squadra1: Number(f.r1.value),
      risultato_squadra2: Number(f.r2.value),
    });
    showOk('Risultato salvato.');
    await reload();
  } catch (err) { showError(err.message); }
}

// ---- aggiungi squadra (owner) ----
function renderAddTeam() {
  if (!isOwner()) { addTeamEl.innerHTML = ''; return; }
  const enrolled = new Set(data.squadre.map((s) => s.nome));
  // squadre dello stesso sport del torneo non ancora iscritte
  const available = allTeams.filter((t) => t.sport === data.sport && !enrolled.has(t.nome));
  const options = available
    .map((t) => `<option value="${escapeHtml(t.nome)}">${escapeHtml(t.nome)}</option>`)
    .join('');
  const full = data.squadre.length >= data.max_teams;

  addTeamEl.innerHTML = full
    ? '<p class="muted">Numero massimo di squadre raggiunto.</p>'
    : `<div class="card" style="max-width:520px;">
         <h3 style="margin-top:0;">Aggiungi una squadra</h3>
         <form id="form-assoc-team" style="display:flex; gap:0.5rem; align-items:end; flex-wrap:wrap;">
           <div class="field" style="margin:0; flex:1; min-width:180px;">
             <label>Squadra esistente (${escapeHtml(data.sport)})</label>
             <select name="nome" ${available.length ? '' : 'disabled'}>${options}</select>
           </div>
           <button class="btn" type="submit" ${available.length ? '' : 'disabled'}>Associa</button>
         </form>
         <p class="muted" style="margin:0.6rem 0;">oppure crea una nuova squadra:</p>
         <form id="form-new-team" style="display:flex; gap:0.5rem; align-items:end; flex-wrap:wrap;">
           <div class="field" style="margin:0; flex:1; min-width:180px;">
             <label>Nome nuova squadra</label>
             <input name="nome" required>
           </div>
           <button class="btn" type="submit">Crea e aggiungi</button>
         </form>
       </div>`;

  const assoc = document.getElementById('form-assoc-team');
  if (assoc) assoc.addEventListener('submit', onAssociateTeam);
  const create = document.getElementById('form-new-team');
  if (create) create.addEventListener('submit', onCreateTeam);
}

async function onAssociateTeam(e) {
  e.preventDefault();
  const nome = e.target.nome.value;
  if (!nome) return;
  try {
    await apiPost(`/tournaments/${id}/teams`, { nome });
    showOk('Squadra associata al torneo.');
    await reload();
  } catch (err) { showError(err.message); }
}

async function onCreateTeam(e) {
  e.preventDefault();
  const nome = e.target.nome.value.trim();
  if (!nome) return;
  try {
    // 1) crea la squadra (stesso sport del torneo); se esiste già va bene lo stesso
    try {
      await apiPost('/teams', { nome, sport: data.sport });
    } catch (err) {
      if (err.status !== 409) throw err; // 409 = esiste già: proseguo ad associarla
    }
    // 2) associala al torneo
    await apiPost(`/tournaments/${id}/teams`, { nome });
    showOk('Squadra creata e aggiunta al torneo.');
    await reload();
  } catch (err) { showError(err.message); }
}

// ---- squadre + giocatori ----
function renderTeams() {
  const squadre = data.squadre || [];
  const owner = isOwner();
  if (squadre.length === 0) {
    teamsEl.innerHTML = '<p class="empty">Nessuna squadra iscritta.</p>';
    return;
  }
  teamsEl.innerHTML = squadre
    .map((s) => {
      const giocatori = s.giocatori.length
        ? `<ul>${s.giocatori
            .map((g) => `<li>${escapeHtml(g.surname)} ${escapeHtml(g.name)}${g.numero != null ? ` <span class="muted">#${g.numero}</span>` : ''}</li>`)
            .join('')}</ul>`
        : '<p class="muted">Nessun giocatore.</p>';
      const addPlayer = owner
        ? `<button class="btn secondary" data-add-player="${s.id}">Aggiungi giocatore</button>
           <div class="player-panel" data-panel="${s.id}" hidden></div>`
        : '';
      return `<article class="card">
        <h3>${escapeHtml(s.nome)}</h3>
        ${giocatori}
        ${addPlayer}
      </article>`;
    })
    .join('');

  if (owner) {
    teamsEl.querySelectorAll('[data-add-player]').forEach((btn) =>
      btn.addEventListener('click', () => togglePlayerPanel(Number(btn.dataset.addPlayer)))
    );
  }
}

function togglePlayerPanel(teamId) {
  const panel = teamsEl.querySelector(`[data-panel="${teamId}"]`);
  if (!panel) return;
  if (!panel.hidden) { panel.hidden = true; panel.innerHTML = ''; return; }

  // giocatori già nella squadra, per non riproporli nel select
  const team = data.squadre.find((s) => s.id === teamId);
  const inTeam = new Set(team.giocatori.map((g) => g.id));
  const available = allPlayers.filter((p) => !inTeam.has(p.id));
  const options = available
    .map((p) => `<option value="${p.id}">${escapeHtml(p.surname)} ${escapeHtml(p.name)}${p.numero != null ? ` (#${p.numero})` : ''}</option>`)
    .join('');

  panel.innerHTML = `
    <form class="assoc-player" data-team="${teamId}" style="display:flex; gap:0.4rem; align-items:end; flex-wrap:wrap; margin-top:0.6rem;">
      <div class="field" style="margin:0; flex:1; min-width:160px;">
        <label>Giocatore esistente</label>
        <select name="giocatore_id" ${available.length ? '' : 'disabled'}>${options}</select>
      </div>
      <button class="btn" type="submit" ${available.length ? '' : 'disabled'}>Associa</button>
    </form>
    <p class="muted" style="margin:0.5rem 0 0.3rem;">oppure crea un nuovo giocatore:</p>
    <form class="new-player" data-team="${teamId}" style="display:flex; gap:0.4rem; align-items:end; flex-wrap:wrap;">
      <div class="field" style="margin:0;"><label>Nome</label><input name="name" required style="width:8rem;"></div>
      <div class="field" style="margin:0;"><label>Cognome</label><input name="surname" required style="width:8rem;"></div>
      <div class="field" style="margin:0;"><label>Numero</label><input name="numero" type="number" min="0" style="width:5rem;"></div>
      <button class="btn" type="submit">Crea e aggiungi</button>
    </form>`;
  panel.hidden = false;
  panel.querySelector('.assoc-player').addEventListener('submit', onAssociatePlayer);
  panel.querySelector('.new-player').addEventListener('submit', onCreatePlayer);
}

async function onAssociatePlayer(e) {
  e.preventDefault();
  const teamId = e.target.dataset.team;
  const giocatoreId = Number(e.target.giocatore_id.value);
  if (!giocatoreId) return;
  try {
    await apiPost(`/teams/${teamId}/players`, { giocatore_id: giocatoreId });
    showOk('Giocatore associato.');
    await reload();
  } catch (err) { showError(err.message); }
}

async function onCreatePlayer(e) {
  e.preventDefault();
  const f = e.target;
  const teamId = f.dataset.team;
  // attenzione: f.name su un form è l'attributo name DEL FORM, non l'input "name":
  // accedo ai controlli via f.elements.
  const els = f.elements;
  const body = { name: els.name.value.trim(), surname: els.surname.value.trim() };
  if (els.numero.value !== '') body.numero = Number(els.numero.value);
  try {
    const created = await apiPost('/players', body);
    await apiPost(`/teams/${teamId}/players`, { giocatore_id: created.id });
    showOk('Giocatore creato e aggiunto.');
    await reload();
  } catch (err) { showError(err.message); }
}

// ---- avvio ----
onAuthChange(() => { if (data) reload(); }); // login/logout: rivaluta i permessi e ricarica
initLayout('tornei');

if (!id || Number.isNaN(id)) {
  showError('Torneo non specificato o non valido.');
} else {
  reload();
}
