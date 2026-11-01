import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import type { GameRoom } from "../network/GameConnection";
import Player, { type PlayerMovement } from "./Player";

type RemoteState = { x: number; y: number; height: number; rotY: number; username: string };

function RemoteAvatar({ player }: { player: RemoteState }) {
  const oldPosition = useRef({ x: player.x, y: player.y });
  const lastMovement = useRef(0);
  const moved = useRef(false);
  const running = useRef(false);
  const jumping = useRef(false);
  const movement: PlayerMovement = { moving: moved, running, jumping };
  useFrame(({ clock }) => {
    const dx = player.x - oldPosition.current.x;
    const dz = player.y - oldPosition.current.y;
    const distance = Math.hypot(dx, dz);
    if (distance > 0.005) {
      moved.current = true;
      running.current = distance > 1.5;
      lastMovement.current = clock.elapsedTime;
    } else if (clock.elapsedTime - lastMovement.current > 0.3) {
      moved.current = false;
      running.current = false;
    }
    jumping.current = player.height > 1.4;
    oldPosition.current = { x: player.x, y: player.y };
  });
  return (
    <group position={[player.x, player.height - 1.18, player.y]} rotation={[0, player.rotY, 0]}>
      <Player movement={movement} />
      <Html center position={[0, 2.5, 0]}>
        <span className="world-label">{player.username}</span>
      </Html>
    </group>
  );
}

export default function RemotePlayers({ room }: { room: GameRoom }) {
  const [players, setPlayers] = useState<Record<string, RemoteState>>({});
  useEffect(() => {
    const update = (s: any) => setPlayers(s.toJSON().players ?? {});
    update(room.state);
    room.onStateChange(update);
    return () => room.onStateChange.remove(update);
  }, [room]);
  return <>{Object.entries(players)
    .filter(([id]) => id !== room.sessionId)
    .map(([id, p]) => <RemoteAvatar key={id} player={p} />)}</>;
}
