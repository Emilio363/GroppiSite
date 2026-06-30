CREATE DATABASE IF NOT EXISTS CAMPI;
USE CAMPI;

CREATE TABLE IF NOT EXISTS utente (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(50) NOT NULL,
    surname VARCHAR(100) NOT NULL,
    password VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS sport (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(50) UNIQUE NOT NULL,
    descrizione TEXT
);

CREATE TABLE IF NOT EXISTS giocatore (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    surname VARCHAR(100) NOT NULL,
    numero INT,  -- numero di maglia
    utente_id INT NOT NULL,

    FOREIGN KEY (utente_id) REFERENCES utente(id)
);

CREATE TABLE IF NOT EXISTS squadra (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) UNIQUE NOT NULL,
    sport_id INT NOT NULL,

    FOREIGN KEY (sport_id) REFERENCES sport(id)
);

CREATE TABLE IF NOT EXISTS torneo (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) UNIQUE NOT NULL,
    sport_id INT NOT NULL,
    owner_id INT NOT NULL,
    max_teams INT NOT NULL,
    min_player INT NOT NULL, 
    start_date DATETIME NOT NULL,

    FOREIGN KEY (sport_id) REFERENCES sport(id),
    FOREIGN KEY (owner_id) REFERENCES utente(id)
);

CREATE TABLE IF NOT EXISTS campo (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    indirizzo VARCHAR(255),
    sport_id INT NOT NULL,

    FOREIGN KEY (sport_id) REFERENCES sport(id)
);

-- Prenotazione di una fascia oraria di un campo in una data.
-- Niente slot fissi: l'utente sceglie liberamente ora_inizio/ora_fine entro la finestra
-- di apertura (09:00-22:00, stessa data). Un campo è libero se non esiste una prenotazione
-- che si sovrappone all'intervallo richiesto: il controllo di sovrapposizione è applicativo
-- (vedi findOverlaps in server.js), perché non esprimibile con un vincolo UNIQUE.
-- UNIQUE(campo_id, data, ora_inizio) resta come salvaguardia contro inizi identici duplicati.
CREATE TABLE IF NOT EXISTS prenotazione (
    id INT AUTO_INCREMENT PRIMARY KEY,
    campo_id INT NOT NULL,
    utente_id INT NOT NULL,
    data DATE NOT NULL,
    ora_inizio TIME NOT NULL,
    ora_fine TIME NOT NULL,

    UNIQUE (campo_id, data, ora_inizio),
    FOREIGN KEY (campo_id) REFERENCES campo(id),
    FOREIGN KEY (utente_id) REFERENCES utente(id)
);

CREATE TABLE IF NOT EXISTS squadra_giocatore (
    squadra_id INT NOT NULL,
    giocatore_id INT NOT NULL,

    PRIMARY KEY (squadra_id, giocatore_id),
    FOREIGN KEY (squadra_id) REFERENCES squadra(id),
    FOREIGN KEY (giocatore_id) REFERENCES giocatore(id)
);

CREATE TABLE IF NOT EXISTS torneo_squadra (
    torneo_id INT NOT NULL,
    squadra_id INT NOT NULL,

    PRIMARY KEY (torneo_id, squadra_id),
    FOREIGN KEY (torneo_id) REFERENCES torneo(id),
    FOREIGN KEY (squadra_id) REFERENCES squadra(id)
);

CREATE TABLE IF NOT EXISTS partita (
    id INT AUTO_INCREMENT PRIMARY KEY,
    owner_id INT NOT NULL,
    sport_id INT NOT NULL,
    torneo_id INT,

    squadra1_id INT NOT NULL,
    squadra2_id INT NOT NULL,

    risultato_squadra1 INT, -- NULL = non ancora giocata
    risultato_squadra2 INT,

    -- NULL = campo/orario non ancora prenotato.
    prenotazione_id INT,

    FOREIGN KEY (owner_id) REFERENCES utente(id),
    FOREIGN KEY (sport_id) REFERENCES sport(id),
    FOREIGN KEY (torneo_id) REFERENCES torneo(id),
    FOREIGN KEY (prenotazione_id) REFERENCES prenotazione(id),
    FOREIGN KEY (squadra1_id) REFERENCES squadra(id),
    FOREIGN KEY (squadra2_id) REFERENCES squadra(id)
);



