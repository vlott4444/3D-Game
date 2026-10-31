
import { ColyseusSDK } from "@colyseus/sdk";
import type server from "@3d-game/backend/app.config";

// Подключаемся к локальному серверу Colyseus
const client = new ColyseusSDK<typeof server>(
  `ws://${window.location.hostname}:2567`
);

// Подключение к игровой комнате
export async function connectToGame() {
  const room = await client.joinOrCreate("my_room");

  console.log("Connected to Colyseus:", room.sessionId);

  return room;
}
