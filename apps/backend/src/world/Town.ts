export type TownBuilding = {
  id: string;
  name: string;
  kind: "house" | "workshop" | "school";
  x: number;
  z: number;
  width: number;
  depth: number;
  color: string;
  roof: string;
};
export const buildings: TownBuilding[] = [
  ...[-1, 1].flatMap((side) =>
    [-24, 0, 24].map((z, i) => ({
      id: `home-${side}-${i}`,
      name: ["Дом садовника", "Дом пекаря", "Дом смотрителя"][i],
      kind: "house" as const,
      x: side * 40,
      z,
      width: 8,
      depth: 8,
      color: side < 0 ? "#d2bd92" : "#a8bda9",
      roof: i === 1 ? "#596e70" : "#a4654a",
    })),
  ),
  {
    id: "workshop",
    name: "Мастерская",
    kind: "workshop",
    x: -22,
    z: 56,
    width: 11,
    depth: 9,
    color: "#bdaf8c",
    roof: "#546b70",
  },
  {
    id: "school",
    name: "Лесная школа",
    kind: "school",
    x: 22,
    z: 56,
    width: 11,
    depth: 9,
    color: "#d8c9a1",
    roof: "#8a604b",
  },
];
export type TownPath = { x: number; z: number; width: number; depth: number };
export const paths: TownPath[] = [
  { x: -26, z: 10, width: 5, depth: 102 },
  { x: 26, z: 10, width: 5, depth: 102 },
  { x: 0, z: -27, width: 57, depth: 5 },
  { x: 0, z: 49, width: 60, depth: 5 },
  { x: 0, z: 20, width: 49, depth: 11 },
  { x: 0, z: 36, width: 6, depth: 24 },
  ...[-1, 1].flatMap((side) =>
    [-24, 0, 24].map((z) => ({ x: side * 33, z: z + 5, width: 14, depth: 3 })),
  ),
  { x: -22, z: 65, width: 13, depth: 4 },
  { x: 22, z: 65, width: 13, depth: 4 },
];
export type Box = { x: number; z: number; hx: number; hz: number };
export function townBlocked(x: number, z: number, padding = 0.8) {
  return buildings.some(
    (b) =>
      Math.abs(x - b.x) < b.width / 2 + padding &&
      Math.abs(z - b.z) < b.depth / 2 + padding,
  );
}
export function townColliders(openDoors: Set<string> = new Set()): Box[] {
  const result: Box[] = [
    { x: -14, z: 0, hx: 0.4, hz: 14 },
    { x: 14, z: 0, hx: 0.4, hz: 14 },
    { x: 0, z: -14, hx: 14, hz: 0.4 },
    { x: -9, z: 14, hx: 5, hz: 0.4 },
    { x: 9, z: 14, hx: 5, hz: 0.4 },
  ];
  for (const b of buildings) {
    const w = b.width / 2,
      d = b.depth / 2,
      segment = (w - 1) / 2;
    result.push(
      { x: b.x - w, z: b.z, hx: 0.2, hz: d },
      { x: b.x + w, z: b.z, hx: 0.2, hz: d },
      { x: b.x, z: b.z - d, hx: w, hz: 0.2 },
      { x: b.x - (w + 1) / 2, z: b.z + d, hx: segment, hz: 0.2 },
      { x: b.x + (w + 1) / 2, z: b.z + d, hx: segment, hz: 0.2 },
    );
    if (!openDoors.has(b.id)) result.push({ x: b.x, z: b.z + d, hx: 1, hz: 0.15 });
  }
  return result;
}
export function townChunk(cx: number, cz: number) {
  const inside = (item: { x: number; z: number }) =>
    Math.floor(item.x / 64) === cx && Math.floor(item.z / 64) === cz;
  return { buildings: buildings.filter(inside), paths: paths.filter(inside) };
}
