const Database = require('better-sqlite3');
const db = new Database('./solace.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    real_name TEXT NOT NULL,
    real_email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    alias TEXT,
    is_anonymous INTEGER DEFAULT 0,
    is_admin INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS groups_table (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT DEFAULT 'chat'
  );
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER,
    user_id INTEGER,
    content TEXT,
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS group_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    group_id INTEGER,
    UNIQUE(user_id, group_id)
  );
  CREATE TABLE IF NOT EXISTS admin_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    type TEXT DEFAULT 'group',
    scheduled_at DATETIME,
    admin_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

const count = db.prepare('SELECT COUNT(*) as c FROM groups_table').get();
if (count.c === 0) {
  const ins = db.prepare('INSERT INTO groups_table (name, description, type) VALUES (?,?,?)');
  ins.run('Morning Anxiety Circle', 'Start your day grounded and lighter', 'chat');
  ins.run('Grief & Loss Support', 'A compassionate space for loss', 'chat');
  ins.run('Mindful Mondays', 'Weekly mindfulness sessions', 'video');
  ins.run('Late Night Thoughts', 'Always open, anonymous friendly', 'chat');
}

module.exports = db;