INSERT INTO utente (username, name, surname, password) VALUES
    ('mrossi',   'Mario',     'Rossi',    '$2a$10$RZvd6c6TTIqdqKUUsJ8OQeBxwtlLt/EyYwPT6HX76fD/Nch.lvFzu'), -- pass123
    ('lbianchi', 'Luca',      'Bianchi',  '$2a$10$qeuicDrdC7VfysrHj9aynOR.8z4dYjlQdVzHMZcvfUyaKjw3q7j7i'), -- pass456
    ('fverdi',   'Francesca', 'Verdi',    '$2a$10$iHwRUSY/t0DRpX5g7ny98.SfSLwtPDlcniCP4DfXHGJ1T8cwjQXse'), -- pass789
    ('gneri',    'Giulia',    'Neri',     '$2a$10$73eH.q6vBV2WL5umDT0/g.U.NgPfxPsdDJGdQoZIFA2KwFUNcFi.m'), -- pass321
    ('asala',    'Andrea',    'Sala',     '$2a$10$p1ahA0AOHEI.iwRLgjAky.nnsCKDfsFzh8CmDDR7b4ij99M9JFiCW'), -- pass654
    -- nuovi
    ('cferrari', 'Carlo',     'Ferrari',  '$2a$10$T5ZOaQpK.ZoT44ut4HlCx.b0YQH4ODS.roOGhuRn73eBliZA2NDxW'), -- passABC
    ('erusso',   'Elena',     'Russo',    '$2a$10$5C8/BJzGwGLiyM0CxcO.S.XS5KXOeKgiiuB5QdlDe/NLI8P9hK2ma'), -- passDEF
    ('tconte',   'Tommaso',   'Conte',    '$2a$10$Ck.adV15mUJdf4wbiLJLpuQh/5FIkNic1XnrzmKo7iofkvS44ZO7C'), -- passGHI
    ('vmoretti', 'Valeria',   'Moretti',  '$2a$10$m510bFmXsRPxnYXlGU5a8edxF0ZtUW9CGKwQpfnB2fYDxZsxfsjue'), -- passJKL
    ('rfontana', 'Roberto',   'Fontana',  '$2a$10$zawb2sScXSjvRKn.kUGfuOD8LPyiNoUbAj8VdCtHhOrB44HhRsO/i'); -- passMNO

-- ------------------------------------------------------------
-- SPORT  (invariati)
-- ------------------------------------------------------------
INSERT INTO sport (nome, descrizione) VALUES
    ('Calcio',  'Sport di squadra con pallone'),
    ('Basket',  'Sport con canestro'),
    ('Volley',  'Sport di squadra con rete');

-- ------------------------------------------------------------
-- CAMPI  (aggiungiamo 2 campi extra per sport per avere più slot)
-- ------------------------------------------------------------
INSERT INTO campo (nome, indirizzo, sport_id) VALUES
    ('Campo Centrale',   'Via Roma 1',        1),   -- id 1
    ('Campo Sud',        'Via Milano 10',     1),   -- id 2
    ('Campo Nord',       'Via Torino 5',      1),   -- id 3
    ('Basket Arena',     'Via Napoli 3',      2),   -- id 4
    ('Palestra Est',     'Via Bologna 12',    2),   -- id 5
    ('PalaBlu',          'Via Venezia 7',     2),   -- id 6
    ('Volley Center',    'Via Genova 8',      3),   -- id 7
    ('Palestra Ovest',   'Via Bari 4',        3),   -- id 8
    ('Palestra Nuova',   'Via Palermo 22',    3);   -- id 9

