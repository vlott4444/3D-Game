import CitizenModel from "./CitizenModel";
import { RigidBody, CapsuleCollider, type RapierRigidBody } from "@react-three/rapier";
import WorldLabel from "../WorldLabel";
import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";

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
  const collider = useRef<RapierRigidBody>(null);
  const walking = useRef(false);
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
    walking.current = visitor.phase !== "discussing" && progress < 1;
    collider.current?.setNextKinematicTranslation({ x: 0, y: 1, z });
  });
  if (!visitor) return null;
  return (
    <>
      <RigidBody
        ref={collider}
        type="kinematicPosition"
        colliders={false}
        position={[0, 1, 16]}
      >
        <CapsuleCollider args={[0.6, 0.32]} />
      </RigidBody>
      <group ref={body}>
        <CitizenModel moving={() => walking.current} color="#b8834c" />
        <WorldLabel center position={[0, 2.5, 0]}>
          <span className="world-label">{visitor.name}</span>
        </WorldLabel>
      </group>
    </>
  );
}
