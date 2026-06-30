import { apiGet, apiPost, apiDelete } from './api.js';
import { initLayout, getUser, onAuthChange, openAuthModal, escapeHtml } from './layout.js';

const messageEl = document.getElementById('message');
const infoEl = document.getElementById('field-info');
const sectionEl = document.getElementById('booking-section');
const dateEl = document.getElementById('date');
const bookingsEl = document.getElementById('bookings');
const formEl = document.getElementById('book-form');

const id = Number(new URLSearchParams(location.search).get('id'));

let slots = null; // ultima risposta di /slots: { apertura, chiusura, prenotazioni: [...] }

const hhmm = (t) => String(t).slice(0, 5);          // "09:00:00" -> "09:00"
const today = () => new Date().toISOString().slice(0, 10);

// una prenotazione è futura (e quindi cancellabile) se inizia dopo "adesso"
const isFuture = (date, ora) => new Date(`${date}T${ora}`) > new Date();

function showMessage(html) { messageEl.innerHTML = html; }
function showError(msg) { showMessage(`<div class="alert error">${escapeHtml(msg)}</div>`); }
function showOk(msg) { showMessage(`<div class="alert ok">${escapeHtml(msg)}</div>`); }



function renderForm() {
  if (!getUser()) {
    formEl.innerHTML = `
      <p class="muted">Devi accedere per prenotare uno slot.</p>
      <button class="btn" id="to-login">Accedi</button>`;
    document.getElementById('to-login').addEventListener('click', openAuthModal);
    return;
  }

  const ap = hhmm(slots.apertura);
  const ch = hhmm(slots.chiusura);
  formEl.innerHTML = `
    <form id="form-book">
      <div class="field">
        <label for="from">Dalle</label>
        <input id="from" name="from" type="time" min="${ap}" max="${ch}" step="60" value="${ap}" required>
      </div>
      <div class="field">
        <label for="to">Alle</label>
        <input id="to" name="to" type="time" min="${ap}" max="${ch}" step="60" required>
      </div>
      <button class="btn" type="submit">Prenota</button>
    </form>`;
  formEl.querySelector('#form-book').addEventListener('submit', onBook);
}

async function loadField() {
  try {
    const f = await apiGet(`/fields/${id}`);
    document.title = `GroppiSite — ${f.nome}`;
    infoEl.innerHTML = `
      <h1>${escapeHtml(f.nome)} <span class="badge">${escapeHtml(f.sport)}</span></h1>
      <p class="muted">${escapeHtml(f.indirizzo || 'Indirizzo non disponibile')}</p>`;
    sectionEl.hidden = false;
    dateEl.min = today();
    dateEl.value = today();
    await loadSlots();
  } catch (err) {
    showError(err.message);
  }
}

async function loadSlots() {
  const date = dateEl.value;
  if (!date) return;
  try {
    slots = await apiGet(`/fields/${id}/slots?date=${encodeURIComponent(date)}`);
    renderBookings();
    renderForm();
  } catch (err) {
    showError(err.message);
  }
}

function renderBookings() {
  const user = getUser();
  const date = dateEl.value;
  const prenotazioni = slots.prenotazioni || [];

  let rows;
  if (prenotazioni.length === 0) {
    rows = '<p class="empty">Nessuna prenotazione: la giornata è tutta libera.</p>';
  } else {
    rows = `
    <table>
      <thead>
        <tr><th>Orario</th><th>Stato</th><th></th></tr>
      </thead>
      <tbody>
        ${prenotazioni
          .map((p) => {
            const mine = user && p.utente_id === user.id;
            const canDelete = mine && isFuture(date, p.ora_inizio);
            const stato = mine
              ? '<span class="badge">Tua prenotazione</span>'
              : '<span class="muted">Occupato</span>';
            const action = canDelete
              ? `<button class="btn danger" data-del="${p.id}">Cancella</button>`
              : '';
            return `<tr><td>${hhmm(p.ora_inizio)}–${hhmm(p.ora_fine)}</td><td>${stato}</td><td>${action}</td></tr>`;
          })
          .join('')}
      </tbody>
    </table>`;
  }

  bookingsEl.innerHTML = `
    <p class="muted">Apertura ${hhmm(slots.apertura)} – chiusura ${hhmm(slots.chiusura)}</p>
    ${rows}`;
}



async function onBook(e) {
  e.preventDefault();
  const from = formEl.querySelector('#from').value;
  const to = formEl.querySelector('#to').value;
  if (!from || !to) return showError('Inserisci ora di inizio e fine.');
  try {
    await apiPost(`/fields/${id}/bookings`, { date: dateEl.value, from, to });
    showOk(`Prenotazione confermata per il ${dateEl.value} dalle ${from} alle ${to}.`);
    await loadSlots();
  } catch (err) {
    showError(err.message);
  }
}

async function onBookingsClick(e) {
  const btn = e.target.closest('[data-del]');
  if (!btn) return;
  if (!confirm('Cancellare questa prenotazione?')) return;
  try {
    await apiDelete(`/fields/${id}/bookings/${btn.dataset.del}`);
    showOk('Prenotazione cancellata.');
    await loadSlots();
  } catch (err) {
    showError(err.message);
  }
}

dateEl.addEventListener('change', () => { showMessage(''); loadSlots(); });
bookingsEl.addEventListener('click', onBookingsClick);
// al login/logout aggiorno
onAuthChange(() => { if (slots) { renderBookings(); renderForm(); } });

initLayout('campi');

if (!id || Number.isNaN(id)) {
  showError('Campo non specificato o non valido.');
} else {
  loadField();
}
