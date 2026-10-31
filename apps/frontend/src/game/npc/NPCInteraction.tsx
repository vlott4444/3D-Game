import { useEffect, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import type { RapierRigidBody } from "@react-three/rapier";
export default function NPCInteraction({
  playerRef,
  enabled,
  onNearbyChange,
  onInteract,
}: {
  playerRef: RefObject<RapierRigidBody | null>;
  enabled: boolean;
  onNearbyChange: (b: boolean) => void;
  onInteract: () => void;
}): null {
  const near = useRef(false);
  const callbacks = useRef({ onNearbyChange, onInteract, enabled });
  callbacks.current = { onNearbyChange, onInteract, enabled };
  useFrame(() => {
    const p = playerRef.current?.translation();
    if (!p) return;
    const next = Math.abs(p.x) < 11 && p.z > -12 && p.z < 11;
    if (next !== near.current) {
      near.current = next;
      callbacks.current.onNearbyChange(next);
    }
  });
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.code === "KeyE" && !e.repeat && near.current && callbacks.current.enabled) {
        e.preventDefault();
        callbacks.current.onInteract();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  return null;
}
