import { useEffect, useState } from "react";
import type { GameRoom } from "./GameConnection";

export type ChatChannel = "players" | "council";
export type GlobalMessage = {
  id: number;
  channel: ChatChannel;
  speaker: string;
  kind: string;
  caseId?: string;
  reactionTo?: { name: string; text: string };
  text: string;
  npcId?: string | null;
  createdAt: number;
};

function mergeMessages(
  existing: GlobalMessage[],
  incoming: GlobalMessage[],
  older = false,
) {
  const byId = new Map<number, GlobalMessage>();
  for (const item of [...existing, ...incoming]) byId.set(item.id, item);
  const sorted = [...byId.values()].sort((a, b) => a.id - b.id);
  return older ? sorted.slice(0, 500) : sorted.slice(-500);
}

export function useGlobalMessages(room: GameRoom | null, channel: ChatChannel) {
  const [messages, setMessages] = useState<GlobalMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    setMessages([]);
    setHasMore(false);
    setError("");
    if (!room) return;
    const off = [
      room.onMessage("global_chat:message", (m: GlobalMessage) => {
        if (m.channel === channel) setMessages((items) => mergeMessages(items, [m]));
      }),
      room.onMessage(
        "global_chat:history",
        (data: {
          channel: ChatChannel;
          messages: GlobalMessage[];
          hasMore: boolean;
          beforeId?: number;
        }) => {
          if (data.channel !== channel) return;
          setMessages((items) => mergeMessages(items, data.messages, !!data.beforeId));
          setHasMore(data.hasMore);
        },
      ),
      room.onMessage("global_chat:error", (data: { text: string }) => {
        setError(data.text);
      }),
    ];
    room.send("global_chat:history_request", { channel });
    return () => off.forEach((f) => f());
  }, [room, channel]);

  function loadOlder() {
    if (!room || !hasMore || messages.length === 0) return;
    room.send("global_chat:history_request", { channel, beforeId: messages[0].id });
  }

  return { messages, hasMore, error, loadOlder };
}
