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

CREATE TABLE IF NOT EXISTS chat_entries (
  id INTEGER PRIMARY KEY,
  speaker TEXT NOT NULL,
  kind TEXT NOT NULL,
  text TEXT NOT NULL,
  target TEXT NOT NULL,
  case_id TEXT NOT NULL,
  npc_id TEXT,
  request_id TEXT,
  reaction_name TEXT,
  reaction_text TEXT,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS chat_receipts (
  entry_id INTEGER NOT NULL,
  player_id TEXT NOT NULL,
  PRIMARY KEY (entry_id, player_id)
);
CREATE INDEX IF NOT EXISTS chat_receipts_player ON chat_receipts(player_id, entry_id);
