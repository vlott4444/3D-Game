
import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { Grid } from "@react-three/drei";
import { Physics } from "@react-three/rapier";

import World from "./World";
import PlayerController from "./PlayerController";
import NPC from "./npc/NPC";

type Props = {
  dialogueOpen: boolean;
  nearNPC: boolean;
  onNearbyChange: (nearby: boolean) => void;
  onInteract: () => void;
};

export default function GameScene({
  dialogueOpen,
  nearNPC,
  onNearbyChange,
  onInteract,
}: Props) {
  return (
    <Canvas
      shadows
      camera={{
        position: [0, 5, 9],
        fov: 60,
      }}
      style={{
        width: "100%",
        height: "100%",
      }}
    >
      {/* Цвет неба */}
      <color
        attach="background"
        args={["#bde0fe"]}
      />

      {/* Основной свет */}
      <ambientLight intensity={0.8} />

      <directionalLight
        position={[10, 15, 5]}
        intensity={2}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
      />

      {/* Сетка на земле */}
      <Grid
        position={[0, 0.015, 0]}
        args={[100, 100]}
        sectionColor="#666666"
        cellColor="#aaaaaa"
        fadeDistance={50}
      />

      <Suspense fallback={null}>
        <Physics gravity={[0, -9.81, 0]}>
          {/* Игровой мир */}
          <World />

          {/* NPC с анимациями */}
          <NPC playerNearby={nearNPC} />

          {/* Игрок и взаимодействие */}
          <PlayerController
            dialogueOpen={dialogueOpen}
            onNearbyChange={onNearbyChange}
            onInteract={onInteract}
          />
        </Physics>
      </Suspense>
    </Canvas>
  );
}
