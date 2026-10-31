import { randomUUID } from "node:crypto";
const problems = [
  {
    name: "Мира, смотрительница",
    problem:
      "В лагере осталось три бочки питьевой воды на пять семей. Люди спорят, кому выдавать воду первым. Помогите собрать недостающие сведения и договориться о справедливом временном порядке.",
  },
  {
    name: "Лев, мастер",
    problem:
      "Общий генератор выдерживает только две мастерские одновременно. Все хотят работать вечером. Мне нужен понятный график, который жители смогут проверить и пересмотреть.",
  },
  {
    name: "Ника, ученица",
    problem:
      "Два свидетеля называют разное время одного события, а часы на острове отставали. Я боюсь обвинить невиновного. Как составить проверяемую последовательность событий?",
  },
  {
    name: "Самир, библиотекарь",
    problem:
      "Жители хотят проложить короткую дорогу через сад, а садовники против. Как сравнить варианты и организовать обсуждение без ссоры?",
  },
];
export type Visit = {
  id: string;
  name: string;
  problem: string;
  phase: "arriving" | "discussing" | "leaving";
  startedAt: number;
  replies: number;
};
export class VisitorManager {
  current: Visit | null = null;
  private cursor = 0;
  call(now: number) {
    if (this.current) throw Error("Сначала заверши текущий приём");
    const problem = problems[this.cursor++ % problems.length];
    this.current = {
      ...problem,
      id: randomUUID(),
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
