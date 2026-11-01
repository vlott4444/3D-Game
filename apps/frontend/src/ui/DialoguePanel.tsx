import { useEffect, useRef, useState, type SubmitEvent } from "react";
import type { GameRoom } from "../network/GameConnection";
import { cast } from "../game/npc/cast";
import type { VisitorState } from "../game/npc/Visitor";
import type { CouncilTurn } from "../network/CouncilTurn";
type Entry = { speaker: string; text: string; kind: string; npcId?: string };
export default function DialoguePanel({
  room,
  open,
  onClose,
  nearNPC,
  council,
}: {
  room: GameRoom;
  open: boolean;
  onClose: () => void;
  nearNPC: boolean;
  council: CouncilTurn | null;
}) {
  const [target, setTarget] = useState("all");
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState<Entry[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [evidence, setEvidence] = useState<Record<string, string>>({});
  const [visitor, setVisitor] = useState<VisitorState | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const request = useRef("");
  useEffect(() => {
    const remove = [
      room.onMessage("visitor_state", (v: VisitorState | null) => setVisitor(v)),
      room.onMessage("visitor_error", (e: { text: string }) => setError(e.text)),
      room.onMessage("dialogue", (e: Entry) => setHistory((h) => [...h, e].slice(-100))),
      room.onMessage("dialogue_done", (e: any) => {
        if (e.requestId === request.current) {
          setBusy(false);
          if (e.error) setError(e.error);
        }
      }),
      room.onMessage("evidence", (e: any) =>
        setEvidence((old) => ({ ...old, [e.id]: e.text })),
      ),
      room.onMessage("case_history", (e: any) => {
        setHistory(e.history);
        setEvidence(e.evidence);
      }),
    ];
    room.send("case_history", {});
    room.send("visitor_request", {});
    return () => remove.forEach((fn) => fn());
  }, [room]);
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, open]);
  function send(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!message.trim() || busy || (target !== "players" && council?.active)) return;
    setError("");
    request.current = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setBusy(true);
    room.send("chat", { text: message.trim(), target, requestId: request.current });
    setMessage("");
  }
  return (
    <section
      className="dialogue"
      style={{ display: open ? "flex" : "none" }}
      aria-label="Общий диалог с мудрецами"
    >
      <div className="dialogue-top">
        <div>
          <b>Зал шести мудрецов</b>
          <small>Общий разговор игроков этой комнаты</small>
        </div>
        <button onClick={onClose}>Закрыть</button>
      </div>
      <div className="visitor-card">
        {visitor ? (
          <>
            <b>{visitor.name}</b>
            <small>
              {visitor.phase === "arriving"
                ? "Посетитель входит…"
                : visitor.phase === "leaving"
                  ? "Приём завершён. Посетитель уходит…"
                  : "Проблема на обсуждении"}
            </small>
            <p>{visitor.problem}</p>
            <button
              type="button"
              disabled={
                busy ||
                council?.active ||
                !nearNPC ||
                visitor.phase !== "discussing" ||
                visitor.replies < 1
              }
              onClick={() => room.send("visitor_action", { action: "finish" })}
            >
              Завершить приём
            </button>
          </>
        ) : (
          <>
            <p>
              Пригласи одного посетителя и обсуди его проблему с советом. После приёма он
              уйдёт.
            </p>
            <button
              type="button"
              disabled={busy || !!council?.active || !nearNPC}
              onClick={() => room.send("visitor_action", { action: "call" })}
            >
              Пригласить посетителя
            </button>
          </>
        )}
      </div>
      {!visitor && (
        <p className="muted">
          Спроси о колоколе, воде, журнале или причале. Свидетели скрывают часть фактов,
          пока группа не найдёт подтверждение. Без посетителя доступен прежний детективный
          сценарий.
        </p>
      )}
      <select
        aria-label="Адресат"
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        disabled={busy}
      >
        <option value="players">Игрокам комнаты</option>
        <option value="all">Совету — отвечают подходящие участники</option>
        {cast.map((n) => (
          <option key={n.id} value={n.id}>
            {n.name} · {n.title}
          </option>
        ))}
      </select>
      <small className="muted">
        По теме отвечают 1–3 участника. Напиши «Ада и Сократ, …» или «Пусть ответят
        остальные», чтобы сменить собеседников.
      </small>
      <details className="council-roster">
        <summary>Кто в совете и чем поможет</summary>
        {cast.map((person) => (
          <p key={person.id}>
            <b>
              {person.name} · {person.title}
            </b>
            <br />
            {person.summary}
          </p>
        ))}
      </details>
      {council && (
        <div className="council-status" aria-live="polite">
          <b>{council.active ? "Этот ход совета" : "Последний ход совета"}</b>
          <div className="council-members">
            {council.members.map((person) => (
              <span key={person.id} data-status={person.status}>
                {person.name}:{" "}
                {
                  {
                    waiting: "в очереди",
                    thinking: "готовит ответ…",
                    answered: "ответил",
                    abstained: "воздержался",
                    error: "ошибка модели",
                  }[person.status]
                }
              </span>
            ))}
          </div>
          {!!council.silent.length && (
            <small>
              Пока слушают: {council.silent.map((p) => p.name).join(", ")}. К ним можно
              обратиться по имени.
            </small>
          )}
        </div>
      )}
      <div className="chat-log" aria-live="polite">
        {history.map((e, i) => (
          <article className={`bubble ${e.kind}`} key={i}>
            <b>{e.speaker}</b>
            <p>{e.text}</p>
          </article>
        ))}
        <div ref={bottom} />
      </div>
      {!visitor && Object.keys(evidence).length > 0 && (
        <details className="evidence">
          <summary>Доска улик ({Object.keys(evidence).length})</summary>
          {Object.entries(evidence).map(([id, text]) => (
            <p key={id}>{text}</p>
          ))}
        </details>
      )}
      {busy && (
        <small role="status">
          Совет отвечает. Выбранные участники выскажутся по очереди.
        </small>
      )}
      {!nearNPC && target !== "players" && (
        <small>Для разговора войди в зал совета.</small>
      )}
      {error && <p role="alert">{error}</p>}
      <form onSubmit={send}>
        <input
          aria-label="Сообщение"
          maxLength={600}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Вопрос мудрецу или сообщение группе"
        />
        <button
          disabled={
            busy ||
            (target !== "players" && !!council?.active) ||
            !message.trim() ||
            (!nearNPC && target !== "players") ||
            (!!visitor && visitor.phase !== "discussing" && target !== "players")
          }
        >
          Отправить
        </button>
      </form>
    </section>
  );
}
