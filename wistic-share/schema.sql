CREATE TABLE IF NOT EXISTS clips (
  id          TEXT PRIMARY KEY,
  uid         TEXT NOT NULL,
  author      TEXT,
  title       TEXT,
  game        TEXT,
  size        INTEGER NOT NULL,
  created     INTEGER NOT NULL,
  last_viewed INTEGER NOT NULL,
  views       INTEGER NOT NULL DEFAULT 0,
  ready       INTEGER NOT NULL DEFAULT 0,
  thumb       INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS clips_uid  ON clips(uid);
CREATE INDEX IF NOT EXISTS clips_seen ON clips(last_viewed);

-- Support-tickets (Wistic Support)
CREATE TABLE IF NOT EXISTS tickets (
  id        TEXT PRIMARY KEY,
  token     TEXT NOT NULL UNIQUE,
  name      TEXT,
  email     TEXT,
  category  TEXT NOT NULL,
  subject   TEXT NOT NULL,
  status    TEXT NOT NULL DEFAULT 'open',
  created   INTEGER NOT NULL,
  updated   INTEGER NOT NULL,
  last_from TEXT NOT NULL DEFAULT 'user',
  unread    INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS tickets_updated ON tickets(updated);
CREATE TABLE IF NOT EXISTS messages (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id TEXT NOT NULL,
  author    TEXT NOT NULL,
  body      TEXT NOT NULL,
  created   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS messages_ticket ON messages(ticket_id);
CREATE TABLE IF NOT EXISTS files (
  id        TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL,
  message_id INTEGER NOT NULL,
  name      TEXT NOT NULL,
  type      TEXT NOT NULL,
  size      INTEGER NOT NULL,
  created   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS files_ticket ON files(ticket_id);
CREATE TABLE IF NOT EXISTS rl (
  k TEXT NOT NULL,
  t INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS rl_k ON rl(k, t);
