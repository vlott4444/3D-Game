import { schema, t, type SchemaType } from "@colyseus/schema";

export const MoveInput = schema({
  moveX: t.int8<-1 | 0 | 1>(),
  moveY: t.int8<-1 | 0 | 1>(),
});
export type MoveInput = SchemaType<typeof MoveInput>;

export const Player = schema({
  x: t.number(),
  y: t.number(),
  vx: t.number(),
  vy: t.number(),
});
export type Player = SchemaType<typeof Player>;

export const Entity = schema({
  id: t.string(),
  type: t.string(),
  x: t.number(),
  y: t.number(),
});
export type Entity = SchemaType<typeof Entity>;

export const Chunk = schema({
  id: t.string(),
  entities: t.array(Entity),
});
export type Chunk = SchemaType<typeof Chunk>;

export const MyRoomState = schema({
  players: t.map(Player),
});
export type MyRoomState = SchemaType<typeof MyRoomState>;
