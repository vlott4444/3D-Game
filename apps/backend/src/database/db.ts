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
