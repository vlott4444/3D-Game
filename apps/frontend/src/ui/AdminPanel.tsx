import { useEffect, useRef, useState } from "react";
type Metric = { username: string; fps: number; ping: number };
type Agent = { id: string; name: string; newPrompt: string; basePersonality: string };
export function AdminPanel({ token, onClose }: { token: string; onClose: () => void }) {
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selected, setSelected] = useState("");
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  async function request(path: string, body?: unknown) {
    const response = await fetch(`/api/admin/${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) throw Error(data.error || "Ошибка админки");
    return data;
  }
  useEffect(() => {
    dialog.current?.showModal();
    let alive = true;
    const poll = async () => {
      try {
        const data = await request("metrics");
        if (alive) setMetrics(data);
      } catch (e) {
        if (alive) setError((e as Error).message);
      }
    };
    void poll();
    void request("agents")
      .then((data: Agent[]) => {
        if (alive) {
          setAgents(data);
          setSelected(data[0]?.id || "");
          setPrompt(data[0]?.newPrompt || "");
        }
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    const timer = window.setInterval(poll, 2000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [token]);
  async function save(reset = false) {
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const newPrompt = reset ? "" : prompt;
      await request("agent", { npcId: selected, newPrompt });
      setAgents((old) => old.map((a) => (a.id === selected ? { ...a, newPrompt } : a)));
      if (reset) setPrompt("");
      setStatus(
        reset
          ? "Исходный характер восстановлен"
          : "Инструкция сохранена. Применится к следующему запросу ИИ.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="admin-panel"
      aria-label="Панель администратора"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <header>
        <h2>Панель администратора</h2>
        <button onClick={onClose}>Закрыть</button>
      </header>
      <h3>Игроки онлайн</h3>
      <div className="admin-table">
        <table>
          <thead>
            <tr>
              <th>Игрок</th>
              <th>FPS сцены</th>
              <th>Пинг, мс</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((m, i) => (
              <tr key={`${m.username}:${i}`}>
                <td>{m.username}</td>
                <td>{m.fps}</td>
                <td>{m.ping}</td>
              </tr>
            ))}
            {!metrics.length && (
              <tr>
                <td colSpan={3}>Ожидаем метрики от клиентов…</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="muted">
        FPS и время отклика измеряются на клиентах. Это показатели для диагностики.
      </p>
      <h3>Поведение мудреца</h3>
      <label>
        Персонаж
        <select
          aria-label="Персонаж для настройки"
          disabled={busy}
          value={selected}
          onChange={(e) => {
            setSelected(e.target.value);
            setPrompt(agents.find((a) => a.id === e.target.value)?.newPrompt || "");
            setStatus("");
          }}
        >
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </label>
      <details>
        <summary>Исходный характер</summary>
        <p>{agents.find((a) => a.id === selected)?.basePersonality}</p>
      </details>
      <label>
        Дополнительная инструкция
        <textarea
          aria-label="Инструкция мудрецу"
          rows={6}
          maxLength={4000}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Например: проси привести измеримые критерии и предлагай короткий проверяемый опыт."
        />
      </label>
      <footer>
        <button
          disabled={busy || !selected || !prompt.trim()}
          onClick={() => void save()}
        >
          Сохранить поведение
        </button>
        <button
          className="button-quiet"
          disabled={busy || !selected}
          onClick={() => void save(true)}
        >
          Восстановить исходное
        </button>
      </footer>
      {error && <p role="alert">{error}</p>}
      {status && <p role="status">{status}</p>}
    </dialog>
  );
}
