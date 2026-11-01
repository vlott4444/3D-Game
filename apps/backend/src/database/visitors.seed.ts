import type { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
export function seedVisitors(db: DatabaseSync) {
  const rows = JSON.parse(
    readFileSync(new URL("../agents/visitors/catalog.json", import.meta.url), "utf8"),
  ) as { id: string; name: string; role: string; category: string; problem: string }[];
  db.exec("BEGIN IMMEDIATE");
  try {
    const insert = db.prepare(
      "INSERT OR IGNORE INTO visitor_catalog(id,name,role,category,problem) VALUES (?,?,?,?,?)",
    );
    for (const row of rows)
      insert.run(row.id, row.name, row.role, row.category, row.problem);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
