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

CREATE TABLE IF NOT EXISTS visitor_catalog (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL,
  category TEXT NOT NULL, problem TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS visitor_draws (
  id INTEGER PRIMARY KEY, visit_key TEXT NOT NULL UNIQUE,
  visitor_id TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS visitor_seen (
  player_id TEXT NOT NULL, visitor_id TEXT NOT NULL,
  count INTEGER NOT NULL, last_draw INTEGER NOT NULL,
  PRIMARY KEY(player_id,visitor_id)
);
CREATE TABLE IF NOT EXISTS visitor_presence (
  draw_id INTEGER NOT NULL, player_id TEXT NOT NULL,
  PRIMARY KEY(draw_id,player_id)
);

CREATE TABLE IF NOT EXISTS world_edits (
  kind TEXT PRIMARY KEY, variant INTEGER NOT NULL,
  agent_id TEXT NOT NULL, player_id TEXT NOT NULL, updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS world_meta (key TEXT PRIMARY KEY,value INTEGER NOT NULL);
INSERT OR IGNORE INTO world_meta(key,value) VALUES ('revision',0);
CREATE TABLE IF NOT EXISTS world_edit_log (
  id INTEGER PRIMARY KEY, kind TEXT NOT NULL, action TEXT NOT NULL,
  agent_id TEXT NOT NULL, player_id TEXT NOT NULL, revision INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS global_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel TEXT NOT NULL CHECK(channel IN ('players','council')),
  speaker TEXT NOT NULL, kind TEXT NOT NULL, text TEXT NOT NULL, npc_id TEXT,
  created_at INTEGER NOT NULL, case_id TEXT, reaction_name TEXT, reaction_text TEXT,
  source_entry_id INTEGER
);
CREATE INDEX IF NOT EXISTS global_messages_channel_id ON global_messages(channel,id);

CREATE TABLE IF NOT EXISTS server_settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS interactive_objects(id TEXT PRIMARY KEY,state TEXT NOT NULL,updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS agent_overrides(npc_id TEXT PRIMARY KEY, prompt TEXT NOT NULL, updated_at INTEGER NOT NULL);
