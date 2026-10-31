import { ColyseusSDK } from "@colyseus/sdk";
import { cli, type Options } from "@colyseus/loadtest";
export async function main(options: Options) {
  const endpoint = options.endpoint.replace(/^ws/, "http");
  const username = `load_${crypto.randomUUID().slice(0, 16)}`;
  const response = await fetch(`${endpoint}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password: crypto.randomUUID() }),
  });
  if (!response.ok) throw Error(`Registration failed: ${response.status}`);
  const { token } = await response.json();
  const client = new ColyseusSDK(options.endpoint);
  client.auth.token = token;
  const room = await client.joinOrCreate(options.roomName);
  room.onMessage("*", () => {});
  console.log("Authenticated load client", room.sessionId);
}
cli(main);
