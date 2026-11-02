import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readdirSync, readFileSync } from "node:fs";
import { cast } from "../src/agents/cast.js";
import { initDb, closeDb, getDb } from "../src/database/db.js";
import { drawVisitor, rememberCurrentVisitor } from "../src/database/visitors.repo.js";
import {
  AmbientWorld,
  createAmbientChunk,
  stepAmbientActor,
} from "../src/world/AmbientWorld.js";
import {
  applyWorldCommand,
  classifyWorldCommand,
  listWorldEdits,
  onWorldChange,
  worldRevision,
} from "../src/world/WorldActions.js";
import { worldSnapshot } from "../src/world/ProceduralWorld.js";

describe("Persistent random visitor catalog and world changes", () => {
  const dir = mkdtempSync(join(tmpdir(), "wisdom-living-")),
    file = join(dir, "game.db");
  before(() => initDb(file));
  after(() => {
    closeDb();
    assert.ok(dir.startsWith(join(tmpdir(), "wisdom-living-")));
    rmSync(dir, { recursive: true, force: true });
  });
  it("seeds thirty cases, covers the catalog before repeating and survives restart", () => {
    assert.equal(
      (getDb().prepare("SELECT count(*) AS n FROM visitor_catalog").get() as any).n,
      30,
    );
    const first: string[] = [];
    for (let i = 0; i < 30; i++)
      first.push(drawVisitor(["catalog-user"], `first-${i}`, i, () => 0).id);
    assert.equal(new Set(first).size, 30);
    closeDb();
    initDb(file);
    const again = drawVisitor(["catalog-user"], "after-restart", 1000, () => 0);
    assert.equal(first.slice(-8).includes(again.id), false);
    const next: string[] = [again.id];
    for (let i = 0; i < 29; i++)
      next.push(drawVisitor(["catalog-user"], `second-${i}`, 2000 + i, () => 0).id);
    assert.equal(new Set(next).size, 30);
    assert.equal(
      (getDb().prepare("SELECT count(*) AS n FROM visitor_catalog").get() as any).n,
      30,
    );
  });
  it("tracks present and late-joining players without double counting a reconnect", () => {
    const visitor = drawVisitor(["host", "partner"], "shared-visit", 5000, () => 0);
    rememberCurrentVisitor("late", "shared-visit");
    rememberCurrentVisitor("late", "shared-visit");
    assert.equal(
      (
        getDb()
          .prepare(
            "SELECT count FROM visitor_seen WHERE player_id='late' AND visitor_id=?",
          )
          .get(visitor.id) as any
      ).count,
      1,
    );
    const next = drawVisitor(["host", "partner", "late"], "shared-next", 6000, () => 0);
    assert.notEqual(next.id, visitor.id);
    const mixed = Array.from({ length: 8 }, (_, i) => `mixed-${i}`);
    for (let p = 0; p < mixed.length; p++)
      for (let i = 0; i < 10; i++)
        drawVisitor(
          [mixed[p]],
          `mixed-history-${p}-${i}`,
          10000 + p * 20 + i,
          (n) => (p + i) % n,
        );
    for (let i = 0; i < 10; i++) {
      const recent = new Set<string>();
      for (const player of mixed)
        (
          getDb()
            .prepare(
              "SELECT visitor_id FROM visitor_seen WHERE player_id=? ORDER BY last_draw DESC LIMIT 3",
            )
            .all(player) as { visitor_id: string }[]
        ).forEach((row) => recent.add(row.visitor_id));
      assert.equal(
        recent.has(drawVisitor(mixed, `mixed-group-${i}`, 20000 + i, () => 0).id),
        false,
      );
    }
  });
  it("requires a direct single-object instruction, rejecting quoted or hypothetical mutations", () => {
    assert.deepEqual(classifyWorldCommand("Ада, создай доску идей"), {
      action: "add",
      kind: "board",
    });
    assert.deepEqual(classifyWorldCommand("Переставь скамейки"), {
      action: "move",
      kind: "benches",
    });
    assert.deepEqual(classifyWorldCommand("Убери питьевой пункт"), {
      action: "remove",
      kind: "water",
    });
    for (const phrase of [
      "Не создавай сад",
      "Что если поставить скамейки?",
      "Он сказал: создай сад",
      "«Создай доску идей»",
      "Создай сад и скамейки",
      "Создай сад и удали колонку",
    ])
      assert.equal(classifyWorldCommand(phrase), null, phrase);
  });
  it("persists, moves and removes an idempotent edit, notifying observers and streaming only local chunks", () => {
    let notifications = 0;
    const off = onWorldChange(() => notifications++);
    try {
      const added = applyWorldCommand(
        { action: "add", kind: "garden" },
        "nightingale",
        "host",
      );
      assert.ok(added.changed);
      assert.equal(listWorldEdits().length, 1);
      assert.equal(
        applyWorldCommand({ action: "add", kind: "garden" }, "nightingale", "host")
          .changed,
        false,
      );
      assert.equal(worldRevision(), added.revision);
      const local = worldSnapshot(0, 0, listWorldEdits(), worldRevision());
      assert.equal(local.chunks.flatMap((c) => c.edits || []).length, 1);
      assert.equal(
        worldSnapshot(10000, 10000, listWorldEdits()).chunks.flatMap((c) => c.edits || [])
          .length,
        0,
      );
      applyWorldCommand({ action: "move", kind: "garden" }, "diogenes", "host");
      const saved = listWorldEdits()[0];
      assert.equal(saved.variant, 1);
      closeDb();
      initDb(file);
      assert.deepEqual(listWorldEdits()[0], saved);
      applyWorldCommand({ action: "remove", kind: "garden" }, "lovelace", "host");
      assert.equal(listWorldEdits().length, 0);
      assert.equal(notifications, 3);
    } finally {
      off();
    }
  });
});

