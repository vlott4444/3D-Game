import { ColyseusSDK } from "@colyseus/sdk";

const protocol = location.protocol === "https:" ? "wss:" : "ws:";

export async function connectToGame(token: string) {
  const client = new ColyseusSDK(
    `${protocol}//${location.hostname}:${import.meta.env.VITE_BACKEND_PORT || "2567"}`,
  );

  client.auth.token = token;

  // joinOrCreate отлично работает, так как мы запретили удаление комнаты на сервере
  return client.joinOrCreate("my_room");
}

export type GameRoom = Awaited<ReturnType<typeof connectToGame>>;

export async function authenticate(
  action: "login" | "register",
  username: string,
  password: string,
) {
  const response = await fetch(`/api/auth/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const data = await response.json();
  if (!response.ok) throw Error(data.error || "Ошибка входа");
  return data as { token: string; username: string };
}
