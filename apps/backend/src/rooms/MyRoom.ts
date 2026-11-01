import { Room, Client } from "colyseus";
import { MyRoomState, Player } from "./schema/MyRoomState.js";
import { findById, saveState } from "../database/players.repo.js";
import { verifyToken } from "../auth/auth.service.js";
import { agentService } from "../agents/AgentService.js";
import { cast } from "../agents/cast.js";
import { chunkAt, worldSnapshot } from "../world/ProceduralWorld.js";
import { VisitorManager } from "../agents/VisitorManager.js";
import { CouncilDirector, type CouncilTurn } from "../agents/CouncilDirector.js";
import { canInteractAt } from "../world/InteractionZones.js";
import { saveChatEntry, chatHistory, type ChatEntry } from "../database/chat.repo.js";
import { metricsStore } from "../AdminMetrics.js";

const online = new Set<string>();

export class MyRoom extends Room<{ state: MyRoomState }> {
  maxClients = 8;
  state = new MyRoomState();

  private busy = new Set<string>();
  private lastPose = new Map<string, number>();
  private discussion: string[] = [];
  private streamedChunks = new Map<string, string>();
  private visitors = new VisitorManager();
  private council = new CouncilDirector();
  private councilTurn: CouncilTurn | null = null;
  private adminPlayerId: string | null = null;

  onCreate() {
    this.autoDispose = false;

    this.clock.setInterval(() => {
      if (this.visitors.advance(Date.now()))
        this.broadcast("visitor_state", this.visitors.snapshot());
    }, 250);
  }

