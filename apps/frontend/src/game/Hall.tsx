import { RigidBody, CuboidCollider } from "@react-three/rapier";
import { Html } from "@react-three/drei";
import DeskArrow from "./DeskArrow";
function Block({
  position,
  size,
  color,
  solid = true,
}: {
  position: [number, number, number];
  size: [number, number, number];
  color: string;
  solid?: boolean;
}) {
  const mesh = (
    <mesh position={position} receiveShadow castShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.8} />
    </mesh>
  );
  return solid ? (
    <RigidBody type="fixed" colliders={false}>
      <CuboidCollider
        args={[size[0] / 2, size[1] / 2, size[2] / 2]}
        position={position}
      />
      {mesh}
    </RigidBody>
  ) : (
    mesh
  );
}
export default function Hall() {
  return (
    <group>
      <DeskArrow />
      <Block position={[0, -0.08, -0.5]} size={[28, 0.2, 27]} color="#ddd1b4" />
      <Block position={[-14, 2.6, -0.5]} size={[0.5, 5.2, 27]} color="#c5bda8" />
      <Block position={[14, 2.6, -0.5]} size={[0.5, 5.2, 27]} color="#c5bda8" />
      <Block position={[0, 2.6, -14]} size={[28, 5.2, 0.5]} color="#a3b0a5" />
      <Block position={[-9, 2.6, 13]} size={[10, 5.2, 0.5]} color="#c5bda8" />
      <Block position={[9, 2.6, 13]} size={[10, 5.2, 0.5]} color="#c5bda8" />
      <Block position={[0, 4.9, 13]} size={[8, 0.6, 0.7]} color="#664e36" />
      {[-12, -6, 0, 6, 12].map((x) => (
        <Block
          key={x}
          position={[x, 5.4, -0.5]}
          size={[0.3, 0.4, 27]}
          color="#66543d"
          solid={false}
        />
      ))}
      {[-13, 13].flatMap((x) =>
        [-10, -3, 5, 11].map((z) => (
          <group key={`${x}:${z}`}>
            <Block position={[x, 2.5, z]} size={[0.55, 5, 0.55]} color="#f1e3c4" />
            <Block position={[x, 0.15, z]} size={[0.9, 0.3, 0.9]} color="#7b725e" />
          </group>
        )),
      )}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.028, -2.5]}>
        <circleGeometry args={[5.2, 64]} />
        <meshStandardMaterial color="#456463" roughness={1} />
      </mesh>
      <RigidBody type="fixed" colliders="hull" position={[0, 0.95, -2.5]}>
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[2.2, 2.2, 0.18, 48]} />
          <meshStandardMaterial color="#765436" />
        </mesh>
      </RigidBody>
      <Block position={[0, 0.45, -2.5]} size={[0.8, 0.9, 0.8]} color="#4e4030" />
      {[-9, 9].map((x) => (
        <group key={x}>
          <Block position={[x, 1.6, -13.4]} size={[5, 3.2, 0.6]} color="#72583c" />
          {[0.7, 1.5, 2.3].map((y) => (
            <Block
              key={y}
              position={[x, y, -12.95]}
              size={[4.8, 0.12, 0.6]}
              color="#d5bd8b"
              solid={false}
            />
          ))}
          {Array.from({ length: 13 }, (_, i) => (
            <Block
              key={i}
              position={[x - 2.1 + i * 0.35, 1.1, -12.9]}
              size={[0.23, 0.6 + (i % 3) * 0.12, 0.35]}
              color={["#44685d", "#9d644b", "#3f596f", "#bd985b"][i % 4]}
              solid={false}
            />
          ))}
        </group>
      ))}
      <Html position={[0, 4.1, -13.6]} center transform>
        <div
          style={{
            color: "#f2deb4",
            background: "#29454a",
            padding: "12px 30px",
            whiteSpace: "nowrap",
            font: "bold 26px Georgia",
          }}
        >
          ЗАЛ ШЕСТИ МУДРЕЦОВ
        </div>
      </Html>
      <pointLight position={[0, 4, -2.5]} intensity={45} color="#ffe2a9" distance={24} />
      <Block
        position={[0, -0.05, 17]}
        size={[7, 0.12, 8]}
        color="#a69e87"
        solid={false}
      />
    </group>
  );
}