-- ------------------------------------------------------------
-- GIOCATORI DI CALCIO  (8 per squadra × 4 squadre = 32)
-- Squadre calcio: id 1-4
-- ------------------------------------------------------------
INSERT INTO giocatore (name, surname, numero, utente_id) VALUES
    -- Squadra A (id 1)
    ('Giovanni',  'Verdi',     10, 1),   -- id 1
    ('Paolo',     'Neri',       9, 1),   -- id 2
    ('Riccardo',  'Esposito',   7, 2),   -- id 3
    ('Stefano',   'Marino',    11, 2),   -- id 4
    ('Alberto',   'Greco',      4, 3),   -- id 5
    ('Daniele',   'Lombardi',   5, 3),   -- id 6
    ('Emanuele',  'Conti',      6, 4),   -- id 7
    ('Fabrizio',  'Serra',      2, 4),   -- id 8
    -- Squadra B (id 2)
    ('Marco',     'Blu',        7, 2),   -- id 9
    ('Alessio',   'Rosa',      11, 2),   -- id 10
    ('Nicola',    'Montagna',   8, 5),   -- id 11
    ('Giorgio',   'Fiore',      3, 5),   -- id 12
    ('Luca',      'Ferretti',  14, 6),   -- id 13
    ('Cristian',  'De Luca',    1, 6),   -- id 14
    ('Mirko',     'Palma',     16, 7),   -- id 15
    ('Samuele',   'Galli',     20, 7),   -- id 16
    -- Squadra C – calcio (id 3)
    ('Enrico',    'Vitale',    22, 8),   -- id 17
    ('Mattia',    'Coppola',   99, 8),   -- id 18
    ('Filippo',   'Riva',      17, 9),   -- id 19
    ('Diego',     'Poli',      23, 9),   -- id 20
    ('Claudio',   'Mancini',    6, 1),   -- id 21
    ('Leonardo',  'Barbieri',  13, 1),   -- id 22
    ('Vittorio',  'Gentile',   18, 2),   -- id 23
    ('Cristiano', 'Messina',    0, 2),   -- id 24
    -- Squadra D – calcio (id 4)
    ('Antonino',  'Gallo',     33, 3),   -- id 25
    ('Saverio',   'Bruno',     10, 3),   -- id 26
    ('Valerio',   'Costa',      5, 4),   -- id 27
    ('Simone',    'Farina',    21, 4),   -- id 28
    ('Tiziano',   'Monti',     19, 5),   -- id 29
    ('Gianluca',  'Longo',      4, 5),   -- id 30
    ('Pierluigi', 'Cattaneo',  77, 6),   -- id 31
    ('Umberto',   'Amato',     25, 6);   -- id 32

-- GIOCATORI DI BASKET  (10 per squadra × 4 squadre = 40)
-- Squadre basket: id 5-8
INSERT INTO giocatore (name, surname, numero, utente_id) VALUES
    -- Squadra E (id 5)
    ('Simone',   'Gialli',     5, 3),   -- id 33
    ('Lorenzo',  'Marrone',    8, 3),   -- id 34
    ('Jacopo',   'Ferrara',   23, 7),   -- id 35
    ('Andrea',   'Pellegrino', 11, 7),  -- id 36
    ('Massimo',  'Caruso',    32, 8),   -- id 37
    ('Edoardo',  'Gatti',      0, 8),   -- id 38
    ('Vincenzo', 'Ruggieri',  44, 9),   -- id 39
    ('Aldo',     'Barbaro',   14, 9),   -- id 40
    ('Cesare',   'Pinto',     21, 10),  -- id 41
    ('Bruno',    'Fabbri',    15, 10),  -- id 42
    -- Squadra F (id 6)
    ('Matteo',   'Grigi',      4, 4),   -- id 43
    ('Davide',   'Arancio',    6, 5),   -- id 44
    ('Federico', 'Viola',      3, 5),   -- id 45
    ('Gabriele', 'Sala',      12, 6),   -- id 46
    ('Nunzio',   'Angelo',  34, 6),   -- id 47
    ('Piero',    'Messina',    7, 7),   -- id 48
    ('Raffaele', 'Barone',    22, 7),   -- id 49
    ('Salvo',    'Ferretti',   9, 8),   -- id 50
    ('Tullio',   'Cariello',  41, 8),   -- id 51
    ('Ivan',     'Pesce',     33, 9),   -- id 52
    -- Squadra G – basket (id 7)
    ('Omar',     'Tarsia',    10, 10),  -- id 53
    ('Pietro',   'Rosi',       5, 10),  -- id 54
    ('Quirino',  'Basile',    24, 1),   -- id 55
    ('Renato',   'Caputo',    31, 1),   -- id 56
    ('Sandro',   'Luca',      13, 2),   -- id 57
    ('Teodoro',  'Marini',     2, 2),   -- id 58
    ('Ulisse',   'Croci',     55, 3),   -- id 59
    ('Vito',     'Esposito',  18, 3),   -- id 60
    ('Walter',   'Testa',      6, 4),   -- id 61
    ('Xavier',   'Merlo',     42, 4),   -- id 62
    -- Squadra H – basket (id 8)
    ('Yuri',     'Rizzo',     30, 5),   -- id 63
    ('Zeno',     'Romano',    19, 5),   -- id 64
    ('Alfredo',  'Parisi',    25, 6),   -- id 65
    ('Bernardino','Sorrentino',8, 6),   -- id 66
    ('Celestino','Palumbo',   17, 7),   -- id 67
    ('Dario',    'Vinci',     26, 7),   -- id 68
    ('Ernesto',  'Scala',     11, 8),   -- id 69
    ('Fiorenzo', 'Penna',      4, 8),   -- id 70
    ('Gerardo',  'Coppola',   99, 9),   -- id 71
    ('Ireneo',   'Vitello',   37, 9);   -- id 72

