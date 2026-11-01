import assert from "node:assert/strict";
import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { ColyseusSDK } from "@colyseus/sdk";
import app from "../src/app.config.js";
import { initDb, closeDb } from "../src/database/db.js";
import { findByUsername, saveState } from "../src/database/players.repo.js";
import { cast } from "../src/agents/cast.js";
const port = 2568;
const endpoint = `http://127.0.0.1:${port}`;
function message(room: any, type: string) {
  return new Promise<any>((resolve, reject) => {
    const timer = setTimeout(() => {
      off();
      reject(Error(`timeout ${type}`));
    }, 10000);
    const off = room.onMessage(type, (m: any) => {
      clearTimeout(timer);
      off();
      resolve(m);
    });
  });
}
async function ready(room: any) {
  if (room.state?.players?.get(room.sessionId)) return;
  await new Promise<void>((resolve) => room.onStateChange.once(() => resolve()));
}
async function walkTo(room: any, x: number, z: number) {
  const player = room.state.players.get(room.sessionId);
  const fromX = player.x,
    fromZ = player.y;
  const steps = Math.max(1, Math.ceil(Math.hypot(x - fromX, z - fromZ) / 1.6));
  for (let i = 1; i <= steps; i++) {
    await new Promise((resolve) => setTimeout(resolve, 110));
    const saved = message(room, "pose_saved");
    room.send("pose", {
      x: fromX + ((x - fromX) * i) / steps,
      z: fromZ + ((z - fromZ) * i) / steps,
      height: 1.18,
      rotY: 0,
      seq: 1000 + i,
    });
    await saved;
  }
}
describe("Authenticated WebSocket flow", function () {
  this.timeout(30000);
  let server: ColyseusTestServer;
  let a: any;
  let b: any;
  const original = globalThis.fetch;
  const modelRequests: any[] = [];
  before(async () => {
    initDb(":memory:");
    server = await boot(app, port);
    globalThis.fetch = async (url, options) => {
      if (!String(url).includes("11434/api/chat")) return original(url, options);
      const request = JSON.parse(options!.body as string);
      modelRequests.push(request);
      const system = request.messages[0].content as string;
      const person = cast.find(
        (p) => system.startsWith(`Ты ${p.name},`) || system.includes(`»: ${p.name}.`),
      )!;
      const content = {
        einstein:
          "Проверим допущение небольшим опытом: сравним два правила на условных семьях разного размера.",
        nightingale:
          "Сначала обеспечим людям временный необходимый минимум и выясним, кому сейчас грозит наибольший вред.",
        lovelace:
          "Зафиксируем объём запаса и число получателей в журнале. Правило выдачи нужно пересматривать каждый день.",
        machiavelli:
          "Кто отвечает за исполнение соглашения? Пусть представители разных семей вместе подтверждают каждую выдачу.",
        socrates:
          "Что вы называете равенством: одинаковую долю на семью или на человека? Проверим выбранный критерий сменой ролей.",
        diogenes:
          "Возможно, сначала стоит исключить необязательный расход. Проверим это предположение, прежде чем добавлять сложный учёт.",
      }[person.id];
      return new Response(JSON.stringify({ message: { content } }));
    };
  });
  after(async () => {
    globalThis.fetch = original;
    if (a) await a.leave();
    if (b) await b.leave();
    await server.shutdown();
    closeDb();
  });
  it("rejects an unauthenticated connection", async () => {
    await assert.rejects(() => new ColyseusSDK(endpoint).joinOrCreate("my_room"));
  });
  it("registers accounts, saves and restores position, broadcasts council replies", async () => {
    async function register(username: string) {
      const response = await fetch(`${endpoint}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password: "test-pass-123" }),
      });
      assert.equal(response.status, 200);
      return (await response.json()).token;
    }
    const token = await register("player_one");
    const tokenB = await register("player_two");
    const ca = new ColyseusSDK(endpoint);
    ca.auth.token = token;
    a = await ca.joinOrCreate("my_room");
    await ready(a);
    const cb = new ColyseusSDK(endpoint);
    cb.auth.token = tokenB;
    b = await cb.joinOrCreate("my_room");
    await ready(b);
    const saved = message(a, "pose_saved");
    a.send("pose", { x: 1, z: 0, height: 1.18, rotY: 1.2, seq: 1 });
    await saved;
    assert.equal(findByUsername("player_one")?.pos_x, 1);
    await a.leave();
    a = null;
    await new Promise((resolve) => setTimeout(resolve, 120));
    a = await ca.joinOrCreate("my_room");
    await ready(a);
    assert.equal(a.state.players.get(a.sessionId).x, 1);
    const received: any[] = [];
    const turns: any[] = [];
    const offTurn = b.onMessage("council_turn", (turn: any) => turns.push(turn));
    const off = b.onMessage("dialogue", (m: any) => received.push(m));
    const done = message(a, "dialogue_done");
    const beforeCalls = modelRequests.length;
    a.send("chat", {
      text: "Сравните варианты справедливого распределения воды",
      target: "all",
      requestId: "test-council",
    });
    await done;
    for (let i = 0; i < 20 && received.filter((m) => m.kind === "npc").length < 3; i++)
      await new Promise((resolve) => setTimeout(resolve, 20));
    off();
    offTurn();
    assert.equal(received.filter((m) => m.kind === "npc").length, 3);
    assert.equal(
      new Set(received.filter((m) => m.kind === "npc").map((m) => m.npcId)).size,
      3,
    );
    assert.equal(turns[turns.length - 1].active, false);
    assert.equal(turns[turns.length - 1].members.length, 3);
    assert.equal(turns[turns.length - 1].silent.length, 3);
    const firstReply = received.find((m) => m.kind === "npc").text;
    assert.equal(
      modelRequests[beforeCalls + 1].messages.some((m: any) =>
        m.content.includes(firstReply),
      ),
      true,
    );
    assert.equal(
      received.filter((m) => m.kind === "npc")[1].reactionTo.name,
      received.find((m) => m.kind === "npc").speaker,
    );
    const loaded = message(a, "dialogue_history");
    a.send("dialogue_history", { target: "all" });
    const history = (await loaded).history;
    assert.equal(
      history.filter(
        (entry: any) =>
          entry.text === "Сравните варианты справедливого распределения воды",
      ).length,
      1,
    );
    assert.ok(history.every((entry: any) => entry.target === "all"));
    const previousIds = received.filter((m) => m.kind === "npc").map((m) => m.npcId);
    const others: string[] = [];
    const offOther = a.onMessage("dialogue", (m: any) => {
      if (m.kind === "npc") others.push(m.npcId);
    });
    const doneOthers = message(a, "dialogue_done");
    a.send("chat", {
      text: "Пусть ответят остальные",
      target: "all",
      requestId: "test-others",
    });
    await doneOthers;
    offOther();
    assert.equal(others.length, 3);
    assert.ok(others.every((id) => !previousIds.includes(id)));
    const named: string[] = [];
    const offNamed = a.onMessage("dialogue", (m: any) => {
      if (m.kind === "npc") named.push(m.npcId);
    });
    const doneNamed = message(a, "dialogue_done");
    a.send("chat", {
      text: "Ада и Сократ, как проверить решение?",
      target: "all",
      requestId: "test-named",
    });
    await doneNamed;
    offNamed();
    assert.deepEqual(named, ["lovelace", "socrates"]);
  });
  it("does not interleave two players' council turns while a model call is pending", async () => {
    await walkTo(a, -6, -2);
    const previousFetch = globalThis.fetch;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    globalThis.fetch = async (url, options) => {
      if (String(url).includes("11434/api/chat")) await gate;
      return previousFetch(url, options);
    };
    try {
      const started = message(b, "council_turn");
      const doneA = message(a, "dialogue_done");
      a.send("chat", {
        text: "Проверь гипотезу",
        target: "einstein",
        requestId: "slow-turn",
      });
      assert.equal((await started).active, true);
      const doneB = message(b, "dialogue_done");
      b.send("chat", {
        text: "Мой вопрос",
        target: "all",
        requestId: "overlapping-turn",
      });
      assert.match((await doneB).error, /ещё отвечает/);
      release();
      await doneA;
    } finally {
      release();
      globalThis.fetch = previousFetch;
    }
  });
  it("requires approaching the intended NPC or the table, while player chat remains available", async () => {
    const denied = message(b, "dialogue_done");
    b.send("chat", { text: "Привет", target: "einstein", requestId: "too-far" });
    assert.match((await denied).error, /подойди/);
    await walkTo(b, 0, 8);
    const deniedTable = message(b, "dialogue_done");
    b.send("chat", {
      text: "Вопрос совету",
      target: "all",
      requestId: "away-from-table",
    });
    assert.match((await deniedTable).error, /столу/);
    const accepted = message(b, "dialogue_done");
    b.send("chat", {
      text: "Привет игрокам",
      target: "players",
      requestId: "player-chat",
    });
    assert.equal((await accepted).error, undefined);
  });
  it("streams a bounded world after restoring a position outside the old map", async () => {
    const player = findByUsername("player_two")!;
    await b.leave();
    b = null;
    await new Promise((resolve) => setTimeout(resolve, 100));
    saveState(player.id, { roomId: null, posX: 1234, posY: -750, height: 1.18, rotY: 0 });
    const login = await fetch(`${endpoint}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "player_two", password: "test-pass-123" }),
    });
    const client = new ColyseusSDK(endpoint);
    client.auth.token = (await login.json()).token;
    b = await client.joinOrCreate("my_room");
    await ready(b);
    assert.equal(b.state.players.get(b.sessionId).x, 1234);
    const snapshot = message(b, "world_snapshot");
    b.send("world_request", {});
    const world = await snapshot;
    assert.equal(world.chunks.length, 9);
    assert.equal(world.center.cx, 19);
    assert.equal(world.center.cz, -12);
    const spawn = message(b, "spawn");
    b.send("return_to_hall", {});
    assert.equal((await spawn).z, 8);
    assert.equal(findByUsername("player_two")!.pos_y, 8);
  });
  it("shares one visitor, discusses the current problem, then removes the visitor", async () => {
    await walkTo(a, 0, 0);
    const arrive = message(a, "visitor_state");
    a.send("visitor_action", { action: "call" });
    const visitor = await arrive;
    assert.equal(visitor.phase, "arriving");
    const talking = await message(a, "visitor_state");
    assert.equal(talking.phase, "discussing");
    assert.equal(talking.id, visitor.id);
    const done = message(a, "dialogue_done");
    a.send("chat", {
      text: "Какой первый шаг предложишь для решения проблемы посетителя?",
      target: "all",
      requestId: "visitor-discussion",
    });
    await done;
    const leaving = message(a, "visitor_state");
    a.send("visitor_action", { action: "finish" });
    assert.equal((await leaving).phase, "leaving");
    assert.equal(await message(a, "visitor_state"), null);
  });
});