describe("Reactive non-LLM population", () => {
  it("keeps exactly the six active profiles and no old plot in their content", () => {
    const folder = new URL("../src/agents/profiles/", import.meta.url);
    assert.deepEqual(
      readdirSync(folder)
        .filter((name) => name.endsWith(".json"))
        .sort(),
      cast.map((p) => `${p.id}.json`).sort(),
    );
    for (const person of cast)
      assert.equal(
        /убий|куратор|детектив|м[её]ртв/i.test(
          readFileSync(new URL(`${person.id}.json`, folder), "utf8"),
        ),
        false,
      );
  });
  it("generates deterministic crowds outside the hall and evicts old chunks", () => {
    assert.deepEqual(createAmbientChunk(0, 0), createAmbientChunk(0, 0));
    assert.ok(
      createAmbientChunk(0, 0).every(
        (actor) => !(Math.abs(actor.x) < 16 && Math.abs(actor.z) < 16),
      ),
    );
    const world = new AmbientWorld();
    for (let i = 0; i < 100; i++) {
      const x = i * 70;
      world.update([{ id: "p", x, z: 20, speed: 0, dx: 0, dz: 0 }], i * 200, 0.1);
      assert.equal(world.activeChunkCount, 9);
      const actors = world.snapshot(x, 20, i * 200).actors;
      assert.equal(actors.length, 162);
      assert.ok(actors.filter((a) => a.kind === "human").length >= 108);
      assert.ok(actors.filter((a) => a.kind === "deer").length <= 54);
    }
    world.update([], 25000, 0.1);
    assert.equal(world.activeChunkCount, 0);
  });
  it("turns and stops a resident for speech, yields to a runner and makes an animal flee", () => {
    const human = {
      ...createAmbientChunk(0, 0).find((a) => a.kind === "human")!,
      x: 5,
      z: 20,
    };
    const player = { id: "p", x: 5, z: 24, speed: 0, dx: 0, dz: -1 };
    stepAmbientActor(
      human,
      [player],
      [{ id: "talk", kind: "talk", x: 5, z: 24, expires: 5000 }],
      1000,
      0.1,
    );
    assert.equal(human.mode, "look");
    assert.equal(human.x, 5);
    assert.equal(human.z, 20);
    assert.ok(Math.abs(human.rotY) < 0.001);
    stepAmbientActor(human, [{ ...player, z: 22, speed: 12 }], [], 2000, 0.1);
    assert.equal(human.mode, "yield");
    assert.equal(human.z, 20);
    const deer = {
      ...createAmbientChunk(2, 2).find((a) => a.kind === "deer")!,
      cx: 0,
      cz: 0,
      homeX: 5,
      homeZ: 20,
      x: 5,
      z: 20,
    };
    stepAmbientActor(deer, [{ ...player, z: 23, speed: 12 }], [], 2000, 0.1);
    assert.equal(deer.mode, "flee");
    assert.ok(deer.z < 20);
  });
  it("attracts an animal to temporary food and shares identical actors between overlapping views", () => {
    const deer = {
      ...createAmbientChunk(2, 2).find((a) => a.kind === "deer")!,
      cx: 0,
      cz: 0,
      homeX: 5,
      homeZ: 20,
      x: 5,
      z: 20,
    };
    stepAmbientActor(
      deer,
      [],
      [{ id: "food", kind: "feed", x: 2, z: 20, expires: 6000 }],
      1000,
      0.1,
    );
    assert.equal(deer.mode, "eat");
    assert.ok(deer.x < 5);
    const world = new AmbientWorld();
    const players = [
      { id: "a", x: 20, z: 20, speed: 0, dx: 0, dz: 0 },
      { id: "b", x: 65, z: 20, speed: 0, dx: 0, dz: 0 },
    ];
    world.update(players, 1000, 0.1);
    const a = world.snapshot(20, 20, 1000),
      b = world.snapshot(65, 20, 1000);
    const other = new Map(b.actors.map((actor) => [actor.id, actor]));
    const common = a.actors.filter((actor) => other.has(actor.id));
    assert.ok(common.length > 0);
    for (const actor of common) assert.deepEqual(actor, other.get(actor.id));
    world.stimulate("a", "feed", 20, 20, 1000);
    assert.equal(world.snapshot(20, 20, 2000).food.length, 1);
    world.update(players, 9000, 0.1);
    assert.equal(world.snapshot(20, 20, 9000).food.length, 0);
  });
});
