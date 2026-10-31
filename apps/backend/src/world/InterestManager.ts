import { Chunk } from '../rooms/schema/MyRoomState.js';

const TOTAL_CHUNKS = 100;
const MAX_CACHE_RATIO = 0.10;
const MAX_CHUNKS = Math.floor(TOTAL_CHUNKS * MAX_CACHE_RATIO); // 10

export class InterestManager {
  update(currentChunkIds: Set<string>, desiredChunks: Chunk[]): { add: Chunk[]; remove: string[] } {
    const desiredIds = new Set(desiredChunks.map(c => c.id));

    const add: Chunk[] = [];
    const remove: string[] = [];

    for (const chunk of desiredChunks) {
      if (!currentChunkIds.has(chunk.id) && currentChunkIds.size + add.length < MAX_CHUNKS) {
        add.push(chunk);
      }
    }

    for (const id of currentChunkIds) {
      if (!desiredIds.has(id)) {
        remove.push(id);
      }
    }

    return { add, remove };
  }
}
