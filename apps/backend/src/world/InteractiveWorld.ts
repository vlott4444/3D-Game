import { buildings, townColliders, type Box } from "./Town.js";
import { getDb } from "../database/db.js";
export type PhysicalItem = {
  id: string;
  kind: "ball";
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  holder?: string;
};
export type PhysicalPlayer = {
  id: string;
  x: number;
  z: number;
  height: number;
  rotY: number;
  speed?: number;
  dx?: number;
  dz?: number;
};
type Saved = { id: string; state: string };
const radius = (_item: PhysicalItem) => 0.38;
function initialItems(): PhysicalItem[] {
  return Array.from({ length: 5 }, (_, i) => ({
    id: `town-item-${i}`,
    kind: "ball",
    x: 4 + i * 1.2,
    y: 0.38,
    z: 18,
    vx: 0,
    vy: 0,
    vz: 0,
  }));
}
export class InteractiveWorld {
  items = initialItems();
  doors = new Set<string>();
  private players = new Map<string, PhysicalPlayer[]>();
  private cooldown = new Map<string, number>();
  private last: number | undefined;
  private accumulator = 0;
  private lastSave = 0;
  private persisted = new Map<string, string>();
  constructor(
    saved: Saved[] = [],
    private save: (id: string, state: string) => void = () => {},
  ) {
    for (const row of saved) {
      try {
        const value = JSON.parse(row.state);
        const item = this.items.find((o) => o.id === row.id);
        if (
          item &&
          [value.x, value.y, value.z].every(Number.isFinite) &&
          Math.abs(value.x) < 10000000 &&
          Math.abs(value.z) < 10000000
        ) {
          Object.assign(item, {
            x: value.x,
            y: Math.max(radius(item), value.y),
            z: value.z,
          });
        }
        if (
          row.id.startsWith("door:") &&
          value.open &&
          buildings.some((b) => `door:${b.id}` === row.id)
        )
          this.doors.add(row.id.slice(5));
      } catch {
        /* Ignore a damaged optional object record; never reset player data. */
      }
    }
  }
  private persist(item: PhysicalItem) {
    const state = JSON.stringify({ x: item.x, y: item.y, z: item.z });
    if (this.persisted.get(item.id) === state) return;
    this.persisted.set(item.id, state);
    this.save(item.id, state);
  }
  setPlayers(roomId: string, players: PhysicalPlayer[]) {
    this.players.set(roomId, players);
  }
  removeRoom(roomId: string) {
    for (const p of this.players.get(roomId) || []) this.leave(p.id);
    this.players.delete(roomId);
  }
  leave(playerId: string) {
    for (const item of this.items)
      if (item.holder === playerId) {
        delete item.holder;
        item.vx = item.vz = 0;
        this.persist(item);
      }
    this.cooldown.delete(playerId);
  }
  action(player: PhysicalPlayer, action: unknown, id: unknown, now = Date.now()) {
    if (!["pickup", "drop", "throw", "toggle"].includes(String(action)))
      throw Error("Неизвестное действие");
    if (now - (this.cooldown.get(player.id) || 0) < 180) throw Error("Подожди немного");
    const held = this.items.find((o) => o.holder === player.id);
    if (action === "toggle") {
      const building = buildings.find((b) => b.id === id);
      if (
        !building ||
        Math.hypot(player.x - building.x, player.z - building.z - building.depth / 2) >
          3.2
      )
        throw Error("Подойди к двери");
      if (this.doors.has(building.id)) {
        const blocked =
          this.items.some(
            (o) =>
              Math.abs(o.x - building.x) < 1.5 &&
              Math.abs(o.z - building.z - building.depth / 2) < 1,
          ) ||
          [...this.players.values()]
            .flat()
            .some(
              (p) =>
                Math.abs(p.x - building.x) < 1.4 &&
                Math.abs(p.z - building.z - building.depth / 2) < 0.9,
            );
        if (blocked) throw Error("Проём занят: отойди или убери предмет");
        this.doors.delete(building.id);
      } else this.doors.add(building.id);
      this.save(
        `door:${building.id}`,
        JSON.stringify({ open: this.doors.has(building.id) }),
      );
      this.cooldown.set(player.id, now);
      return this.doors.has(building.id) ? "Дверь открыта" : "Дверь закрыта";
    }
    if (action === "pickup") {
      const item = this.items.find((o) => o.id === id);
      if (held) throw Error("Сначала положи предмет из рук");
      if (
        !item ||
        item.holder ||
        Math.hypot(item.x - player.x, item.z - player.z, item.y - player.height) > 2.8
      )
        throw Error("Предмет далеко или уже занят");
      item.holder = player.id;
      for (const box of townColliders(this.doors))
        for (let t = 0.1; t < 0.95; t += 0.1) {
          const x = player.x + (item.x - player.x) * t,
            z = player.z + (item.z - player.z) * t;
          if (Math.abs(x - box.x) < box.hx && Math.abs(z - box.z) < box.hz) {
            delete item.holder;
            throw Error("Между тобой и предметом препятствие");
          }
        }
      item.vx = item.vy = item.vz = 0;
      this.cooldown.set(player.id, now);
      return item.kind === "ball"
        ? "Мяч в руках · Q — положить, T — бросить"
        : "Ящик в руках · Q — положить, T — бросить";
    }
    if (!held) throw Error("В руках нет предмета");
    const x = player.x - Math.sin(player.rotY) * 1.3,
      z = player.z - Math.cos(player.rotY) * 1.3;
    if (
      townColliders(this.doors).some(
        (b) =>
          Math.abs(x - b.x) < b.hx + radius(held) &&
          Math.abs(z - b.z) < b.hz + radius(held),
      )
    )
      throw Error("Впереди препятствие: повернись в свободную сторону");
    delete held.holder;
    held.x = x;
    held.z = z;
    held.y =
      action === "throw" ? Math.max(1.1, player.height + 0.35) : radius(held) + 0.1;
    held.vx = action === "throw" ? -Math.sin(player.rotY) * 7 : 0;
    held.vz = action === "throw" ? -Math.cos(player.rotY) * 7 : 0;
    held.vy = action === "throw" ? 3.8 : 0;
    this.cooldown.set(player.id, now);
    this.persist(held);
    return action === "throw" ? "Предмет брошен" : "Предмет положен";
  }
  update(now: number) {
    if (this.last === undefined) {
      this.last = now;
      return;
    }
    // Shared across rooms: the second room's call cannot advance the clock twice.
    this.accumulator += Math.max(0, Math.min(0.25, (now - this.last) / 1000));
    this.last = Math.max(this.last, now);
    const players = [...this.players.values()].flat(),
      boxes = townColliders(this.doors);
    while (this.accumulator + 1e-9 >= 1 / 60) {
      this.step(players, boxes, 1 / 60);
      this.accumulator -= 1 / 60;
    }
    if (now - this.lastSave > 1000) {
      this.lastSave = now;
      for (const item of this.items)
        if (!item.holder && Math.hypot(item.vx, item.vy, item.vz) < 0.08)
          this.persist(item);
    }
  }
  step(players: PhysicalPlayer[], boxes: Box[], dt: number) {
    for (const item of this.items) {
      const owner = players.find((p) => p.id === item.holder);
      if (owner) {
        item.x = owner.x - Math.sin(owner.rotY) * 0.95;
        item.z = owner.z - Math.cos(owner.rotY) * 0.95;
        item.y = owner.height + 0.25;
        continue;
      }
      if (item.holder) {
        delete item.holder;
        this.persist(item);
      }
      if (
        !players.some(
          (p) =>
            Math.abs(Math.floor(p.x / 64) - Math.floor(item.x / 64)) <= 1 &&
            Math.abs(Math.floor(p.z / 64) - Math.floor(item.z / 64)) <= 1,
        )
      )
        continue;
      const r = radius(item),
        oldX = item.x,
        oldZ = item.z;
      for (const p of players) {
        const d = Math.hypot(item.x - p.x, item.z - p.z);
        if (d < r + 0.65 && (p.speed || 0) > 0.5) {
          item.vx += (p.dx || 0) * Math.min(10, p.speed || 0) * dt * 5;
          item.vz += (p.dz || 0) * Math.min(10, p.speed || 0) * dt * 5;
        }
      }
      item.vy -= 9.8 * dt;
      item.x += item.vx * dt;
      item.y += item.vy * dt;
      item.z += item.vz * dt;
      if (item.y < r) {
        item.y = r;
        item.vy =
          Math.abs(item.vy) > 0.8 ? -item.vy * (item.kind === "ball" ? 0.68 : 0.2) : 0;
        const friction = Math.exp(-(item.kind === "ball" ? 1.1 : 4) * dt);
        item.vx *= friction;
        item.vz *= friction;
      }
      if (item.y < 3.7)
        for (const b of boxes)
          if (Math.abs(item.x - b.x) < b.hx + r && Math.abs(item.z - b.z) < b.hz + r) {
            if (Math.abs(oldX - b.x) >= b.hx + r) {
              item.x = oldX;
              item.vx *= -0.55;
            } else {
              item.z = oldZ;
              item.vz *= -0.55;
            }
          }
      if (Math.hypot(item.vx, item.vz) < 0.025) {
        item.vx = item.vz = 0;
      }
    }
    for (let i = 0; i < this.items.length; i++)
      for (let j = i + 1; j < this.items.length; j++) {
        const a = this.items[i],
          b = this.items[j];
        if (a.holder || b.holder) continue;
        const dx = b.x - a.x,
          dz = b.z - a.z,
          d = Math.hypot(dx, dz),
          limit = radius(a) + radius(b);
        if (d < 0.001 || d >= limit || Math.abs(a.y - b.y) > limit) continue;
        const nx = dx / d,
          nz = dz / d,
          push = (limit - d) / 2;
        a.x -= nx * push;
        a.z -= nz * push;
        b.x += nx * push;
        b.z += nz * push;
        const speed = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz;
        if (speed > 0) {
          const impulse = speed * 0.75;
          a.vx -= impulse * nx;
          a.vz -= impulse * nz;
          b.vx += impulse * nx;
          b.vz += impulse * nz;
        }
      }
  }
  snapshot(player: PhysicalPlayer) {
    const near = (p: { x: number; z: number }) =>
      Math.abs(Math.floor(p.x / 64) - Math.floor(player.x / 64)) <= 1 &&
      Math.abs(Math.floor(p.z / 64) - Math.floor(player.z / 64)) <= 1;
    return {
      serverTime: Date.now(),
      items: this.items.filter(near).map((o) => ({ ...o })),
      doors: buildings
        .filter(near)
        .map((b) => ({ id: b.id, open: this.doors.has(b.id) })),
      holdingId: this.items.find((o) => o.holder === player.id)?.id,
    };
  }
}
let database: ReturnType<typeof getDb> | undefined, world: InteractiveWorld;
export function interactiveWorld() {
  const db = getDb();
  if (database !== db) {
    database = db;
    world = new InteractiveWorld(
      db.prepare("SELECT id,state FROM interactive_objects").all() as Saved[],
      (id, state) => {
        db.prepare(
          "INSERT INTO interactive_objects(id,state,updated_at) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET state=excluded.state,updated_at=excluded.updated_at",
        ).run(id, state, Date.now());
      },
    );
  }
  return world;
}
