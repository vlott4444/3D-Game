CREATE TABLE IF NOT EXISTS players (
  id            TEXT PRIMARY KEY,
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    INTEGER NOT NULL,
  last_seen     INTEGER,
  room_id       TEXT,
  pos_x         REAL DEFAULT 0,
  pos_y         REAL DEFAULT 0,
  rot_y         REAL DEFAULT 0
);
