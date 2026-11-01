import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  RigidBody,
  BallCollider,
  CuboidCollider,
  type RapierRigidBody,
} from "@react-three/rapier";
import type { GameRoom } from "../../network/GameConnection";
import { useObjects, type Item } from "../../network/InteractiveState";
function ObjectBody({ item }: { item: Item }) {
  const body = useRef<RapierRigidBody>(null);
  const initial = useRef<[number, number, number]>([item.x, item.y, item.z]);
  useFrame((_, dt) => {
    const b = body.current;
    if (!b) return;
    const p = b.translation(),
      a = 1 - Math.exp(-18 * Math.min(dt, 0.1));
    b.setNextKinematicTranslation({
      x: p.x + (item.x - p.x) * a,
      y: p.y + (item.y - p.y) * a,
      z: p.z + (item.z - p.z) * a,
    });
  });
  return (
    <RigidBody
      ref={body}
      type="kinematicPosition"
      colliders={false}
      position={initial.current}
    >
      {item.kind === "ball" ? (
        <>
          <BallCollider args={[0.38]} sensor={!!item.holder} />
          <mesh castShadow>
            <sphereGeometry args={[0.38, 12, 10]} />
            <meshStandardMaterial color="#d99e58" roughness={0.6} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.38, 0.018, 4, 12]} />
            <meshStandardMaterial color="#f1d9a3" />
          </mesh>
        </>
      ) : (
        <>
          <CuboidCollider args={[0.48, 0.48, 0.48]} sensor={!!item.holder} />
          <mesh castShadow receiveShadow>
            <boxGeometry args={[0.96, 0.96, 0.96]} />
            <meshStandardMaterial color="#aa8050" />
          </mesh>
          {[-0.3, 0.3].map((x) => (
            <mesh key={x} position={[x, 0, 0.49]}>
              <boxGeometry args={[0.09, 0.96, 0.035]} />
              <meshStandardMaterial color="#6c5038" />
            </mesh>
          ))}
        </>
      )}
    </RigidBody>
  );
}
export default function InteractiveObjects({ room }: { room: GameRoom }) {
  const state = useObjects(room);
  return (
    <>
      {state.items.map((item) => (
        <ObjectBody key={item.id} item={item} />
      ))}
    </>
  );
}
