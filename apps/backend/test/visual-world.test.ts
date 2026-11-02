import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { WORLD_CATALOG as catalog } from "../src/world/WorldCatalog.generated.js";
import {
  worldSnapshot,
  WORLD_MIN,
  WORLD_MAX,
  clampWorld,
} from "../src/world/ProceduralWorld.js";
import { InteractiveWorld, type PhysicalPlayer } from "../src/world/InteractiveWorld.js";
import { createAmbientChunk, stepAmbientActor } from "../src/world/AmbientWorld.js";

describe("Finite world, cache accounting and smooth authoritative objects", () => {
  it("accounts for real local asset bytes and keeps peak replacement below 10%", () => {
    assert.equal(catalog.chunkCount, 65536);
    assert.equal(catalog.totalBytes, catalog.chunkBytes + catalog.commonBytes);
    for (const asset of catalog.assets) {
      const bytes = readFileSync(
        new URL(`../../frontend/public${asset.url}`, import.meta.url),
      );
      assert.equal(bytes.length, asset.bytes);
      assert.equal(createHash("sha256").update(bytes).digest("hex"), asset.sha256);
    }
    const budget =
      catalog.commonBytes + catalog.dynamicReserve + 2 * (catalog.maxWindowBytes + 65536);
    assert.ok(budget < catalog.totalBytes * 0.1);
    assert.ok(catalog.commonBytes > 1000000); // Includes the user's avatar, not just chunk JSON.
  });
  it("bounds edge streaming, evicts old chunks and preserves the same IDs on return", () => {
    const home = worldSnapshot(0, 0);
    for (const [x, z] of [
      [WORLD_MIN, WORLD_MIN],
      [WORLD_MAX - 1, WORLD_MAX - 1],
      [3000, -4000],
      [90000, -90000],
    ]) {
      const snapshot = worldSnapshot(x, z);
      assert.ok(snapshot.chunks.length <= 9);
      assert.ok(
        snapshot.chunks.every(
          (c) => c.cx >= -128 && c.cx <= 127 && c.cz >= -128 && c.cz <= 127,
        ),
      );
      assert.ok(
        catalog.commonBytes +
          catalog.dynamicReserve +
          2 * Buffer.byteLength(JSON.stringify(snapshot)) <
          catalog.budgetBytes,
      );
    }
    assert.deepEqual(worldSnapshot(0, 0), home);
    assert.equal(clampWorld(90000), WORLD_MAX - 1);
  });
  it("has only five balls even when old crate records exist", () => {
    const world = new InteractiveWorld([
      { id: "town-item-8", state: JSON.stringify({ x: 0, y: 1, z: 0 }) },
    ]);
    assert.equal(world.items.length, 5);
    assert.ok(world.items.every((i) => i.kind === "ball"));
  });
  it("uses the same fixed trajectory across room/update rates without stepping twice", () => {
    const player: PhysicalPlayer = {
      id: "owner",
      x: 4,
      z: 18,
      height: 1.18,
      rotY: Math.PI,
    };
    const run = (interval: number, twice: boolean) => {
      const w = new InteractiveWorld();
      w.setPlayers("room", [player]);
      w.action(player, "pickup", "town-item-0", 1000);
      w.action(player, "throw", undefined, 1300);
      w.update(2000);
      for (let t = 2000 + interval; t <= 4000; t += interval) {
        w.update(t);
        if (twice) w.update(t);
      }
      return w.items[0];
    };
    const a = run(50, false),
      b = run(100, true),
      c = run(20, false);
    for (const field of ["x", "y", "z", "vx", "vy", "vz"] as const) {
      assert.ok(Math.abs(a[field] - b[field]) < 1e-7);
      assert.ok(Math.abs(a[field] - c[field]) < 1e-7);
    }
  });
  it("stops a guiding human at a player's capsule and allows separation from an overlap", () => {
    const actor = createAmbientChunk(0, 0).find((a) => a.kind === "human")!;
    Object.assign(actor, {
      x: 20,
      z: 20,
      homeX: 20,
      homeZ: 20,
      guideFor: "follower",
      guideUntil: 99999,
      route: [{ x: 20, z: 30 }],
    });
    const follower = { id: "follower", x: 20, z: 21, speed: 0, dx: 0, dz: 0 };
    for (let t = 1000; t < 3000; t += 100)
      stepAmbientActor(actor, [follower], [], t, 0.1, () => false);
    assert.ok(Math.hypot(actor.x - follower.x, actor.z - follower.z) >= 0.78);
    follower.z = 19.9;
    for (let t = 3000; t < 4000; t += 100)
      stepAmbientActor(actor, [follower], [], t, 0.1, () => false);
    assert.ok(actor.z > 21);
  });
});
