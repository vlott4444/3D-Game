import { useEffect, useState } from "react";
import type { GameRoom } from "./GameConnection";
export type Item = {
  id: string;
  kind: "ball" | "crate";
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  holder?: string;
};
export type ObjectState = {
  items: Item[];
  doors: { id: string; open: boolean }[];
  holdingId?: string;
};
const empty: ObjectState = { items: [], doors: [] };
export function useObjects(room: GameRoom) {
  const [value, setValue] = useState<ObjectState>(empty);
  useEffect(() => {
    const off = room.onMessage("object_snapshot", (next: ObjectState) => setValue(next));
    room.send("object_request", {});
    return off;
  }, [room]);
  return value;
}
