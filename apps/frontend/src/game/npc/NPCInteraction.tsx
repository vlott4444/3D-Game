
import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import type { RapierRigidBody } from "@react-three/rapier";
import { EINSTEIN_POSITION } from "./NPC";

type Props = {
  playerRef: RefObject<RapierRigidBody | null>;
  enabled: boolean;
  onNearbyChange: (nearby: boolean) => void;
  onInteract: () => void;
};

export default function NPCInteraction({
  playerRef,
  enabled,
  onNearbyChange,
  onInteract,
}: Props): null {
  const nearbyRef = useRef(false);

  // Храним актуальные обработчики
  const callbacksRef = useRef({
    onNearbyChange,
    onInteract,
  });

  callbacksRef.current = {
    onNearbyChange,
    onInteract,
  };

  useFrame(() => {
    const body = playerRef.current;
    if (!body) return;

    const position = body.translation();

    const distance = Math.hypot(
      position.x - EINSTEIN_POSITION[0],
      position.z - EINSTEIN_POSITION[2]
    );

    const nearby = distance <= 3.5;

    if (nearby !== nearbyRef.current) {
      nearbyRef.current = nearby;
      callbacksRef.current.onNearbyChange(nearby);

      console.log("NPC nearby:", nearby);
    }
  });

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.code !== "KeyE" || event.repeat) return;

      console.log("E нажата", {
        enabled,
        nearby: nearbyRef.current,
      });

      if (!enabled || !nearbyRef.current) return;

      event.preventDefault();

      console.log("Открываем диалог!");

      callbacksRef.current.onInteract();
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [enabled]);

  return null;
}
