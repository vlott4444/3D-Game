import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import WorldLabel from "./WorldLabel";
import type { Group } from "three";

export default function DeskArrow() {
  const arrow = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (!arrow.current) return;
    const t = clock.elapsedTime;
    arrow.current.position.y = 2.65 + Math.sin(t * 2.6) * 0.19;
    arrow.current.rotation.y = Math.sin(t * 0.9) * 0.1;
  });
  return (
    <group position={[0, 0, -2.5]}>
      <group ref={arrow}>
        {/* Arrow pointing down to the council desk, with gentle vertical motion. */}
        <mesh position={[0, 0.33, 0]} castShadow>
          <cylinderGeometry args={[0.105, 0.105, 0.65, 12]} />
          <meshStandardMaterial
            color="#fff7df"
            emissive="#f7c967"
            emissiveIntensity={0.65}
          />
        </mesh>
        <mesh rotation={[0, 0, Math.PI]}>
          <coneGeometry args={[0.38, 0.6, 12]} />
          <meshStandardMaterial
            color="#ffe18d"
            emissive="#ffc75a"
            emissiveIntensity={0.6}
          />
        </mesh>
        <WorldLabel center position={[0, 0.6, 0]} distanceFactor={10}>
          <span className="world-label desk-label">К столу · E</span>
        </WorldLabel>
      </group>
      <pointLight position={[0, 2.65, 0]} intensity={5} color="#ffe7a4" distance={4} />
    </group>
  );
}
