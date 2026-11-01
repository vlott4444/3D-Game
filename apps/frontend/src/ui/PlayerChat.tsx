import { useEffect, useRef, useState, type SubmitEvent } from "react";
import type { GameRoom } from "../network/GameConnection";
import { useGlobalMessages } from "../network/GlobalMessages";

export default function PlayerChat({ room }: { room: GameRoom | null }) {
  const { messages, hasMore, error, loadOlder } = useGlobalMessages(room, "players");
  const [draft, setDraft] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);
  function send(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = draft.trim();
    if (!room || !value) return;
    room.send("global_chat:send", { text: value });
    setDraft("");
    // Release keyboard focus so WASD and E work immediately after sending.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  }
  return (
    <section
      className={`player-chat${collapsed ? " is-collapsed" : ""}`}
      aria-label="Общий чат игроков"
    >
      <div className="player-chat-heading">
        <span>ЧАТ ИГРОКОВ · общий</span>
        <button
          type="button"
          aria-label={collapsed ? "Развернуть чат игроков" : "Свернуть чат игроков"}
          aria-expanded={!collapsed}
          onClick={() => setCollapsed((v) => !v)}
        >
          {collapsed ? "Развернуть" : "Свернуть"}
        </button>
      </div>
      {!collapsed && (
        <>
          <div className="player-chat-log" aria-live="polite">
            {hasMore && (
              <button type="button" className="load-history" onClick={loadOlder}>
                Загрузить предыдущие
              </button>
            )}
            {messages.map((m) => (
              <div className={`player-chat-line ${m.kind}`} key={m.id}>
                {m.kind === "system" ? (
                  <em>{m.text}</em>
                ) : (
                  <>
                    <strong>{m.speaker}:</strong> {m.text}
                  </>
                )}
              </div>
            ))}
            {!room && (
              <div className="player-chat-line system">Соединяемся с сервером…</div>
            )}
            {error && <div className="player-chat-line error">{error}</div>}
            <div ref={bottom} />
          </div>
          <form onSubmit={send}>
            <input
              aria-label="Сообщение всем игрокам"
              value={draft}
              maxLength={600}
              disabled={!room}
              placeholder="Сообщение всем игрокам…"
              onChange={(e) => setDraft(e.target.value)}
            />
            <button type="submit" disabled={!room || !draft.trim()}>
              ➤
            </button>
          </form>
        </>
      )}
    </section>
  );
}
