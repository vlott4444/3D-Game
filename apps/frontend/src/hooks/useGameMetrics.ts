import { useEffect, useRef } from "react";

export function useGameMetrics(room: any) {
  const frameCount = useRef(0);
  const lastTime = useRef(performance.now());

  useEffect(() => {
    if (!room) return;

    let animationFrameId: number;

    const loop = () => {
      frameCount.current++;
      const now = performance.now();

      // Отправляем FPS на сервер раз в секунду
      if (now - lastTime.current >= 1000) {
        const fps = Math.round((frameCount.current * 1000) / (now - lastTime.current));

        // Отправляем только если комната открыта
        if (room.connection.isOpen) {
          room.send("metrics", { fps });
        }

        frameCount.current = 0;
        lastTime.current = now;
      }

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [room]);
}
