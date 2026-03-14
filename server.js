require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');
const db = require('./db');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/register', async (req, res) => {
  const { real_name, real_email, password, alias, is_anonymous } = req.body;
  try {
    const hash = await bcrypt.hash(password, 12);
    db.prepare('INSERT INTO users (real_name, real_email, password_hash, alias, is_anonymous) VALUES (?,?,?,?,?)').run(real_name, real_email, hash, alias || real_name, is_anonymous ? 1 : 0);
    res.json({ success: true });
  } catch(e) { res.status(400).json({ error: 'Email already used.' }); }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE real_email = ?').get(email);
  if (!user) return res.status(401).json({ error: 'User not found' });
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Wrong password' });
  const token = jwt.sign({ id: user.id, alias: user.alias, is_admin: user.is_admin, is_anonymous: user.is_anonymous }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, alias: user.alias, is_admin: user.is_admin });
});

function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Not logged in' });
  try { req.user = jwt.verify(token, process.env.JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Invalid session' }); }
}

app.get('/api/groups', (req, res) => res.json(db.prepare('SELECT * FROM groups_table').all()));

app.post('/api/groups/:id/join', auth, (req, res) => {
  db.prepare('INSERT OR IGNORE INTO group_members (user_id, group_id) VALUES (?,?)').run(req.user.id, req.params.id);
  res.json({ success: true });
});

app.get('/api/groups/:id/messages', auth, (req, res) => {
  const rows = db.prepare(`SELECT m.content, m.sent_at, CASE WHEN u.is_anonymous=1 THEN u.alias ELSE u.real_name END as display_name FROM messages m JOIN users u ON m.user_id=u.id WHERE m.group_id=? ORDER BY m.sent_at ASC LIMIT 100`).all(req.params.id);
  res.json(rows);
});

app.get('/api/admin/users', auth, (req, res) => {
  if (!req.user.is_admin) return res.status(403).json({ error: 'Admins only' });
  res.json(db.prepare('SELECT id, real_name, real_email, alias, is_anonymous, is_admin, created_at FROM users').all());
});

app.post('/api/sessions', auth, (req, res) => {
  if (!req.user.is_admin) return res.status(403).json({ error: 'Admins only' });
  const { title, description, type, scheduled_at } = req.body;
  db.prepare('INSERT INTO admin_sessions (title, description, type, scheduled_at, admin_id) VALUES (?,?,?,?,?)').run(title, description, type, scheduled_at, req.user.id);
  res.json({ success: true });
});

app.get('/api/sessions', (req, res) => res.json(db.prepare('SELECT * FROM admin_sessions ORDER BY scheduled_at ASC').all()));

io.use((socket, next) => {
  try { socket.user = jwt.verify(socket.handshake.auth.token, process.env.JWT_SECRET); next(); }
  catch { next(new Error('Unauthorized')); }
});

io.on('connection', (socket) => {
  socket.on('join-room', (groupId) => socket.join(`group-${groupId}`));
  socket.on('message', ({ groupId, content }) => {
    db.prepare('INSERT INTO messages (group_id, user_id, content) VALUES (?,?,?)').run(groupId, socket.user.id, content);
    io.to(`group-${groupId}`).emit('message', { alias: socket.user.alias, content, sent_at: new Date().toISOString() });
  });
});

app.get('/{*path}', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

server.listen(process.env.PORT || 3000, () => console.log('🌸 Solace running at http://localhost:3000'));