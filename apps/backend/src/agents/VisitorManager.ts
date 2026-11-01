import { randomUUID } from "node:crypto";
import { drawVisitor, type VisitorRecord } from "../database/visitors.repo.js";
export type Visit = {
  id: string;
  catalogId: string;
  category: string;
  role: string;
  name: string;
  problem: string;
  phase: "arriving" | "discussing" | "leaving";
  startedAt: number;
  replies: number;
};
export class VisitorManager {
  current: Visit | null = null;
  constructor(
    private readonly draw: (
      players: string[],
      visitKey: string,
      now: number,
    ) => VisitorRecord = drawVisitor,
  ) {}
  call(now: number, players: string[] = []) {
    if (this.current) throw Error("Сначала заверши текущий приём");
    const id = randomUUID();
    const selected = this.draw(players, id, now);
    this.current = {
      name: `${selected.name}, ${selected.role}`,
      problem: selected.problem,
      catalogId: selected.id,
      category: selected.category,
      role: selected.role,
      id,
      phase: "arriving",
      startedAt: now,
      replies: 0,
    };
  }
  recordReply(id: string) {
    if (this.current?.id === id) this.current.replies++;
  }
  finish(now: number) {
    if (!this.current || this.current.phase !== "discussing")
      throw Error("Сейчас нет посетителя для обсуждения");
    if (!this.current.replies)
      throw Error("Сначала обсуди проблему хотя бы с одним мудрецом");
    this.current = { ...this.current, phase: "leaving", startedAt: now };
  }
  advance(now: number) {
    if (!this.current || now - this.current.startedAt < 5000) return false;
    if (this.current.phase === "arriving") {
      this.current = { ...this.current, phase: "discussing", startedAt: now };
      return true;
    }
    if (this.current.phase === "leaving") {
      this.current = null;
      return true;
    }
    return false;
  }
  snapshot() {
    return this.current
      ? {
          ...this.current,
          progress: Math.min(1, (Date.now() - this.current.startedAt) / 5000),
        }
      : null;
  }
}
