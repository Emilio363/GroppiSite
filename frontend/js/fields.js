// Pagina elenco campi: ricerca testuale (lato server, ?q=) + filtro sport (lato client).
import { apiGet } from './api.js';
import { initLayout, escapeHtml } from './layout.js';

const listEl = document.getElementById('list');
const messageEl = document.getElementById('message');
const searchEl = document.getElementById('search');
const sportEl = document.getElementById('sport-filter');

let master = []; // ultimo risultato dal server, su cui applico il filtro sport

function showMessage(html) { messageEl.innerHTML = html; }

function render(fields) {
  if (fields.length === 0) {
    listEl.innerHTML = '<p class="empty">Nessun campo trovato.</p>';
    return;
  }
  listEl.innerHTML = fields
    .map(
      (f) => `
      <article class="card">
        <h3>${escapeHtml(f.nome)}</h3>
        <span class="badge">${escapeHtml(f.sport)}</span>
        <p class="muted">${escapeHtml(f.indirizzo || 'Indirizzo non disponibile')}</p>
        <a class="btn secondary" href="field.html?id=${f.id}">Dettagli e prenota</a>
      </article>`
    )
    .join('');
}

// popola il select degli sport con i valori distinti presenti nei campi caricati
function fillSportFilter(fields) {
  const sports = [...new Set(fields.map((f) => f.sport))].sort();
  const current = sportEl.value;
  sportEl.innerHTML =
    '<option value="">Tutti gli sport</option>' +
    sports.map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
  if (sports.includes(current)) sportEl.value = current;
}

function applySportFilter() {
  const sport = sportEl.value;
  render(sport ? master.filter((f) => f.sport === sport) : master);
}

async function load(q) {
  try {
    showMessage('');
    master = await apiGet(`/fields${q ? `?q=${encodeURIComponent(q)}` : ''}`);
    fillSportFilter(master);
    applySportFilter();
  } catch (err) {
    showMessage(`<div class="alert error">${escapeHtml(err.message)}</div>`);
  }
}

// debounce sulla ricerca per non chiamare il server a ogni tasto
let timer;
searchEl.addEventListener('input', () => {
  clearTimeout(timer);
  timer = setTimeout(() => load(searchEl.value.trim()), 250);
});
sportEl.addEventListener('change', applySportFilter);

initLayout('campi');
load('');
