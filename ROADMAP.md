# Roadmap GroppiSite

Progetto d'esame **Web Application Programming 2025/26**: web app per prenotazione campi sportivi + gestione tornei amatoriali.
Stack: **Node.js + Express 5 + MariaDB**, **frontend vanilla** (HTML/CSS/JS, niente framework/build), tutto in **Docker**.
Riferimenti: `project.pdf` (specifica), `idee-sito.md`, `riassunto.md`, `docker.md`, `Javascript.md`.

> Questo file è il punto di ripartenza: contiene stato, architettura e cosa resta da fare.

---

## Stato sintetico

| Fase | Descrizione | Stato |
|---|---|---|
| 0 | Bug bloccanti backend | ✅ fatto |
| 1 | Coerenza/completezza API | 🟡 quasi (resta data/campo partita, min_player, dati seed) |
| 2 | Docker & delivery | ✅ fatto |
| 3 | Frontend | 🟡 in corso (fondamenta + pagine Campi e Dettaglio campo fatte) |
| 4 | Testing & rifinitura | ⬜ da fare |

---

## Come si esegue

⚠️ Usare **`GroppiSite/docker-compose.yml`** (NON quello vecchio in `GroppiSite/dev/`, è obsoleto e va eliminato/allineato).

```bash
cd GroppiSite
sudo docker compose up --build -d            # build + avvio
# per ripartire da DB pulito (rilancia l'init dello schema):
sudo docker compose down -v && sudo docker compose up --build -d
```
App + frontend su **http://localhost:3000** (stessa origine per API e pagine).
Dopo modifiche a `app/` serve **rebuild**; le modifiche a `frontend/` sono live (montata via volume), basta ricaricare il browser.

Note ambiente: Node non è installato sull'host; Docker richiede `sudo` (password interattiva). Login: gli utenti del seed hanno password in chiaro → non passano bcrypt; per testare l'auth **registrare un nuovo utente** dalla UI.

---

## Architettura file

```
GroppiSite/
  app/                  backend (copiato nell'immagine, serve rebuild per modifiche)
    server.js           express, static frontend, endpoint campi/utenti/match, whoami
    auth.js             signup/signin/logout, JWT cookie httpOnly, middleware verifyToken
    db.js               pool MariaDB (legge env DB_HOST/USER/PASSWORD/NAME)
    helpers.js          whereCreate (ricerca q), APERTURA/CHIUSURA, parseInterval, findOverlaps
    bookings.js         prenotazioni campi (POST/DELETE)
    tournaments.js      tornei, partite, generate, risultato, classifica
    teams.js            squadre, giocatori, associazioni
  frontend/             servito da Express (../frontend), montato a caldo in dev
    index.html          pagina Campi
    css/style.css       stile condiviso
    js/api.js           wrapper fetch (apiGet/apiPost/apiPut/apiDelete)
    js/layout.js        header/nav + modale login/signup/logout + getUser/onAuthChange
    js/fields.js        logica pagina Campi
  database/
    00-grant-root.sql   crea root@'%' (accesso DB da rete) — init
    database.sql        schema + dati seed — init
  docker-compose.yml    UFFICIALE (named volume DB, init mount, healthcheck, depends_on)
  Dockerfile            copia app/ e frontend/ nell'immagine
  dev/                  ⚠️ contiene un docker-compose VECCHIO da rimuovere/allineare
```

---

## API REST (tutte implementate lato backend)

Pubbliche (GET): `/api/fields`, `/api/fields/:id`, `/api/fields/:id/slots?date=`,
`/api/tournaments`, `/api/tournaments/:id`, `/api/tournaments/:id/matches`, `/api/tournaments/:id/standings`,
`/api/matches/:id`, `/api/teams`, `/api/teams/:id`, `/api/players`, `/api/players/:id`,
`/api/users`, `/api/users/:id`.

Auth richiesta (scrittura): `POST /api/auth/signup|signin|logout`, `GET /api/whoami`,
`POST/DELETE /api/fields/:id/bookings[/:bookingId]`,
`POST /api/tournaments`, `PUT /api/tournaments/:id`, `DELETE /api/tournaments/:id`,
`POST /api/tournaments/:id/matches/generate`, `PUT /api/matches/:id/result`,
`POST /api/teams` (crea squadra), `POST /api/tournaments/:id/teams` (associa squadra esistente),
`POST /api/players` (crea giocatore), `POST /api/teams/:teamId/players` (associa giocatore esistente).

