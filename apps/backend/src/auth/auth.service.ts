import jwt from "jsonwebtoken";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
const keyPath = fileURLToPath(new URL("../../data/jwt-secret", import.meta.url));
function secret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  mkdirSync(dirname(keyPath), { recursive: true });
  if (!existsSync(keyPath))
    writeFileSync(keyPath, randomBytes(48).toString("hex"), { mode: 0o600, flag: "wx" });
  return readFileSync(keyPath, "utf8");
}
const JWT_SECRET = secret();
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `scrypt:${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}
export async function verifyPassword(password: string, hash: string) {
  if (!hash.startsWith("scrypt:"))
    return (await import("bcrypt")).default.compare(password, hash);
  const [, salt, key] = hash.split(":");
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(key, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export function signToken(payload: { playerId: string; username: string }) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "12h", algorithm: "HS256" });
}
export function verifyToken(token: string): { playerId: string; username: string } {
  const p = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] });
  if (
    typeof p === "string" ||
    typeof p.playerId !== "string" ||
    typeof p.username !== "string"
  )
    throw Error("Invalid token");
  return { playerId: p.playerId, username: p.username };
}
