import { Html } from "@react-three/drei";
import { RigidBody, CuboidCollider } from "@react-three/rapier";
export type WorldEdit = {
  kind: "board" | "benches" | "water" | "garden";
  variant: number;
  x: number;
  z: number;
  agentId: string;
};
function Box({
  at,
  size,
  color,
}: {
  at: [number, number, number];
  size: [number, number, number];
  color: string;
}) {
  return (
    <mesh position={at} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}
export default function WorldChanges({ edits }: { edits: WorldEdit[] }) {
  return (
    <>
      {edits.map((edit) => (
        <RigidBody
          key={`${edit.kind}:${edit.variant}`}
          type="fixed"
          colliders={false}
          position={[edit.x, 0, edit.z]}
        >
          {edit.kind === "board" && (
            <>
              <CuboidCollider position={[0, 1.2, 0]} args={[1.3, 1.2, 0.2]} />
              <Box at={[0, 1.7, 0]} size={[2.5, 1.5, 0.15]} color="#586f69" />
              {[-1, 1].map((side) => (
                <Box
                  key={side}
                  at={[side, 0.65, 0]}
                  size={[0.15, 1.3, 0.18]}
                  color="#785c3e"
                />
              ))}
              <Html center position={[0, 2.6, 0]}>
                <span className="world-label">Доска идей</span>
              </Html>
              {[-0.65, 0, 0.65].map((x) => (
                <Box
                  key={x}
                  at={[x, 1.75, 0.1]}
                  size={[0.45, 0.55, 0.03]}
                  color="#dfcc90"
                />
              ))}
            </>
          )}
          {edit.kind === "benches" &&
            [-2, 2].map((x) => (
              <group key={x} position={[x, 0, 0]}>
                <CuboidCollider position={[0, 0.55, 0]} args={[1.3, 0.55, 0.6]} />
                <Box at={[0, 0.75, 0]} size={[2.6, 0.18, 0.9]} color="#98714b" />
                <Box at={[0, 1.2, -0.4]} size={[2.6, 0.75, 0.16]} color="#98714b" />
                {[-1, 1].map((side) => (
                  <Box
                    key={side}
                    at={[side, 0.35, 0]}
                    size={[0.18, 0.7, 0.65]}
                    color="#514d40"
                  />
                ))}
              </group>
            ))}
          {edit.kind === "water" && (
            <>
              <CuboidCollider position={[0, 0.75, 0]} args={[0.7, 0.75, 0.7]} />
              <mesh position={[0, 0.15, 0]}>
                <cylinderGeometry args={[1.15, 1.15, 0.3, 14]} />
                <meshStandardMaterial color="#9ca9a3" />
              </mesh>
              <Box at={[0, 1, 0]} size={[0.65, 1.6, 0.65]} color="#689694" />
              <Box at={[0, 1.5, 0.5]} size={[0.12, 0.12, 0.8]} color="#c6d5ce" />
              <mesh position={[0, 0.9, 0.8]}>
                <cylinderGeometry args={[0.04, 0.04, 1, 6]} />
                <meshStandardMaterial color="#90cbd1" transparent opacity={0.7} />
              </mesh>
              <Html center position={[0, 2.3, 0]}>
                <span className="world-label">Питьевой пункт</span>
              </Html>
            </>
          )}
          {edit.kind === "garden" && (
            <>
              <Box at={[0, 0.12, 0]} size={[4.8, 0.24, 4.8]} color="#745e42" />
              {Array.from({ length: 16 }, (_, i) => (
                <group
                  key={i}
                  position={[((i % 4) - 1.5) * 1.1, 0, (Math.floor(i / 4) - 1.5) * 1.1]}
                >
                  <Box at={[0, 0.55, 0]} size={[0.09, 0.7, 0.09]} color="#547b44" />
                  <mesh position={[0, 0.95, 0]}>
                    <dodecahedronGeometry args={[0.3, 0]} />
                    <meshStandardMaterial color={i % 2 ? "#d4b358" : "#a76c8c"} />
                  </mesh>
                </group>
              ))}
              <Html center position={[0, 1.8, 0]}>
                <span className="world-label">Общий сад</span>
              </Html>
            </>
          )}
        </RigidBody>
      ))}
    </>
  );
}
