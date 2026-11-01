import { EventEmitter } from "node:events";
import { getDb } from "./db.js";
import type { ChatEntry } from "./chat.repo.js";

export type GlobalChannel = "players" | "council";
export type GlobalEntry = {
  id: number;
  channel: GlobalChannel;
  speaker: string;
  kind: string;
  text: string;
  npcId?: string;
  caseId?: string;
  reactionTo?: { name: string; text: string };
  createdAt: number;
};
const events = new EventEmitter();
events.setMaxListeners(0);
function decode(row: any): GlobalEntry {
  return {
    id: row.id,
    channel: row.channel,
    speaker: row.speaker,
    kind: row.kind,
    text: row.text,
    npcId: row.npc_id ?? undefined,
    caseId: row.case_id ?? undefined,
    reactionTo: row.reaction_name
      ? { name: row.reaction_name, text: row.reaction_text }
      : undefined,
    createdAt: row.created_at,
  };
}
export function publishGlobal(
  channel: GlobalChannel,
  entry: Omit<ChatEntry, "target" | "caseId"> & { caseId?: string },
) {
  const db = getDb();
  const result = db
    .prepare(
      `INSERT INTO global_messages(channel,speaker,kind,text,npc_id,created_at,case_id,reaction_name,reaction_text,source_entry_id) VALUES (?,?,?,?,?,?,?,?,?,?)`,
    )
    .run(
      channel,
      entry.speaker,
      entry.kind,
      entry.text,
      entry.npcId ?? null,
      Date.now(),
      entry.caseId ?? null,
      entry.reactionTo?.name ?? null,
      entry.reactionTo?.text ?? null,
      entry.id ?? null,
    );
  const saved = decode(
    db.prepare("SELECT * FROM global_messages WHERE id=?").get(result.lastInsertRowid),
  );
  events.emit(
    "message",
    saved,
    entry.id
      ? { ...entry, target: channel === "players" ? "players" : "all" }
      : undefined,
  );
  return saved;
}
export function onGlobalMessage(
  listener: (entry: GlobalEntry, legacy?: ChatEntry) => void,
) {
  events.on("message", listener);
  return () => {
    events.off("message", listener);
  };
}
export function globalHistory(channel: GlobalChannel, beforeId?: number) {
  const rows = (
    beforeId
      ? getDb()
          .prepare(
            "SELECT * FROM global_messages WHERE channel=? AND id<? ORDER BY id DESC LIMIT 101",
          )
          .all(channel, beforeId)
      : getDb()
          .prepare(
            "SELECT * FROM global_messages WHERE channel=? ORDER BY id DESC LIMIT 101",
          )
          .all(channel)
  ) as any[];
  return {
    channel,
    beforeId,
    hasMore: rows.length > 100,
    messages: rows.slice(0, 100).reverse().map(decode),
  };
}
