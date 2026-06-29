#!/usr/bin/env bash
# Smoke test end-to-end di GroppiSite via curl.
# Presuppone l'app già avviata (sudo docker compose up --build -d) e in ascolto su BASE.
#
#   ./test/smoke-test.sh                  # usa http://localhost:3000
#   BASE=http://localhost:3000 ./test/smoke-test.sh
#
# Verifica: liste pubbliche (200), dettaglio campo+slot, scrittura senza auth (401),
# signup→whoami, creazione torneo, gestione torneo completa (crea/associa squadre e
# giocatori, genera calendario, inserisce risultato, letture detail/standings/matches),
# dettaglio utente, vincoli (409 su duplicati/overlap), prenotazione crea→cancella.
# Non serve jq: gli id vengono estratti con grep. Non azzera il DB: i dati creati restano.

set -u

BASE="${BASE:-http://localhost:3000}"
JAR="$(mktemp)"        # cookie jar per la sessione autenticata
BODY="$(mktemp)"       # corpo dell'ultima risposta
trap 'rm -f "$JAR" "$BODY"' EXIT

PASS=0
FAIL=0

# Esegue una richiesta e stampa SOLO lo status code; il corpo finisce in $BODY.
req() {
  local method="$1" path="$2" data="${3:-}"
  if [ -n "$data" ]; then
    curl -s -b "$JAR" -c "$JAR" -o "$BODY" -w '%{http_code}' \
      -H 'Content-Type: application/json' -X "$method" -d "$data" "$BASE$path"
  else
    curl -s -b "$JAR" -c "$JAR" -o "$BODY" -w '%{http_code}' -X "$method" "$BASE$path"
  fi
}

# expect <descrizione> <atteso> <ottenuto>
expect() {
  if [ "$2" = "$3" ]; then
    printf '  \033[32mOK\033[0m   %s (%s)\n' "$1" "$3"
    PASS=$((PASS + 1))
  else
    printf '  \033[31mFAIL\033[0m %s — atteso %s, ottenuto %s\n' "$1" "$2" "$3"
    printf '       body: %s\n' "$(head -c 200 "$BODY")"
    FAIL=$((FAIL + 1))
  fi
}

# Estrae il primo "id":N dal corpo dell'ultima risposta.
first_id() { grep -o '"id":[0-9]*' "$BODY" | head -1 | grep -o '[0-9]*'; }

echo "== Smoke test su $BASE =="

echo
echo "[1] Liste pubbliche (200)"
expect "GET /api/fields"      200 "$(req GET /api/fields)"
FIELD_ID="$(first_id)"
expect "GET /api/tournaments" 200 "$(req GET /api/tournaments)"
expect "GET /api/teams"       200 "$(req GET /api/teams)"
expect "GET /api/players"     200 "$(req GET /api/players)"
expect "GET /api/users"       200 "$(req GET /api/users)"

echo
echo "[2] Dettaglio campo + slot (200)"
expect "GET /api/fields/$FIELD_ID"        200 "$(req GET "/api/fields/$FIELD_ID")"
DATE="$(date -d '+7 days' +%F 2>/dev/null || date -v+7d +%F)"  # GNU o BSD date
expect "GET /api/fields/$FIELD_ID/slots"  200 "$(req GET "/api/fields/$FIELD_ID/slots?date=$DATE")"

echo
echo "[3] Scrittura senza auth (401)"
expect "POST /api/tournaments"                  401 "$(req POST /api/tournaments '{"nome":"X","sport":"Calcio","max_teams":4,"start_date":"2030-01-01 10:00:00"}')"
expect "POST /api/fields/$FIELD_ID/bookings"    401 "$(req POST "/api/fields/$FIELD_ID/bookings" "{\"date\":\"$DATE\",\"from\":\"10:00\",\"to\":\"11:00\"}")"

echo
echo "[4] Signup -> whoami"
TS="$(date +%s)"
USER="smoke_$TS"
expect "POST /api/auth/signup" 201 "$(req POST /api/auth/signup "{\"username\":\"$USER\",\"name\":\"Smoke\",\"surname\":\"Test\",\"password\":\"pw123456\"}")"
expect "GET /api/whoami"        200 "$(req GET /api/whoami)"

echo
echo "[5] Creazione torneo (auth, 201)"
expect "POST /api/tournaments" 201 "$(req POST /api/tournaments "{\"nome\":\"Smoke $TS\",\"sport\":\"Calcio\",\"max_teams\":4,\"min_player\":1,\"start_date\":\"2030-01-01 10:00:00\"}")"
TID="$(first_id)"