  private streamWorld(client: Client, force = false) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const center = chunkAt(player.x, player.y);
    const id = `${center.cx}:${center.cz}`;
    if (force || this.streamedChunks.get(client.sessionId) !== id) {
      this.streamedChunks.set(client.sessionId, id);
      client.send("world_snapshot", worldSnapshot(player.x, player.y));
    }
  }

  private canTalk(client: Client, target: string) {
    const player = this.state.players.get(client.sessionId);
    return !!player && canInteractAt(player.x, player.y, target);
  }

  private historyCase(target: string) {
    return target === "players" ? "players" : this.visitors.current?.id || "open-council";
  }

  private publish(entry: ChatEntry, ownerId: string) {
    const saved = saveChatEntry(entry, [
      ownerId,
      ...this.clients.map((client) => client.auth?.playerId).filter(Boolean),
    ]);
    this.broadcast("dialogue", saved);
    return saved;
  }

  static async onAuth(token: string) {
    const auth = verifyToken(token);
    if (!findById(auth.playerId)) throw Error("Игрок не найден");
    return auth;
  }

  onJoin(client: Client) {
    const id = client.auth.playerId;

    if (!this.adminPlayerId) {
      this.adminPlayerId = id;
      client.send("is_admin", true);
      console.log(`[SERVER] ${client.auth.username} назначен администратором`);
  }

    if (online.has(id)) {
      client.leave(4001, "Этот аккаунт уже в игре");
      return;
    }
    online.add(id);

    const row = findById(id)!;
    const saved =
      row.last_seen != null &&
      Number.isFinite(row.pos_x) &&
      Number.isFinite(row.pos_y) &&
      Math.abs(row.pos_x) < 10000000 &&
      Math.abs(row.pos_y) < 10000000;

    const p = new Player({
      x: saved ? row.pos_x : 0,
      y: saved ? row.pos_y : 0,
      height: saved ? row.height : 1.18,
      rotY: saved ? row.rot_y : 0,
      username: row.username,
      vx: 0,
      vy: 0,
    });

    this.state.players.set(client.sessionId, p);
    this.lastPose.set(client.sessionId, Date.now() - 100);
  }

  messages = {

    metrics: (client: Client, data: { fps: number }) => {
      const username = client.auth?.username || "Unknown";

      const ping = (client as any).ping || 0;

      metricsStore.set(client.sessionId, {
        username,
        fps: data.fps,
        ping: ping,
        lastUpdate: Date.now()
      });
    },

    council_request: (client: Client) => client.send("council_turn", this.councilTurn),

    return_to_hall: (client: Client) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      saveState(client.auth.playerId, {
        roomId: this.roomId,
        posX: 0,
        posY: 8,
        height: 1.18,
        rotY: 0,
      });
      player.x = 0;
      player.y = 8;
      player.height = 1.18;
      player.rotY = 0;
      this.lastPose.set(client.sessionId, Date.now() - 100);
      this.streamWorld(client, true);
      client.send("spawn", { x: 0, z: 8, height: 1.18, rotY: 0 });
    },

    world_request: (client: Client) => this.streamWorld(client, true),

    visitor_request: (client: Client) =>
      client.send("visitor_state", this.visitors.snapshot()),

    visitor_action: (client: Client, message: { action?: string }) => {
      try {
        if (!this.canTalk(client, "all")) throw Error("Подойди к столу совета");
        if (this.busy.size) throw Error("Дождись окончания обсуждения");
        if (message?.action === "call") this.visitors.call(Date.now());
        else if (message?.action === "finish") this.visitors.finish(Date.now());
        else throw Error("Неизвестное действие");
        this.discussion = [];
        this.council.reset();
        this.councilTurn = null;
        this.broadcast("council_turn", null);
        this.broadcast("visitor_state", this.visitors.snapshot());
      } catch (e) {
        client.send("visitor_error", { text: (e as Error).message });
      }
    },

    dialogue_history: (client: Client, message: { target?: string }) => {
      const target = message?.target || "all";
      if (
        target !== "all" &&
        target !== "players" &&
        !cast.some((person) => person.id === target)
      )
        return;
      const caseId = this.historyCase(target);
      client.send("dialogue_history", {
        target,
        caseId,
        history: chatHistory(client.auth.playerId, target, caseId),
      });
    },

    case_history: (client: Client) =>
      client.send("case_history", {
        history: chatHistory(client.auth.playerId, "all", this.historyCase("all")),
        evidence: {},
      }),

    pose: (client: Client, m: unknown) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !m || typeof m !== "object") return;
      const v = m as Record<string, number>;
      if (
        !["x", "z", "height", "rotY", "seq"].every(
          (k) => typeof v[k] === "number" && Number.isFinite(v[k]),
        ) ||
        Math.abs(v.x) >= 10000000 ||
        Math.abs(v.z) >= 10000000 ||
        v.height < 1.15 ||
        v.height > 20
      )
        return;
      const now = Date.now();
      const elapsed = Math.min(
        (now - (this.lastPose.get(client.sessionId) || now)) / 1000,
        2,
      );
      if (now - (this.lastPose.get(client.sessionId) || 0) < 80) return;
      if (Math.hypot(v.x - p.x, v.z - p.y) > 12 * elapsed + 1.5) {
        client.send("spawn", { x: p.x, z: p.y, height: p.height, rotY: p.rotY });
        return;
      }
      saveState(client.auth.playerId, {
        roomId: this.roomId,
        posX: v.x,
        posY: v.z,
        rotY: v.rotY,
        height: v.height,
      });
      p.x = v.x;
      p.y = v.z;
      p.height = v.height;
      p.rotY = v.rotY;
      this.lastPose.set(client.sessionId, now);
      client.send("pose_saved", { seq: v.seq });
      this.streamWorld(client);
    },

    chat: async (client: Client, m: unknown) => {
      if (!m || typeof m !== "object") return;
      const { text, target, requestId } = m as Record<string, unknown>;
      if (
        typeof text !== "string" ||
        !text.trim() ||
        text.length > 600 ||
        typeof requestId !== "string" ||
        requestId.length > 80
      )
        return;
      if (this.busy.has(client.sessionId)) {
        client.send("dialogue_done", { requestId, error: "Дождись предыдущего ответа" });
        return;
      }
      if (
        target !== "players" &&
        target !== "all" &&
        !cast.some((n) => n.id === target)
      ) {
        client.send("dialogue_done", {
          requestId,
          error: "Участник совета не найден. Обнови страницу и выбери адресата заново.",
        });
        return;
      }
      if (target !== "players" && this.councilTurn?.active) {
        client.send("dialogue_done", {
          requestId,
          error: "Совет ещё отвечает другому игроку. Дождись окончания этого хода.",
        });
        return;
      }
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      if (!this.canTalk(client, target as string)) {
        client.send("dialogue_done", {
          requestId,
          error:
            target === "all"
              ? "Для общего обсуждения подойди к столу совета"
              : "Для разговора подойди к выбранному мудрецу",
        });
        return;
      }
      const visit = this.visitors.current;
      if (visit && target !== "players" && visit.phase !== "discussing") {
        client.send("dialogue_done", {
          requestId,
          error: "Дождись, пока посетитель войдёт в зал или покинет его",
        });
        return;
      }
      this.busy.add(client.sessionId);
      const selected =
        target === "players"
          ? []
          : target === "all"
            ? this.council.select(text, visit?.problem).speakers
            : [target as string];
      const participants = selected.map((id) => cast.find((person) => person.id === id)!);
      const roundReplies: { name: string; text: string }[] = [];
      const spoken: string[] = [];
      const turn: CouncilTurn | null = participants.length
        ? {
            requestId,
            active: true,
            currentNpcId: null,
            members: participants.map(({ id, name, title }) => ({
              id,
              name,
              title,
              status: "waiting",
            })),
            silent: cast
              .filter((person) => !selected.includes(person.id))
              .map(({ id, name, title }) => ({ id, name, title })),
          }
        : null;
      if (turn) {
        this.councilTurn = turn;
        this.broadcast("council_turn", turn);
      }
      const caseId = this.historyCase(target as string);
      let failure: string | undefined;
      try {
        this.publish(
          {
            target: target as string,
            caseId,
            speaker: p.username,
            text,
            requestId,
            kind: "player",
          },
          client.auth.playerId,
        );
        this.discussion.push(`${p.username}: ${text}`);
        this.discussion = this.discussion.slice(-12);
        const roundContext = this.discussion.join("\n");
        for (const npc of participants) {
          const reactionTo = roundReplies.at(-1);
          const member = turn!.members.find((person) => person.id === npc.id)!;
          member.status = "thinking";
          turn!.currentNpcId = npc.id;
          this.broadcast("council_turn", turn);
          try {
            const answer = await agentService.reply({
              playerId: client.auth.playerId,
              npcId: npc.id,
              message: text,
              context: roundContext,
              roundReplies,
              caseContext: visit
                ? { id: visit.id, name: visit.name, problem: visit.problem }
                : undefined,
            });
            if (answer.abstained) {
              member.status = "abstained";
              this.broadcast("council_turn", turn);
              continue;
            }
            member.status = "answered";
            roundReplies.push({ name: npc.name, text: answer.text });
            spoken.push(npc.id);
            this.publish(
              {
                target: target as string,
                caseId,
                reactionTo,
                speaker: npc.name,
                npcId: npc.id,
                text: answer.text,
                kind: "npc",
                requestId,
              },
              client.auth.playerId,
            );
            this.discussion.push(`${npc.name}: ${answer.text}`);
            this.discussion = this.discussion.slice(-12);
            if (visit) this.visitors.recordReply(visit.id);
          } catch (e) {
            member.status = "error";
            console.error("NPC failure", npc.id, e);
            this.publish(
              {
                target: target as string,
                caseId,
                speaker: npc.name,
                text: "Ошибка локальной модели. Проверь Ollama и имя модели на сервере.",
                kind: "error",
                requestId,
              },
              client.auth.playerId,
            );
          }
        }
      } catch (error) {
        console.error("Conversation persistence failure", error);
        failure =
          "Не удалось сохранить сообщение. Повтори попытку после проверки сервера.";
      } finally {
        if (turn) {
          turn.active = false;
          turn.currentNpcId = null;
          this.council.finish(spoken);
          this.broadcast("council_turn", turn);
        }
        this.busy.delete(client.sessionId);
        client.send("dialogue_done", { requestId, error: failure });
        this.broadcast("visitor_state", this.visitors.snapshot());
      }
    },
  };

  onLeave(client: Client) {

    if (client.auth.playerId === this.adminPlayerId) {
      this.adminPlayerId = null; // Сбрасываем админа, если он вышел
      console.log(`[SERVER] Администратор покинул игру`);
  }

    const p = this.state.players.get(client.sessionId);
    if (p) {
      saveState(client.auth.playerId, {
        roomId: this.roomId,
        posX: p.x,
        posY: p.y,
        height: p.height,
        rotY: p.rotY,
      });
      online.delete(client.auth.playerId);
    }
    metricsStore.delete(client.sessionId);

    this.state.players.delete(client.sessionId);
    this.lastPose.delete(client.sessionId);
    this.streamedChunks.delete(client.sessionId);
  }
}
