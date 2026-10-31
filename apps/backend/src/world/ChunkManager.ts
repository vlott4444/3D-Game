import { Chunk } from "../rooms/schema/MyRoomState.js";

const CHUNK_SIZE = 200;

export class ChunkManager {
  private cache = new Map<string, Chunk>();

  getChunk(cx: number, cz: number): Chunk {
    const id = `${cx}:${cz}`;
    if (!this.cache.has(id)) {
      this.cache.set(id, this.generate(cx, cz));
    }
    return this.cache.get(id)!;
  }

  private generate(cx: number, cz: number): Chunk {
    // Детерминированная генерация (можно использовать сид)
    const chunk = new Chunk();
    chunk.id = `${cx}:${cz}`;
    // Пример: добавляем один NPC
    // chunk.entities.push(new Entity({ id: ..., type: 'npc', x: ..., y: ... }));
    return chunk;
  }

  getChunksAround(x: number, y: number, radius: number): Chunk[] {
    const pcx = Math.floor(x / CHUNK_SIZE);
    const pcy = Math.floor(y / CHUNK_SIZE);
    const chunks: Chunk[] = [];
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        chunks.push(this.getChunk(pcx + dx, pcy + dy));
      }
    }
    return chunks;
  }
}