-- GIOCATORI DI VOLLEY  (8 per squadra × 4 squadre = 32)
-- Squadre volley: id 9-12
INSERT INTO giocatore (name, surname, numero, utente_id) VALUES
    -- Squadra I (id 9)
    ('Achille',  'Izzo',       2, 10),  -- id 73
    ('Baldo',    'Pansini',    5, 10),  -- id 74
    ('Carmelo',  'Fiore',      7, 1),   -- id 75
    ('Demetrio', 'Milani',    10, 1),   -- id 76
    ('Egidio',   'Quaranta',  14, 2),   -- id 77
    ('Fabio',    'Nico',       3, 2),   -- id 78
    ('Gaetano',  'Lodi',      12, 3),   -- id 79
    ('Hilario',  'Moro',       9, 3),   -- id 80
    -- Squadra L (id 10)
    ('Ilario',   'Puglia',     6, 4),   -- id 81
    ('Jone',     'Cirillo',   11, 4),   -- id 82
    ('Kevyn',    'Fedi',       1, 5),   -- id 83
    ('Lino',     'Pane',       4, 5),   -- id 84
    ('Manlio',   'Noto',       8, 6),   -- id 85
    ('Nestore',  'Bisi',      13, 6),   -- id 86
    ('Olindo',   'Russa',     15, 7),   -- id 87
    ('Primo',    'Verna',     17, 7),   -- id 88
    -- Squadra M – volley (id 11)
    ('Quirico',  'Sanna',      5, 8),   -- id 89
    ('Rocco',    'Arru',       9, 8),   -- id 90
    ('Sergio',   'Cadeddu',    3, 9),   -- id 91
    ('Tarcisio', 'Piras',     11, 9),   -- id 92
    ('Ubaldo',   'Melis',      7, 10),  -- id 93
    ('Valentino','Porcu',      2, 10),  -- id 94
    ('Wladimir', 'Mura',      14, 1),   -- id 95
    ('Xaver',    'Soro',      16, 1),   -- id 96
    -- Squadra N – volley (id 12)
    ('Yago',     'Cao',        4, 2),   -- id 97
    ('Zenone',   'Meloni',     6, 2),   -- id 98
    ('Anselmo',  'Fois',      10, 3),   -- id 99
    ('Beniamino','Lai',        8, 3),   -- id 100
    ('Corrado',  'Carta',     13, 4),   -- id 101
    ('Damiano',  'Mele',       1, 4),   -- id 102
    ('Erasmo',   'Schirru',   12, 5),   -- id 103
    ('Flavio',   'Tocco',     15, 5);   -- id 104

