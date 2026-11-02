import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RigidBody, BallCollider, type RapierRigidBody } from "@react-three/rapier";
import type { GameRoom } from "../../network/GameConnection";
import { useObjects, objectPosition, type Item } from "../../network/InteractiveState";
import type { Group } from "three";
function ObjectBody({ item, room }: { item: Item; room: GameRoom }) {
  const body = useRef<RapierRigidBody>(null),
    mesh = useRef<Group>(null);
  const initial = useRef<[number, number, number]>([item.x, item.y, item.z]);
  useFrame((_, dt) => {
    body.current?.setNextKinematicTranslation(objectPosition(room, item));
    if (mesh.current && !item.holder) {
      mesh.current.rotation.x += (item.vz * Math.min(dt, 0.1)) / 0.38;
      mesh.current.rotation.z -= (item.vx * Math.min(dt, 0.1)) / 0.38;
    }
  });
  return (
    <RigidBody
      ref={body}
      type="kinematicPosition"
      colliders={false}
      position={initial.current}
      friction={0}
    >
      <BallCollider args={[0.38]} sensor={!!item.holder} />
      <group ref={mesh}>
        <mesh castShadow>
          <sphereGeometry args={[0.38, 20, 14]} />
          <meshStandardMaterial color="#c67b45" roughness={0.65} />
        </mesh>
        {[0, Math.PI / 2].map((angle) => (
          <mesh key={angle} rotation={[angle, 0, 0]}>
            <torusGeometry args={[0.38, 0.014, 5, 24]} />
            <meshStandardMaterial color="#f8dfac" />
          </mesh>
        ))}
      </group>
    </RigidBody>
  );
}
export default function InteractiveObjects({ room }: { room: GameRoom }) {
  const state = useObjects(room);
  return (
    <>
      {state.items
        .filter((i) => i.kind === "ball")
        .map((item) => (
          <ObjectBody key={item.id} item={item} room={room} />
        ))}
    </>
  );
}
