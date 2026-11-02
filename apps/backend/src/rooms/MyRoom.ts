import { insideWorld, clampWorld } from "../world/TerrainGenerator.js";
import { interactiveWorld, type PhysicalPlayer } from "../world/InteractiveWorld.js";
import { isAdministrator } from "../admin.service.js";
import { metricsStore } from "../AdminMetrics.js";
import {
  globalHistory,
  onGlobalMessage,
  publishGlobal,
} from "../database/global-chat.repo.js";
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
import { AmbientWorld, type AmbientPlayer } from "../world/AmbientWorld.js";
import {
  applyWorldCommand,
  classifyWorldCommand,
  listWorldEdits,
  onWorldChange,
  worldRevision,
} from "../world/WorldActions.js";
import { rememberCurrentVisitor } from "../database/visitors.repo.js";
const online = new Set<string>();
export class MyRoom extends Room<{ state: MyRoomState }> {
  maxClients = 8;
  state = new MyRoomState();
  private busy = new Set<string>();
  private lastPlayerChat = new Map<string, number>();
  private lastMetrics = new Map<string, number>();
  private lastPing = new Map<string, number>();
  private offGlobal?: () => void;
  private lastPose = new Map<string, number>();
  private discussion: string[] = [];
  private streamedChunks = new Map<string, string>();
  private visitors = new VisitorManager();
  private council = new CouncilDirector();
  private councilTurn: CouncilTurn | null = null;
  private ambient = new AmbientWorld();
  private ambientSubscribers = new Set<string>();
  private objectSubscribers = new Set<string>();
  private motion = new Map<
    string,
    { speed: number; dx: number; dz: number; at: number }
  >();
  private lastGesture = new Map<string, number>();
  private offWorld?: () => void;
  private lastAmbient = Date.now();
  private ambientStep = 0;
  private updateAmbient(now: number) {
    const players: AmbientPlayer[] = [];
    for (const [sessionId, player] of this.state.players) {
      const m = this.motion.get(sessionId);
      const recent = m && now - m.at < 600;
      players.push({
        id: sessionId,
        x: player.x,
        z: player.y,
        speed: recent ? m.speed : 0,
        dx: recent ? m.dx : 0,
        dz: recent ? m.dz : 0,
      });
    }
    const obstacles = listWorldEdits().map((edit) => ({
      x: edit.x,
      z: edit.z,
      radius: edit.kind === "garden" ? 3 : edit.kind === "benches" ? 4.5 : 1.2,
    }));
    obstacles.push(
      ...interactiveWorld()
        .items.filter((item) => !item.holder && item.y < 1)
        .map((item) => ({ x: item.x, z: item.z, radius: 0.8 })),
    );
    this.ambient.update(
      players,
      now,
      Math.min(0.2, (now - this.lastAmbient) / 1000),
      obstacles,
    );
    this.lastAmbient = now;
  }
  onCreate() {
    this.offGlobal = onGlobalMessage((entry, legacy) => {
      this.broadcast("global_chat:message", entry);
      if (legacy) this.broadcast("dialogue", legacy);
    });
    // Keep the shared council room available when its last player disconnects.
    this.autoDispose = false;
    this.offWorld = onWorldChange((change) => {
      for (const client of this.clients) {
        const p = this.state.players.get(client.sessionId);
        if (!p) continue;
        const c = chunkAt(p.x, p.y);
        if (
          [change.edit, change.previous].some(
            (edit) =>
              edit &&
              Math.abs(Math.floor(edit.x / 64) - c.cx) <= 1 &&
              Math.abs(Math.floor(edit.z / 64) - c.cz) <= 1,
          )
        )
          this.streamWorld(client, true);
      }
      this.broadcast("world_feedback", { text: change.text, revision: change.revision });
    });
    this.clock.setInterval(() => {
      const now = Date.now();
      this.updateAmbient(now);
      if (++this.ambientStep % 2 === 0)
        for (const client of this.clients)
          if (this.ambientSubscribers.has(client.sessionId)) {
            const p = this.state.players.get(client.sessionId);
            if (p) client.send("ambient_snapshot", this.ambient.snapshot(p.x, p.y, now));
          }
    }, 100);
    this.clock.setInterval(() => {
      const now = Date.now();
      const objectWorld = interactiveWorld();
      objectWorld.setPlayers(
        this.roomId,
        this.clients
          .map((client) => this.physicalPlayer(client))
          .filter((p): p is PhysicalPlayer => !!p),
      );
      objectWorld.update(now);
      for (const client of this.clients) {
        const player = this.physicalPlayer(client);
        if (player && this.objectSubscribers.has(client.sessionId))
          client.send("object_snapshot", objectWorld.snapshot(player));
      }
    }, 50);
    this.clock.setInterval(() => {
      if (this.visitors.advance(Date.now()))
        this.broadcast("visitor_state", this.visitors.snapshot());
    }, 250);
  }
  private physicalPlayer(client: Client): PhysicalPlayer | undefined {
    const p = this.state.players.get(client.sessionId);
    if (!p) return;
    const m = this.motion.get(client.sessionId),
      recent = m && Date.now() - m.at < 600;
    return {
      id: client.auth.playerId,
      x: p.x,
      z: p.y,
      height: p.height,
      rotY: p.rotY,
      speed: recent ? m.speed : 0,
      dx: recent ? m.dx : 0,
      dz: recent ? m.dz : 0,
    };
  }
  private streamWorld(client: Client, force = false) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const center = chunkAt(player.x, player.y);
    const id = `${center.cx}:${center.cz}`;
    if (force || this.streamedChunks.get(client.sessionId) !== id) {
      this.streamedChunks.set(client.sessionId, id);
      client.send(
        "world_snapshot",
        worldSnapshot(player.x, player.y, listWorldEdits(), worldRevision()),
      );
    }
  }
  private canTalk(client: Client, target: string) {
    const player = this.state.players.get(client.sessionId);
    return !!player && canInteractAt(player.x, player.y, target);
  }
  private historyCase(target: string) {
    return target === "players"
      ? "players"
      : target !== "all"
        ? `private:${target}`
        : this.visitors.current?.id || "open-council";
  }
  private publish(entry: ChatEntry, ownerId: string) {
    const isPublic = entry.target === "all" || entry.target === "players";
    const saved = saveChatEntry(
      entry,
      isPublic
        ? [ownerId, ...this.clients.map((c) => c.auth?.playerId).filter(Boolean)]
        : [ownerId],
    );
    if (isPublic)
      publishGlobal(entry.target === "players" ? "players" : "council", saved);
    else this.clients.find((c) => c.auth?.playerId === ownerId)?.send("dialogue", saved);
    return saved;
  }
  private async privateDialogue(client: Client, raw: unknown) {
    if (!raw || typeof raw !== "object") return;
    const m = raw as Record<string, unknown>;
    const npcId = m.npcId ?? m.target;
    const requestId = m.requestId;
    if (typeof requestId !== "string" || requestId.length > 80) return;
    const done = (error?: string) => {
      client.send("private_npc:done", { requestId, error });
      client.send("dialogue_done", { requestId, error });
    };
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    if (
      typeof npcId !== "string" ||
      !cast.some((n) => n.id === npcId) ||
      typeof m.text !== "string" ||
      !m.text.trim() ||
      m.text.length > 600
    ) {
      done("Некорректное личное сообщение");
      return;
    }
    if (!this.canTalk(client, npcId)) {
      done("Для разговора подойди к выбранному мудрецу");
      return;
    }
    if (this.busy.has(client.sessionId)) {
      done("Дождись предыдущего ответа");
      return;
    }
    this.busy.add(client.sessionId);
    const person = cast.find((n) => n.id === npcId)!;
    const caseId = this.historyCase(npcId);
    let failure: string | undefined;
    try {
      const text = m.text.trim();
      this.ambient.stimulate(client.sessionId, "talk", player.x, player.y, Date.now());
      this.publish(
        {
          target: npcId,
          caseId,
          speaker: player.username,
          text,
          kind: "player",
          requestId,
        },
        client.auth.playerId,
      );
      const command = classifyWorldCommand(text);
      const worldUpdate = command
        ? applyWorldCommand(command, npcId, client.auth.playerId).text
        : undefined;
      if (worldUpdate)
        this.publish(
          {
            target: npcId,
            caseId,
            speaker: `Окружение · ${person.name}`,
            text: worldUpdate,
            kind: "world",
            requestId,
          },
          client.auth.playerId,
        );
      const result = await agentService.reply({
        playerId: client.auth.playerId,
        npcId,
        message: text,
        channel: "private",
        worldUpdate,
        caseContext: {
          id: caseId,
          name: player.username,
          problem: "Личная задача игрока: " + text,
        },
      });
      this.publish(
        {
          target: npcId,
          caseId,
          speaker: person.name,
          npcId,
          text: result.text,
          kind: "npc",
          requestId,
        },
        client.auth.playerId,
      );
      client.send("private_npc:reply", {
        npcId,
        requestId,
        speaker: person.name,
        kind: "npc",
        text: result.text,
      });
    } catch (error) {
      console.error("Private NPC failure", npcId, error);
      failure = "Не удалось получить ответ. Проверь локальную модель и сервер.";
    } finally {
      this.busy.delete(client.sessionId);
      done(failure);
    }
  }
  static async onAuth(token: string) {
    const auth = verifyToken(token);
    if (!findById(auth.playerId)) throw Error("Игрок не найден");
    return auth;
  }
  onJoin(client: Client) {
    const id = client.auth.playerId;
    if (online.has(id)) {
      client.leave(4001, "Этот аккаунт уже в игре");
      return;
    }
    online.add(id);
    if (this.visitors.current) rememberCurrentVisitor(id, this.visitors.current.id);
    const row = findById(id)!;
    const saved =
      row.last_seen != null &&
      Number.isFinite(row.pos_x) &&
      Number.isFinite(row.pos_y) &&
      Math.abs(row.pos_x) < 10000000 &&
      Math.abs(row.pos_y) < 10000000;
    const p = new Player({
      x: saved ? clampWorld(row.pos_x) : 0,
      y: saved ? clampWorld(row.pos_y) : 0,
      height: saved ? row.height : 1.18,
      rotY: saved ? row.rot_y : 0,
      username: row.username,
      vx: 0,
      vy: 0,
    });
    this.state.players.set(client.sessionId, p);
    if (saved && !insideWorld(row.pos_x, row.pos_y))
      client.send("world_feedback", {
        text: "Сохранённая позиция за новой границей карты: вход у ближайшего края. Исходная БД сохранена в резервной копии обновления.",
      });
    this.lastPose.set(client.sessionId, Date.now() - 100);
    publishGlobal("players", {
      speaker: "Система",
      kind: "system",
      text: `${p.username} подключился к серверу`,
    });
  }
  messages = {
    object_request: (client: Client) => {
      const p = this.physicalPlayer(client);
      if (!p) return;
      this.objectSubscribers.add(client.sessionId);
      client.send("object_snapshot", interactiveWorld().snapshot(p));
    },
    object_action: (client: Client, raw: unknown) => {
      const p = this.physicalPlayer(client);
      if (!p || !raw || typeof raw !== "object") return;
      const m = raw as { action?: unknown; id?: unknown };
      try {
        const text = interactiveWorld().action(p, m.action, m.id);
        client.send("world_feedback", { text });
        for (const c of this.clients) {
          const player = this.physicalPlayer(c);
          if (player && this.objectSubscribers.has(c.sessionId))
            c.send("object_snapshot", interactiveWorld().snapshot(player));
        }
      } catch (e) {
        client.send("world_feedback", { text: (e as Error).message });
      }
    },
    citizen_action: (client: Client) => {
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      try {
        this.updateAmbient(Date.now());
        client.send("world_feedback", {
          text: this.ambient.guide(client.sessionId, p.x, p.y, Date.now()),
        });
      } catch (e) {
        client.send("world_feedback", { text: (e as Error).message });
      }
    },
    admin_request: (client: Client) => {
      if (this.state.players.has(client.sessionId))
        client.send("is_admin", isAdministrator(client.auth.playerId));
    },
    "metrics:ping": (client: Client, raw: unknown) => {
      if (!this.state.players.has(client.sessionId) || !raw || typeof raw !== "object")
        return;
      const nonce = (raw as { nonce?: unknown }).nonce,
        now = Date.now();
      if (
        typeof nonce !== "number" ||
        !Number.isFinite(nonce) ||
        now - (this.lastPing.get(client.sessionId) || 0) < 500
      )
        return;
      this.lastPing.set(client.sessionId, now);
      client.send("metrics:pong", { nonce });
    },
    metrics: (client: Client, raw: unknown) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || !raw || typeof raw !== "object") return;
      const { fps, ping } = raw as Record<string, unknown>,
        now = Date.now();
      if (
        typeof fps !== "number" ||
        !Number.isFinite(fps) ||
        fps < 0 ||
        fps > 1000 ||
        typeof ping !== "number" ||
        !Number.isFinite(ping) ||
        ping < 0 ||
        ping > 60000 ||
        now - (this.lastMetrics.get(client.sessionId) || 0) < 500
      )
        return;
      this.lastMetrics.set(client.sessionId, now);
      metricsStore.set(`${this.roomId}:${client.sessionId}`, {
        username: player.username,
        fps: Math.round(fps),
        ping: Math.round(ping),
        lastUpdate: now,
      });
    },
    "global_chat:history_request": (client: Client, raw: unknown) => {
      if (!this.state.players.has(client.sessionId) || !raw || typeof raw !== "object")
        return;
      const m = raw as Record<string, unknown>;
      if (m.channel !== "players" && m.channel !== "council") return;
      const before =
        typeof m.beforeId === "number" &&
        Number.isSafeInteger(m.beforeId) &&
        m.beforeId > 0
          ? m.beforeId
          : undefined;
      client.send("global_chat:history", globalHistory(m.channel, before));
    },
    "global_chat:send": (client: Client, raw: unknown) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !raw || typeof raw !== "object") return;
      const m = raw as Record<string, unknown>;
      if (typeof m.text !== "string" || !m.text.trim() || m.text.length > 600) return;
      const now = Date.now();
      if (now - (this.lastPlayerChat.get(client.sessionId) || 0) < 500) {
        client.send("global_chat:error", {
          text: "Не отправляй сообщения слишком часто",
        });
        return;
      }
      this.lastPlayerChat.set(client.sessionId, now);
      this.ambient.stimulate(client.sessionId, "talk", p.x, p.y, now);
      this.publish(
        {
          target: "players",
          caseId: "players",
          speaker: p.username,
          kind: "player",
          text: m.text.trim(),
        },
        client.auth.playerId,
      );
    },
    "private_npc:send": (client: Client, raw: unknown) =>
      this.privateDialogue(client, raw),
    "private_npc:history_request": (client: Client, raw: unknown) => {
      const npcId =
        raw && typeof raw === "object" ? (raw as { npcId?: unknown }).npcId : undefined;
      if (
        !this.state.players.has(client.sessionId) ||
        typeof npcId !== "string" ||
        !cast.some((n) => n.id === npcId)
      )
        return;
      client.send("private_npc:history", {
        npcId,
        messages: chatHistory(client.auth.playerId, npcId, this.historyCase(npcId)),
      });
    },
    ambient_request: (client: Client) => {
      this.ambientSubscribers.add(client.sessionId);
      const now = Date.now();
      this.updateAmbient(now);
      const p = this.state.players.get(client.sessionId);
      if (p) client.send("ambient_snapshot", this.ambient.snapshot(p.x, p.y, now));
    },
    ambient_action: (client: Client, message: { action?: string }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !["wave", "feed"].includes(message?.action || "")) return;
      const now = Date.now(),
        cooldown = message.action === "feed" ? 6500 : 1800;
      const gestureKey = `${client.sessionId}:${message.action}`;
      if (now - (this.lastGesture.get(gestureKey) || 0) < cooldown) return;
      if (message.action === "feed" && Math.abs(p.x) < 16 && Math.abs(p.y) < 16) {
        client.send("world_feedback", {
          text: "Угощение для животных можно оставить снаружи зала.",
        });
        return;
      }
      this.lastGesture.set(gestureKey, now);
      this.ambient.stimulate(
        client.sessionId,
        message.action as "wave" | "feed",
        p.x - (message.action === "feed" ? Math.sin(p.rotY) * 1.4 : 0),
        p.y - (message.action === "feed" ? Math.cos(p.rotY) * 1.4 : 0),
        now,
      );
      client.send("world_feedback", {
        text:
          message.action === "feed"
            ? "Угощение оставлено рядом. Ближайшие олени могут подойти."
            : "Ты позвал жителей. Те, кто рядом, оборачиваются.",
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
      this.motion.delete(client.sessionId);
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
        if (message?.action === "call")
          this.visitors.call(
            Date.now(),
            this.clients.map((c) => c.auth.playerId),
          );
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
    pose: (client: Client, m: unknown) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !m || typeof m !== "object") return;
      const v = m as Record<string, number>;
      if (
        !["x", "z", "height", "rotY", "seq"].every(
          (k) => typeof v[k] === "number" && Number.isFinite(v[k]),
        ) ||
        !insideWorld(v.x, v.z) ||
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
      // Commit before acknowledgement: only an acknowledged pose is guaranteed durable.
      saveState(client.auth.playerId, {
        roomId: this.roomId,
        posX: v.x,
        posY: v.z,
        rotY: v.rotY,
        height: v.height,
      });
      const distance = Math.hypot(v.x - p.x, v.z - p.y);
      this.motion.set(client.sessionId, {
        speed: Math.min(12, distance / Math.max(elapsed, 0.08)),
        dx: distance ? (v.x - p.x) / distance : 0,
        dz: distance ? (v.z - p.y) / distance : 0,
        at: now,
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
      if (typeof target === "string" && cast.some((n) => n.id === target)) {
        await this.privateDialogue(client, m);
        return;
      }
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
        this.ambient.stimulate(client.sessionId, "talk", p.x, p.y, Date.now());
        let worldUpdate: string | undefined;
        const build = target !== "players" ? classifyWorldCommand(text) : null;
        if (build && participants.length) {
          const builder = participants[0];
          const result = applyWorldCommand(build, builder.id, client.auth.playerId);
          worldUpdate = result.text;
          this.publish(
            {
              target: target as string,
              caseId,
              speaker: `Окружение · ${builder.name}`,
              text: result.text,
              kind: "world",
              npcId: builder.id,
              requestId,
            },
            client.auth.playerId,
          );
        }
        this.discussion.push(`${p.username}: ${text}`);
        this.discussion = this.discussion.slice(-12);
        // Keep the older conversation stable; a separate bounded quote identifies
        // the current proposal that the next participant should evaluate.
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
              worldUpdate,
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
  onDispose() {
    interactiveWorld().removeRoom(this.roomId);
    this.offGlobal?.();
    this.offWorld?.();
  }
  onLeave(client: Client) {
    const p = this.state.players.get(client.sessionId);
    if (p) {
      publishGlobal("players", {
        speaker: "Система",
        kind: "system",
        text: `${p.username} вышел с сервера`,
      });
      saveState(client.auth.playerId, {
        roomId: this.roomId,
        posX: p.x,
        posY: p.y,
        height: p.height,
        rotY: p.rotY,
      });
      online.delete(client.auth.playerId);
    }
    this.state.players.delete(client.sessionId);
    this.lastPose.delete(client.sessionId);
    this.lastMetrics.delete(client.sessionId);
    this.lastPing.delete(client.sessionId);
    metricsStore.delete(`${this.roomId}:${client.sessionId}`);
    this.lastPlayerChat.delete(client.sessionId);
    this.streamedChunks.delete(client.sessionId);
    this.ambientSubscribers.delete(client.sessionId);
    this.objectSubscribers.delete(client.sessionId);
    interactiveWorld().leave(client.auth.playerId);
    this.motion.delete(client.sessionId);
    this.lastGesture.delete(`${client.sessionId}:wave`);
    this.lastGesture.delete(`${client.sessionId}:feed`);
  }
}
