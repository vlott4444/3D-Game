import { VillageRoof } from "./world/VillageAssets";
import { Surface, GableInfill, Beam, WindowFrame, Lantern } from "./world/Architecture";
import WorldLabel, { labelOccluder } from "./WorldLabel";
import { RigidBody, CuboidCollider } from "@react-three/rapier";

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
    <mesh ref={labelOccluder} position={position} receiveShadow castShadow>
      <boxGeometry args={size} />
      <Surface kind="plaster" color={color} />
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
      <VillageRoof width={28} depth={28} y={5.3} />
      <GableInfill width={28} depth={28} y={5.3} height={28 * 0.27} />
      <group position={[0, 8.5, 14.08]} ref={labelOccluder}>
        <mesh>
          <circleGeometry args={[1.05, 32]} />
          <meshStandardMaterial color="#718e87" metalness={0.2} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0, 0.02]}>
          <torusGeometry args={[1.08, 0.09, 8, 48]} />
          <meshStandardMaterial color="#d7c398" />
        </mesh>
        {[0, 1, 2, 3].map((i) => (
          <Beam
            key={i}
            p={[0, 0, 0.04]}
            s={[2, 0.055, 0.07]}
            rotation={(i * Math.PI) / 4}
            color="#e4d7b8"
          />
        ))}
      </group>
      <Beam p={[0, 5.55, 14.05]} s={[27, 0.22, 0.24]} />

      {[-1, 1].map((side) => (
        <group key={`facade${side}`}>
          {[-10, -5, 2, 9].map((z) => (
            <group
              key={z}
              position={[side * 14.32, 2.6, z]}
              rotation={[0, (side * Math.PI) / 2, 0]}
            >
              <WindowFrame x={0} z={0} y={0} scale={1.45} />
            </group>
          ))}
          <Beam p={[side * 9, 0.5, 13.4]} s={[10, 0.7, 0.9]} color="#aaa28b" />
          <Beam p={[side * 9, 4.8, 13.4]} s={[10, 0.35, 0.8]} color="#655640" />
          {[5, 12].map((x) => (
            <group key={x} position={[side * x, 0, 13.6]} ref={labelOccluder}>
              <mesh position={[0, 2.5, 0]} castShadow>
                <cylinderGeometry args={[0.3, 0.4, 5, 16]} />
                <Surface kind="plaster" color="#e0d6bb" />
              </mesh>
              <mesh position={[0, 0.22, 0]}>
                <cylinderGeometry args={[0.58, 0.64, 0.44, 16]} />
                <Surface kind="stone" />
              </mesh>
              <mesh position={[0, 4.9, 0]}>
                <cylinderGeometry args={[0.62, 0.42, 0.3, 16]} />
                <Surface kind="plaster" color="#e4d6b5" />
              </mesh>
            </group>
          ))}
          <Lantern p={[side * 4.6, 3.4, 14]} />
        </group>
      ))}
      <Beam p={[0, 5.4, 13.7]} s={[29, 0.4, 0.85]} color="#66583f" />
      <Beam p={[0, 5.5, -14]} s={[28, 0.4, 0.7]} />
      {[-1, 1].map((side) => (
        <Beam key={side} p={[side * 14, 5.45, -0.5]} s={[0.5, 0.4, 28]} />
      ))}

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
      <mesh position={[0, 1.055, -2.5]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.05, 0.025, 6, 64]} />
        <meshStandardMaterial color="#c49e64" metalness={0.3} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.45, -2.5]} castShadow>
        <cylinderGeometry args={[0.55, 0.9, 0.85, 16]} />
        <meshStandardMaterial color="#674d35" />
      </mesh>
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
      <WorldLabel position={[0, 4.5, -13.6]} distanceFactor={16} center transform>
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
      </WorldLabel>
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
