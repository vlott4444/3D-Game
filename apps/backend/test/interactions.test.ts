import assert from "node:assert/strict";
import { cast } from "../src/agents/cast.js";
import { canInteractAt } from "../src/world/InteractionZones.js";
import { interactionAt } from "../../frontend/src/game/npc/interactionTarget.js";

describe("Spatial dialogue entry points", () => {
  it("offers the table only nearby and an individual speaker at each seat", () => {
    assert.equal(interactionAt(0, 0, cast)?.target, "all");
    assert.equal(interactionAt(0, 8, cast), null);
    for (const person of cast) {
      assert.equal(
        interactionAt(person.position[0], person.position[2], cast)?.target,
        person.id,
      );
      assert.ok(canInteractAt(person.position[0], person.position[2], person.id));
    }
  });
  it("rejects remote council and NPC requests while allowing player chat", () => {
    assert.equal(canInteractAt(0, 8, "all"), false);
    assert.equal(canInteractAt(0, 0, "einstein"), false);
    assert.equal(canInteractAt(-8, -2, "diogenes"), false);
    assert.equal(interactionAt(300, 300, cast), null);
    assert.equal(canInteractAt(300, 300, "players"), true);
  });
});
