import { useEffect, useState } from "react";
import type { GameRoom } from "./GameConnection";

export type CouncilTurn = {
  requestId: string;
  active: boolean;
  currentNpcId: string | null;
  members: {
    id: string;
    name: string;
    title: string;
    status: "waiting" | "thinking" | "answered" | "abstained" | "error";
  }[];
  silent: { id: string; name: string; title: string }[];
};
export function useCouncilTurn(room: GameRoom | null) {
  const [turn, setTurn] = useState<CouncilTurn | null>(null);
  useEffect(() => {
    setTurn(null);
    if (!room) return;
    const off = room.onMessage("council_turn", (next: CouncilTurn | null) =>
      setTurn(next),
    );
    room.send("council_request", {});
    return off;
  }, [room]);
  return turn;
}
