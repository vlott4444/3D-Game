import { useEffect, useState } from "react";
import GameScene from "./game/GameScene";
import DialoguePanel from "./ui/DialoguePanel";
import { authenticate, connectToGame, type GameRoom } from "./network/GameConnection";
import "./style.css";
type Pose = { x: number; z: number; height: number; rotY: number };
export default function App() {
  const [token, setToken] = useState(localStorage.getItem("island-token") || "");
  const [room, setRoom] = useState<GameRoom | null>(null);
  const [spawn, setSpawn] = useState<Pose | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [near, setNear] = useState(false);
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState("Ожидаем сохранения");
  const [chunkCount, setChunkCount] = useState(0);
  useEffect(() => {
    if (!token) return;
    let disposed = false;
    let active: GameRoom | null = null;
    connectToGame(token)
      .then((r) => {
        if (disposed) {
          void r.leave();
          return;
        }
        active = r;
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
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  const openChat = () => {
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
          <small>Детектив с локальным ИИ</small>
          <h1>Карантинный остров</h1>
          <p>
            На острове погиб куратор. Сопоставь показания шести свидетелей с другими
            игроками.
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
          dialogueOpen={open}
          nearNPC={near}
          onNearbyChange={setNear}
          onInteract={openChat}
        />
      ) : (
        <div className="loading">Подключаемся к острову…</div>
      )}
      <header className="hud">
        <b>Карантинный остров</b>
        <span>
          {room ? "В игре" : "Нет соединения"} · {saved} · Чанков: {chunkCount}/9
        </span>
        <button onClick={openChat} disabled={!room}>
          Общий чат
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
      {error && (
        <div className="notice" role="alert">
          {error}
        </div>
      )}
      {near && !open && <div className="hint">E — открыть совет мудрецов</div>}
      <footer className="controls">
        WASD — движение · Shift — бег · Пробел — прыжок · Esc — освободить мышь
      </footer>
      {room && (
        <DialoguePanel
          room={room}
          open={open}
          onClose={() => setOpen(false)}
          nearNPC={near}
        />
      )}
    </div>
  );
}
