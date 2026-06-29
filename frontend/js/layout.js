// Header/nav condiviso + gestione sessione (login/signup/logout) tramite una modale.
// Ogni pagina mette <header id="site-header"></header> e chiama initLayout('chiave-nav').
// Espone getUser() per sapere chi è loggato e onAuthChange() per reagire ai cambi di stato.

import { apiGet, apiPost } from './api.js';

const NAV = [
  { key: 'campi', label: 'Campi', href: 'index.html' },
  { key: 'tornei', label: 'Tornei', href: 'tournaments.html' },
  { key: 'utenti', label: 'Utenti', href: 'users.html' },
  // { key: 'squadre', label: 'Squadre', href: 'teams.html' },
];

let currentUser = null;            // null = non loggato
const listeners = []; 

function getUser() { return currentUser; }
function onAuthChange(cb) { listeners.push(cb); }
function notify() { listeners.forEach((cb) => cb(currentUser)); }

// chiede al backend chi è l'utente corrente (200 se loggato, 401 altrimenti)
async function refreshUser() {
  try {
    currentUser = await apiGet('/whoami');
  } catch {
    currentUser = null;
  }
  return currentUser;
}

// creatore dello header
function renderHeader(activeKey) {
  const header = document.getElementById('site-header');
  if (!header) return;
  header.className = 'site-header';
  const links = NAV.map(
    (n) => `<a href="${n.href}" class="${n.key === activeKey ? 'active' : ''}">${n.label}</a>`
  ).join('');

  const auth = currentUser
    ? `<span class="user">Ciao, <strong>${escapeHtml(currentUser.name)}</strong></span>
       <button class="btn secondary" id="btn-logout">Esci</button>`
    : `<button class="btn" id="btn-login">Accedi</button>`;

  header.innerHTML = `
    <div class="bar">
      <span class="brand">🏟️ GroppiSite</span>
      <nav>${links}</nav>
      <div class="auth">${auth}</div>
    </div>`;

  if (currentUser) {
    document.getElementById('btn-logout').addEventListener('click', doLogout);
  } else {
    document.getElementById('btn-login').addEventListener('click', openAuthModal);
  }
}

async function doLogout() {
  await apiPost('/auth/logout');
  await refreshUser();
  renderHeader(document.body.dataset.nav);
  notify();
}

// ---- modale login/signup ----
function openAuthModal() {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal">
      <button class="close" aria-label="Chiudi">&times;</button>
      <div class="tabs">
        <button data-tab="login" class="active">Accedi</button>
        <button data-tab="signup">Registrati</button>
      </div>
      <div class="auth-error alert error" hidden></div>

      <form id="form-login">
        <div class="field"><label>Username</label><input name="username" required></div>
        <div class="field"><label>Password</label><input name="password" type="password" required></div>
        <button class="btn" type="submit" style="width:100%">Accedi</button>
      </form>

      <form id="form-signup" hidden>
        <div class="field"><label>Username</label><input name="username" required></div>
        <div class="field"><label>Nome</label><input name="name" required></div>
        <div class="field"><label>Cognome</label><input name="surname" required></div>
        <div class="field"><label>Password</label><input name="password" type="password" required></div>
        <button class="btn" type="submit" style="width:100%">Registrati</button>
      </form>
    </div>`;
  document.body.appendChild(backdrop);

  const close = () => backdrop.remove();
  backdrop.querySelector('.close').addEventListener('click', close);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
  document.body.addEventListener('keydown', (e) => {if (e.key == "Escape") close(); });

  const errBox = backdrop.querySelector('.auth-error');
  const showErr = (msg) => { errBox.textContent = msg; errBox.hidden = false; };

  const formLogin = backdrop.querySelector('#form-login');
  const formSignup = backdrop.querySelector('#form-signup');
  backdrop.querySelectorAll('.tabs button').forEach((tab) => {
    tab.addEventListener('click', () => {
      backdrop.querySelectorAll('.tabs button').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      const isLogin = tab.dataset.tab === 'login';
      formLogin.hidden = !isLogin;
      formSignup.hidden = isLogin;
      errBox.hidden = true;
    });
  });

  const handle = (endpoint) => async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target).entries());
    try {
      await apiPost(endpoint, body);
      await refreshUser();
      close();
      renderHeader(document.body.dataset.nav);
      notify();
    } catch (err) {
      showErr(err.message);
    }
  };
  formLogin.addEventListener('submit', handle('/auth/signin'));
  formSignup.addEventListener('submit', handle('/auth/signup'));
}

// rende s adatta alle chiamate HTML
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

// inizializzazione chiamata da ogni pagina
async function initLayout(activeKey) {
  document.body.dataset.nav = activeKey || '';
  await refreshUser();
  renderHeader(activeKey);
  notify();
}

export { initLayout, getUser, onAuthChange, openAuthModal, escapeHtml };
