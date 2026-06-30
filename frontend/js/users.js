import { apiGet } from './api.js';
import { initLayout, escapeHtml } from './layout.js';

const listEl = document.getElementById('list');
const messageEl = document.getElementById('message');
const searchEl = document.getElementById('search');

function showMessage(html) { messageEl.innerHTML = html; }
function showError(msg) { showMessage(`<div class="alert error">${escapeHtml(msg)}</div>`); }

// start_date arriva come DATETIME (ISO): mostro solo la data in formato locale.
function formatDate(value) {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('it-IT', { dateStyle: 'medium' });
}

function tourneyList(tornei) {
  if (!tornei || tornei.length === 0) return '<p class="muted">Nessun torneo creato.</p>';
  return `<ul>${tornei
    .map((t) => {
      const when = formatDate(t.start_date);
      return `<li><a href="tournament.html?id=${t.id}">${escapeHtml(t.nome)}</a>${when ? ` <span class="muted">(${escapeHtml(when)})</span>` : ''}</li>`;
    })
    .join('')}</ul>`;
}

function render(users) {
  if (users.length === 0) {
    listEl.innerHTML = '<p class="empty">Nessun utente trovato.</p>';
    return;
  }
  listEl.innerHTML = users
    .map(
      (u) => `
      <article class="card">
        <h3>${escapeHtml(u.name)} ${escapeHtml(u.surname)}</h3>
        <p class="muted">@${escapeHtml(u.username)}</p>
        <p class="muted" style="margin-bottom:0.25rem;">Tornei creati:</p>
        ${tourneyList(u.tornei)}
      </article>`
    )
    .join('');
}

async function load(q) {
  try {
    showMessage('');
    const users = await apiGet(`/users${q ? `?q=${encodeURIComponent(q)}` : ''}`);
    render(users);
  } catch (err) {
    showError(err.message);
  }
}

// debounce sulla ricerca per non chiamare il server a ogni tasto
let timer;
searchEl.addEventListener('input', () => {
  clearTimeout(timer);
  timer = setTimeout(() => load(searchEl.value.trim()), 250);
});

initLayout('utenti');
load('');
