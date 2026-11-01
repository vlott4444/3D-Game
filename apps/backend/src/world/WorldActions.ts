import { EventEmitter } from "node:events";
import { cast } from "../agents/cast.js";
import { getDb } from "../database/db.js";
export type EditKind = "board" | "benches" | "water" | "garden";
export type WorldEdit = {
  kind: EditKind;
  variant: number;
  x: number;
  z: number;
  agentId: string;
};
export type BuildCommand = { action: "add" | "remove" | "move"; kind: EditKind };
const events = new EventEmitter();
const titles: Record<EditKind, string> = {
  board: "доска идей",
  benches: "скамейки",
  water: "питьевой пункт",
  garden: "сад",
};
const verbs: Record<string, BuildCommand["action"]> = {
  создай: "add",
  создайте: "add",
  поставь: "add",
  поставьте: "add",
  построй: "add",
  постройте: "add",
  добавь: "add",
  добавьте: "add",
  посади: "add",
  посадите: "add",
  установи: "add",
  установите: "add",
  убери: "remove",
  уберите: "remove",
  удали: "remove",
  удалите: "remove",
  снеси: "remove",
  снесите: "remove",
  переставь: "move",
  переставьте: "move",
  перенеси: "move",
  перенесите: "move",
};
const prefixes = new Set([
  "совет",
  "мудрецы",
  "мудрецов",
  "пожалуйста",
  ...cast.flatMap((p) => p.name.toLowerCase().split(/\s+/)),
  ...cast.flatMap((p) => [...p.aliases]),
]);
export function classifyWorldCommand(text: string): BuildCommand | null {
  // Only a direct imperative, optionally preceded by a name/polite address.
  // Quotes and hypotheticals are discussion, not an instruction to mutate the world.
  if (/[«»"“”]/.test(text)) return null;
  const words =
    text
      .toLowerCase()
      .replace(/ё/g, "е")
      .match(/[\p{L}\p{N}]+/gu) || [];
  let start = 0;
  while (prefixes.has(words[start])) start++;
  const action = verbs[words[start]];
  if (!action) return null;
  const rest = words.slice(start + 1);
  if (rest.some((word) => verbs[word] || word === "не")) return null;
  const kinds: EditKind[] = [];
  if (rest.some((w) => w.startsWith("доск"))) kinds.push("board");
  if (rest.some((w) => w.startsWith("скам"))) kinds.push("benches");
  if (rest.some((w) => /^(сад|сада|саду|садик|цветник|клумба|клумбу|клумбы)$/.test(w)))
    kinds.push("garden");
  if (
    rest.some((w) => w.startsWith("фонтан") || w.startsWith("колонк")) ||
    (rest.some((w) => w.startsWith("пункт")) &&
      rest.some((w) => w.startsWith("пить") || w.startsWith("вод")))
  )
    kinds.push("water");
  return kinds.length === 1 ? { action, kind: kinds[0] } : null;
}
function position(kind: EditKind, variant: number) {
  const positions = {
    board: [-6, 18],
    benches: [18, variant ? 25 : 18],
    water: [7, 27],
    garden: [-22, 27],
  };
  const [x, z] = positions[kind];
  return { x: variant && kind !== "benches" ? -x : x, z };
}
export function listWorldEdits(): WorldEdit[] {
  return (
    getDb()
      .prepare("SELECT kind,variant,agent_id FROM world_edits ORDER BY kind")
      .all() as { kind: EditKind; variant: number; agent_id: string }[]
  ).map((row) => ({
    kind: row.kind,
    variant: row.variant,
    agentId: row.agent_id,
    ...position(row.kind, row.variant),
  }));
}
export function worldRevision() {
  return Number(
    (
      getDb().prepare("SELECT value FROM world_meta WHERE key='revision'").get() as {
        value: number;
      }
    ).value,
  );
}
export function onWorldChange(
  listener: (change: {
    edit: WorldEdit;
    previous?: WorldEdit;
    revision: number;
    text: string;
  }) => void,
) {
  events.on("change", listener);
  return () => {
    events.off("change", listener);
  };
}
export function applyWorldCommand(
  command: BuildCommand,
  agentId: string,
  playerId: string,
) {
  const agent = cast.find((p) => p.id === agentId);
  if (!agent) throw Error("Неизвестный строитель");
  if (!titles[command.kind] || !["add", "remove", "move"].includes(command.action))
    throw Error("Неизвестное изменение мира");
  const db = getDb();
  let result: {
    changed: boolean;
    text: string;
    revision: number;
    edit: WorldEdit;
    previous?: WorldEdit;
  };
  db.exec("BEGIN IMMEDIATE");
  try {
    const previous = listWorldEdits().find((edit) => edit.kind === command.kind);
    if (
      (command.action === "add" && previous) ||
      (command.action !== "add" && !previous)
    ) {
      result = {
        changed: false,
        text: previous
          ? `${titles[command.kind]} уже есть во дворе.`
          : `Во дворе пока нет объекта «${titles[command.kind]}».`,
        revision: worldRevision(),
        edit: previous || {
          kind: command.kind,
          variant: 0,
          agentId,
          ...position(command.kind, 0),
        },
      };
    } else {
      const variant = command.action === "move" ? 1 - previous!.variant : 0;
      const edit: WorldEdit = {
        kind: command.kind,
        variant,
        agentId,
        ...position(command.kind, variant),
      };
      if (command.action === "remove")
        db.prepare("DELETE FROM world_edits WHERE kind=?").run(command.kind);
      else
        db.prepare(
          `INSERT INTO world_edits(kind,variant,agent_id,player_id,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(kind) DO UPDATE SET variant=excluded.variant,agent_id=excluded.agent_id,player_id=excluded.player_id,updated_at=excluded.updated_at`,
        ).run(command.kind, variant, agentId, playerId, Date.now());
      db.prepare("UPDATE world_meta SET value=value+1 WHERE key='revision'").run();
      const revision = worldRevision();
      db.prepare(
        "INSERT INTO world_edit_log(kind,action,agent_id,player_id,revision,created_at) VALUES (?,?,?,?,?,?)",
      ).run(command.kind, command.action, agentId, playerId, revision, Date.now());
      const verb = { add: "создаёт", remove: "убирает", move: "переставляет" }[
        command.action
      ];
      result = {
        changed: true,
        text: `${agent.name} ${verb} объект «${titles[command.kind]}» во дворе зала.`,
        revision,
        edit,
        previous,
      };
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  if (result.changed) events.emit("change", result);
  return result;
}
