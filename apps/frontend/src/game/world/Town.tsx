import { Html } from "@react-three/drei";
import { RigidBody, CuboidCollider, CylinderCollider } from "@react-three/rapier";
import type { GameRoom } from "../../network/GameConnection";
import { useObjects } from "../../network/InteractiveState";
export type Building = {
  id: string;
  name: string;
  kind: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  color: string;
  roof: string;
};
export type Path = { x: number; z: number; width: number; depth: number };
function Block({
  p,
  s,
  color,
}: {
  p: [number, number, number];
  s: [number, number, number];
  color: string;
}) {
  return (
    <mesh position={p} castShadow receiveShadow>
      <boxGeometry args={s} />
      <meshStandardMaterial color={color} roughness={0.85} />
    </mesh>
  );
}
function House({ b, open }: { b: Building; open: boolean }) {
  const w = b.width / 2,
    d = b.depth / 2;
  const walls: [number, number, number, number, number, number][] = [
    [-w, 1.7, 0, 0.4, 3.4, b.depth],
    [w, 1.7, 0, 0.4, 3.4, b.depth],
    [0, 1.7, -d, b.width, 3.4, 0.4],
    [-(w + 1) / 2, 1.7, d, w - 1, 3.4, 0.4],
    [(w + 1) / 2, 1.7, d, w - 1, 3.4, 0.4],
    [0, 3.05, d, 2, 0.7, 0.4],
  ];
  return (
    <group position={[b.x, 0, b.z]}>
      <RigidBody type="fixed" colliders={false}>
        {walls.map(([x, y, z, sx, sy, sz], i) => (
          <group key={i}>
            <CuboidCollider position={[x, y, z]} args={[sx / 2, sy / 2, sz / 2]} />
            <Block p={[x, y, z]} s={[sx, sy, sz]} color={b.color} />
          </group>
        ))}
        <Block p={[0, 0.035, 0]} s={[b.width, 0.07, b.depth]} color="#b2a38b" />
        {!open && (
          <CuboidCollider position={[0, 1.3, d + 0.05]} args={[0.95, 1.3, 0.12]} />
        )}
      </RigidBody>
      <mesh
        position={[0, 4.15, 0]}
        rotation={[0, Math.PI / 4, 0]}
        scale={[b.width / Math.sqrt(2), 1, b.depth / Math.sqrt(2)]}
        castShadow
      >
        <coneGeometry args={[1, 1.9, 4]} />
        <meshStandardMaterial color={b.roof} roughness={0.9} />
      </mesh>
      <group
        position={[-0.93, 0, d + 0.08]}
        rotation={[0, open ? -Math.PI * 0.55 : 0, 0]}
      >
        <Block p={[0.93, 1.3, 0]} s={[1.85, 2.6, 0.16]} color="#725038" />
        <mesh position={[1.55, 1.2, 0.13]}>
          <sphereGeometry args={[0.075, 6, 6]} />
          <meshStandardMaterial color="#d9bc71" />
        </mesh>
      </group>
      {[-1, 1].map((side) => (
        <group key={side}>
          <Block
            p={[(side * (w + 1)) / 2, 1.85, d + 0.22]}
            s={[1.1, 1.1, 0.08]}
            color="#688a8e"
          />
          <Block
            p={[(side * (w + 1)) / 2, 1.85, d + 0.28]}
            s={[0.08, 1.2, 0.07]}
            color="#ead9b6"
          />
          <Block
            p={[(side * (w + 1)) / 2, 1.85, d + 0.28]}
            s={[1.2, 0.08, 0.07]}
            color="#ead9b6"
          />
          <Block
            p={[(side * (w + 1)) / 2, 0.65, d + 0.45]}
            s={[1.6, 0.45, 0.65]}
            color="#75855c"
          />
        </group>
      ))}
      <Html center position={[0, 3.25, d + 0.4]} distanceFactor={12}>
        <span className="town-label">{b.name}</span>
      </Html>
      {b.kind === "workshop" && (
        <Block p={[-3, 0.6, d + 2]} s={[2.5, 1.2, 1]} color="#8a6849" />
      )}
    </group>
  );
}
export default function Town({
  room,
  buildings,
  paths,
}: {
  room: GameRoom;
  buildings: Building[];
  paths: Path[];
}) {
  const state = useObjects(room);
  return (
    <>
      {paths.map((p, i) => (
        <mesh
          key={`${p.x}:${p.z}:${i}`}
          position={[p.x, 0.014, p.z]}
          rotation={[-Math.PI / 2, 0, 0]}
          receiveShadow
        >
          <planeGeometry args={[p.width, p.depth]} />
          <meshStandardMaterial color="#c0b294" roughness={1} />
        </mesh>
      ))}
      {buildings.map((b) => (
        <House key={b.id} b={b} open={state.doors.some((d) => d.id === b.id && d.open)} />
      ))}
      {buildings.some((b) => b.id === "school") && (
        <RigidBody type="fixed" colliders={false} position={[0, 0, 44]}>
          <CylinderCollider args={[0.4, 1.8]} position={[0, 0.4, 0]} />
          <mesh position={[0, 0.35, 0]} receiveShadow>
            <cylinderGeometry args={[1.9, 2, 0.7, 12]} />
            <meshStandardMaterial color="#9b9b8b" />
          </mesh>
          <mesh position={[0, 0.72, 0]}>
            <cylinderGeometry args={[1.55, 1.55, 0.05, 16]} />
            <meshStandardMaterial color="#74ada8" roughness={0.25} />
          </mesh>
          <mesh position={[0, 1.2, 0]}>
            <cylinderGeometry args={[0.25, 0.45, 1.1, 8]} />
            <meshStandardMaterial color="#b5b3a0" />
          </mesh>
        </RigidBody>
      )}
    </>
  );
}
