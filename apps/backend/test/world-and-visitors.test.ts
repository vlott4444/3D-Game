import assert from "node:assert/strict";
import { generateChunk, worldSnapshot, chunkAt } from "../src/world/ProceduralWorld.js";
import { VisitorManager } from "../src/agents/VisitorManager.js";
describe("Procedural streaming and visitor lifecycle", () => {
  it("generates the same chunk for all clients and after reloading", () => {
    assert.deepEqual(generateChunk(-3, 8), generateChunk(-3, 8));
    assert.notDeepEqual(generateChunk(-3, 8), generateChunk(-2, 8));
    assert.deepEqual(chunkAt(-0.1, -64.1), { cx: -1, cz: -2 });
  });
  it("keeps exactly nine chunks while travelling beyond the old map", () => {
    let cache = new Map();
    for (let i = -200; i <= 200; i++) {
      const snapshot = worldSnapshot(i * 64, i * 128);
      cache = new Map(snapshot.chunks.map((c) => [c.id, c]));
      assert.equal(cache.size, 9);
      assert.equal(snapshot.center.cx, i);
      assert.ok(snapshot.chunks.flatMap((c) => c.objects).length <= 90);
      assert.ok(
        snapshot.chunks
          .flatMap((c) => c.objects)
          .every((o) => !(Math.abs(o.x) < 19 && Math.abs(o.z) < 20)),
      );
    }
  });
  it("admits one visitor, requires a discussion, and removes a departing visitor", () => {
    const manager = new VisitorManager();
    manager.call(1000);
    const id = manager.current!.id;
    assert.throws(() => manager.call(1001));
    assert.throws(() => manager.finish(2000));
    assert.equal(manager.advance(5999), false);
    assert.equal(manager.advance(6000), true);
    assert.equal(manager.current?.phase, "discussing");
    assert.throws(() => manager.finish(6001));
    manager.recordReply(id);
    manager.finish(7000);
    assert.equal(manager.current?.phase, "leaving");
    assert.equal(manager.advance(11999), false);
    assert.equal(manager.advance(12000), true);
    assert.equal(manager.current, null);
    manager.call(13000);
    assert.notEqual(manager.current!.id, id);
  });
});
