import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { closeDb, initDb, getDb } from "../src/database/db.js";
import { createPlayer, saveState, findById } from "../src/database/players.repo.js";
import { administratorId, agentOverride, updateAgent } from "../src/admin.service.js";
import { saveChatEntry } from "../src/database/chat.repo.js";
import { globalHistory } from "../src/database/global-chat.repo.js";

describe("Merged database migrations and admin settings", () => {
  const dir = mkdtempSync(join(tmpdir(), "wisdom-merge-")),
    path = join(dir, "game.db");
  before(() => initDb(path));
  after(() => {
    closeDb();
    rmSync(dir, { recursive: true, force: true });
  });
  it("persists admin ownership and real model overrides without replacing player state", () => {
    createPlayer("first", "server_owner", "unused");
    saveState("first", { roomId: "hall", posX: 125, posY: -87, height: 1.18, rotY: 1.4 });
    assert.equal(administratorId(), "first");
    updateAgent("einstein", "Сначала проверь измеримость предложенного критерия.");
    closeDb();
    initDb(path);
    assert.equal(administratorId(), "first");
    assert.equal(
      agentOverride("einstein"),
      "Сначала проверь измеримость предложенного критерия.",
    );
    assert.equal(findById("first")!.pos_x, 125);
    assert.equal(findById("first")!.pos_y, -87);
    assert.equal(
      (getDb().prepare("SELECT COUNT(*) AS n FROM visitor_catalog").get() as any).n,
      30,
    );
    updateAgent("einstein", "");
    assert.equal(agentOverride("einstein"), undefined);
  });
  it("imports only public legacy chat once, preserving reactions and excluding private targets", () => {
    saveChatEntry(
      {
        speaker: "Игрок",
        kind: "player",
        text: "Публичная задача",
        target: "all",
        caseId: "open-council",
      },
      ["first"],
    );
    saveChatEntry(
      {
        speaker: "Игрок",
        kind: "player",
        text: "Личный план",
        target: "einstein",
        caseId: "private:einstein",
      },
      ["first"],
    );
    closeDb();
    initDb(path);
    assert.equal(globalHistory("council").messages.length, 1);
    assert.equal(globalHistory("council").messages[0].text, "Публичная задача");
    closeDb();
    initDb(path);
    assert.equal(globalHistory("council").messages.length, 1);
    assert.equal(
      (getDb().prepare("SELECT COUNT(*) AS n FROM chat_entries").get() as any).n,
      2,
    );
  });
});
