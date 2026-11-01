import { getDb } from "./db.js";
export type ChatEntry = {
  id?: number;
  speaker: string;
  kind: string;
  text: string;
  target: string;
  caseId: string;
  npcId?: string;
  requestId?: string;
  reactionTo?: { name: string; text: string };
};
export function saveChatEntry(entry: ChatEntry, recipients: string[]): ChatEntry {
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = db
      .prepare(
        `INSERT INTO chat_entries(speaker,kind,text,target,case_id,npc_id,request_id,reaction_name,reaction_text,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        entry.speaker,
        entry.kind,
        entry.text,
        entry.target,
        entry.caseId,
        entry.npcId ?? null,
        entry.requestId ?? null,
        entry.reactionTo?.name ?? null,
        entry.reactionTo?.text ?? null,
        Date.now(),
      );
    const id = Number(result.lastInsertRowid);
    const receipt = db.prepare(
      "INSERT OR IGNORE INTO chat_receipts(entry_id,player_id) VALUES (?,?)",
    );
    for (const playerId of new Set(recipients)) receipt.run(id, playerId);
    db.exec("COMMIT");
    return { ...entry, id };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
export function chatHistory(
  playerId: string,
  target: string,
  caseId: string,
): ChatEntry[] {
  const rows = getDb()
    .prepare(
      `SELECT e.* FROM chat_entries e JOIN chat_receipts r ON r.entry_id=e.id WHERE r.player_id=? AND e.target=? AND e.case_id=? ORDER BY e.id DESC LIMIT 100`,
    )
    .all(playerId, target, caseId) as any[];
  return rows.reverse().map((row) => ({
    id: row.id,
    speaker: row.speaker,
    kind: row.kind,
    text: row.text,
    target: row.target,
    caseId: row.case_id,
    npcId: row.npc_id ?? undefined,
    requestId: row.request_id ?? undefined,
    reactionTo: row.reaction_name
      ? { name: row.reaction_name, text: row.reaction_text }
      : undefined,
  }));
}
