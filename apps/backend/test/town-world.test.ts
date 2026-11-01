import assert from "node:assert/strict";
import { InteractiveWorld, type PhysicalPlayer } from "../src/world/InteractiveWorld.js";
import { buildings, townColliders, townBlocked } from "../src/world/Town.js";
import { worldSnapshot } from "../src/world/ProceduralWorld.js";
import { AmbientWorld, createAmbientChunk } from "../src/world/AmbientWorld.js";
const player: PhysicalPlayer = { id: "owner", x: 4, z: 18, height: 1.18, rotY: Math.PI };
describe("Streamed forest town and shared physical objects", () => {
  it("streams eight buildings locally and spawns residents outside walls", () => {
    assert.equal(
      worldSnapshot(0, 0).chunks.flatMap((c) => c.town?.buildings || []).length,
      8,
    );
    assert.equal(
      worldSnapshot(4000, 4000).chunks.flatMap((c) => c.town?.buildings || []).length,
      0,
    );
    for (let cx = -1; cx <= 1; cx++)
      for (let cz = -1; cz <= 1; cz++)
        for (const a of createAmbientChunk(cx, cz))
          assert.equal(townBlocked(a.x, a.z), false);
  });
  it("locks a held item to one nearby owner and restores its placed position", () => {
    const saved = new Map<string, string>(),
      w = new InteractiveWorld([], (id, state) => saved.set(id, state));
    w.setPlayers("room", [player]);
    w.action(player, "pickup", "town-item-0", 1000);
    assert.throws(
      () => w.action({ ...player, id: "other" }, "pickup", "town-item-0", 1000),
      /занят/,
    );
    assert.throws(
      () => w.action({ ...player, id: "far", x: 300 }, "pickup", "town-item-1", 1000),
      /далеко/,
    );
    w.action(player, "drop", undefined, 1300);
    assert.equal(w.items[0].holder, undefined);
    assert.ok(w.items[0].z > player.z);
    const restored = new InteractiveWorld(
      [...saved].map(([id, state]) => ({ id, state })),
    );
    assert.equal(restored.items[0].z, w.items[0].z);
  });
  it("applies gravity, bounces and friction to a thrown ball", () => {
    const w = new InteractiveWorld();
    w.setPlayers("room", [player]);
    w.action(player, "pickup", "town-item-0", 1000);
    w.action(player, "throw", undefined, 1300);
    const ball = w.items[0],
      start = ball.z;
    let rose = false,
      bounced = false,
      falling = false;
    for (let i = 0; i < 100; i++) {
      w.step([player], [], 0.05);
      if (ball.y > 1.6) rose = true;
      if (ball.vy < 0) falling = true;
      if (falling && ball.vy > 0) bounced = true;
    }
    assert.ok(rose && bounced);
    assert.ok(ball.z > start + 2);
    assert.ok(Math.abs(ball.vz) < 1);
    const at = ball.z;
    for (let i = 0; i < 300; i++) w.step([player], [], 0.05);
    assert.ok(ball.z - at < 2);
    assert.equal(ball.y, 0.38);
  });
  it("persists doors and refuses to close a doorway occupied by a player", () => {
    const saved = new Map<string, string>(),
      w = new InteractiveWorld([], (id, state) => saved.set(id, state)),
      b = buildings[0];
    const p = { ...player, x: b.x, z: b.z + b.depth / 2 + 2 };
    w.setPlayers("room", [p]);
    const closed = townColliders(w.doors).length;
    w.action(p, "toggle", b.id, 1000);
    assert.equal(townColliders(w.doors).length, closed - 1);
    w.setPlayers("room", [{ ...p, z: b.z + b.depth / 2 }]);
    assert.throws(() => w.action(p, "toggle", b.id, 1300), /занят/);
    assert.equal(
      new InteractiveWorld([...saved].map(([id, state]) => ({ id, state }))).doors.has(
        b.id,
      ),
      true,
    );
    w.setPlayers("room", [p]);
    w.action(p, "toggle", b.id, 1600);
    assert.equal(w.doors.has(b.id), false);
  });
  it("releases carried items on disconnect and shares overlapping snapshots", () => {
    const w = new InteractiveWorld();
    w.action(player, "pickup", "town-item-0", 1000);
    assert.equal(w.snapshot(player).holdingId, "town-item-0");
    w.leave(player.id);
    assert.equal(w.snapshot(player).holdingId, undefined);
    assert.deepEqual(
      w.snapshot(player).items,
      w.snapshot({ ...player, id: "viewer" }).items,
    );
  });
  it("lets a resident guide a player and allows cancelling the help", () => {
    const w = new AmbientWorld(),
      p = { id: "walker", x: 0, z: 18, speed: 0, dx: 0, dz: 0 };
    w.update([p], 1000, 0.1);
    const actor = w.snapshot(0, 18, 1000).actors.find((a) => a.kind === "human")!;
    p.x = actor.x;
    p.z = actor.z;
    assert.match(w.guide(p.id, p.x, p.z, 1100), /Проведу/);
    for (let t = 1200; t < 3200; t += 100) w.update([p], t, 0.1);
    const guide = w.snapshot(p.x, p.z, 3200).actors.find((a) => a.id === actor.id)!;
    assert.equal(guide.mode, "guide");
    assert.match(w.guide(p.id, guide.x, guide.z, 3300), /останусь/);
    assert.throws(() => w.guide(p.id, 10000, 10000, 3400), /Подойди/);
  });
  it("guides from the north side around the hall and waits when the follower falls behind", () => {
    const w = new AmbientWorld(),
      p = { id: "north-walker", x: -11, z: -20, speed: 0, dx: 0, dz: 0 };
    w.update([p], 1000, 0.1);
    const actor = w
      .snapshot(p.x, p.z, 1000)
      .actors.filter((a) => a.kind === "human")
      .sort(
        (a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z),
      )[0];
    p.x = actor.x;
    p.z = actor.z;
    w.guide(p.id, p.x, p.z, 1100);
    let last = actor;
    for (let t = 1200; t < 85000; t += 100) {
      w.update([p], t, 0.1);
      const a = w.snapshot(p.x, p.z, t).actors.find((a) => a.id === actor.id);
      assert.ok(a);
      assert.ok(!(Math.abs(a.x) < 16 && Math.abs(a.z) < 16));
      p.x = a.x;
      p.z = a.z;
      last = a;
      if (a.mode !== "guide") break;
    }
    assert.ok(Math.hypot(last.x, last.z - 18) < 2);
  });
});
