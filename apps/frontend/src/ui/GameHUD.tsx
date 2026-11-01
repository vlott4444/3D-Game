export default function GameHUD({
  online,
  saved,
  chunks,
  npcs,
  isAdmin,
  dialogue,
  onCouncil,
  onAdmin,
  onCitizen,
  onWave,
  onFeed,
  onHall,
  onLogout,
}: {
  online: boolean;
  saved: string;
  chunks: number;
  npcs: number;
  isAdmin: boolean;
  dialogue: boolean;
  onCouncil: () => void;
  onAdmin: () => void;
  onCitizen: () => void;
  onWave: () => void;
  onFeed: () => void;
  onHall: () => void;
  onLogout: () => void;
}) {
  return (
    <header className="game-hud" aria-label="Управление игрой">
      <div className="hud-heading">
        <div>
          <small>ЛЕСНОЙ ГОРОДОК</small>
          <h1>Совет мудрецов</h1>
        </div>
        <span
          className={`connection-dot ${online ? "online" : ""}`}
          title={online ? "В игре" : "Нет соединения"}
        />
      </div>
      <div className="hud-status">
        <span>{online ? "В игре" : "Подключение…"}</span>
        <span>{chunks}/9 чанков</span>
        <span>{npcs} NPC</span>
      </div>
      <p className="hud-saved">{saved}</p>
      <nav className="hud-grid" aria-label="Действия игрока">
        <button disabled={!online} onClick={onCouncil}>
          Совет <kbd>C</kbd>
        </button>
        {isAdmin ? (
          <button className="hud-secondary" onClick={onAdmin}>
            Админка <span>↗</span>
          </button>
        ) : (
          <button
            className="hud-secondary"
            disabled={!online || dialogue}
            onClick={onCitizen}
          >
            Житель <kbd>N</kbd>
          </button>
        )}
        {
          <button
            className="hud-secondary"
            disabled={!online || dialogue}
            onClick={onWave}
          >
            Позвать <kbd>G</kbd>
          </button>
        }
        <button className="hud-secondary" disabled={!online || dialogue} onClick={onFeed}>
          Угощение <kbd>F</kbd>
        </button>
        <button className="hud-secondary" disabled={!online} onClick={onHall}>
          В зал <span>⌂</span>
        </button>
        <button className="hud-exit" onClick={onLogout}>
          Выйти <span>↗</span>
        </button>
      </nav>
      <small className="hud-tip">N у жителя — помощь с дорогой</small>
    </header>
  );
}
