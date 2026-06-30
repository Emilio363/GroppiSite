import { apiGet, apiPost } from './api.js';
import { initLayout, getUser, onAuthChange, escapeHtml } from './layout.js';

const listEl = document.getElementById('list');
const messageEl = document.getElementById('message');
const searchEl = document.getElementById('search');
const createActionEl = document.getElementById('create-action');
const createPanelEl = document.getElementById('create-panel');

let master = [];                 // ultimo risultato dal server
const sportSet = new Set();      // sport noti, per popolare il select del form

function showMessage(html) { messageEl.innerHTML = html; }
function showError(msg) { showMessage(`<div class="alert error">${escapeHtml(msg)}</div>`); }
function showOk(msg) { showMessage(`<div class="alert ok">${escapeHtml(msg)}</div>`); }

// 'active' | 'completed'
const STATO = {
  active: { label: 'In corso', cls: 'badge' },
  completed: { label: 'Completato', cls: 'badge' },
};

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? String(value)
    : d.toLocaleString('it-IT', { dateStyle: 'medium', timeStyle: 'short' });
}

function render(tornei) {
  if (tornei.length === 0) {
    listEl.innerHTML = '<p class="empty">Nessun torneo trovato.</p>';
    return;
  }
  listEl.innerHTML = tornei
    .map((t) => {
      const st = STATO[t.stato] || { label: t.stato, cls: 'badge' };
      return `
      <article class="card">
        <h3>${escapeHtml(t.nome)}</h3>
        <span class="badge">${escapeHtml(t.sport)}</span>
        <span class="${st.cls}">${st.label}</span>
        <p class="muted">Inizio: ${escapeHtml(formatDate(t.start_date))}</p>
        <p class="muted">Squadre max: ${escapeHtml(String(t.max_teams))} · Min. giocatori: ${escapeHtml(String(t.min_player))}</p>
        <p class="muted">Creato da ${escapeHtml(t.owner)}</p>
        <a class="btn secondary" href="tournament.html?id=${t.id}">Dettagli</a>
      </article>`;
    })
    .join('');
}

// raccoglie gli sport visti nei tornei caricati (uniti a quelli dei campi)
function collectSports(tornei) {
  tornei.forEach((t) => { if (t.sport) sportSet.add(t.sport); });
}

async function load(q) {
  try {
    showMessage('');
    master = await apiGet(`/tournaments${q ? `?q=${encodeURIComponent(q)}` : ''}`);
    collectSports(master);
    render(master);
  } catch (err) {
    showError(err.message);
  }
}

async function seedSportsFromFields() {
  try {
    const fields = await apiGet('/fields');
    fields.forEach((f) => { if (f.sport) sportSet.add(f.sport); });
  } catch {
    /* non bloccante: se fallisce, gli sport vengono comunque dai tornei */
  }
}

function renderCreateAction() {
  if (!getUser()) {
    createActionEl.innerHTML = '';
    createPanelEl.hidden = true;
    createPanelEl.innerHTML = '';
    return;
  }
  createActionEl.innerHTML = '<button class="btn" id="btn-create">Crea torneo</button>';
  document.getElementById('btn-create').addEventListener('click', toggleCreatePanel);
}

function toggleCreatePanel() {
  if (!createPanelEl.hidden) {
    createPanelEl.hidden = true;
    createPanelEl.innerHTML = '';
    return;
  }
  const sports = [...sportSet].sort();
  const options = sports.length
    ? sports.map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('')
    : '';
  createPanelEl.innerHTML = `
    <form id="form-create" class="card" style="max-width:480px;">
      <h3 style="margin-top:0;">Nuovo torneo</h3>
      <div class="field">
        <label for="t-nome">Nome</label>
        <input id="t-nome" name="nome" required>
      </div>
      <div class="field">
        <label for="t-sport">Sport</label>
        <select id="t-sport" name="sport" required>${options}</select>
      </div>
      <div class="field">
        <label for="t-max">Numero massimo di squadre</label>
        <input id="t-max" name="max_teams" type="number" min="2" value="4" required>
      </div>
      <div class="field">
        <label for="t-min">Giocatori minimi per squadra</label>
        <input id="t-min" name="min_player" type="number" min="1" value="1">
      </div>
      <div class="field">
        <label for="t-start">Data e ora di inizio</label>
        <input id="t-start" name="start_date" type="datetime-local" required>
      </div>
      <button class="btn" type="submit">Crea torneo</button>
    </form>`;
  createPanelEl.hidden = false;
  createPanelEl.querySelector('#form-create').addEventListener('submit', onCreate);
}

async function onCreate(e) {
  e.preventDefault();
  const form = e.target;
  const start = form.start_date.value; // 'YYYY-MM-DDTHH:MM'
  if (!start) return showError('Inserisci data e ora di inizio.');
  const body = {
    nome: form.nome.value.trim(),
    sport: form.sport.value,
    max_teams: Number(form.max_teams.value),
    min_player: Number(form.min_player.value || 1),
    start_date: `${start.replace('T', ' ')}:00`, // -> 'YYYY-MM-DD HH:MM:SS'
  };
  try {
    const created = await apiPost('/tournaments', body);
    showOk(`Torneo "${created.nome}" creato.`);
    createPanelEl.hidden = true;
    createPanelEl.innerHTML = '';
    await load(searchEl.value.trim());
  } catch (err) {
    showError(err.message);
  }
}

let timer;
searchEl.addEventListener('input', () => {
  clearTimeout(timer);
  timer = setTimeout(() => load(searchEl.value.trim()), 250);
});

onAuthChange(renderCreateAction);

initLayout('tornei');
renderCreateAction();
seedSportsFromFields();
load('');