**Modello squadre/giocatori:** si **crea** (`POST /api/teams`, `POST /api/players`) e poi si **associa**
(`POST /api/tournaments/:id/teams` con `nome`+sport, `POST /api/teams/:teamId/players` con `giocatore_id`).
Ricerca `q` parziale case-insensitive su tutte le liste.

**Permessi:** crea/modifica/elimina torneo + generate + risultato = solo `owner`. Cancella prenotazione = solo proprietario e solo se futura.

---

## Fase 0 — Bug bloccanti ✅ FATTO

- `POST /api/tournaments`: `sportRows` era dichiarato dentro `if/else` → ora `let` esterno (struttura if/else mantenuta).
- `PUT /api/tournaments/:id`: il check permessi usava `t` prima di definirlo → spostato dopo il caricamento.
- `GET /api/matches/:id`: partita inesistente ora `404` (era `400`).
- Aggiunto `POST /api/auth/logout` (clearCookie) per il frontend.
- (Route di debug `/api/debug/where` lasciata su richiesta — da togliere in Fase 4.)

---

## Fase 1 — Coerenza API 🟡 QUASI

- ✅ Endpoint creazione squadre/giocatori (`POST /api/teams`, `POST /api/players`) — modello "crea poi associa".
- ⬜ **Data/campo della partita.** `generate` crea partite senza `prenotazione_id` (senza data); ma `PUT /matches/:id/result` consente il risultato solo *dopo la data* → con data assente la regola non scatta mai. Serve un modo per assegnare data+campo a una partita (es. `PUT /api/matches/:id` che crea/collega una `prenotazione`), oppure assegnare gli slot in fase di `generate`. **Decisione da prendere.**
- ⬜ **`min_player`**: presente nello schema ma non verificato in `generate`. Decidere se controllarlo.
- ⬜ **Dati seed**: `partita` con risultato `78-80` in `database.sql` → mettere valori realistici.

---

## Fase 2 — Docker & delivery ✅ FATTO

- Init schema automatico: mount `./database:/docker-entrypoint-initdb.d:ro` (esegue `00-grant-root.sql` poi `database.sql` al primo avvio).
- Credenziali allineate: DB `MARIADB_ROOT_PASSWORD=1234`, `MARIADB_DATABASE=CAMPI`; app `DB_*` espliciti (coerenti coi default di `db.js`).
- Accesso root da rete garantito da `00-grant-root.sql` (`root@'%'`), perché l'app si connette da un altro container.
- `healthcheck` sul DB + `depends_on: condition: service_healthy` sull'app (niente race all'avvio).
- Persistenza pulita: **named volume `groppi_db_data`** al posto del bind mount `./mariadb` (rimossa; era già in `.gitignore`, mai committata → niente dati DB in consegna).
- ⬜ Resta solo da **rimuovere/allineare `dev/docker-compose.yml`** (versione vecchia, fonte di confusione).

---

## Fase 3 — Frontend 🟡 IN CORSO

Scelte: vanilla, **stessa origine** API↔FE (cookie httpOnly, niente CORS). Header/nav e auth centralizzati in `layout.js`; ogni pagina chiama `initLayout('<chiave-nav>')` e usa `getUser()`/`onAuthChange()` per mostrare/nascondere azioni.

### Fatto ✅
- Infrastruttura: `js/api.js`, `js/layout.js` (modale Accedi/Registrati/Esci, stato sessione), `css/style.css`.
- **Pagina Campi** (`index.html` + `js/fields.js`): lista, ricerca server (`?q=`), filtro sport client.
- **Dettaglio campo + prenotazione** (`field.html` + `js/field.js`): info campo (`GET /fields/:id`),
  selettore data con disponibilità (`GET /fields/:id/slots?date=`, mostra finestra apertura/chiusura +
  prenotazioni della giornata), form prenotazione (`POST /fields/:id/bookings`, solo se loggato, gestisce
  400/401/404/409), cancellazione delle proprie prenotazioni future (`DELETE …/bookings/:bookingId`,
  bottone mostrato solo se `utente_id === getUser().id` e slot futuro). Reagisce a login/logout via
  `onAuthChange`. ⏳ Da verificare a runtime (Docker su) — non testabile sull'host (Node assente, sudo interattivo).
