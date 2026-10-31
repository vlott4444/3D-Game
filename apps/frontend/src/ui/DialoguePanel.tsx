import { useEffect, useState } from "react";
import type { FormEvent } from "react";

type Message = {
  role: "player" | "npc";
  text: string;
};

type Props = {
  // any, потому что сообщения agent_reply нет в типах сервера
  room: any;
  onClose: () => void;
};

export default function DialoguePanel({ room, onClose }: Props) {
  const [message, setMessage] = useState("");
  const [waiting, setWaiting] = useState(false);
  const [history, setHistory] = useState<Message[]>([
    {
      role: "npc",
      text: "Привет! О чём поговорим?",
    },
  ]);

  // Ответ нейросети приходит от сервера сообщением agent_reply
  useEffect(() => {
    if (!room) return;

    const off = room.onMessage(
      "agent_reply",
      (data: { text: string }) => {
        setHistory((previous) => [
          ...previous,
          { role: "npc", text: data.text },
        ]);
        setWaiting(false);
      }
    );

    return () => {
      if (typeof off === "function") off();
    };
  }, [room]);

  function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const text = message.trim();
    if (!text || !room || waiting) return;

    setHistory((previous) => [...previous, { role: "player", text }]);
    setWaiting(true);

    room.send("chat", { text, target: "einstein" });

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
        <h3 style={{ margin: 0 }}>Альберт Эйнштейн</h3>

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
              {item.role === "player" ? "Ты" : "Эйнштейн"}
            </strong>

            <div style={{ marginTop: 6 }}>{item.text}</div>
          </div>
        ))}

        {waiting && (
          <div style={{ opacity: 0.7 }}>Эйнштейн думает…</div>
        )}
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

        <button type="submit" disabled={waiting || !room}>
          Отправить
        </button>
      </form>
    </div>
  );
}
