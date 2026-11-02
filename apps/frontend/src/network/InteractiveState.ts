import { useEffect, useSyncExternalStore } from "react";
import type { GameRoom } from "./GameConnection";
export type Item = {
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
export type ObjectState = {
  serverTime: number;
  items: Item[];
  doors: { id: string; open: boolean }[];
  holdingId?: string;
};
const empty: ObjectState = { serverTime: 0, items: [], doors: [] };
type Store = {
  value: ObjectState;
  previous: ObjectState;
  received: number;
  interval: number;
  listeners: Set<() => void>;
  off?: () => void;
};
const stores = new WeakMap<GameRoom, Store>();
export const localPoses = new WeakMap<
  GameRoom,
  { x: number; y: number; z: number; rotY: number }
>();
function store(room: GameRoom) {
  let s = stores.get(room);
  if (!s) {
    s = {
      value: empty,
      previous: empty,
      received: 0,
      interval: 50,
      listeners: new Set(),
    };
    stores.set(room, s);
  }
  return s;
}
export function useObjects(room: GameRoom) {
  const s = store(room);
  useEffect(() => {
    if (!s.off) {
      s.off = room.onMessage("object_snapshot", (next: ObjectState) => {
        if (
          !Array.isArray(next.items) ||
          next.items.length > 5 ||
          !Array.isArray(next.doors) ||
          next.doors.length > 22 ||
          !Number.isFinite(next.serverTime)
        )
          return;
        if (next.serverTime < s.value.serverTime) return;
        const now = performance.now();
        s.interval = Math.min(
          100,
          Math.max(20, next.serverTime - s.value.serverTime || 50),
        );
        s.previous = s.value;
        s.value = next;
        s.received = now;
        s.listeners.forEach((fn) => fn());
      });
      room.send("object_request", {});
    }
    return () => {
      if (!s.listeners.size) {
        s.off?.();
        s.off = undefined;
        s.value = s.previous = empty;

        localPoses.delete(room);
      }
    };
  }, [room, s]);
  return useSyncExternalStore(
    (fn) => {
      s.listeners.add(fn);
      return () => {
        s.listeners.delete(fn);
      };
    },
    () => s.value,
  );
}
// One snapshot behind, then short bounded extrapolation if a packet is late.
export function sampleItem(
  previous: Item | undefined,
  next: Item,
  age: number,
  interval: number,
) {
  if (
    previous &&
    previous.holder === next.holder &&
    Math.hypot(previous.x - next.x, previous.y - next.y, previous.z - next.z) < 5 &&
    age < interval
  ) {
    const a = Math.max(0, age / interval);
    return {
      x: previous.x + (next.x - previous.x) * a,
      y: previous.y + (next.y - previous.y) * a,
      z: previous.z + (next.z - previous.z) * a,
    };
  }
  const dt = Math.max(0, Math.min(0.1, (age - interval) / 1000));
  return {
    x: next.x + next.vx * dt,
    y: Math.max(0.38, next.y + next.vy * dt - (next.y > 0.39 ? 4.9 * dt * dt : 0)),
    z: next.z + next.vz * dt,
  };
}
export function objectPosition(room: GameRoom, item: Item) {
  const s = store(room),
    pose = localPoses.get(room);
  if (s.value.holdingId === item.id && pose)
    return {
      x: pose.x - Math.sin(pose.rotY) * 0.95,
      y: pose.y + 0.25,
      z: pose.z - Math.cos(pose.rotY) * 0.95,
    };
  return sampleItem(
    s.previous.items.find((p) => p.id === item.id),
    item,
    performance.now() - s.received,
    s.interval,
  );
}
