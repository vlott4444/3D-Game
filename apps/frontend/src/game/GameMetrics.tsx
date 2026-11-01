import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { GameRoom } from "../network/GameConnection";

// Count actual scene frames, rather than the browser's independent RAF loop.
export default function GameMetrics({ room }: { room: GameRoom }): null {
  const frame = useRef({ count: 0, at: performance.now(), fps: 0 });
  useFrame(() => {
    const now = performance.now(),
      value = frame.current;
    value.count++;
    if (now - value.at >= 1000) {
      value.fps = Math.round((value.count * 1000) / (now - value.at));
      value.at = now;
      value.count = 0;
    }
  });
  useEffect(() => {
    let pending: number | undefined;
    const off = room.onMessage("metrics:pong", (data: { nonce: number }) => {
      if (data.nonce !== pending) return;
      const ping = Math.round(performance.now() - pending);
      pending = undefined;
      room.send("metrics", { fps: frame.current.fps, ping });
    });
    const timer = window.setInterval(() => {
      pending = performance.now();
      room.send("metrics:ping", { nonce: pending });
    }, 1500);
    return () => {
      window.clearInterval(timer);
      off();
    };
  }, [room]);
  return null;
}
