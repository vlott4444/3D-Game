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
import { chatHistory, saveChatEntry } from "../src/database/chat.repo.js";
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
  it("remembers council tasks by player and case without reviving the old plot", async () => {
    const original = globalThis.fetch;
    const calls: any[] = [];
    globalThis.fetch = async (_url, options) => {
      calls.push(JSON.parse(options!.body as string));
      return new Response(
        JSON.stringify({ message: { content: "Ответ тестовой модели" } }),
      );
    };
    try {
      const service = new AgentService();
      getDb()
        .prepare("INSERT INTO dialogue(player_id,npc_id,role,content) VALUES (?,?,?,?)")
        .run("p1", "machiavelli", "assistant", "Старое детективное показание");
      const basic = {
        playerId: "p1",
        npcId: "machiavelli",
        message: "Как договориться о расписании?",
      };
      await service.reply(basic);
      assert.equal(calls[0].messages.length, 2);
      assert.equal(
        /куратор|убийств|Старое детективное показание/.test(JSON.stringify(calls[0])),
        false,
      );
      await service.reply({ ...basic, message: "А если правило нарушат?" });
      assert.equal(calls[1].messages.length, 4);
      await service.reply({ ...basic, playerId: "p2" });
      assert.equal(calls[2].messages.length, 2);
      const visit = { id: "visit-a", name: "Мира", problem: "Как поделить воду?" };
      await service.reply({ ...basic, caseContext: visit });
      assert.equal(calls[3].messages.length, 2);
      await service.reply({ ...basic, caseContext: { ...visit, id: "visit-b" } });
      assert.equal(calls[4].messages.length, 2);
      await service.reply({ ...basic, caseContext: visit });
      assert.equal(calls[5].messages.length, 4);
      globalThis.fetch = async () => {
        throw Error("offline");
      };
      await assert.rejects(() => service.reply({ ...basic, npcId: "nightingale" }));
      assert.equal(
        getDb().prepare("SELECT id FROM dialogue WHERE npc_id='nightingale'").get(),
        undefined,
      );
    } finally {
      globalThis.fetch = original;
    }
  });
  it("gives a reacting character the actual proposal and keeps the player's original text in memory", async () => {
    const original = globalThis.fetch;
    let body: any;
    globalThis.fetch = async (_url, options) => {
      body = JSON.parse(options!.body as string);
      return new Response(
        JSON.stringify({
          message: {
            content:
              "Макиавелли, кто выберет представителей семей и сможет проверить их решения?",
          },
        }),
      );
    };
    try {
      const proposal =
        "Пусть представители разных семей вместе подтверждают выдачу воды.";
      await new AgentService().reply({
        playerId: "p1",
        npcId: "socrates",
        message: "Что скажешь?",
        caseContext: { id: "reaction", name: "Мира", problem: "Вода" },
        roundReplies: [{ name: "Никколо Макиавелли", text: proposal }],
      });
      assert.ok(body.messages.at(-1).content.includes(proposal));
      assert.ok(body.messages.at(-1).content.includes("Никколо Макиавелли"));
      assert.equal(
        (
          getDb()
            .prepare(
              "SELECT content FROM dialogue WHERE case_id='reaction' AND role='user'",
            )
            .get() as any
        ).content,
        "Что скажешь?",
      );
    } finally {
      globalThis.fetch = original;
    }
  });
  it("persists channel histories once per message and only for their recipients", () => {
    const one = saveChatEntry(
      {
        speaker: "tester",
        kind: "player",
        text: "Общий вопрос",
        target: "all",
        caseId: "chat-test",
      },
      ["p1", "p2"],
    );
    saveChatEntry(
      {
        speaker: "Ада",
        kind: "npc",
        text: "Проверим условие пересмотра.",
        target: "all",
        caseId: "chat-test",
        reactionTo: { name: "Макиавелли", text: "Предлагаю контроль." },
      },
      ["p1", "p2"],
    );
    saveChatEntry(
      {
        speaker: "Диоген",
        kind: "npc",
        text: "Упростим.",
        target: "diogenes",
        caseId: "chat-test",
      },
      ["p1"],
    );
    assert.equal(chatHistory("p1", "all", "chat-test").length, 2);
    assert.equal(chatHistory("p2", "all", "chat-test")[0].id, one.id);
    assert.equal(chatHistory("p2", "diogenes", "chat-test").length, 0);
    assert.equal(chatHistory("unrelated", "all", "chat-test").length, 0);
    closeDb();
    initDb(path);
    assert.equal(chatHistory("p1", "all", "chat-test")[1].reactionTo?.name, "Макиавелли");
  });
  it("does not persist a repeated or explicitly abstaining second contribution", async () => {
    const original = globalThis.fetch;
    const same =
      "Предлагаю сначала собрать сведения о числе людей и общем объёме доступной воды.";
    const service = new AgentService();
    const request = {
      playerId: "p1",
      npcId: "diogenes",
      message: "Что добавишь?",
      caseContext: { id: "echo-test", name: "Мира", problem: "Вода" },
      roundReplies: [{ name: "Ада", text: same }],
    };
    try {
      globalThis.fetch = async () =>
        new Response(JSON.stringify({ message: { content: same } }));
      assert.equal((await service.reply(request)).abstained, true);
      globalThis.fetch = async () =>
        new Response(JSON.stringify({ message: { content: "[ВОЗДЕРЖУСЬ]" } }));
      assert.equal((await service.reply(request)).abstained, true);
      assert.equal(
        getDb().prepare("SELECT id FROM dialogue WHERE case_id='echo-test'").get(),
        undefined,
      );
      await assert.rejects(() => service.reply({ ...request, roundReplies: [] }));
    } finally {
      globalThis.fetch = original;
    }
  });
});