-- ------------------------------------------------------------
-- SQUADRE  (4 per sport)
-- Sport 1 = Calcio  →  squadre 1-4
-- Sport 2 = Basket  →  squadre 5-8
-- Sport 3 = Volley  →  squadre 9-12
-- ------------------------------------------------------------
INSERT INTO squadra (nome, sport_id) VALUES
    ('Falchi FC',        1),   -- id 1
    ('Lupi United',      1),   -- id 2
    ('Aquile Calcio',    1),   -- id 3
    ('Draghi SC',        1),   -- id 4
    ('Bulls Bologna',    2),   -- id 5
    ('Tigers Basket',    2),   -- id 6
    ('Sharks Bball',     2),   -- id 7
    ('Eagles Court',     2),   -- id 8
    ('Vulcani Volley',   3),   -- id 9
    ('Tornado VB',       3),   -- id 10
    ('Fuoco Volley',     3),   -- id 11
    ('Tempesta VB',      3);   -- id 12

-- ------------------------------------------------------------
-- SQUADRA_GIOCATORE
-- ------------------------------------------------------------
-- Calcio: 8 giocatori per squadra
INSERT INTO squadra_giocatore (squadra_id, giocatore_id) VALUES
    -- Falchi FC (id 1): giocatori 1-8
    (1,1),(1,2),(1,3),(1,4),(1,5),(1,6),(1,7),(1,8),
    -- Lupi United (id 2): giocatori 9-16
    (2,9),(2,10),(2,11),(2,12),(2,13),(2,14),(2,15),(2,16),
    -- Aquile Calcio (id 3): giocatori 17-24
    (3,17),(3,18),(3,19),(3,20),(3,21),(3,22),(3,23),(3,24),
    -- Draghi SC (id 4): giocatori 25-32
    (4,25),(4,26),(4,27),(4,28),(4,29),(4,30),(4,31),(4,32);

-- Basket: 10 giocatori per squadra
INSERT INTO squadra_giocatore (squadra_id, giocatore_id) VALUES
    -- Bulls Bologna (id 5): giocatori 33-42
    (5,33),(5,34),(5,35),(5,36),(5,37),(5,38),(5,39),(5,40),(5,41),(5,42),
    -- Tigers Basket (id 6): giocatori 43-52
    (6,43),(6,44),(6,45),(6,46),(6,47),(6,48),(6,49),(6,50),(6,51),(6,52),
    -- Sharks Bball (id 7): giocatori 53-62
    (7,53),(7,54),(7,55),(7,56),(7,57),(7,58),(7,59),(7,60),(7,61),(7,62),
    -- Eagles Court (id 8): giocatori 63-72
    (8,63),(8,64),(8,65),(8,66),(8,67),(8,68),(8,69),(8,70),(8,71),(8,72);

-- Volley: 8 giocatori per squadra
INSERT INTO squadra_giocatore (squadra_id, giocatore_id) VALUES
    -- Vulcani Volley (id 9): giocatori 73-80
    (9,73),(9,74),(9,75),(9,76),(9,77),(9,78),(9,79),(9,80),
    -- Tornado VB (id 10): giocatori 81-88
    (10,81),(10,82),(10,83),(10,84),(10,85),(10,86),(10,87),(10,88),
    -- Fuoco Volley (id 11): giocatori 89-96
    (11,89),(11,90),(11,91),(11,92),(11,93),(11,94),(11,95),(11,96),
    -- Tempesta VB (id 12): giocatori 97-104
    (12,97),(12,98),(12,99),(12,100),(12,101),(12,102),(12,103),(12,104);


