import assert from "assert";
import { ColyseusTestServer, boot } from "@colyseus/testing";
import appConfig from "../src/app.config.js";
import { MyRoom } from "../src/rooms/MyRoom.js";
import { type MoveInput } from "../src/rooms/schema/MyRoomState.js";
import { PLAYER_SPEED, TICK_RATE } from "../src/shared/constants.js";

describe("testing your Colyseus app", () => {
  let colyseus: ColyseusTestServer<typeof appConfig>;

  before(async () => colyseus = await boot(appConfig));
  after(async () => colyseus.shutdown());
  beforeEach(async () => { await colyseus.cleanup(); });

  it("advances a player from its buffered input", async () => {
    const room = await colyseus.createRoom<MyRoom>("my_room", {});
    // Теперь onAuth пропустит подключение без токена
    const client1 = await colyseus.connectTo(room);

    const player = room.state.players.get(client1.sessionId);
    assert.ok(player, "a Player is created on join");
    const startX = player.x;

    const input = client1.input<MoveInput>({ mode: "reliable" });
    input.data.moveX = 1;
    input.data.moveY = 0;
    input.send();

    await room.waitForNextMessage();
    await room.waitForNextTimestep();

    assert.ok(player.x > startX, "the buffered input advanced the player");
  });

  it("clamps input that is out of range", async () => {
    const room = await colyseus.createRoom<MyRoom>("my_room", {});
    const client1 = await colyseus.connectTo(room);

    const player = room.state.players.get(client1.sessionId);
    assert.ok(player, "a Player is created on join");
    const startX = player.x;

    const input = client1.input<MoveInput>({ mode: "reliable" });
    input.data.moveX = 100 as any;
    input.send();

    await room.waitForNextMessage();
    await room.waitForNextTimestep();

    assert.strictEqual(player.x, startX + PLAYER_SPEED * (1 / TICK_RATE));
  });
});
