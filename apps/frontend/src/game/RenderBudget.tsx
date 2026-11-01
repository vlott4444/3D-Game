import { useEffect } from "react";
import { useThree } from "@react-three/fiber";

// Manual advancement prevents Rapier's invalidate() calls from bypassing this budget.
export default function RenderBudget({ dialogueOpen }: { dialogueOpen: boolean }): null {
  const advance = useThree((state) => state.advance);
  const clock = useThree((state) => state.clock);
  useEffect(() => {
    let previous = performance.now();
    let elapsed = clock.elapsedTime;
    function frame() {
      const now = performance.now();
      const delta = Math.min((now - previous) / 1000, 0.1);
      previous = now;
      if (document.hidden) return;
      elapsed += delta;
      advance(elapsed, true);
    }
    frame();
    const timer = window.setInterval(frame, 1000 / (dialogueOpen ? 12 : 40));
    return () => window.clearInterval(timer);
  }, [dialogueOpen, advance, clock]);
  return null;
}
