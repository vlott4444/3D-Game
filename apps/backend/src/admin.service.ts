import { getDb } from "./database/db.js";
import { cast } from "./agents/cast.js";

export function administratorId(): string | undefined {
  const db = getDb();
  if (process.env.ADMIN_USERNAME) {
    return (
      db
        .prepare("SELECT id FROM players WHERE username=?")
        .get(process.env.ADMIN_USERNAME) as { id: string } | undefined
    )?.id;
  }
  const setting = db
    .prepare("SELECT value FROM server_settings WHERE key='admin_player_id'")
    .get() as { value: string } | undefined;
  if (setting) return setting.value;
  const owner = db
    .prepare("SELECT id FROM players ORDER BY created_at,id LIMIT 1")
    .get() as { id: string } | undefined;
  if (owner)
    db.prepare(
      "INSERT OR IGNORE INTO server_settings(key,value) VALUES ('admin_player_id',?)",
    ).run(owner.id);
  return owner?.id;
}
export function isAdministrator(playerId: string) {
  return administratorId() === playerId;
}
export function agentOverride(npcId: string) {
  return (
    getDb().prepare("SELECT prompt FROM agent_overrides WHERE npc_id=?").get(npcId) as
      { prompt: string } | undefined
  )?.prompt;
}
export function updateAgent(npcId: unknown, prompt: unknown) {
  if (typeof npcId !== "string" || !cast.some((n) => n.id === npcId))
    throw Error("Участник совета не найден");
  if (typeof prompt !== "string" || prompt.length > 4000)
    throw Error("Инструкция должна быть строкой до 4000 символов");
  const value = prompt.trim();
  if (value)
    getDb()
      .prepare(
        "INSERT INTO agent_overrides(npc_id,prompt,updated_at) VALUES (?,?,?) ON CONFLICT(npc_id) DO UPDATE SET prompt=excluded.prompt,updated_at=excluded.updated_at",
      )
      .run(npcId, value, Date.now());
  else getDb().prepare("DELETE FROM agent_overrides WHERE npc_id=?").run(npcId);
}
