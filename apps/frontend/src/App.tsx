import { useEffect, useState } from "react";

import GameScene from "./game/GameScene";
import DialoguePanel from "./ui/DialoguePanel";
import InteractionHint from "./ui/InteractionHint";
import { connectToGame } from "./network/GameConnection";

export default function App() {
  // Подключение к серверу
  const [status, setStatus] = useState("Connecting...");
  const [playersCount, setPlayersCount] = useState(0);

  // Состояние NPC и диалога
  const [nearNPC, setNearNPC] = useState(false);
  const [dialogueOpen, setDialogueOpen] = useState(false);
  const [gameRoom, setGameRoom] = useState<
    Awaited<ReturnType<typeof connectToGame>> | null
  >(null);

  // -----------------------------
  // Подключение к Colyseus
  // -----------------------------

  useEffect(() => {
    let disposed = false;

    let activeRoom:
      | Awaited<ReturnType<typeof connectToGame>>
      | null = null;

    async function connect() {
      try {
        const room = await connectToGame();

        if (disposed) {
          await room.leave();
          return;
        }

        activeRoom = room;
        setGameRoom(room);

        setStatus(`Connected as ${room.sessionId}`);

        room.onStateChange((state) => {
          if (disposed) return;

          const data = state.toJSON();

          setPlayersCount(
            Object.keys(data.players ?? {}).length
          );
        });

        room.onLeave(() => {
          if (!disposed) {
            setStatus("Disconnected");
            setGameRoom(null);
          }
        });
      } catch (error) {
        console.error("Colyseus connection error:", error);

        if (!disposed) {
          setStatus("Connection failed");
        }
      }
    }

    void connect();

    return () => {
      disposed = true;

      if (activeRoom) {
        void activeRoom.leave();
      }
    };
  }, []);

  // -----------------------------
  // Открытие диалога
  // -----------------------------

  function openDialogue() {
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }

    setDialogueOpen(true);
  }

  // -----------------------------
  // Закрытие диалога
  // -----------------------------

  function closeDialogue() {
    setDialogueOpen(false);
  }

  // Escape закрывает окно диалога
  useEffect(() => {
    if (!dialogueOpen) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.code === "Escape") {
        setDialogueOpen(false);
      }
    }

    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [dialogueOpen]);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Основная 3D-сцена */}
      <GameScene
        dialogueOpen={dialogueOpen}
        nearNPC={nearNPC}
        onNearbyChange={setNearNPC}
        onInteract={openDialogue}
      />

      {/* Информация об игре */}
      <div>
        <div>{status}</div>
        <div>Players: {playersCount}</div>
      </div>

      {/* Подсказка рядом с Эйнштейном */}
      {nearNPC && !dialogueOpen && <InteractionHint />}

      {/* Окно диалога */}
      {dialogueOpen && (
        <DialoguePanel room={gameRoom} onClose={closeDialogue} />
      )}
    </div>
  );
}
