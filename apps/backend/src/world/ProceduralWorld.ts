import type { WorldEdit } from "./WorldActions.js";
import {
  chunkAt,
  generateChunk,
  clampWorld,
  CHUNK_RADIUS,
  CHUNK_SIZE,
  WORLD_SEED,
  MIN_CHUNK,
  MAX_CHUNK,
  type WorldChunk,
} from "./TerrainGenerator.js";
import { WORLD_CATALOG } from "./WorldCatalog.generated.js";
export * from "./TerrainGenerator.js";
export function worldSnapshot(
  x: number,
  z: number,
  edits: WorldEdit[] = [],
  revision = 0,
) {
  const center = chunkAt(clampWorld(x), clampWorld(z));
  const chunks: WorldChunk[] = [];
  for (let dx = -CHUNK_RADIUS; dx <= CHUNK_RADIUS; dx++)
    for (let dz = -CHUNK_RADIUS; dz <= CHUNK_RADIUS; dz++) {
      const cx = center.cx + dx,
        cz = center.cz + dz;
      if (cx < MIN_CHUNK || cx > MAX_CHUNK || cz < MIN_CHUNK || cz > MAX_CHUNK) continue;
      const chunk = generateChunk(cx, cz);
      chunk.edits = edits.filter(
        (e) => Math.floor(e.x / CHUNK_SIZE) === cx && Math.floor(e.z / CHUNK_SIZE) === cz,
      );
      chunks.push(chunk);
    }
  const snapshot = {
    seed: WORLD_SEED,
    chunkSize: CHUNK_SIZE,
    center,
    chunks,
    revision,
    catalogId: WORLD_CATALOG.id,
  };
  const bytes = Buffer.byteLength(JSON.stringify(snapshot));
  if (
    WORLD_CATALOG.commonBytes + WORLD_CATALOG.dynamicReserve + 2 * bytes >
    WORLD_CATALOG.budgetBytes
  )
    throw Error("Локальный кэш мира превысил бюджет");
  return snapshot;
}
