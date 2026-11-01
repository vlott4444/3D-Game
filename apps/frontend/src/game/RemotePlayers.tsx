import { useEffect, useState } from "react";
import { Html } from "@react-three/drei";
import type { GameRoom } from "../network/GameConnection";
export default function RemotePlayers({ room }: { room: GameRoom }) {
  const [players, setPlayers] = useState<Record<string, any>>({});
  useEffect(() => {
    const update = (s: any) => setPlayers(s.toJSON().players ?? {});
    update(room.state);
    room.onStateChange(update);
    return () => room.onStateChange.remove(update);
  }, [room]);
  return (
    <>
      {Object.entries(players)
        .filter(([id]) => id !== room.sessionId)
        .map(([id, p]) => (
          <group
            key={id}
            position={[p.x, p.height - 1.18, p.y]}
            rotation={[0, p.rotY, 0]}
          >
            <mesh position={[0, 1, 0]}>
              <capsuleGeometry args={[0.3, 1, 4, 8]} />
              <meshStandardMaterial color="#48b7c3" />
            </mesh>
            <mesh position={[0, 1.9, 0]}>
              <sphereGeometry args={[0.28, 12, 12]} />
              <meshStandardMaterial color="#e8c4a4" />
            </mesh>
            <Html center position={[0, 2.5, 0]}>
              <span className="world-label">{p.username}</span>
            </Html>
          </group>
        ))}
    </>
  );
}
