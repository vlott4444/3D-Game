import VillageAssets, { VillageDoor, type Decoration } from "./VillageAssets";
import {
  Surface,
  GableRoof,
  Beam,
  WindowFrame,
  GardenBed,
  Lantern,
} from "./Architecture";
import WorldLabel, { labelOccluder } from "../WorldLabel";

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
      <Surface kind="plaster" color={color} />
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
    <group ref={labelOccluder} position={[b.x, 0, b.z]}>
      <RigidBody type="fixed" colliders={false}>
        {walls.map(([x, y, z, sx, sy, sz], i) => (
          <group key={i}>
            <CuboidCollider position={[x, y, z]} args={[sx / 2, sy / 2, sz / 2]} />
          </group>
        ))}
        <Block p={[0, 0.035, 0]} s={[b.width, 0.07, b.depth]} color="#b2a38b" />
        {!open && (
          <CuboidCollider position={[0, 1.3, d + 0.05]} args={[0.95, 1.3, 0.12]} />
        )}
      </RigidBody>
      {[-1, 1].map((side) => (
        <group key={`timber${side}`}>
          <Beam p={[side * w, 1.8, d + 0.25]} s={[0.19, 3.6, 0.2]} />
          <Beam p={[(side * (w + 1)) / 2, 3.22, d + 0.25]} s={[w - 1, 0.15, 0.2]} />
          <Beam p={[(side * (w + 1)) / 2, 0.35, d + 0.25]} s={[w - 1, 0.23, 0.2]} />
          <Beam p={[side * 1.1, 1.35, d + 0.3]} s={[0.18, 2.7, 0.28]} />
        </group>
      ))}
      <Beam p={[0, 2.76, d + 0.35]} s={[2.4, 0.22, 0.35]} />
      <Beam p={[0, 0.08, d + 0.5]} s={[2.8, 0.16, 1.2]} color="#a69b83" />
      <Lantern p={[1.5, 2.45, d + 0.55]} />
      <group
        position={[-0.93, 0, d + 0.08]}
        rotation={[0, open ? -Math.PI * 0.55 : 0, 0]}
      >
        <VillageDoor />
        <mesh position={[1.55, 1.2, 0.13]}>
          <sphereGeometry args={[0.075, 6, 6]} />
          <meshStandardMaterial color="#d9bc71" />
        </mesh>
      </group>
      <WorldLabel center position={[0, 3.25, d + 0.4]} distanceFactor={12}>
        <span className="town-label">{b.name}</span>
      </WorldLabel>
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
  decor,
}: {
  room: GameRoom;
  buildings: Building[];
  paths: Path[];
  decor: Decoration[];
}) {
  const state = useObjects(room);
  return (
    <>
      <VillageAssets buildings={buildings} decor={decor} />
      {decor.map((d) => (
        <RigidBody
          key={d.id}
          type="fixed"
          colliders={false}
          position={[d.x, 0, d.z]}
          rotation={[0, d.rotY, 0]}
        >
          {d.kind === "bench" && (
            <CuboidCollider args={[1.4, 0.55, 0.42]} position={[0, 0.55, 0]} />
          )}
          {d.kind === "pine" && <CylinderCollider args={[1, 0.3]} position={[0, 1, 0]} />}
          {d.kind === "pond" && (
            <>
              <CylinderCollider args={[0.5, 8]} position={[0, -0.1, 0]} />
              <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <circleGeometry args={[8, 48]} />
                <meshStandardMaterial color="#659e99" roughness={0.17} metalness={0.35} />
              </mesh>
            </>
          )}
        </RigidBody>
      ))}
      {paths.map((p, i) => (
        <mesh
          key={`${p.x}:${p.z}:${i}`}
          position={[p.x, 0.014, p.z]}
          rotation={[-Math.PI / 2, 0, 0]}
          receiveShadow
        >
          <planeGeometry args={[p.width, p.depth]} />
          <Surface kind="stone" color="#ded3b5" />
        </mesh>
      ))}
      {buildings.map((b) => (
        <House key={b.id} b={b} open={state.doors.some((d) => d.id === b.id && d.open)} />
      ))}
      {buildings.some((b) => b.id === "school") && (
        <>
          {[-1, 1].flatMap((side) =>
            [29, 39, 58].map((z) => (
              <GardenBed key={`${side}:${z}`} x={side * 12} z={z} />
            )),
          )}
          {[-1, 1].flatMap((side) =>
            [19, 35, 50].map((z) => (
              <group key={`lamp${side}:${z}`} position={[side * 22, 0, z]}>
                <Beam p={[0, 1.8, 0]} s={[0.13, 3.6, 0.13]} color="#43564f" />
                <Lantern p={[0, 3.3, 0]} />
              </group>
            )),
          )}
        </>
      )}
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
