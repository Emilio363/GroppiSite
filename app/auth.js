import { query } from './db.js';
import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax',
  maxAge: 24 * 60 * 60 * 1000, // 24h
};

// genera il token. da usare ogni volta che si crea un token
function setAuthCookie(user, res) {
  const payload = { id: user.id, username: user.username };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
  res.cookie('token', token, COOKIE_OPTS);
}

// Middleware: verifica il token nel cookie e mette i dati utente in req.user.
function verifyToken(req, res, next) {
  if (req.cookies == undefined) {
    return res.status(401).json({ error: 'Autenticazione richiesta' });
  }
  const token = req.cookies.token;
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Token non valido o scaduto' });
  }
}

// POST /api/auth/signup - Registra un nuovo utente
router.post('/signup', async (req, res) => {
  const { username, name, surname, password } = req.body || {};
  if (!username || !name || !surname || !password) {
    return res.status(400).json({ error: 'username, name, surname e password devono essere tutti specificati' });
  }
  try {
    const hash = await bcrypt.hash(password, 10);
    const result = await query(
      'INSERT INTO utente (username, name, surname, password) VALUES (?, ?, ?, ?)',
      [username, name, surname, hash]
    ); // insert con un valore Id del record torna l'Id
    const user = { id: Number(result.insertId), username, name, surname };
    setAuthCookie(user, res);
    res.status(201).json(user);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Username già in uso' });
    }
    console.error('signup error:', err);
    res.status(500).json({ error: 'Errore interno' });
  }
});

// POST /api/auth/signin - Login utente
router.post('/signin', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'username o password non forniti' });
  }
  try {
    const rows = await query(
      'SELECT id, username, name, surname, password FROM utente WHERE username = ?',
      [username]
    );
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Credenziali non valide' });
    }
    setAuthCookie(user, res);
    res.json({ id: user.id, username: user.username, name: user.name, surname: user.surname });
  } catch (err) {
    console.error('signin error:', err);
    res.status(500).json({ error: 'Errore interno' });
  }
});

// POST /api/auth/logout - cancella il cookie di sessione
router.post('/logout', (req, res) => {
  res.clearCookie('token', COOKIE_OPTS);
  res.json({ ok: true });
});

export default router;
export { verifyToken };
