import { AdminPanel } from "./ui/AdminPanel";
import { useEffect, useState } from "react";
import GameScene from "./game/GameScene";
import DialoguePanel from "./ui/DialoguePanel";
import PrivateDialoguePanel from "./ui/PrivateDialoguePanel";
import PlayerChat from "./ui/PlayerChat";
import { authenticate, connectToGame, type GameRoom } from "./network/GameConnection";
import "./style.css";
import type { InteractionTarget } from "./game/npc/interactionTarget";
import { useCouncilTurn } from "./network/CouncilTurn";
type Pose = { x: number; z: number; height: number; rotY: number };
export default function App() {
  const [token, setToken] = useState(localStorage.getItem("island-token") || "");
  const [room, setRoom] = useState<GameRoom | null>(null);
  const [spawn, setSpawn] = useState<Pose | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [interaction, setInteraction] = useState<InteractionTarget | null>(null);
  const [dialogueTarget, setDialogueTarget] = useState("players");
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState("Ожидаем сохранения");
  const [chunkCount, setChunkCount] = useState(0);
  const [ambientCount, setAmbientCount] = useState(0);
  const [feedback, setFeedback] = useState("");
  const council = useCouncilTurn(room);
  const ActiveDialogue =
    dialogueTarget !== "all" && dialogueTarget !== "players"
      ? PrivateDialoguePanel
      : DialoguePanel;
  useEffect(() => {
    if (!token) return;
    setIsAdmin(false);
    setShowAdmin(false);
    let disposed = false;
    let active: GameRoom | null = null;
    connectToGame(token)
      .then((r) => {
        if (disposed) {
          void r.leave();
          return;
        }
        active = r;
        r.onMessage("is_admin", (value: boolean) => setIsAdmin(value));
        r.send("admin_request", {});
        const ready = (s: any) => {
          const p = s?.players?.get(r.sessionId);
          if (p) {
            setSpawn((old) => old ?? { x: p.x, z: p.y, height: p.height, rotY: p.rotY });
            setRoom(r);
          }
        };
        ready(r.state);
        r.onStateChange(ready);
        r.onMessage("world_snapshot", (snapshot: { chunks: unknown[] }) =>
          setChunkCount(snapshot.chunks.length),
        );
        r.onMessage("ambient_snapshot", (data: { actors: unknown[] }) =>
          setAmbientCount(data.actors.length),
        );
        r.onMessage("world_feedback", (data: { text: string }) => setFeedback(data.text));
        r.onMessage("pose_saved", () =>
          setSaved(`Сохранено ${new Date().toLocaleTimeString()}`),
        );
        r.onLeave(() => {
          if (!disposed) {
            setError("Соединение закрыто. Перезайди, чтобы восстановить позицию.");
            setRoom(null);
            setSpawn(null);
          }
        });
        r.onError((_code, msg) => setError(msg || "Ошибка соединения"));
      })
      .catch((e) => {
        if (!disposed) {
          setError(String(e.message || e));
          localStorage.removeItem("island-token");
          setToken("");
        }
      });
    return () => {
      disposed = true;
      if (active) void active.leave();
    };
  }, [token]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.code === "Escape") setOpen(false);
      if (
        e.code === "KeyC" &&
        !e.repeat &&
        room &&
        !showAdmin &&
        !(
          e.target instanceof HTMLElement &&
          (e.target.isContentEditable ||
            ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName))
        )
      ) {
        e.preventDefault();
        setDialogueTarget("all");
        if (document.pointerLockElement) document.exitPointerLock();
        setOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [room, showAdmin]);
  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(""), 6000);
    return () => window.clearTimeout(timer);
  }, [feedback]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (
        !room ||
        open ||
        showAdmin ||
        event.repeat ||
        (event.target instanceof HTMLElement &&
          (event.target.isContentEditable ||
            ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName)))
      )
        return;
      if (event.code === "KeyG" || event.code === "KeyF") {
        event.preventDefault();
        room.send("ambient_action", { action: event.code === "KeyG" ? "wave" : "feed" });
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [room, open, showAdmin]);
  const openChat = (target: string) => {
    setDialogueTarget(target);
    if (document.pointerLockElement) document.exitPointerLock();
    setOpen(true);
  };
  async function login(action: "login" | "register") {
    setWorking(true);
    setError("");
    try {
      const result = await authenticate(action, username, password);
      localStorage.setItem("island-token", result.token);
      setPassword("");
      setToken(result.token);
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setWorking(false);
    }
  }
  if (!token)
    return (
      <main className="login">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void login("login");
          }}
        >
          <small>3D-зал с локальным ИИ</small>
          <h1>Совет мудрецов</h1>
          <p>
            Принеси свою задачу или пригласи посетителя. Сравни доводы шести ярких
            собеседников и найди решение вместе с другими игроками.
          </p>
          <label>
            Имя
            <input
              autoComplete="username"
              required
              minLength={3}
              maxLength={32}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </label>
          <label>
            Пароль
            <input
              autoComplete="current-password"
              type="password"
              required
              minLength={8}
              maxLength={128}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error && <p role="alert">{error}</p>}
          <button disabled={working}>Войти</button>{" "}
          <button
            disabled={working || username.length < 3 || password.length < 8}
            type="button"
            onClick={() => void login("register")}
          >
            Создать аккаунт
          </button>
          <p className="muted">
            Вернись под тем же аккаунтом, чтобы продолжить с сохранённого места.
          </p>
        </form>
      </main>
    );
  return (
    <div className="game">
      {room && spawn ? (
        <GameScene
          room={room}
          initialPose={spawn}
          dialogueOpen={open || showAdmin}
          interaction={interaction}
          onNearbyChange={setInteraction}
          onInteract={openChat}
          council={council}
        />
      ) : (
        <div className="loading">Подключаемся к залу…</div>
      )}
      <PlayerChat room={room} />
      <header className="hud">
        {isAdmin && (
          <button
            onClick={() => {
              setOpen(false);
              setShowAdmin(true);
              if (document.pointerLockElement) document.exitPointerLock();
            }}
          >
            Админка
          </button>
        )}
        <b>Совет мудрецов</b>
        <span>
          {room ? "В игре" : "Нет соединения"} · {saved} · Чанков: {chunkCount}/9 · NPC:{" "}
          {ambientCount}
        </span>
        <button onClick={() => openChat("all")} disabled={!room}>
          Совет (C)
        </button>
        <button
          disabled={!room || open}
          onClick={() => room?.send("ambient_action", { action: "wave" })}
        >
          Позвать (G)
        </button>
        <button
          disabled={!room || open}
          onClick={() => room?.send("ambient_action", { action: "feed" })}
        >
          Угощение (F)
        </button>
        <button disabled={!room} onClick={() => room?.send("return_to_hall", {})}>
          В зал
        </button>
        <button
          onClick={() => {
            localStorage.removeItem("island-token");
            setToken("");
            setRoom(null);
            setSpawn(null);
          }}
        >
          Выйти
        </button>
      </header>
      {feedback && (
        <div className="world-feedback" role="status">
          {feedback}
        </div>
      )}
      {error && (
        <div className="notice" role="alert">
          {error}
        </div>
      )}
      {interaction && !open && <div className="hint">E — {interaction.label}</div>}
      <footer className="controls">
        WASD — движение · Shift — бег · Пробел — прыжок · C — совет · Esc — освободить
        мышь
      </footer>
      {showAdmin && isAdmin && (
        <AdminPanel token={token} onClose={() => setShowAdmin(false)} />
      )}
      {room && (
        <ActiveDialogue
          room={room}
          open={open}
          onClose={() => setOpen(false)}
          target={dialogueTarget}
          canInteract={
            dialogueTarget === "players" || interaction?.target === dialogueTarget
          }
          atTable={interaction?.target === "all"}
          council={council}
        />
      )}
    </div>
  );
}
