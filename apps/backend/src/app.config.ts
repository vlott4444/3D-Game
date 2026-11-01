import { readFileSync } from "node:fs";
import { isAdministrator, agentOverride, updateAgent } from "./admin.service.js";
import { metricsStore } from "./AdminMetrics.js";
import { cast } from "./agents/cast.js";
import { verifyToken } from "./auth/auth.service.js";
import { findById } from "./database/players.repo.js";
import { defineServer, defineRoom } from "colyseus";
import express from "express";
import { randomUUID } from "node:crypto";
import { MyRoom } from "./rooms/MyRoom.js";
import { findByUsername, createPlayer } from "./database/players.repo.js";
import { hashPassword, verifyPassword, signToken } from "./auth/auth.service.js";
const server = defineServer({
  rooms: { my_room: defineRoom(MyRoom) },
  express: (app) => {
    app.use(express.json({ limit: "8kb" }));
    app.use("/api/admin", (req, res, next) => {
      try {
        const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
        if (!token) {
          res.status(401).json({ error: "Требуется авторизация" });
          return;
        }
        const auth = verifyToken(token);
        if (!findById(auth.playerId)) {
          res.status(401).json({ error: "Аккаунт не найден" });
          return;
        }
        if (!isAdministrator(auth.playerId)) {
          res.status(403).json({ error: "Недостаточно прав" });
          return;
        }
        next();
      } catch {
        res.status(401).json({ error: "Недействительный токен" });
      }
    });
    app.get("/api/admin/metrics", (_req, res) =>
      res.json(
        [...metricsStore.values()].filter((m) => Date.now() - m.lastUpdate < 10000),
      ),
    );
    app.get("/api/admin/agents", (_req, res) =>
      res.json(
        cast.map((n) => ({
          id: n.id,
          name: n.name,
          newPrompt: agentOverride(n.id) || "",
          basePersonality: JSON.parse(
            readFileSync(
              new URL(`./agents/profiles/${n.id}.json`, import.meta.url),
              "utf8",
            ),
          ).personality,
        })),
      ),
    );
    app.post("/api/admin/agent", (req, res) => {
      try {
        updateAgent(req.body?.npcId, req.body?.newPrompt);
        res.json({ success: true });
      } catch (e) {
        res.status(400).json({ error: (e as Error).message });
      }
    });
    app.get("/api/health", (_req, res) => res.json({ ok: true }));
    app.post("/api/auth/:action", async (req, res) => {
      const { username, password } = req.body ?? {};
      if (
        !["login", "register"].includes(req.params.action) ||
        typeof username !== "string" ||
        !/^[\p{L}\p{N}_-]{3,32}$/u.test(username) ||
        typeof password !== "string" ||
        password.length < 8 ||
        password.length > 128
      ) {
        res.status(400).json({ error: "Имя: 3–32 буквы/цифры. Пароль: 8–128 символов." });
        return;
      }
      try {
        let player = findByUsername(username);
        if (req.params.action === "register") {
          if (player) {
            res.status(409).json({ error: "Имя уже занято" });
            return;
          }
          const hash = await hashPassword(password);
          createPlayer(randomUUID(), username, hash);
          player = findByUsername(username);
        }
        if (!player || !(await verifyPassword(password, player.password_hash))) {
          res.status(401).json({ error: "Неверное имя или пароль" });
          return;
        }
        res.json({
          token: signToken({ playerId: player.id, username: player.username }),
          username: player.username,
        });
      } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Ошибка входа на сервере" });
      }
    });
  },
});
export default server;
