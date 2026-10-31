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
