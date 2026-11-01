export type InteractionTarget = { target: string; label: string };
type Person = { id: string; name: string; position: readonly number[] };
export const TABLE = { x: 0, z: -2.5, radius: 3.7 };
export const NPC_REACH = 2.7;

export function interactionAt(
  x: number,
  z: number,
  people: readonly Person[],
): InteractionTarget | null {
  let nearest: Person | null = null;
  let distance = NPC_REACH;
  for (const person of people) {
    const d = Math.hypot(x - person.position[0], z - person.position[2]);
    if (d <= distance) {
      distance = d;
      nearest = person;
    }
  }
  if (nearest) return { target: nearest.id, label: `Поговорить: ${nearest.name}` };
  if (Math.hypot(x - TABLE.x, z - TABLE.z) <= TABLE.radius)
    return { target: "all", label: "Обсудить задачу с советом" };
  return null;
}
