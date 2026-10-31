import { useEffect } from "react";
import { useThree } from "@react-three/fiber";

// Keep rendering from competing with the local model on a laptop CPU / shared GPU.
export default function RenderBudget({ dialogueOpen }: { dialogueOpen: boolean }): null {
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    const timer = window.setInterval(
      () => {
        if (!document.hidden) invalidate();
      },
      1000 / (dialogueOpen ? 12 : 40),
    );
    invalidate();
    return () => window.clearInterval(timer);
  }, [dialogueOpen, invalidate]);
  return null;
}
