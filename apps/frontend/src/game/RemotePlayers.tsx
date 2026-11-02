import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import WorldLabel from "./WorldLabel";
import Player from "./Player";
import type { GameRoom } from "../network/GameConnection";
type RemotePlayer = {
  x: number;
  y: number;
  height: number;
  rotY: number;
  username: string;
};
function RemoteAvatar({ player }: { player: RemotePlayer }) {
  const body = useRef<Group>(null),
    moving = useRef(false),
    running = useRef(false),
    jumping = useRef(false);
  const last = useRef({ x: player.x, z: player.y, at: performance.now() }),
    motion = useRef({ until: 0, speed: 0, rot: player.rotY });
  const initial = useRef<[number, number, number]>([
    player.x,
    player.height - 1.18,
    player.y,
  ]);
  useEffect(() => {
    const now = performance.now(),
      dx = player.x - last.current.x,
      dz = player.y - last.current.z,
      d = Math.hypot(dx, dz);
    if (d > 0.01)
      motion.current = {
        until: now + 300,
        speed: d / Math.max(0.05, (now - last.current.at) / 1000),
        rot: Math.atan2(-dx, -dz),
      };
    last.current = { x: player.x, z: player.y, at: now };
  }, [player.x, player.y]);
  useFrame((_, dt) => {
    const b = body.current;
    if (!b) return;
    const a = 1 - Math.exp(-16 * Math.min(dt, 0.1));
    const far = Math.hypot(b.position.x - player.x, b.position.z - player.y) > 10;
    b.position.x = far ? player.x : b.position.x + (player.x - b.position.x) * a;
    b.position.y += (player.height - 1.18 - b.position.y) * a;
    b.position.z = far ? player.y : b.position.z + (player.y - b.position.z) * a;
    const angle = motion.current.rot - b.rotation.y;
    b.rotation.y += Math.atan2(Math.sin(angle), Math.cos(angle)) * a;
    moving.current = performance.now() < motion.current.until;
    running.current = moving.current && motion.current.speed > 8;
    jumping.current = player.height > 1.45;
  });
  return (
    <group ref={body} position={initial.current}>
      <Player movement={{ moving, running, jumping }} />
      <WorldLabel center position={[0, 2.5, 0]}>
        <span className="world-label">{player.username}</span>
      </WorldLabel>
    </group>
  );
}
export default function RemotePlayers({ room }: { room: GameRoom }) {
  const [players, setPlayers] = useState<Record<string, RemotePlayer>>({});
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
        .map(([id, player]) => (
          <RemoteAvatar key={id} player={player} />
        ))}
    </>
  );
}
