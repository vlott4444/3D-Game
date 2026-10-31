
import { useState } from "react";
import type { FormEvent } from "react";

type Message = {
  role: "player" | "npc";
  text: string;
};

type Props = {
  onClose: () => void;
};

export default function DialoguePanel({ onClose }: Props) {
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState<Message[]>([
    {
      role: "npc",
      text: "Привет! О чём поговорим?",
    },
  ]);

  function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const text = message.trim();
    if (!text) return;

    // Временный ответ — позже подключим Ollama через backend
    const reply = text.toLowerCase().includes("время")
      ? "Время относительно! Представь два поезда, движущихся с разными скоростями..."
      : "Интересный вопрос! Давай исследуем его вместе.";

    setHistory((previous) => [
      ...previous,
      { role: "player", text },
      { role: "npc", text: reply },
    ]);

    setMessage("");
  }

  return (
    <div
      style={{
        position: "absolute",
        right: 24,
        bottom: 24,
        width: "min(420px, calc(100vw - 48px))",
        height: 440,
        background: "rgba(20, 28, 44, 0.96)",
        color: "white",
        borderRadius: 16,
        padding: 20,
        zIndex: 20,
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
        fontFamily: "Arial",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h3 style={{ margin: 0 }}>Ноунейм Ноунеймов</h3>

        <button onClick={onClose} type="button">
          ✕
        </button>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          marginTop: 20,
          marginBottom: 16,
        }}
      >
        {history.map((item, index) => (
          <div
            key={index}
            style={{
              marginBottom: 14,
              padding: 12,
              background:
                item.role === "player" ? "#385a91" : "#343e52",
              borderRadius: 10,
            }}
          >
            <strong>
              {item.role === "player" ? "Ты" : "ноунейм"}
            </strong>

            <div style={{ marginTop: 6 }}>{item.text}</div>
          </div>
        ))}
      </div>

      <form
        onSubmit={sendMessage}
        style={{ display: "flex", gap: 8 }}
      >
        <input
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Напиши сообщение..."
          style={{
            flex: 1,
            minWidth: 0,
            padding: 12,
            borderRadius: 8,
            border: "none",
          }}
        />

        <button type="submit">Отправить</button>
      </form>
    </div>
  );
}
