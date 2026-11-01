import { useEffect, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import type { RapierRigidBody } from "@react-three/rapier";
import { cast } from "./cast";
import { interactionAt, type InteractionTarget } from "./interactionTarget";
export default function NPCInteraction({
  playerRef,
  enabled,
  onNearbyChange,
  onInteract,
}: {
  playerRef: RefObject<RapierRigidBody | null>;
  enabled: boolean;
  onNearbyChange: (target: InteractionTarget | null) => void;
  onInteract: (target: string) => void;
}): null {
  const near = useRef<InteractionTarget | null>(null);
  const callbacks = useRef({ onNearbyChange, onInteract, enabled });
  callbacks.current = { onNearbyChange, onInteract, enabled };
  useFrame(() => {
    const p = playerRef.current?.translation();
    if (!p) return;
    const next = interactionAt(p.x, p.z, cast);
    if (next?.target !== near.current?.target) {
      near.current = next;
      callbacks.current.onNearbyChange(next);
    }
  });
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.code === "KeyE" && !e.repeat && near.current && callbacks.current.enabled) {
        e.preventDefault();
        callbacks.current.onInteract(near.current.target);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  return null;
}
