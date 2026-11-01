import { cast } from "../agents/cast.js";
export function canInteractAt(x: number, z: number, target: string) {
  if (target === "players") return true;
  // Small tolerance over the UI radius accommodates the last acknowledged pose.
  if (target === "all") return Math.hypot(x, z + 2.5) <= 4.1;
  const person = cast.find((p) => p.id === target);
  return !!person && Math.hypot(x - person.position[0], z - person.position[2]) <= 3.2;
}
