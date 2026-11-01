import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { seedVisitors } from "./visitors.seed.js";
let db: DatabaseSync;
export function initDb(
  path = process.env.DB_PATH ||
    fileURLToPath(new URL("../../data/game.db", import.meta.url)),
) {
  if (db) return db;
  if (path !== ":memory:") mkdirSync(dirname(resolve(path)), { recursive: true });
  db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;");
  db.exec(readFileSync(new URL("./schema.sql", import.meta.url), "utf8"));
  const columns = db.prepare("PRAGMA table_info(players)").all() as { name: string }[];
  if (!columns.some((c) => c.name === "height"))
    db.exec("ALTER TABLE players ADD COLUMN height REAL DEFAULT 1.18");
  db.exec(`CREATE TABLE IF NOT EXISTS dialogue (id INTEGER PRIMARY KEY, player_id TEXT NOT NULL, npc_id TEXT NOT NULL, role TEXT NOT NULL, content TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS dialogue_lookup ON dialogue(player_id,npc_id,id);`);
  const dialogueColumns = db.prepare("PRAGMA table_info(dialogue)").all() as {
    name: string;
  }[];
  if (!dialogueColumns.some((c) => c.name === "case_id"))
    db.exec("ALTER TABLE dialogue ADD COLUMN case_id TEXT");
  if (!dialogueColumns.some((c) => c.name === "channel"))
    db.exec("ALTER TABLE dialogue ADD COLUMN channel TEXT NOT NULL DEFAULT 'council'");
  // Import only previously public messages, once. Private account history stays private.
  const globalColumns = db.prepare("PRAGMA table_info(global_messages)").all() as {
    name: string;
  }[];
  for (const [name, type] of [
    ["case_id", "TEXT"],
    ["reaction_name", "TEXT"],
    ["reaction_text", "TEXT"],
    ["source_entry_id", "INTEGER"],
  ]) {
    if (!globalColumns.some((c) => c.name === name))
      db.exec(`ALTER TABLE global_messages ADD COLUMN ${name} ${type}`);
  }
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS global_messages_source ON global_messages(source_entry_id);
    INSERT OR IGNORE INTO global_messages(channel,speaker,kind,text,npc_id,created_at,case_id,reaction_name,reaction_text,source_entry_id)
    SELECT CASE target WHEN 'players' THEN 'players' ELSE 'council' END,speaker,kind,text,npc_id,created_at,case_id,reaction_name,reaction_text,id
    FROM chat_entries WHERE target IN ('players','all');`);
  seedVisitors(db);
  return db;
}
export function getDb() {
  if (!db) throw new Error("DB not initialized");
  return db;
}
export function closeDb() {
  if (db) {
    db.close();
    db = undefined!;
  }
}