echo
echo "[6] Gestione torneo $TID (squadre, giocatori, calendario, risultato)"
# 6a) creo due squadre (stesso sport del torneo) e le associo
TEAM_A="SmokeA $TS"; TEAM_B="SmokeB $TS"
expect "POST /api/teams (A)" 201 "$(req POST /api/teams "{\"nome\":\"$TEAM_A\",\"sport\":\"Calcio\"}")"
TEAM_A_ID="$(first_id)"
expect "POST /api/teams (B)" 201 "$(req POST /api/teams "{\"nome\":\"$TEAM_B\",\"sport\":\"Calcio\"}")"
expect "POST /api/tournaments/$TID/teams (A)" 201 "$(req POST "/api/tournaments/$TID/teams" "{\"nome\":\"$TEAM_A\"}")"
expect "POST /api/tournaments/$TID/teams (B)" 201 "$(req POST "/api/tournaments/$TID/teams" "{\"nome\":\"$TEAM_B\"}")"
# 6b) creo un giocatore e lo associo alla squadra A
expect "POST /api/players" 201 "$(req POST /api/players "{\"name\":\"Smoke\",\"surname\":\"Player $TS\",\"numero\":7}")"
PLAYER_ID="$(first_id)"
expect "POST /api/teams/$TEAM_A_ID/players" 201 "$(req POST "/api/teams/$TEAM_A_ID/players" "{\"giocatore_id\":$PLAYER_ID}")"
# 6c) genero il calendario (>=2 squadre) e prendo la prima partita
expect "POST /api/tournaments/$TID/matches/generate" 201 "$(req POST "/api/tournaments/$TID/matches/generate")"
MATCH_ID="$(first_id)"
# 6d) inserisco il risultato (consentito: la partita non ha data)
expect "PUT /api/matches/$MATCH_ID/result" 200 "$(req PUT "/api/matches/$MATCH_ID/result" '{"risultato_squadra1":2,"risultato_squadra2":1}')"
# 6e) viste di lettura usate dal frontend
expect "GET /api/tournaments/$TID"           200 "$(req GET "/api/tournaments/$TID")"
expect "GET /api/tournaments/$TID/standings" 200 "$(req GET "/api/tournaments/$TID/standings")"
expect "GET /api/tournaments/$TID/matches"   200 "$(req GET "/api/tournaments/$TID/matches")"
expect "GET /api/matches/$MATCH_ID"          200 "$(req GET "/api/matches/$MATCH_ID")"

echo
echo "[7] Dettaglio utente (200)"
expect "GET /api/whoami (id)" 200 "$(req GET /api/whoami)"
ME_ID="$(first_id)"
expect "GET /api/users/$ME_ID" 200 "$(req GET "/api/users/$ME_ID")"

echo
echo "[8] Vincoli (errori attesi)"
# squadra già iscritta -> 409
expect "POST /api/tournaments/$TID/teams (dup) 409" 409 "$(req POST "/api/tournaments/$TID/teams" "{\"nome\":\"$TEAM_A\"}")"
# giocatore già in squadra -> 409
expect "POST /api/teams/$TEAM_A_ID/players (dup) 409" 409 "$(req POST "/api/teams/$TEAM_A_ID/players" "{\"giocatore_id\":$PLAYER_ID}")"
# calendario già generato -> 409
expect "POST /api/tournaments/$TID/matches/generate (dup) 409" 409 "$(req POST "/api/tournaments/$TID/matches/generate")"

echo
echo "[9] Prenotazione (auth): crea (201) -> cancella (200)"
expect "POST /api/fields/$FIELD_ID/bookings" 201 "$(req POST "/api/fields/$FIELD_ID/bookings" "{\"date\":\"$DATE\",\"from\":\"10:00\",\"to\":\"11:00\"}")"
BOOKING_ID="$(first_id)"
# stesso slot occupato -> 409
expect "POST /api/fields/$FIELD_ID/bookings (overlap) 409" 409 "$(req POST "/api/fields/$FIELD_ID/bookings" "{\"date\":\"$DATE\",\"from\":\"10:30\",\"to\":\"11:30\"}")"
expect "DELETE /api/fields/$FIELD_ID/bookings/$BOOKING_ID" 200 "$(req DELETE "/api/fields/$FIELD_ID/bookings/$BOOKING_ID")"

echo
echo "== Risultato: $PASS passati, $FAIL falliti =="
[ "$FAIL" -eq 0 ]
