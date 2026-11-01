import assert from "node:assert/strict";
import { ColyseusSDK } from "@colyseus/sdk";
import { getDb } from "../src/database/db.js";
import { findByUsername, saveState } from "../src/database/players.repo.js";
import { globalHistory, publishGlobal } from "../src/database/global-chat.repo.js";
import { AgentService } from "../src/agents/AgentService.js";
function message(room: any, type: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      off();
      reject(Error(`timeout ${type}`));
    }, 10000);
    const off = room.onMessage(type, (value: any) => {
      clearTimeout(timer);
      off();
      resolve(value);
    });
  });
}
async function ready(room: any) {
  if (room.state?.players?.has(room.sessionId)) return;
  await new Promise((resolve) => room.onStateChange.once(resolve));
}
export function mergedChatTests(endpoint: string) {
  describe("Merged public and private conversations", function () {
    this.timeout(30000);
    const rooms: any[] = [];
    let original: typeof globalThis.fetch;
    const calls: any[] = [];
    let failModel = false;
    async function join(name: string, x: number, z: number, separate = false) {
      const response = await fetch(`${endpoint}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: name, password: "test-pass-123" }),
      });
      assert.equal(response.status, 200);
      const sdk = new ColyseusSDK(endpoint);
      sdk.auth.token = (await response.json()).token;
      saveState(findByUsername(name)!.id, {
        roomId: "saved",
        posX: x,
        posY: z,
        height: 1.18,
        rotY: 0,
      });
      const room = separate
        ? await sdk.create("my_room")
        : await sdk.joinOrCreate("my_room");
      rooms.push(room);
      await ready(room);
      return room;
    }
    before(async () => {
      original = globalThis.fetch;
      globalThis.fetch = async (url, options) => {
        if (!String(url).includes("11434/api/chat")) return original(url, options);
        if (failModel) throw Error("test offline");
        calls.push(JSON.parse(options!.body as string));
        return new Response(
          JSON.stringify({
            message: {
              content: "Проверим предложение небольшим опытом и сравним результат.",
            },
          }),
        );
      };
    });
    after(async () => {
      globalThis.fetch = original;
      for (const room of rooms) await room.leave();
    });
    it("keeps private messages and history invisible to another account, and always completes a reply", async () => {
      const a = await join("private_owner", -6, -2);
      const b = await join("private_observer", -6, -2);
      const leaked: any[] = [];
      const remove = [
        b.onMessage("dialogue", (m: any) => leaked.push(m)),
        b.onMessage("global_chat:message", (m: any) => leaked.push(m)),
        b.onMessage("private_npc:reply", (m: any) => leaked.push(m)),
      ];
      const reply = message(a, "private_npc:reply"),
        done = message(a, "private_npc:done");
      a.send("private_npc:send", {
        npcId: "einstein",
        text: "Личный секрет: уникальный план 9147",
        requestId: "private-one",
      });
      assert.equal((await reply).npcId, "einstein");
      assert.equal((await done).error, undefined);
      const own = message(a, "private_npc:history");
      a.send("private_npc:history_request", { npcId: "einstein" });
      assert.equal((await own).messages.length, 2);
      const other = message(b, "private_npc:history");
      b.send("private_npc:history_request", { npcId: "einstein" });
      assert.deepEqual((await other).messages, []);
      assert.ok(!leaked.some((m) => m.text?.includes("9147")));
      assert.ok(!globalHistory("council").messages.some((m) => m.text.includes("9147")));
      failModel = true;
      const failed = message(a, "private_npc:done");
      a.send("private_npc:send", {
        npcId: "einstein",
        text: "Повтори вопрос",
        requestId: "private-offline",
      });
      assert.ok((await failed).error);
      failModel = false;
      remove.forEach((off) => off());
    });
    it("shares player chat across rooms and gives public council history to a late joiner", async () => {
      const a = await join("public_speaker", 0, 0);
      const b = await join("public_other_room", 0, 0, true);
      const live = message(b, "global_chat:message");
      a.send("global_chat:send", { text: "Общий план 6721" });
      assert.equal((await live).text, "Общий план 6721");
      const done = message(a, "dialogue_done");
      a.send("chat", {
        target: "all",
        text: "Эйнштейн, как проверить общий план?",
        requestId: "public-council",
      });
      await done;
      const late = await join("public_late", 0, 0);
      const history = message(late, "global_chat:history");
      late.send("global_chat:history_request", { channel: "council" });
      const received = (await history).messages;
      assert.ok(received.some((m: any) => m.kind === "npc"));
      assert.ok(!received.some((m: any) => m.text.includes("9147")));
    });
    it("paginates public history by 100 messages without overlaps", () => {
      for (let i = 0; i < 121; i++)
        publishGlobal("players", {
          speaker: "tester",
          kind: "player",
          text: `page-${i}`,
        });
      const latest = globalHistory("players");
      assert.equal(latest.messages.length, 100);
      assert.equal(latest.hasMore, true);
      const older = globalHistory("players", latest.messages[0].id);
      assert.ok(older.messages.length > 0 && older.messages.length <= 100);
      assert.ok(older.messages.every((m) => m.id < latest.messages[0].id));
      const count = Number(
        (getDb().prepare("SELECT COUNT(*) AS n FROM global_messages").get() as any).n,
      );
      assert.ok(count >= 121);
    });
    it("isolates model memory even when public and private questions use the same case id", async () => {
      const service = new AgentService(),
        start = calls.length;
      const r = {
        playerId: "memory-owner",
        npcId: "socrates",
        message: "Сравни критерии",
        caseContext: { id: "same-case", name: "Игрок", problem: "Выбор" },
      };
      await service.reply({ ...r, channel: "private" });
      await service.reply({ ...r, channel: "council" });
      await service.reply({ ...r, channel: "private" });
      assert.equal(calls[start].messages.length, 2);
      assert.equal(calls[start + 1].messages.length, 2);
      assert.equal(calls[start + 2].messages.length, 4);
    });
    it("protects the admin API, reports authenticated metrics and applies saved instructions to the model", async () => {
      async function login(username: string) {
        const response = await fetch(`${endpoint}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password: "test-pass-123" }),
        });
        assert.equal(response.status, 200);
        return (await response.json()).token;
      }
      const owner = await login("player_one"),
        other = await login("private_owner");
      const api = (path: string, token?: string, body?: unknown) =>
        fetch(`${endpoint}/api/admin/${path}`, {
          method: body ? "POST" : "GET",
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            "Content-Type": "application/json",
          },
          body: body ? JSON.stringify(body) : undefined,
        });
      assert.equal((await api("agents")).status, 401);
      assert.equal((await api("agents", other)).status, 403);
      assert.equal((await (await api("agents", owner)).json()).length, 6);
      assert.equal(
        (
          await api("agent", owner, {
            npcId: "einstein",
            newPrompt: "Сравни стоимость опыта: admin-test-428",
          })
        ).status,
        200,
      );
      await new AgentService().reply({
        playerId: "admin-model",
        npcId: "einstein",
        message: "Как проверить гипотезу?",
      });
      assert.ok(calls.at(-1).messages[0].content.includes("admin-test-428"));
      const ping = message(rooms[0], "metrics:pong");
      rooms[0].send("metrics:ping", { nonce: 128 });
      assert.equal((await ping).nonce, 128);
      rooms[0].send("metrics", { fps: 47, ping: 9 });
      await new Promise((resolve) => setTimeout(resolve, 100));
      const metrics = await (await api("metrics", owner)).json();
      assert.ok(
        metrics.some(
          (m: any) => m.username === "private_owner" && m.fps === 47 && m.ping === 9,
        ),
      );
      assert.equal(
        (await api("agent", other, { npcId: "einstein", newPrompt: "tampered" })).status,
        403,
      );
      assert.equal(
        (await api("agent", owner, { npcId: "missing", newPrompt: "x" })).status,
        400,
      );
      assert.equal(
        (await api("agent", owner, { npcId: "einstein", newPrompt: "" })).status,
        200,
      );
    });
    it("shares object ownership and door actions over authenticated WebSocket without using the model", async () => {
      const before = calls.length,
        a = await join("physical_owner", 4, 18),
        b = await join("physical_observer", 5, 18);
      function state(room: any, test: (m: any) => boolean): Promise<any> {
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            off();
            reject(Error("object state timeout"));
          }, 10000);
          const off = room.onMessage("object_snapshot", (m: any) => {
            if (test(m)) {
              clearTimeout(timer);
              off();
              resolve(m);
            }
          });
        });
      }
      const initial = [message(a, "object_snapshot"), message(b, "object_snapshot")];
      a.send("object_request", {});
      b.send("object_request", {});
      await Promise.all(initial);
      const held = state(a, (m) => m.holdingId === "town-item-0"),
        seen = state(b, (m) =>
          m.items.some((o: any) => o.id === "town-item-0" && o.holder),
        );
      a.send("object_action", { action: "pickup", id: "town-item-0" });
      await held;
      assert.equal((await seen).holdingId, undefined);
      const denied = message(b, "world_feedback");
      b.send("object_action", { action: "pickup", id: "town-item-0" });
      assert.match((await denied).text, /занят/);
      await new Promise((resolve) => setTimeout(resolve, 220));
      const placed = state(b, (m) =>
        m.items.some((o: any) => o.id === "town-item-0" && !o.holder),
      );
      a.send("object_action", { action: "drop" });
      await placed;
      const doorOwner = await join("physical_door_owner", -40, -18);
      const opened = state(b, (m) =>
        m.doors.some((d: any) => d.id === "home--1-0" && d.open),
      );
      doorOwner.send("object_action", { action: "toggle", id: "home--1-0" });
      await opened;
      assert.equal(calls.length, before);
      const crowd = message(a, "ambient_snapshot");
      a.send("ambient_request", {});
      const citizen = (await crowd).actors.find((actor: any) => actor.kind === "human");
      const caller = await join("resident_guide_caller", citizen.x, citizen.z);
      const help = message(caller, "world_feedback");
      caller.send("citizen_action", {});
      assert.match((await help).text, /Проведу/);
      assert.equal(calls.length, before);
    });
  });
}
