import { useEffect, useState } from "react";

type AgentInfo = { id: string; name: string };

export function AdminPanel({ onClose }: { onClose: () => void }) {
  const [metrics, setMetrics] = useState<any[]>([]);
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Формируем базовый URL к бэкенду
  const apiUrl = `http://${window.location.hostname}:2567/api/admin`;

  // Загружаем метрики
  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const res = await fetch(`${apiUrl}/metrics`);
        if (res.ok) setMetrics(await res.json());
      } catch (e) { console.error("Metrics error:", e); }
    };
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 1000);
    return () => clearInterval(interval);
  }, []);

  // Загружаем список агентов один раз при открытии
  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const res = await fetch(`${apiUrl}/agents`);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

        const data = await res.json();
        console.log("Загруженные агенты:", data);

        if (Array.isArray(data) && data.length > 0) {
          setAgents(data);
          setSelectedAgent(data[0].id); // Выбираем первого по умолчанию
        } else {
          setError("Список агентов пуст. Проверьте cast.ts на бэкенде.");
        }
      } catch (e: any) {
        console.error("Agents fetch error:", e);
        setError("Не удалось загрузить список агентов. " + e.message);
      }
    };
    fetchAgents();
  }, []);

  const updateAgent = async () => {
    if (!selectedAgent) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${apiUrl}/agent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ npcId: selectedAgent, newPrompt: prompt })
      });
      if (!res.ok) throw new Error("Ошибка сервера");
      alert("Поведение агента обновлено!");
      setPrompt("");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const currentAgentName = agents.find(a => a.id === selectedAgent)?.name || "Агента";

  return (
    <div style={{ position: "absolute", top: 50, left: 50, background: "rgba(0,0,0,0.9)", color: "white", padding: 20, zIndex: 999, borderRadius: 8, width: 400, fontFamily: "sans-serif", border: "2px solid #eab308" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 15 }}>
        <h2 style={{ margin: 0, color: "#eab308" }}>Панель Администратора</h2>
        <button onClick={onClose} style={{ background: "#ef4444", color: "white", border: "none", padding: "5px 10px", cursor: "pointer", borderRadius: 4 }}>X</button>
      </div>

      {error && <div style={{ color: "red", marginBottom: 10, fontSize: "14px" }}>⚠️ {error}</div>}

      <h3>Игроки онлайн:</h3>
      <table style={{ width: "100%", textAlign: "left", marginBottom: 20, borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #555" }}>
            <th>Ник</th>
            <th>FPS</th>
            <th>Ping</th>
          </tr>
        </thead>
        <tbody>
          {metrics.length === 0 && <tr><td colSpan={3}>Нет активных игроков</td></tr>}
          {metrics.map((m, i) => (
            <tr key={i} style={{ borderBottom: "1px solid #333" }}>
              <td>{m.username}</td>
              <td style={{ color: m.fps < 30 ? "#ef4444" : "#22c55e", fontWeight: "bold" }}>{m.fps}</td>
              <td>{m.ping} ms</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Редактировать агента:</h3>
      <select
        value={selectedAgent}
        onChange={(e) => setSelectedAgent(e.target.value)}
        style={{ width: "100%", padding: 8, marginBottom: 10, borderRadius: 4, background: "#333", color: "white", border: "1px solid #555" }}
      >
        {agents.length === 0 && <option value="">Загрузка...</option>}
        {agents.map(a => (
          <option key={a.id} value={a.id}>{a.name}</option>
        ))}
      </select>

      <textarea
        value={prompt}
        onChange={e => setPrompt(e.target.value)}
        placeholder={`Введите новый промпт для ${currentAgentName}...`}
        style={{ width: "100%", height: 80, marginBottom: 10, padding: 8, borderRadius: 4, background: "#222", color: "white", border: "1px solid #555" }}
      />

      <button
        onClick={updateAgent}
        disabled={loading || !selectedAgent}
        style={{ background: "#3b82f6", color: "white", border: "none", padding: "10px 15px", cursor: (loading || !selectedAgent) ? "not-allowed" : "pointer", borderRadius: 4, width: "100%", fontWeight: "bold" }}
      >
        {loading ? "Сохранение..." : `Применить промпт для ${currentAgentName}`}
      </button>
    </div>
  );
}
