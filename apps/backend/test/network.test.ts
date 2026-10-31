import assert from "node:assert/strict";
import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { ColyseusSDK } from "@colyseus/sdk";
import app from "../src/app.config.js";
import { initDb, closeDb } from "../src/database/db.js";
import { findByUsername, saveState } from "../src/database/players.repo.js";
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
describe("Authenticated WebSocket flow", function () {
  this.timeout(30000);
  let server: ColyseusTestServer;
  let a: any;
  let b: any;
  const original = globalThis.fetch;
  before(async () => {
    initDb(":memory:");
    server = await boot(app, port);
    globalThis.fetch = async (url, options) =>
      String(url).includes("11434/api/chat")
        ? new Response(
            JSON.stringify({ message: { content: "Показание тестовой модели" } }),
          )
        : original(url, options);
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
    const off = b.onMessage("dialogue", (m: any) => received.push(m));
    const done = message(a, "dialogue_done");
    a.send("chat", {
      text: "Когда ударил колокол?",
      target: "all",
      requestId: "test-council",
    });
    await done;
    for (let i = 0; i < 20 && received.filter((m) => m.kind === "npc").length < 6; i++)
      await new Promise((resolve) => setTimeout(resolve, 20));
    off();
    assert.equal(received.filter((m) => m.kind === "npc").length, 6);
    assert.equal(
      new Set(received.filter((m) => m.kind === "npc").map((m) => m.npcId)).size,
      6,
    );
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
      target: "einstein",
      requestId: "visitor-discussion",
    });
    await done;
    const leaving = message(a, "visitor_state");
    a.send("visitor_action", { action: "finish" });
    assert.equal((await leaving).phase, "leaving");
    assert.equal(await message(a, "visitor_state"), null);
  });
});