INSERT INTO torneo (nome, sport_id, owner_id, max_teams, min_player, start_date) VALUES
    -- Calcio
    ('Coppa Emilia Estate 2026',   1, 1, 4, 7,  '2026-07-05 10:00:00'),  -- id 1, owner mrossi
    ('Trofeo Città di Bologna',    1, 6, 4, 7,  '2026-08-02 10:00:00'),  -- id 2, owner cferrari
    -- Basket
    ('Summer Basket Cup 2026',     2, 2, 4, 8,  '2026-07-12 18:00:00'),  -- id 3, owner lbianchi
    ('Torneo Pro Basket Bologna',  2, 7, 4, 8,  '2026-08-09 18:00:00'),  -- id 4, owner tconte
    -- Volley
    ('Open Volley Appennino',      3, 3, 4, 6,  '2026-07-19 17:00:00'),  -- id 5, owner fverdi
    ('Gran Prix Volley Emilia',    3, 8, 4, 6,  '2026-08-16 17:00:00');  -- id 6, owner vmoretti


INSERT INTO torneo_squadra (torneo_id, squadra_id) VALUES
    -- Coppa Emilia Estate 2026 (calcio, id 1)
    (1,1),(1,2),(1,3),(1,4),
    -- Trofeo Città di Bologna (calcio, id 2) – Falchi FC e Lupi United ricompaiono
    (2,1),(2,2),(2,3),(2,4),
    -- Summer Basket Cup 2026 (basket, id 3)
    (3,5),(3,6),(3,7),(3,8),
    -- Torneo Pro Basket Bologna (basket, id 4) – Bulls e Tigers ricompaiono
    (4,5),(4,6),(4,7),(4,8),
    -- Open Volley Appennino (volley, id 5)
    (5,9),(5,10),(5,11),(5,12),
    -- Gran Prix Volley Emilia (volley, id 6) – Vulcani e Tornado ricompaiono
    (6,9),(6,10),(6,11),(6,12);

