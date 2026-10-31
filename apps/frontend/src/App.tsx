
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

        setStatus(
          `Connected as ${room.sessionId}`
        );

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
          }
        });
      } catch (error) {
        console.error(
          "Colyseus connection error:",
          error
        );

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

    window.addEventListener(
      "keydown",
      handleEscape
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleEscape
      );
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
      <div
        style={{
          position: "absolute",
          top: 20,
          left: 20,
          zIndex: 10,
          padding: "12px 16px",
          background: "rgba(0, 0, 0, 0.65)",
          color: "white",
          borderRadius: 10,
          fontFamily: "Arial",
          pointerEvents: "none",
        }}
      >
        <div>{status}</div>
        <div>Players: {playersCount}</div>

        <div style={{ marginTop: 8 }}>
          WASD — движение
        </div>

        <div>Shift — бег</div>
        <div>Space — прыжок</div>
        <div>E — разговор с NPC</div>
      </div>

      {/* Подсказка рядом с Эйнштейном */}
      {nearNPC && !dialogueOpen && (
        <InteractionHint />
      )}

      {/* Окно диалога */}
      {dialogueOpen && (
        <DialoguePanel
          onClose={closeDialogue}
        />
      )}
    </div>
  );
}
