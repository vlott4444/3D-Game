import { Suspense, useEffect } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import NPC from "../game/npc/NPC";
import { cast } from "../game/npc/cast";

function CameraOnFace(): null {
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    camera.position.set(0, 1.65, 3.3);
    camera.lookAt(0, 1.65, 0);
    camera.updateProjectionMatrix();
  }, [camera]);
  return null;
}

// Uses the very same in-game NPC geometry/materials, cropped to head and shoulders.
// No separate portrait textures are present in the supplied project archive.
export default function NPCPortrait({ npcId }: { npcId: string }) {
  const npc = cast.find((person) => person.id === npcId);
  if (!npc) return null;
  return (
    <div className="npc-portrait" aria-label={`Портрет: ${npc.name}`}>
      <Canvas
        frameloop="demand"
        camera={{ fov: 29, position: [0, 1.65, 3.3] }}
        dpr={[1, 1.5]}
      >
        <CameraOnFace />
        <ambientLight intensity={1.6} />
        <directionalLight position={[2, 5, 5]} intensity={2} />
        <Suspense fallback={null}>
          <Physics gravity={[0, 0, 0]}>
            <NPC person={npc} portrait />
          </Physics>
        </Suspense>
      </Canvas>
    </div>
  );
}