-- ------------------------------------------------------------
-- PRENOTAZIONI
-- Ogni partita avrà la sua prenotazione collegata.
-- Generiamo anche prenotazioni "libere" (senza partita).
-- Struttura tornei (round-robin 4 squadre → 6 partite ciascuno):
--   Torneo 1 (calcio): partite 1-6   su Campo Centrale/Sud/Nord
--   Torneo 2 (calcio): partite 7-12  su Campo Centrale/Sud/Nord
--   Torneo 3 (basket): partite 13-18 su Basket Arena/Palestra Est/PalaBlu
--   Torneo 4 (basket): partite 19-24 su Basket Arena/Palestra Est/PalaBlu
--   Torneo 5 (volley): partite 25-30 su Volley Center/Palestra Ovest/Palestra Nuova
--   Torneo 6 (volley): partite 31-36 su Volley Center/Palestra Ovest/Palestra Nuova
-- ------------------------------------------------------------
INSERT INTO prenotazione (campo_id, utente_id, data, ora_inizio, ora_fine) VALUES
    -- Torneo 1 – Coppa Emilia Estate (calcio, luglio)
    (1, 1, '2026-07-05', '10:00', '11:30'),   -- id 1  → partita 1:  Falchi vs Lupi
    (1, 1, '2026-07-05', '12:00', '13:30'),   -- id 2  → partita 2:  Aquile vs Draghi
    (2, 1, '2026-07-12', '10:00', '11:30'),   -- id 3  → partita 3:  Falchi vs Aquile
    (2, 1, '2026-07-12', '12:00', '13:30'),   -- id 4  → partita 4:  Lupi vs Draghi
    (3, 1, '2026-07-19', '10:00', '11:30'),   -- id 5  → partita 5:  Falchi vs Draghi
    (3, 1, '2026-07-19', '12:00', '13:30'),   -- id 6  → partita 6:  Lupi vs Aquile
    -- Torneo 2 – Trofeo Città di Bologna (calcio, agosto)
    (1, 6, '2026-08-02', '10:00', '11:30'),   -- id 7  → partita 7
    (1, 6, '2026-08-02', '12:00', '13:30'),   -- id 8  → partita 8
    (2, 6, '2026-08-09', '10:00', '11:30'),   -- id 9  → partita 9
    (2, 6, '2026-08-09', '12:00', '13:30'),   -- id 10 → partita 10
    (3, 6, '2026-08-16', '10:00', '11:30'),   -- id 11 → partita 11
    (3, 6, '2026-08-16', '12:00', '13:30'),   -- id 12 → partita 12
    -- Torneo 3 – Summer Basket Cup (basket, luglio)
    (4, 2, '2026-07-12', '18:00', '19:30'),   -- id 13 → partita 13: Bulls vs Tigers
    (4, 2, '2026-07-12', '20:00', '21:30'),   -- id 14 → partita 14: Sharks vs Eagles
    (5, 2, '2026-07-19', '18:00', '19:30'),   -- id 15 → partita 15: Bulls vs Sharks
    (5, 2, '2026-07-19', '20:00', '21:30'),   -- id 16 → partita 16: Tigers vs Eagles
    (6, 2, '2026-07-26', '18:00', '19:30'),   -- id 17 → partita 17: Bulls vs Eagles
    (6, 2, '2026-07-26', '20:00', '21:30'),   -- id 18 → partita 18: Tigers vs Sharks
    -- Torneo 4 – Torneo Pro Basket (basket, agosto)
    (4, 7, '2026-08-09', '18:00', '19:30'),   -- id 19 → partita 19
    (4, 7, '2026-08-09', '20:00', '21:30'),   -- id 20 → partita 20
    (5, 7, '2026-08-16', '18:00', '19:30'),   -- id 21 → partita 21
    (5, 7, '2026-08-16', '20:00', '21:30'),   -- id 22 → partita 22
    (6, 7, '2026-08-23', '18:00', '19:30'),   -- id 23 → partita 23
    (6, 7, '2026-08-23', '20:00', '21:30'),   -- id 24 → partita 24
    -- Torneo 5 – Open Volley Appennino (volley, luglio)
    (7, 3, '2026-07-19', '17:00', '18:30'),   -- id 25 → partita 25: Vulcani vs Tornado
    (7, 3, '2026-07-19', '19:00', '20:30'),   -- id 26 → partita 26: Fuoco vs Tempesta
    (8, 3, '2026-07-26', '17:00', '18:30'),   -- id 27 → partita 27: Vulcani vs Fuoco
    (8, 3, '2026-07-26', '19:00', '20:30'),   -- id 28 → partita 28: Tornado vs Tempesta
    (9, 3, '2026-08-02', '17:00', '18:30'),   -- id 29 → partita 29: Vulcani vs Tempesta
    (9, 3, '2026-08-02', '19:00', '20:30'),   -- id 30 → partita 30: Tornado vs Fuoco
    -- Torneo 6 – Gran Prix Volley Emilia (volley, agosto)
    (7, 8, '2026-08-16', '17:00', '18:30'),   -- id 31 → partita 31
    (7, 8, '2026-08-16', '19:00', '20:30'),   -- id 32 → partita 32
    (8, 8, '2026-08-23', '17:00', '18:30'),   -- id 33 → partita 33
    (8, 8, '2026-08-23', '19:00', '20:30'),   -- id 34 → partita 34
    (9, 8, '2026-08-30', '17:00', '18:30'),   -- id 35 → partita 35
    (9, 8, '2026-08-30', '19:00', '20:30'),   -- id 36 → partita 36
    -- Prenotazioni libere (non legate a partite)
    (1, 4, '2026-07-08', '16:00', '17:30'),   -- id 37  allenamento privato calcio
    (4, 9, '2026-07-15', '09:00', '10:30'),   -- id 38  allenamento basket
    (7, 5, '2026-07-22', '09:00', '10:30');   -- id 39  allenamento volley

