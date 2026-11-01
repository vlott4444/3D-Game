import { townBlocked } from "./Town.js";
import { chunkAt, generateChunk, CHUNK_SIZE, groveObjects } from "./ProceduralWorld.js";
export type AmbientMode = "wander" | "look" | "yield" | "flee" | "eat" | "guide";
export type AmbientActor = {
  id: string;
  kind: "human" | "deer";
  x: number;
  z: number;
  rotY: number;
  mode: AmbientMode;
  homeX: number;
  homeZ: number;
  phase: number;
  until: number;
  cx: number;
  cz: number;
  guideFor?: string;
  route?: { x: number; z: number }[];
  guideUntil?: number;
};
export type AmbientPlayer = {
  id: string;
  x: number;
  z: number;
  speed: number;
  dx: number;
  dz: number;
};
export type Stimulus = {
  id: string;
  kind: "talk" | "wave" | "feed";
  x: number;
  z: number;
  expires: number;
};
const COUNT = 18;
function insideHall(x: number, z: number) {
  return Math.abs(x) < 16 && Math.abs(z) < 16;
}
function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
export function createAmbientChunk(cx: number, cz: number): AmbientActor[] {
  let seed = (Math.imul(cx, 14348907) ^ Math.imul(cz, 48611) ^ 911) >>> 0;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const terrain = groveObjects(generateChunk(cx, cz).objects);
  const actors: AmbientActor[] = [];
  for (let i = 0; i < COUNT; i++) {
    let x = cx * 64 + 6 + random() * 52,
      z = cz * 64 + 6 + random() * 52;
    if ((cx === 0 || cx === -1) && (cz === 0 || cz === -1) && i < 8) {
      const sx = cx === 0 ? 1 : -1,
        sz = cz === 0 ? 1 : -1;
      if (i < 4) {
        x = sx * (4 + (i % 2) * 7);
        z = sz * (20 + Math.floor(i / 2) * 7);
      } else {
        x = sx * (20 + (i % 2) * 7);
        z = sz * (4 + Math.floor((i - 4) / 2) * 7);
      }
    }
    for (
      let attempt = 0;
      attempt < 100 &&
      (insideHall(x, z) ||
        townBlocked(x, z) ||
        terrain.some((o) => Math.hypot(o.x - x, o.z - z) < 1.7));
      attempt++
    ) {
      x = cx * 64 + 6 + random() * 52;
      z = cz * 64 + 6 + random() * 52;
    }
    actors.push({
      id: `${cx}:${cz}:${i}`,
      kind: i % 3 === 0 ? "deer" : "human",
      x,
      z,
      homeX: x,
      homeZ: z,
      rotY: random() * Math.PI * 2,
      phase: random() * Math.PI * 2,
      mode: "wander",
      until: 0,
      cx,
      cz,
    });
  }
  return actors;
}
export function stepAmbientActor(
  actor: AmbientActor,
  players: AmbientPlayer[],
  stimuli: Stimulus[],
  now: number,
  dt: number,
  blocked: (x: number, z: number) => boolean = insideHall,
) {
  let nearest: AmbientPlayer | undefined;
  let distance = Infinity;
  for (const player of players) {
    const d = Math.hypot(player.x - actor.x, player.z - actor.z);
    if (d < distance) {
      nearest = player;
      distance = d;
    }
  }
  const local = stimuli.filter(
    (s) =>
      s.expires > now &&
      Math.hypot(s.x - actor.x, s.z - actor.z) < (s.kind === "feed" ? 9 : 14),
  );
  const food = local.find((s) => s.kind === "feed");
  const social = local.find((s) => s.kind !== "feed");
  let tx = actor.homeX + Math.sin(now / 6500 + actor.phase) * 3,
    tz = actor.homeZ + Math.cos(now / 7000 + actor.phase) * 3;
  let speed = actor.kind === "human" ? 0.8 : 1;
  const follower = players.find((p) => p.id === actor.guideFor);
  if (actor.guideFor && (!follower || now > (actor.guideUntil || 0))) {
    actor.guideFor = undefined;
    actor.route = undefined;
  }
  if (actor.guideFor && follower && actor.route?.length) {
    const target = actor.route[0];
    tx = target.x;
    tz = target.z;
    actor.mode = "guide";
    speed = Math.hypot(follower.x - actor.x, follower.z - actor.z) > 12 ? 0 : 1.6;
    if (Math.hypot(tx - actor.x, tz - actor.z) < 1) {
      actor.route.shift();
      if (!actor.route.length) {
        actor.guideFor = undefined;
        actor.homeX = actor.x;
        actor.homeZ = actor.z;
        actor.mode = "look";
        actor.until = now + 3000;
        speed = 0;
      }
    }
  } else if (
    nearest &&
    nearest.speed > 6.5 &&
    distance < (actor.kind === "deer" ? 7 : 4)
  ) {
    if (actor.kind === "deer") {
      actor.mode = "flee";
      actor.until = now + 1200;
      const d = Math.max(distance, 0.01);
      tx = actor.x + ((actor.x - nearest.x) / d) * 5;
      tz = actor.z + ((actor.z - nearest.z) / d) * 5;
      speed = 3.4;
    } else {
      actor.mode = "yield";
      actor.until = now + 900;
      tx = nearest.x;
      tz = nearest.z;
      speed = 0;
    }
  } else if (food && actor.kind === "deer") {
    actor.mode = "eat";
    actor.until = food.expires;
    tx = food.x;
    tz = food.z;
    speed = Math.hypot(tx - actor.x, tz - actor.z) > 1.3 ? 1.5 : 0;
  } else if ((social || (nearest && distance < 2.4)) && actor.kind === "human") {
    actor.mode = "look";
    actor.until = social?.expires || now + 600;
    tx = social?.x ?? nearest!.x;
    tz = social?.z ?? nearest!.z;
    speed = 0;
  } else if (actor.until > now && (actor.mode === "yield" || actor.mode === "look")) {
    speed = 0;
    tx = nearest?.x ?? actor.homeX;
    tz = nearest?.z ?? actor.homeZ;
  } else {
    actor.mode = "wander";
    actor.until = 0;
  }
  const dx = tx - actor.x,
    dz = tz - actor.z,
    d = Math.hypot(dx, dz);
  if (d > 0.001) actor.rotY = Math.atan2(dx, dz);
  if (speed && d > 0.15) {
    const step = Math.min(d, speed * Math.min(dt, 0.2));
    const x = actor.guideFor
        ? actor.x + (dx / d) * step
        : clamp(actor.x + (dx / d) * step, actor.cx * 64 + 1, actor.cx * 64 + 63),
      z = actor.guideFor
        ? actor.z + (dz / d) * step
        : clamp(actor.z + (dz / d) * step, actor.cz * 64 + 1, actor.cz * 64 + 63);
    if (!blocked(x, z)) {
      actor.x = x;
      actor.z = z;
    } else {
      if (!blocked(x, actor.z)) actor.x = x;
      else if (!blocked(actor.x, z)) actor.z = z;
    }
  }
}
export class AmbientWorld {
  private chunks = new Map<string, AmbientActor[]>();
  private terrain = new Map<string, ReturnType<typeof generateChunk>["objects"]>();
  private signals = new Map<string, Stimulus>();
  update(
    players: AmbientPlayer[],
    now: number,
    dt: number,
    obstacles: { x: number; z: number; radius: number }[] = [],
  ) {
    const active = new Set<string>();
    for (const player of players) {
      const c = chunkAt(player.x, player.z);
      for (let dx = -1; dx <= 1; dx++)
        for (let dz = -1; dz <= 1; dz++) {
          const cx = c.cx + dx,
            cz = c.cz + dz,
            key = `${cx}:${cz}`;
          active.add(key);
          if (!this.chunks.has(key)) {
            this.chunks.set(key, createAmbientChunk(cx, cz));
            this.terrain.set(key, groveObjects(generateChunk(cx, cz).objects));
          }
        }
    }
    for (const key of this.chunks.keys())
      if (!active.has(key)) {
        this.chunks.delete(key);
        this.terrain.delete(key);
      }
    for (const [id, signal] of this.signals)
      if (signal.expires <= now) this.signals.delete(id);
    const signals = [...this.signals.values()];
    for (const [key, actors] of this.chunks)
      for (const actor of actors)
        stepAmbientActor(
          actor,
          players,
          signals,
          now,
          dt,
          (x, z) =>
            insideHall(x, z) ||
            townBlocked(x, z) ||
            this.terrain
              .get(key)!
              .some((o) => o.kind === "tree" && Math.hypot(x - o.x, z - o.z) < 0.7) ||
            obstacles.some((o) => {
              const next = Math.hypot(x - o.x, z - o.z);
              const current = Math.hypot(actor.x - o.x, actor.z - o.z);
              return next < o.radius && (current >= o.radius || next <= current);
            }),
        );
  }
  guide(playerId: string, x: number, z: number, now: number) {
    const people = [...this.chunks.values()]
      .flat()
      .filter((a) => a.kind === "human" && Math.hypot(a.x - x, a.z - z) < 4)
      .sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z));
    const person = people[0];
    if (!person) throw Error("Подойди ближе к жителю: N — попросить провести к совету");
    if (person.guideFor && person.guideFor !== playerId)
      throw Error("Этот житель сейчас помогает другому игроку");
    if (person.guideFor === playerId) {
      person.guideFor = undefined;
      person.route = undefined;
      return "Смотритель: Хорошо, останусь здесь. Обращайся, если понадобится дорога.";
    }
    if (Math.hypot(person.x, person.z) > 180)
      return "Смотритель: Главный зал далеко. Кнопка «В зал» вернёт тебя к совету; возле городка я смогу проводить пешком.";
    person.guideFor = playerId;
    person.guideUntil = now + 90000;
    person.route = [
      {
        x:
          Math.abs(person.x) > 20 || person.z < 16
            ? (Math.sign(person.x) || 1) * 26
            : person.x,
        z: person.z,
      },
      {
        x:
          Math.abs(person.x) > 20 || person.z < 16
            ? (Math.sign(person.x) || 1) * 26
            : person.x,
        z: 18,
      },
      { x: 0, z: 18 },
    ];
    return "Смотритель: Проведу к главному залу. Иди за мной — если отстанешь, я подожду. N рядом со мной — отменить помощь.";
  }
  stimulate(playerId: string, kind: Stimulus["kind"], x: number, z: number, now: number) {
    this.signals.set(`${playerId}:${kind}`, {
      id: `${playerId}:${kind}`,
      kind,
      x,
      z,
      expires: now + (kind === "feed" ? 6500 : 2500),
    });
  }
  snapshot(x: number, z: number, now: number) {
    const c = chunkAt(x, z);
    const actors: Pick<AmbientActor, "id" | "kind" | "x" | "z" | "rotY" | "mode">[] = [];
    for (let dx = -1; dx <= 1; dx++)
      for (let dz = -1; dz <= 1; dz++)
        for (const actor of this.chunks.get(`${c.cx + dx}:${c.cz + dz}`) || [])
          actors.push({
            id: actor.id,
            kind: actor.kind,
            x: actor.x,
            z: actor.z,
            rotY: actor.rotY,
            mode: actor.mode,
          });
    const food = [...this.signals.values()]
      .filter(
        (s) =>
          s.kind === "feed" &&
          s.expires > now &&
          Math.abs(Math.floor(s.x / CHUNK_SIZE) - c.cx) <= 1 &&
          Math.abs(Math.floor(s.z / CHUNK_SIZE) - c.cz) <= 1,
      )
      .map(({ id, x, z }) => ({ id, x, z }));
    return { actors, food };
  }
  get activeChunkCount() {
    return this.chunks.size;
  }
}