- **Tornei — lista** (`tournaments.html` + `js/tournaments.js`): elenco con badge stato (active→"In corso",
  completed→"Completato") + ricerca server (`GET /tournaments?q=`); card con sport, inizio, max squadre,
  min giocatori, owner, link a `tournament.html?id=`. Se loggato: bottone "Crea torneo" → pannello inline
  (`POST /tournaments` con `nome, sport, max_teams, start_date, min_player?`; `start_date` da `datetime-local`
  convertito in `YYYY-MM-DD HH:MM:SS`). **Sport del select derivati da `/fields` + `/tournaments`** (scelta
  concordata: niente endpoint dedicato). Reagisce a login/logout via `onAuthChange`. ⏳ Da verificare a runtime.
- **Tornei — dettaglio + gestione** (`tournament.html` + `js/tournament.js`): da `GET /tournaments/:id`
  mostra info, classifica (tabella Pt/G/V/N/P/fatti/subiti/diff), partite (orario se presente, altrimenti
  "da definire"; risultato) e squadre con giocatori. Azioni **solo owner** (`getUser().id === owner_id`):
  modifica (`PUT`), elimina (`DELETE` → torna alla lista), genera calendario (`POST …/matches/generate`,
  mostrato solo se nessuna partita), aggiungi squadra (associa esistente dello stesso sport non iscritta,
  oppure crea `POST /teams` con sport del torneo poi `POST …/teams`; 409 "esiste già" gestito), aggiungi
  giocatore (associa `POST /teams/:id/players` o crea `POST /players` poi associa), inserisci risultato
  (`PUT /matches/:id/result`). **Scelta concordata: solo risultato, niente scheduling** (le partite restano
  senza data → il risultato è inseribile subito; assegnazione data+campo rimandata, manca l'endpoint backend).
  Nota DOM: gli input "name" si leggono via `form.elements` (su un form `.name` è l'attributo del form).
  ⏳ Da verificare a runtime.
- **Utenti** (`users.html` + `js/users.js`): lista con ricerca server (`GET /users?q=`); ogni card mostra
  nome+cognome, @username e i tornei creati come link a `tournament.html?id=` (la lista include già `tornei`,
  quindi nessuna pagina di dettaglio dedicata). ⏳ Da verificare a runtime.

### Da fare ⬜ (in ordine consigliato)

**1. Trasversali / rifiniture**
   - ricerca squadre/giocatori (richiesta dal PDF): `GET /teams?q=`, `GET /players?q=` — pagina dedicata o dentro la gestione torneo.
   - dettaglio partita (`GET /matches/:id`): pagina o modale.
   - footer; coerenza messaggi d'errore; stati vuoti.

---

## Fase 4 — Testing & rifinitura ⬜

1. ✅ Smoke test end-to-end in `test/smoke-test.sh` (curl, no jq): liste pubbliche (200), dettaglio campo+slot, scrittura senza auth → 401, signup→whoami, crea torneo, **gestione torneo completa** (crea/associa squadre e giocatori, genera calendario, inserisce risultato, letture detail/standings/matches), dettaglio utente, **vincoli 409** (squadra/giocatore duplicato, calendario già generato, slot sovrapposto), prenota→cancella. Avvio: `BASE=http://localhost:3000 ./test/smoke-test.sh` con app su. ⏳ Da eseguire a runtime.
2. Verifica permessi (scrittura richiede auth; azioni da creatore).
3. Verifica vincoli (slot non doppio, niente prenotazioni passate, squadra non duplicata nel torneo, giocatore non duplicato in squadra).
4. Pulizia: rimuovere route di debug `/api/debug/where`, `console.log`, codice morto, `dev/` obsoleto.
5. `README` con avvio (`sudo docker compose up --build`) e note utente demo.

---

## Prossimo passo immediato
**Verifica a runtime di tutto il frontend** (Docker su): campi/prenotazioni, lista+crea torneo,
dettaglio torneo (genera calendario, aggiungi squadra/giocatore, risultato) come owner, pagina utenti.
Utile far girare `test/smoke-test.sh`. Poi restano solo le rifiniture trasversali (ricerca squadre/giocatori,
dettaglio partita, footer/stati vuoti) e la Fase 4.