-- ------------------------------------------------------------
-- PARTITE
-- Torneo 1 (calcio): round-robin Falchi(1) Lupi(2) Aquile(3) Draghi(4)
--   Partite già giocate: 1-4; ancora da giocare: 5-6
-- Torneo 2 (calcio): stesse squadre, tutte da giocare
-- Torneo 3 (basket): round-robin Bulls(5) Tigers(6) Sharks(7) Eagles(8)
--   Partite già giocate: 13-15
-- Torneo 4 (basket): tutte da giocare
-- Torneo 5 (volley): round-robin Vulcani(9) Tornado(10) Fuoco(11) Tempesta(12)
--   Partite già giocate: 25-27
-- Torneo 6 (volley): tutte da giocare
-- ------------------------------------------------------------
INSERT INTO partita (
    owner_id, sport_id, torneo_id,
    squadra1_id, squadra2_id,
    risultato_squadra1, risultato_squadra2,
    prenotazione_id
) VALUES
    -- === TORNEO 1 – Coppa Emilia Estate (calcio) ===
    (1, 1, 1,  1, 2,  3, 1,  1),   -- partita 1:  Falchi 3-1 Lupi           (giocata)
    (1, 1, 1,  3, 4,  0, 0,  2),   -- partita 2:  Aquile 0-0 Draghi         (giocata)
    (1, 1, 1,  1, 3,  2, 2,  3),   -- partita 3:  Falchi 2-2 Aquile         (giocata)
    (1, 1, 1,  2, 4,  1, 3,  4),   -- partita 4:  Lupi 1-3 Draghi           (giocata)
    (1, 1, 1,  1, 4,  NULL, NULL, 5),  -- partita 5:  Falchi vs Draghi   (da giocare)
    (1, 1, 1,  2, 3,  NULL, NULL, 6),  -- partita 6:  Lupi vs Aquile     (da giocare)
    -- === TORNEO 2 – Trofeo Città di Bologna (calcio) ===
    (6, 1, 2,  1, 2,  NULL, NULL, 7),
    (6, 1, 2,  3, 4,  NULL, NULL, 8),
    (6, 1, 2,  1, 3,  NULL, NULL, 9),
    (6, 1, 2,  2, 4,  NULL, NULL, 10),
    (6, 1, 2,  1, 4,  NULL, NULL, 11),
    (6, 1, 2,  2, 3,  NULL, NULL, 12),
    -- === TORNEO 3 – Summer Basket Cup (basket) ===
    (2, 2, 3,  5, 6,  82, 79,  13),  -- partita 13: Bulls 82-79 Tigers        (giocata)
    (2, 2, 3,  7, 8,  65, 71,  14),  -- partita 14: Sharks 65-71 Eagles       (giocata)
    (2, 2, 3,  5, 7,  90, 85,  15),  -- partita 15: Bulls 90-85 Sharks        (giocata)
    (2, 2, 3,  6, 8,  NULL, NULL, 16),
    (2, 2, 3,  5, 8,  NULL, NULL, 17),
    (2, 2, 3,  6, 7,  NULL, NULL, 18),
    -- === TORNEO 4 – Torneo Pro Basket Bologna (basket) ===
    (7, 2, 4,  5, 6,  NULL, NULL, 19),
    (7, 2, 4,  7, 8,  NULL, NULL, 20),
    (7, 2, 4,  5, 7,  NULL, NULL, 21),
    (7, 2, 4,  6, 8,  NULL, NULL, 22),
    (7, 2, 4,  5, 8,  NULL, NULL, 23),
    (7, 2, 4,  6, 7,  NULL, NULL, 24),
    -- === TORNEO 5 – Open Volley Appennino (volley) ===
    (3, 3, 5,   9, 10,  3, 1,  25),  -- partita 25: Vulcani 3-1 Tornado        (giocata)
    (3, 3, 5,  11, 12,  2, 3,  26),  -- partita 26: Fuoco 2-3 Tempesta         (giocata)
    (3, 3, 5,   9, 11,  3, 0,  27),  -- partita 27: Vulcani 3-0 Fuoco          (giocata)
    (3, 3, 5,  10, 12,  NULL, NULL, 28),
    (3, 3, 5,   9, 12,  NULL, NULL, 29),
    (3, 3, 5,  10, 11,  NULL, NULL, 30),
    -- === TORNEO 6 – Gran Prix Volley Emilia (volley) ===
    (8, 3, 6,   9, 10,  NULL, NULL, 31),
    (8, 3, 6,  11, 12,  NULL, NULL, 32),
    (8, 3, 6,   9, 11,  NULL, NULL, 33),
    (8, 3, 6,  10, 12,  NULL, NULL, 34),
    (8, 3, 6,   9, 12,  NULL, NULL, 35),
    (8, 3, 6,  10, 11,  NULL, NULL, 36);