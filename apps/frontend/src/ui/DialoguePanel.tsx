import { useEffect, useRef, useState, type SubmitEvent } from "react";
import type { GameRoom } from "../network/GameConnection";
import { cast } from "../game/npc/cast";
import type { VisitorState } from "../game/npc/Visitor";
import type { CouncilTurn } from "../network/CouncilTurn";

type Entry = {
  id: number;
  speaker: string;
  text: string;
  kind: string;
  npcId?: string;
  target: string;
  caseId: string;
  reactionTo?: { name: string; text: string };
};
type Props = {
  room: GameRoom;
  open: boolean;
  onClose: () => void;
  target: string;
  canInteract: boolean;
  atTable: boolean;
  council: CouncilTurn | null;
};
function mergeEntries(previous: Entry[], incoming: Entry[]) {
  return [
    ...new Map([...previous, ...incoming].map((entry) => [entry.id, entry])).values(),
  ]
    .sort((a, b) => a.id - b.id)
    .slice(-300);
}
export default function DialoguePanel({
  room,
  open,
  onClose,
  target,
  canInteract,
  atTable,
  council,
}: Props) {
  const [message, setMessage] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [visitor, setVisitor] = useState<VisitorState | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(() => window.innerWidth >= 1000);
  const [maximized, setMaximized] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const followTail = useRef(true);
  const request = useRef("");
  const person = cast.find((p) => p.id === target);
  const isPlayers = target === "players";
  const caseId = isPlayers ? "players" : visitor?.id || "open-council";
  const history = entries.filter(
    (entry) => entry.target === target && entry.caseId === caseId,
  );
  const title = isPlayers ? "Чат игроков" : person?.name || "Совет мудрецов";
  const current = council?.members.find((p) => p.id === council.currentNpcId);
  const blocked =
    busy ||
    (!isPlayers &&
      (!!council?.active ||
        !canInteract ||
        (!!visitor && visitor.phase !== "discussing")));

  useEffect(() => {
    const off = [
      room.onMessage("dialogue", (entry: Entry) =>
        setEntries((old) => mergeEntries(old, [entry])),
      ),
      room.onMessage("dialogue_history", (data: { history: Entry[] }) =>
        setEntries((old) => mergeEntries(old, data.history)),
      ),
      room.onMessage("dialogue_done", (data: { requestId: string; error?: string }) => {
        if (data.requestId === request.current) {
          setBusy(false);
          if (data.error) setError(data.error);
        }
      }),
      room.onMessage("visitor_state", (state: VisitorState | null) => setVisitor(state)),
      room.onMessage("visitor_error", (data: { text: string }) => setError(data.text)),
    ];
    room.send("visitor_request", {});
    return () => off.forEach((remove) => remove());
  }, [room]);
  useEffect(() => {
    if (open) {
      if (!dialog.current?.open) dialog.current?.showModal();
      input.current?.focus();
    } else dialog.current?.close();
  }, [open]);
  useEffect(() => {
    setError("");
    setMessage("");
    followTail.current = true;
    if (open) room.send("dialogue_history", { target });
  }, [open, target, caseId, room]);
  useEffect(() => {
    if (open && followTail.current && log.current)
      log.current.scrollTop = log.current.scrollHeight;
  }, [open, entries, target, caseId, detailsOpen]);
  function send(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!message.trim() || blocked) return;
    setError("");
    followTail.current = true;
    request.current = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setBusy(true);
    room.send("chat", { text: message.trim(), target, requestId: request.current });
    setMessage("");
    input.current?.focus();
  }
  function visitorAction(action: string) {
    setError("");
    room.send("visitor_action", { action });
  }
  return (
    <dialog
      ref={dialog}
      className={`dialogue ${maximized ? "dialogue--maximized" : ""}`}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <header className="dialogue-header">
        <div>
          <small>
            {isPlayers ? "ИГРОКИ КОМНАТЫ" : person ? person.title : "ОБСУЖДЕНИЕ ЗАДАЧ"}
          </small>
          <h2>{title}</h2>
        </div>
        <div className="dialogue-actions">
          {!isPlayers && (
            <button
              type="button"
              className="button-quiet"
              aria-expanded={detailsOpen}
              onClick={() => setDetailsOpen((value) => !value)}
            >
              О задаче
            </button>
          )}
          <button
            type="button"
            className="button-quiet"
            onClick={() => setMaximized((value) => !value)}
          >
            {maximized ? "Свернуть" : "Развернуть"}
          </button>
          <button type="button" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </header>
      <div className={`dialogue-body ${detailsOpen && !isPlayers ? "details-open" : ""}`}>
        <main className="dialogue-main">
          <div className="conversation-context">
            {isPlayers
              ? "Сообщения игрокам этой комнаты"
              : visitor
                ? `Задача посетителя: ${visitor.name}`
                : "Обсуди собственную задачу или пригласи посетителя у стола"}
          </div>
          <div
            ref={log}
            className="chat-log"
            role="log"
            aria-label="Переписка"
            aria-live="polite"
            onScroll={() => {
              const node = log.current;
              if (node)
                followTail.current =
                  node.scrollHeight - node.scrollTop - node.clientHeight < 100;
            }}
          >
            {!history.length && (
              <div className="chat-empty">
                <b>
                  {isPlayers
                    ? "Начните разговор"
                    : person
                      ? `Что спросим у ${person.name}?`
                      : "Какая задача стоит перед советом?"}
                </b>
                <p>
                  {isPlayers
                    ? "Здесь можно согласовать действия с другими игроками."
                    : person
                      ? person.summary
                      : "Опиши ситуацию и предложи вариант решения. Выбранные мудрецы выскажутся и смогут оценить доводы друг друга."}
                </p>
              </div>
            )}
            {history.map((entry) => (
              <article
                className={`bubble ${entry.kind}`}
                key={entry.id}
                data-message-id={entry.id}
              >
                <div className="bubble-speaker">{entry.speaker}</div>
                {entry.reactionTo && (
                  <blockquote className="reply-context">
                    <b>В ответ: {entry.reactionTo.name}</b>
                    <span>
                      {entry.reactionTo.text.slice(0, 180)}
                      {entry.reactionTo.text.length > 180 ? "…" : ""}
                    </span>
                  </blockquote>
                )}
                <p>{entry.text}</p>
              </article>
            ))}
          </div>
          <div className="dialogue-progress" role="status">
            {!isPlayers && council?.active
              ? current
                ? `${current.name} готовит ответ…`
                : "Совет обдумывает задачу…"
              : busy
                ? "Отправляем сообщение…"
                : !isPlayers && !canInteract
                  ? "Для продолжения закрой окно и подойди к собеседнику или столу."
                  : !isPlayers && visitor?.phase === "arriving"
                    ? "Посетитель входит в зал…"
                    : !isPlayers && visitor?.phase === "leaving"
                      ? "Посетитель завершает приём…"
                      : " "}
          </div>
          {error && (
            <p className="dialogue-error" role="alert">
              {error}
            </p>
          )}
          <form className="dialogue-composer" onSubmit={send}>
            <textarea
              ref={input}
              aria-label="Сообщение"
              rows={2}
              maxLength={600}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !event.shiftKey &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder={
                isPlayers
                  ? "Сообщение игрокам…"
                  : person
                    ? `Вопрос: ${person.name}…`
                    : "Твоя задача, предложение или возражение…"
              }
            />
            <button disabled={blocked || !message.trim()}>Отправить</button>
            <small>Enter — отправить · Shift+Enter — новая строка</small>
          </form>
        </main>
        {!isPlayers && (
          <aside className="dialogue-details" aria-label="Задача и участники">
            <div className="details-heading">
              <b>О задаче</b>
              <button
                className="button-quiet"
                type="button"
                onClick={() => setDetailsOpen(false)}
              >
                Скрыть
              </button>
            </div>
            {person && (
              <section className="profile-card">
                <h3>{person.name}</h3>
                <small>{person.title}</small>
                <p>{person.summary}</p>
              </section>
            )}
            <section className="visitor-card">
              <small>ТЕКУЩАЯ СИТУАЦИЯ</small>
              {visitor ? (
                <>
                  <h3>{visitor.name}</h3>
                  <p>{visitor.problem}</p>
                  <small>
                    {visitor.phase === "arriving"
                      ? "Входит в зал…"
                      : visitor.phase === "leaving"
                        ? "Приём завершается…"
                        : "Проблема на обсуждении"}
                  </small>
                  {atTable ? (
                    <button
                      type="button"
                      disabled={
                        busy ||
                        !!council?.active ||
                        visitor.phase !== "discussing" ||
                        visitor.replies < 1
                      }
                      onClick={() => visitorAction("finish")}
                    >
                      Завершить приём
                    </button>
                  ) : (
                    <p className="muted">Завершить приём можно у стола совета.</p>
                  )}
                </>
              ) : (
                <>
                  <h3>Твоя задача или посетитель</h3>
                  <p>
                    Можно обсудить собственный вопрос. Для подготовленной ситуации
                    пригласи одного посетителя к совету.
                  </p>
                  {atTable ? (
                    <button
                      type="button"
                      disabled={busy || !!council?.active}
                      onClick={() => visitorAction("call")}
                    >
                      Пригласить посетителя
                    </button>
                  ) : (
                    <p className="muted">
                      Чтобы пригласить посетителя, подойди к столу и нажми E.
                    </p>
                  )}
                </>
              )}
            </section>
            {target === "all" && council && (
              <section className="council-status">
                <h3>{council.active ? "Этот ход совета" : "Последний ход"}</h3>
                {council.members.map((member) => (
                  <div
                    className="member-state"
                    key={member.id}
                    data-status={member.status}
                  >
                    <b>{member.name}</b>
                    <small>
                      {
                        {
                          waiting: "Ждёт слова",
                          thinking: "Готовит ответ…",
                          answered: "Ответ получен",
                          abstained: "Воздержался",
                          error: "Ошибка модели",
                        }[member.status]
                      }
                    </small>
                  </div>
                ))}
                {!!council.silent.length && (
                  <p className="muted">
                    Пока слушают: {council.silent.map((member) => member.name).join(", ")}
                    . Можно обратиться к ним по имени или попросить остальных.
                  </p>
                )}
              </section>
            )}
            <section className="world-tools">
              <h3>Изменить двор</h3>
              <p>
                Попроси мудреца создать, перенести или убрать объект. Изменение увидят все
                игроки.
              </p>
              <div className="world-tool-buttons">
                {[
                  ["Доска идей", "Создай доску идей"],
                  ["Скамейки", "Поставь скамейки"],
                  ["Питьевой пункт", "Создай питьевой пункт"],
                  ["Сад", "Посади сад"],
                ].map(([label, command]) => (
                  <button
                    type="button"
                    key={label}
                    className="button-quiet"
                    onClick={() => {
                      setMessage(command);
                      input.current?.focus();
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <small>
                Кнопка подставляет просьбу. Отправь её выбранному мудрецу или совету.
                Например: «Переставь скамейки».
              </small>
            </section>
            <details className="council-roster">
              <summary>Кто в совете</summary>
              {cast.map((member) => (
                <p key={member.id}>
                  <b>{member.name}</b>
                  <br />
                  {member.summary}
                </p>
              ))}
            </details>
            <p className="muted">
              Реплики видны игрокам этой комнаты. Для смены собеседника закрой окно и
              подойди к нужному мудрецу. Общий разговор открывается у стола.
            </p>
          </aside>
        )}
      </div>
    </dialog>
  );
}
