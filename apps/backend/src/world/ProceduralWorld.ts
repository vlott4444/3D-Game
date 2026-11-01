import type { WorldEdit } from "./WorldActions.js";
import { townChunk } from "./Town.js";
export const CHUNK_SIZE = 64;
export const CHUNK_RADIUS = 1;
export const WORLD_SEED = 71239;
export type WorldObject = { kind: "tree" | "rock"; x: number; z: number; scale: number };
// A streamed tree asset is a small three-tree grove; geometry remains instanced.
export function groveObjects(objects: WorldObject[]): WorldObject[] {
  return objects.flatMap((o) =>
    o.kind === "tree"
      ? [
          o,
          { ...o, x: o.x + 2.3 * o.scale, z: o.z + 1.6 * o.scale, scale: o.scale * 0.78 },
          { ...o, x: o.x - 1.8 * o.scale, z: o.z + 2.4 * o.scale, scale: o.scale * 0.9 },
        ]
      : [o],
  );
}
export type WorldChunk = {
  id: string;
  cx: number;
  cz: number;
  objects: WorldObject[];
  edits?: WorldEdit[];
  town?: ReturnType<typeof townChunk>;
};
export function chunkAt(x: number, z: number) {
  return { cx: Math.floor(x / CHUNK_SIZE), cz: Math.floor(z / CHUNK_SIZE) };
}
export function generateChunk(cx: number, cz: number): WorldChunk {
  let seed = (Math.imul(cx, 73856093) ^ Math.imul(cz, 19349663) ^ WORLD_SEED) >>> 0;
  function random() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  }
  const objects: WorldObject[] = [];
  for (let i = 0; i < 10; i++) {
    const x = (cx + random()) * CHUNK_SIZE,
      z = (cz + random()) * CHUNK_SIZE,
      scale = 0.8 + random() * 0.7;
    // Keep the hall and its approaches clear, regardless of which chunks contain them.
    if (Math.abs(x) < 19 && Math.abs(z) < 20) continue;
    // Keep a usable courtyard for the crowd and the four construction sites.
    if (Math.abs(x) < 58 && z > -42 && z < 75) continue;
    objects.push({ kind: i < 7 ? "tree" : "rock", x, z, scale });
  }
  return { id: `${cx}:${cz}`, cx, cz, objects, town: townChunk(cx, cz) };
}
export function worldSnapshot(
  x: number,
  z: number,
  edits: WorldEdit[] = [],
  revision = 0,
) {
  const center = chunkAt(x, z);
  const chunks: WorldChunk[] = [];
  for (let dx = -CHUNK_RADIUS; dx <= CHUNK_RADIUS; dx++)
    for (let dz = -CHUNK_RADIUS; dz <= CHUNK_RADIUS; dz++)
      chunks.push(generateChunk(center.cx + dx, center.cz + dz));
  for (const chunk of chunks)
    chunk.edits = edits.filter(
      (edit) =>
        Math.floor(edit.x / CHUNK_SIZE) === chunk.cx &&
        Math.floor(edit.z / CHUNK_SIZE) === chunk.cz,
    );
  return { seed: WORLD_SEED, chunkSize: CHUNK_SIZE, center, chunks, revision };
}
