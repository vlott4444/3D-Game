import { randomInt, randomUUID } from "node:crypto";
import { getDb } from "./db.js";
export type VisitorRecord = {
  id: string;
  name: string;
  role: string;
  category: string;
  problem: string;
};
type Seen = { player_id: string; visitor_id: string; count: number; last_draw: number };
function recordSeen(drawId: number, visitorId: string, players: string[]) {
  const db = getDb();
  for (const playerId of new Set(players)) {
    const receipt = db
      .prepare("INSERT OR IGNORE INTO visitor_presence(draw_id,player_id) VALUES (?,?)")
      .run(drawId, playerId);
    if (Number(receipt.changes))
      db.prepare(
        `INSERT INTO visitor_seen(player_id,visitor_id,count,last_draw) VALUES (?,?,1,?) ON CONFLICT(player_id,visitor_id) DO UPDATE SET count=count+1,last_draw=excluded.last_draw`,
      ).run(playerId, visitorId, drawId);
  }
}
export function drawVisitor(
  players: string[],
  visitKey: string = randomUUID(),
  now = Date.now(),
  random: (max: number) => number = randomInt,
): VisitorRecord {
  players = [...new Set(players)];
  if (!players.length) throw Error("Не задан участник приёма");
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const catalog = db
      .prepare(
        "SELECT id,name,role,category,problem FROM visitor_catalog WHERE enabled=1 ORDER BY id",
      )
      .all() as VisitorRecord[];
    if (!catalog.length) throw Error("Каталог посетителей пуст");
    const seen = db
      .prepare(
        `SELECT * FROM visitor_seen WHERE player_id IN (${players.map(() => "?").join(",")})`,
      )
      .all(...players) as Seen[];
    let pool: VisitorRecord[] = [];
    // Each present player gets a cooldown. If many histories exclude everything,
    // relax gradually; a normal single-player cycle still covers the whole catalog.
    for (
      let cooldown = Math.min(8, catalog.length - 1);
      cooldown >= 0 && !pool.length;
      cooldown--
    ) {
      const recent = new Set<string>();
      for (const playerId of players)
        seen
          .filter((row) => row.player_id === playerId)
          .sort((a, b) => b.last_draw - a.last_draw)
          .slice(0, cooldown)
          .forEach((row) => recent.add(row.visitor_id));
      pool = catalog.filter((row) => !recent.has(row.id));
    }
    const score = (id: string) =>
      seen
        .filter((row) => row.visitor_id === id)
        .reduce((sum, row) => sum + row.count, 0);
    const min = Math.min(...pool.map((row) => score(row.id)));
    pool = pool.filter((row) => score(row.id) === min);
    const index = random(pool.length);
    if (!Number.isInteger(index) || index < 0 || index >= pool.length)
      throw Error("Некорректный источник случайности");
    const selected = pool[index];
    const result = db
      .prepare(
        "INSERT INTO visitor_draws(visit_key,visitor_id,created_at) VALUES (?,?,?)",
      )
      .run(visitKey, selected.id, now);
    recordSeen(Number(result.lastInsertRowid), selected.id, players);
    db.exec("COMMIT");
    return selected;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
export function rememberCurrentVisitor(playerId: string, visitKey: string) {
  const db = getDb();
  const draw = db
    .prepare("SELECT id,visitor_id FROM visitor_draws WHERE visit_key=?")
    .get(visitKey) as { id: number; visitor_id: string } | undefined;
  if (!draw) return;
  db.exec("BEGIN IMMEDIATE");
  try {
    recordSeen(draw.id, draw.visitor_id, [playerId]);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
