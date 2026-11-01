import { defineServer, defineRoom, LobbyRoom } from "colyseus";
import { MyRoom } from "./rooms/MyRoom.js";
import express, { type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { metricsStore } from "./AdminMetrics.js";
import { cast } from "./agents/cast.js";

// 🔥 Импортируем только те функции, которые реально есть в файле
import { signToken, hashPassword, verifyPassword } from "./auth/auth.service.js";
// Импортируем репозиторий для работы с базой данных
import * as repo from "./database/players.repo.js";

const server = defineServer({
  rooms: {
    my_room: defineRoom(MyRoom).enableRealtimeListing(),
    lobby: defineRoom(LobbyRoom),
  },

  express: (app) => {
    app.use(express.json());

    // ==========================================
    // 🔥 1. АВТОРИЗАЦИЯ (Восстановлена)
    // ==========================================
    app.post("/api/auth/register", async (req: Request, res: Response) => {
      try {
        const { username, password } = req.body;
        if (!username || !password) throw new Error("Введите логин и пароль");

        if (repo.findByUsername(username)) throw new Error("Этот логин уже занят");

        const hash = await hashPassword(password);
        const id = randomUUID();
        repo.createPlayer(id, username, hash);

        res.json({ id, username });
      } catch (e: any) {
        res.status(400).json({ error: e.message || "Ошибка регистрации" });
      }
    });

    app.post("/api/auth/login", async (req: Request, res: Response) => {
      try {
        const { username, password } = req.body;
        if (!username || !password) throw new Error("Введите логин и пароль");

        const row = repo.findByUsername(username);
        if (!row) throw new Error("Неверный логин или пароль");

        const isValid = await verifyPassword(password, row.password_hash);
        if (!isValid) throw new Error("Неверный логин или пароль");

        // Генерируем JWT токен
        const token = signToken({ playerId: row.id, username: row.username });

        res.json({ token, playerId: row.id, username: row.username });
      } catch (e: any) {
        res.status(401).json({ error: e.message || "Ошибка входа" });
      }
    });

    // ==========================================
    // 🔥 2. МАРШРУТЫ АДМИНКИ
    // ==========================================
    app.get("/api/admin/metrics", (req: Request, res: Response) => {
      const now = Date.now();
      const activePlayers = Array.from(metricsStore.values()).filter(
        (p) => now - p.lastUpdate < 10000
      );
      res.json(activePlayers);
    });

    app.get("/api/admin/agents", (req: Request, res: Response) => {
      const agentsList = cast.map((a) => ({ id: a.id, name: a.name }));
      res.json(agentsList);
    });

    app.post("/api/admin/agent", (req: Request, res: Response) => {
      const { npcId, newPrompt } = req.body;
      const agent = cast.find((a) => a.id === npcId);

      if (agent) {
        (agent as any).personality = newPrompt;
        console.log(`[ADMIN] Промпт для ${agent.name} изменен.`);
        res.json({ success: true, message: `Промпт для ${agent.name} обновлен` });
      } else {
        res.status(404).json({ error: "Агент не найден" });
      }
    });
  },
});

export default server;
