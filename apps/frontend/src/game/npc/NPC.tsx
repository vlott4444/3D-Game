import { Html } from "@react-three/drei";
import { RigidBody, CylinderCollider } from "@react-three/rapier";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
type Person = {
  id: string;
  name: string;
  color: string;
  hair: string;
  position: number[];
};
export default function NPC({
  person,
  playerNearby = false,
}: {
  person: Person;
  playerNearby?: boolean;
}) {
  const head = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (head.current)
      head.current.rotation.y =
        Math.sin(clock.elapsedTime * 0.65 + person.position[0]) * 0.08;
  });
  const facing = Math.atan2(-person.position[0], -2.5 - person.position[2]);
  function box(
    position: [number, number, number],
    size: [number, number, number],
    color: string,
  ) {
    return (
      <mesh position={position} castShadow receiveShadow>
        <boxGeometry args={size} />
        <meshStandardMaterial color={color} />
      </mesh>
    );
  }
  return (
    <RigidBody
      type="fixed"
      colliders={false}
      position={person.position as [number, number, number]}
      rotation={[0, facing, 0]}
    >
      <CylinderCollider args={[1, 0.65]} position={[0, 1, 0]} />
      {box([0, 0.62, 0], [1.15, 0.18, 1.05], "#715238")}
      {box([0, 1.2, -0.48], [1.15, 1.25, 0.16], "#715238")}
      {[-0.45, 0.45].flatMap((x) =>
        [-0.4, 0.4].map((z) => (
          <group key={`${x}:${z}`}>
            {box([x, 0.3, z], [0.12, 0.6, 0.12], "#4f3b2b")}
          </group>
        )),
      )}
      {box([0, 1.08, 0], [0.8, 0.85, 0.46], person.color)}
      {[-0.22, 0.22].map((x) => (
        <group key={x}>
          {box([x, 0.64, 0.25], [0.27, 0.26, 0.65], "#30343d")}
          {box([x, 0.33, 0.55], [0.25, 0.56, 0.25], "#30343d")}
          {box([x, 0.09, 0.65], [0.29, 0.16, 0.43], "#282b30")}
        </group>
      ))}
      {[-0.52, 0.52].map((x) => (
        <group key={x}>
          {box([x, 1.14, 0], [0.2, 0.6, 0.25], person.color)}
          {box([x, 0.93, 0.23], [0.2, 0.22, 0.55], person.color)}
        </group>
      ))}
      <group ref={head} position={[0, 1.77, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[0.32, 16, 12]} />
          <meshStandardMaterial color="#e8c5a3" />
        </mesh>
        <mesh position={[0, 0.2, -0.03]} castShadow>
          <sphereGeometry args={[0.34, 12, 10]} />
          <meshStandardMaterial color={person.hair} />
        </mesh>
        {[-0.12, 0.12].map((x) => (
          <mesh key={x} position={[x, 0, 0.29]}>
            <sphereGeometry args={[0.035, 6, 6]} />
            <meshStandardMaterial color="#283536" />
          </mesh>
        ))}
        {person.id === "einstein" && box([0, -0.15, 0.3], [0.32, 0.06, 0.04], "#eeeeee")}
        {person.id === "holmes" && box([0, 0.35, 0], [0.72, 0.12, 0.72], "#45564b")}
      </group>
      <Html position={[0, 2.5, 0]} center distanceFactor={16}>
        <span
          style={{
            whiteSpace: "nowrap",
            background: playerNearby ? "#284b4d" : "#293f46",
            color: "#fff1d2",
            padding: "5px 9px",
            borderRadius: 6,
            font: "13px Arial",
            pointerEvents: "none",
          }}
        >
          {person.name}
        </span>
      </Html>
    </RigidBody>
  );
}
