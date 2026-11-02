import { useEffect, useState } from "react";
import type { GameRoom } from "./GameConnection";
import { cacheAccounting, serializedBytes, validSnapshot } from "./WorldCache";
import { WORLD_CATALOG } from "./WorldCatalog.generated";
export function useWorldCache(room: GameRoom | null) {
  const [meter, setMeter] = useState<ReturnType<typeof cacheAccounting> | null>(null);
  useEffect(() => {
    if (!room) {
      setMeter(null);
      return;
    }
    const sizes = new Map<string, number>();
    const off = room.onMessage("world_snapshot", (s: unknown) => {
      if (!validSnapshot(s)) return;
      const accounting = cacheAccounting(s);
      setMeter(accounting);
      (window as any).__worldCache = {
        ...accounting,
        dynamicPayloadBytes: [...sizes.values()].reduce((a, b) => a + b, 0),
      };
    });
    const stops = ["ambient_snapshot", "object_snapshot", "visitor_state"].map((type) =>
      room.onMessage(type, (s: unknown) => {
        sizes.set(type, serializedBytes(s));
        if (
          [...sizes.values()].reduce((a, b) => a + b, 0) * 3 >
          WORLD_CATALOG.dynamicReserve
        )
          console.error("World dynamic cache reserve exceeded");
      }),
    );
    return () => {
      off();
      stops.forEach((fn) => fn());
      sizes.clear();
      delete (window as any).__worldCache;
    };
  }, [room]);
  return meter;
}
