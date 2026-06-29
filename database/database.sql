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

    -- Prenotazione del campo per la partita: data e campo si ricavano da qui.
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
    ('mrossi', 'Mario', 'Rossi', 'pass123'),
    ('lbianchi', 'Luca', 'Bianchi', 'pass456'),
    ('fverdi', 'Francesca', 'Verdi', 'pass789'),
    ('gneri', 'Giulia', 'Neri', 'pass321'),
    ('asala', 'Andrea', 'Sala', 'pass654');

INSERT INTO sport (nome, descrizione) VALUES
    ('Calcio', 'Sport di squadra con pallone'),
    ('Basket', 'Sport con canestro'),
    ('Volley', 'Sport di squadra con rete');

INSERT INTO giocatore (name, surname, numero, utente_id) VALUES
    ('Giovanni', 'Verdi', 10, 1),
    ('Paolo', 'Neri', 9, 1),
    ('Marco', 'Blu', 7, 2),
    ('Alessio', 'Rosa', 11, 2),
    ('Simone', 'Gialli', 5, 3),
    ('Lorenzo', 'Marrone', 8, 3),
    ('Matteo', 'Grigi', 4, 4),
    ('Davide', 'Arancio', 6, 5),
    ('Federico', 'Viola', 3, 5);

INSERT INTO squadra (nome, sport_id) VALUES
    ('Squadra A', 1),
    ('Squadra B', 1),
    ('Squadra C', 2),
    ('Squadra D', 2),
    ('Volley Team 1', 3),
    ('Volley Team 2', 3);

INSERT INTO squadra_giocatore (squadra_id, giocatore_id) VALUES
    (1,1),(1,2),
    (2,3),(2,4),
    (3,5),(3,6),
    (4,7),(4,8),
    (5,1),(5,5),
    (6,2),(6,6);

INSERT INTO campo (nome, indirizzo, sport_id) VALUES
    ('Campo Centrale', 'Via Roma 1', 1),
    ('Campo Sud', 'Via Milano 10', 1),
    ('Basket Arena', 'Via Napoli 3', 2),
    ('Palestra Est', 'Via Bologna 12', 2),
    ('Volley Center', 'Via Genova 8', 3),
    ('Palestra Ovest', 'Via Bari 4', 3);

INSERT INTO prenotazione (campo_id, utente_id, data, ora_inizio, ora_fine) VALUES
    (1, 1, '2026-07-01', '09:00:00', '10:00:00'),  -- id 1
    (1, 2, '2026-07-01', '18:00:00', '19:00:00'),  -- id 2
    (3, 3, '2026-07-02', '20:00:00', '21:00:00'),  -- id 3
    -- Prenotazioni associate alle partite di esempio sotto
    (1, 1, '2026-06-01', '10:00:00', '11:00:00'),  -- id 4 -> partita 1
    (3, 2, '2026-06-05', '18:00:00', '19:00:00'),  -- id 5 -> partita 2
    (5, 3, '2026-06-10', '17:00:00', '18:00:00');  -- id 6 -> partita 3

INSERT INTO torneo (nome, sport_id, owner_id, max_teams, min_player, start_date) VALUES
    ('Torneo Calcio Estate', 1, 1, 8, 5, '2026-06-01 10:00:00'),
    ('Torneo Basket Pro', 2, 2, 6, 5, '2026-06-05 18:00:00'),
    ('Torneo Volley', 3, 3, 4, 6, '2026-06-10 17:00:00');

INSERT INTO torneo_squadra (torneo_id, squadra_id) VALUES
    (1,1),(1,2),
    (2,3),(2,4),
    (3,5),(3,6);

INSERT INTO partita (
    owner_id, sport_id, torneo_id,
    squadra1_id, squadra2_id,
    risultato_squadra1, risultato_squadra2,
    prenotazione_id
) VALUES
    (1, 1, 1, 1, 2, 2, 1, 4),
    (2, 2, 2, 3, 4, 78, 80, 5),
    (3, 3, 3, 5, 6, 3, 1, 6);
