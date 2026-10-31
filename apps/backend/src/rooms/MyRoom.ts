import { Room, Client, CloseCode, type StepContext } from "colyseus";
import { MyRoomState, Player, MoveInput } from "./schema/MyRoomState.js";
import { stepEntity } from "../shared/movement.js";
import { TICK_RATE, ARENA_WIDTH, ARENA_HEIGHT } from "../shared/constants.js";

import { ChunkManager } from '../world/ChunkManager.js';
import { InterestManager } from '../world/InterestManager.js';
import { saveState } from '../database/players.repo.js';
import { verifyToken } from "../auth/auth.service.js";

export class MyRoom extends Room<{ state: MyRoomState, input: MoveInput }> {
  maxClients = 8;
  state = new MyRoomState();

  /**
   * Per-client input buffer. `sanitize` clamps every field as it is decoded —
   * never trust the wire — and the buffer holds ~2s of inputs at this tick rate
   * so a burst after a stall still replays in order.
   */
  inputs = this.defineInput(MoveInput, {
    bufferMaxSize: 64,
    sanitize: { moveX: [-1, 1], moveY: [-1, 1] },
  });

  private joinCount = 0;

  private chunkManager = new ChunkManager();
  private interestManager = new InterestManager();
  private playerChunks = new Map<string, Set<string>>();

  static async onAuth(token: string, options: any, request: any) {
    try {
      const payload = verifyToken(token);
      return { playerId: payload.playerId, username: payload.username };
    } catch (e) {
      throw new Error("Invalid token");
    }
  }

  messages = {


    chat: (client: Client, message: { text: string; target?: string }) => {
      if (message.target) {
        client.send('agent_reply', {
          agentId: message.target,
          text: `[echo] ${message.text}`
        });
      } else {
        this.broadcast('chat', { from: client.sessionId, text: message.text });
      }
    },
  };

  onCreate(options: any) {
    this.setFixedTimestep((ctx) => this.step(ctx), TICK_RATE);

    this.clock.setInterval(() => {
      for (const client of this.clients) {
        const player = this.state.players.get(client.sessionId);
        const playerId = client.auth?.playerId;

        if (player && playerId) {
          saveState(playerId, {
            roomId: this.roomId,
            posX: player.x,
            posY: player.y,
            rotY: 0
          });
        }
      }
    }, 30000);
  }

  onJoin(client: Client, options: any) {
    console.log(client.sessionId, "joined!");

    const angle = this.joinCount++ * 2.399963;
    this.state.players.set(client.sessionId, new Player({
      x: ARENA_WIDTH / 2 + Math.cos(angle) * 80,
      y: ARENA_HEIGHT / 2 + Math.sin(angle) * 80,
      vx: 0,
      vy: 0,
    }));

    this.playerChunks.set(client.sessionId, new Set());
  }

  onLeave(client: Client, code: CloseCode) {
    console.log(client.sessionId, "left!", code);

    const player = this.state.players.get(client.sessionId);

    const playerId = client.auth?.playerId;

    if (player && playerId) {
      saveState(playerId, {
        roomId: this.roomId,
        posX: player.x,
        posY: player.y,
        rotY: 0
      });
    }

    this.state.players.delete(client.sessionId);

    this.playerChunks.delete(client.sessionId);
  }

  onDispose() {
    console.log("room", this.roomId, "disposing...");
  }

  private step(ctx: StepContext) {
    for (const [sessionId, player] of this.state.players) {
      const channel = this.inputs.get(sessionId);
      if (channel) {
        for (const input of channel) {
          stepEntity(player, input, ctx.dt);
        }
      }

      this.updateChunksForPlayer(sessionId, player);
    }
  }

  private updateChunksForPlayer(sessionId: string, player: Player) {
    const client = this.clients.find(c => c.sessionId === sessionId);
    if (!client) return;

    const desired = this.chunkManager.getChunksAround(player.x, player.y, 1);
    let current = this.playerChunks.get(sessionId);

    if (!current) {
      current = new Set();
      this.playerChunks.set(sessionId, current);
    }

    const diff = this.interestManager.update(current, desired);

    if (diff.add.length > 0 || diff.remove.length > 0) {
      client.send('chunks_update', diff);

      for (const chunk of diff.add) current.add(chunk.id);
      for (const id of diff.remove) current.delete(id);
    }
  }

  onDrop(client: Client, code: CloseCode) {

    this.allowReconnection(client, 30).catch(() => {});
  }

  onReconnect(client: Client) {
    console.log(client.sessionId, "reconnected!");
  }
}
