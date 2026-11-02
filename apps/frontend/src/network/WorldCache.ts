import { WORLD_CATALOG as catalog } from "./WorldCatalog.generated";
export const WORLD_BOUNDS = catalog.bounds;
const encoder = new TextEncoder();
export const serializedBytes = (value: unknown) =>
  encoder.encode(JSON.stringify(value)).byteLength;
export function cacheAccounting(snapshot: unknown) {
  const snapshotBytes = serializedBytes(snapshot);
  const usedBytes = catalog.commonBytes + catalog.dynamicReserve + snapshotBytes * 2;
  return {
    usedBytes,
    totalBytes: catalog.totalBytes,
    budgetBytes: catalog.budgetBytes,
    ratio: usedBytes / catalog.totalBytes,
    chunkBytes: snapshotBytes,
    assetsBytes: catalog.commonBytes,
    catalogId: catalog.id,
  };
}
export function validSnapshot(snapshot: any) {
  if (
    !snapshot ||
    snapshot.catalogId !== catalog.id ||
    snapshot.chunkSize !== 64 ||
    !Array.isArray(snapshot.chunks) ||
    snapshot.chunks.length > 9
  )
    return false;
  const ids = new Set<string>();
  for (const c of snapshot.chunks) {
    if (
      !Number.isInteger(c.cx) ||
      !Number.isInteger(c.cz) ||
      c.cx < -128 ||
      c.cx > 127 ||
      c.cz < -128 ||
      c.cz > 127 ||
      c.id !== `${c.cx}:${c.cz}` ||
      ids.has(c.id) ||
      !Array.isArray(c.objects) ||
      c.objects.length > 10
    )
      return false;
    ids.add(c.id);
  }
  return cacheAccounting(snapshot).usedBytes <= catalog.budgetBytes;
}
