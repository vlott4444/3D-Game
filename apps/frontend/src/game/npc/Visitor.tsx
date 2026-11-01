import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import type { Group } from "three";
import type { GameRoom } from "../../network/GameConnection";
export type VisitorState = {
  id: string;
  name: string;
  catalogId?: string;
  category?: string;
  problem: string;
  phase: "arriving" | "discussing" | "leaving";
  progress: number;
  replies: number;
};
export default function Visitor({ room }: { room: GameRoom }) {
  const [visitor, setVisitor] = useState<VisitorState | null>(null);
  const body = useRef<Group>(null);
  const received = useRef(0);
  useEffect(() => {
    const off = room.onMessage("visitor_state", (v: VisitorState | null) => {
      received.current = performance.now();
      setVisitor(v);
    });
    room.send("visitor_request", {});
    return off;
  }, [room]);
  useFrame(() => {
    if (!body.current || !visitor) return;
    const progress = Math.min(
      1,
      visitor.progress + (performance.now() - received.current) / 5000,
    );
    const z =
      visitor.phase === "arriving"
        ? 16 - progress * 11
        : visitor.phase === "leaving"
          ? 5 + progress * 11
          : 5;
    body.current.position.set(
      0,
      visitor.phase === "discussing" ? 0 : Math.sin(progress * 36) * 0.035,
      z,
    );
    body.current.rotation.y = visitor.phase === "leaving" ? 0 : Math.PI;
  });
  if (!visitor) return null;
  return (
    <group ref={body}>
      <mesh position={[0, 1.05, 0]} castShadow>
        <boxGeometry args={[0.7, 1.05, 0.4]} />
        <meshStandardMaterial
          color={
            visitor.category === "ecology"
              ? "#668459"
              : visitor.category === "education"
                ? "#866c9b"
                : visitor.category === "energy"
                  ? "#658398"
                  : "#b8834c"
          }
        />
      </mesh>
      <mesh position={[0, 1.85, 0]} castShadow>
        <sphereGeometry args={[0.3, 14, 12]} />
        <meshStandardMaterial color="#dcb28c" />
      </mesh>
      {[-0.2, 0.2].map((x) => (
        <mesh key={x} position={[x, 0.35, 0]} castShadow>
          <boxGeometry args={[0.24, 0.7, 0.3]} />
          <meshStandardMaterial color="#47505c" />
        </mesh>
      ))}
      {[-0.45, 0.45].map((x) => (
        <mesh key={x} position={[x, 1.04, 0]} castShadow>
          <boxGeometry args={[0.18, 0.8, 0.24]} />
          <meshStandardMaterial
            color={
              visitor.category === "ecology"
                ? "#668459"
                : visitor.category === "education"
                  ? "#866c9b"
                  : visitor.category === "energy"
                    ? "#658398"
                    : "#b8834c"
            }
          />
        </mesh>
      ))}
      <Html center position={[0, 2.5, 0]}>
        <span
          style={{
            background: "#735638",
            color: "#fff2d2",
            padding: "6px 10px",
            borderRadius: 6,
            whiteSpace: "nowrap",
            font: "14px Arial",
          }}
        >
          {visitor.name}
        </span>
      </Html>
    </group>
  );
}
