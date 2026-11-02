import { useEffect, useRef, useState, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { SceneOverlay } from "../WorldLabel";
import type { RapierRigidBody } from "@react-three/rapier";
import type { GameRoom } from "../../network/GameConnection";
import { useObjects, type ObjectState } from "../../network/InteractiveState";
import type { Building } from "./Town";
export default function ObjectInteraction({
  room,
  playerRef,
  enabled,
}: {
  room: GameRoom;
  playerRef: RefObject<RapierRigidBody | null>;
  enabled: boolean;
}) {
  const state = useObjects(room),
    buildings = useRef<Building[]>([]);
  const current = useRef({ state, enabled });
  current.current = { state, enabled };
  const [label, setLabel] = useState("");
  const previousLabel = useRef("");
  useEffect(() => {
    const off = room.onMessage(
      "world_snapshot",
      (s: { chunks: { town?: { buildings: Building[] } }[] }) => {
        buildings.current = s.chunks.flatMap((c) => c.town?.buildings || []);
      },
    );
    room.send("world_request", {});
    return off;
  }, [room]);
  function nearest(p: { x: number; y: number; z: number }, value: ObjectState) {
    let next: { action: string; id: string; label: string } | null = null,
      distance = 2.8;
    if (!value.holdingId)
      for (const item of value.items) {
        const d = Math.hypot(p.x - item.x, p.z - item.z, p.y - item.y);
        if (!item.holder && d < distance) {
          distance = d;
          next = {
            action: "pickup",
            id: item.id,
            label: "R — взять мяч",
          };
        }
      }
    for (const b of buildings.current) {
      const d = Math.hypot(p.x - b.x, p.z - b.z - b.depth / 2);
      if (d < distance) {
        distance = d;
        next = {
          action: "toggle",
          id: b.id,
          label: `R — ${value.doors.some((o) => o.id === b.id && o.open) ? "закрыть" : "открыть"} дверь`,
        };
      }
    }
    return next;
  }
  useFrame(() => {
    const p = playerRef.current?.translation();
    if (!p) return;
    const next = nearest(p, state);
    const text = enabled
      ? state.holdingId
        ? "В руках предмет · Q — положить · T — бросить"
        : next?.label || ""
      : "";
    if (previousLabel.current !== text) {
      previousLabel.current = text;
      setLabel(text);
    }
  });
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        !current.current.enabled ||
        e.repeat ||
        (e.target instanceof HTMLElement &&
          (e.target.isContentEditable ||
            ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)))
      )
        return;
      const held = current.current.state.holdingId;
      if (e.code === "KeyR") {
        const p = playerRef.current?.translation();
        const target = p ? nearest(p, current.current.state) : null;
        if (target) {
          e.preventDefault();
          room.send("object_action", target);
        }
      }
      if (held && (e.code === "KeyQ" || e.code === "KeyT")) {
        e.preventDefault();
        room.send("object_action", {
          action: e.code === "KeyQ" ? "drop" : "throw",
          id: held,
        });
      }
      if (e.code === "KeyN") {
        e.preventDefault();
        room.send("citizen_action", {});
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [room]);
  return label ? (
    <SceneOverlay>
      <div className="object-hint">{label}</div>
    </SceneOverlay>
  ) : null;
}
