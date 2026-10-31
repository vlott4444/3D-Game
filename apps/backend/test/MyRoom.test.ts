import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initDb, closeDb, getDb } from "../src/database/db.js";
import { createPlayer, findById, saveState } from "../src/database/players.repo.js";
import {
  hashPassword,
  verifyPassword,
  signToken,
  verifyToken,
} from "../src/auth/auth.service.js";
import { AgentService } from "../src/agents/AgentService.js";
describe("Persistence, identity and agent pipeline", () => {
  const dir = mkdtempSync(join(tmpdir(), "island-test-"));
  const path = join(dir, "game.db");
  before(() => initDb(path));
  after(() => {
    closeDb();
    rmSync(dir, { recursive: true, force: true });
  });
  it("restores committed position after database close and reopen", () => {
    createPlayer("p1", "tester", "unused");
    saveState("p1", {
      roomId: "old-room",
      posX: -4.25,
      posY: 8.5,
      height: 1.18,
      rotY: 1.3,
    });
    closeDb();
    initDb(path);
    const row = findById("p1")!;
    assert.equal(row.pos_x, -4.25);
    assert.equal(row.pos_y, 8.5);
    assert.equal(row.rot_y, 1.3);
    assert.ok(row.last_seen);
  });
  it("checks passwords and signed identity", async () => {
    const hash = await hashPassword("test-password");
    assert.ok(await verifyPassword("test-password", hash));
    assert.equal(await verifyPassword("wrong", hash), false);
    assert.equal(
      verifyToken(signToken({ playerId: "p1", username: "tester" })).playerId,
      "p1",
    );
    assert.throws(() => verifyToken("invalid"));
  });
  it("calls model, carries history, isolates players and gates evidence", async () => {
    const original = globalThis.fetch;
    const calls: any[] = [];
    globalThis.fetch = async (_url, init) => {
      calls.push(JSON.parse(init!.body as string));
      return new Response(
        JSON.stringify({ message: { content: "Ответ тестовой модели" } }),
        { status: 200 },
      );
    };
    try {
      const service = new AgentService();
      await service.reply({
        playerId: "p1",
        npcId: "tesla",
        message: "Что случилось с генератором?",
      });
      assert.equal(
        getDb()
          .prepare("SELECT * FROM evidence WHERE player_id='p1' AND clue_id='power'")
          .get(),
        undefined,
      );
      assert.ok(calls[0].messages[0].content.includes("Ты скрываешь"));
      await service.reply({
        playerId: "p1",
        npcId: "einstein",
        message: "Когда ударил колокол?",
      });
      const answer = await service.reply({
        playerId: "p1",
        npcId: "tesla",
        message: "Мы проверили колокол. Что с генератором?",
      });
      assert.equal(answer.clue?.id, "power");
      assert.ok(calls[2].messages.length >= 4);
      await service.reply({ playerId: "p2", npcId: "tesla", message: "Привет" });
      assert.equal(calls[3].messages.length, 2);
      const firstVisit = { id: "visit-a", name: "Мира", problem: "Как поделить воду?" };
      const visitReply = await service.reply({
        playerId: "p1",
        npcId: "tesla",
        message: "С чего начать?",
        caseContext: firstVisit,
      });
      assert.equal(visitReply.clue, undefined);
      assert.equal(calls[4].messages.length, 2);
      assert.ok(calls[4].messages[0].content.includes("Ты советник"));
      await service.reply({
        playerId: "p1",
        npcId: "tesla",
        message: "Новая проблема",
        caseContext: { ...firstVisit, id: "visit-b" },
      });
      assert.equal(calls[5].messages.length, 2);
      await service.reply({
        playerId: "p1",
        npcId: "tesla",
        message: "Продолжим",
        caseContext: firstVisit,
      });
      assert.equal(calls[6].messages.length, 4);
      globalThis.fetch = async () => {
        throw Error("offline");
      };
      await assert.rejects(() =>
        service.reply({ playerId: "p1", npcId: "curie", message: "Вода?" }),
      );
      assert.equal(
        getDb().prepare("SELECT * FROM dialogue WHERE npc_id='curie'").get(),
        undefined,
      );
    } finally {
      globalThis.fetch = original;
    }
  });
});
