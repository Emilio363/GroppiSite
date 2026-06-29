abbiamo un area con diversi campi per diversi sport (calcio, basket e pallavolo)

entità: campi, sport, giocatori, torneo, squadre, partita
# Database
campi: hanno uno sport associato e un ubicazione. possono essere prenotati in uno slot da una partita
partita: una parita viene giocata da due squadre, ha un momento in cui viene giocata in un campo. il risultato ci dice se 

We want to develop a web application that allows the booking of sports fields (football, volleyball, basketball) and the management of amateur tournaments. The application will allow registered users to:
- book sports fields for specific time slots;
- search for fields, tournaments, teams and players;
- create tournaments associated with a specific sport;
- add teams and players to tournaments;
- automatically generate the tournament match schedule;
- enter match results;
- view automatically updated standings.

Users register with a unique username, name, and surname, and authenticate using a password.​
The project consists of a server-side component that stores the data and handles authentication/authorization, and a client-side component that displays the application and data to the user.

Main Features
-​ Field list: anyone can view all available sports fields, filtering by sport or via a text search.
-​ Field details: each field includes name, sport type, address, and bookable slots.
-​ Availability view: users can view available time slots for a given date.
-​ Field booking: authenticated users can book any free time slot.
○​ Constraints: a slot cannot be booked more than once, and users cannot book past slots.
- Booking cancellation: users may cancel their upcoming bookings.
- Tournament list: view all tournaments, either active or completed, with support for search queries.
- Tournament creation: authenticated users may create a tournament specifying:
○​ name
○​ sport (football, volleyball, basketball)
○​ maximum number of teams
○​ start date
- Tournament editing: the creator may edit certain fields (e.g., name, max teams).
- Tournament deletion: only the creator may delete a tournament.
- Tournament details: includes general information, teams, matches, and standings.
- Team creation: the tournament’s creator can add teams by specifying a team name.
- Player management: teams can contain multiple players, each with: (devo controllare che non venga aggiunto più volte lo stesso giocatore)
○​ name
○​ surname
○​ optional jersey number
- Visualization: list of teams and players available for each tournament.
- Automatic schedule generation: once all teams are registered, the match schedule can be generated (single round-robin).
- Match details: participating teams, date, optional field(field booked / not already booked), status and optional result.(da giocare / giocato con risultato / in corso)
- Result entry: the tournament creator may enter the final score once the match date has passed. ????
- Search: partial, case-insensitive search should be available for fields, tournaments, teams, players (eg, searching "cal" should match “Calcio”, “Calisthenics Arena”, “California Team”, etc.);
- User list: it is possible to view a list of users, optionally filtered by a search parameter. For each user, all tournaments created by them will be shown.
- User registration: A new user can register by providing:
  ○​ Username
  ○​ Password
  ○​ Name
  ○​ Surname
Standings are automatically computed based on match results (football: 3 points for a win, 1 for a draw, 0 for a loss, volleyball/basketball: 2 points for a win, 0 for a loss).

Standings are publicly available and include: ??????

-​ points
-​ matches played
-​ goals/points scored and conceded
-​ goal/point difference

## Authentication

Users can sign up by providing:

- username (unique)
- password
- name
- surname

Any operation that modifies data (booking a field, creating a tournament, adding teams, entering results, etc.) must require authentication. After login, ensure that the user has the necessary permissions (for example, only the tournament creator may modify or delete it)

REST Interface
The project requires the implementation of a REST interface. The API to be implemented is
listed below.
TODO: aggiungere endpoit users
MetodoAPIDescrizione
POST/api/auth/signupRegister a new user
POST/api/auth/signinUser login
GET/api/fields?q=queryList of sports fields (searchable)
GET/api/fields/:idField details
GET/api/fields/:id/slots?date=YYYY-MM-DDAvailability for a specific date
POST/api/fields/:id/bookingsBook a slot (authenticated)
DELETE/api/fields/:id/bookings/:bookingIdCancel a booking (authenticated)
GET/api/tournaments?q=queryList of tournaments
POST/api/tournamentsCreate a new tournament (authenticated)
GET/api/tournaments/:idTournament details
PUT/api/tournaments/:idEdit tournament data
DELETE/api/tournaments/:idDelete the tournament (creator only)
POST/api/tournaments/:id/matches/generateGenerate match schedule
GET/api/tournaments/:id/matchesList matches
GET/api/matches/:idMatch details
PUT/api/matches/:id/resultEnter match result
GET/api/users?q=queryList of users (searchable)
GET/api/users/:idDetails about a user with the specified id
GET/api/tournaments/:id/standingsTournament standings
GET/api/whoamiIf authenticated, returns information about the current userProject Delivery


# Come fare

http://localhost:3000/api/fields?q=1

treminal:
- sudo docker compose up
`cd GroppiSite/app && for f in db.js auth.js server.js; do node --check "$f" && echo "OK: $f" || echo "ERR: $f"; done` epr fare il sintax check dei vari file JS