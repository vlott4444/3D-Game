import { Sky } from "@react-three/drei";
import GameMetrics from "./GameMetrics";
import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { cast } from "./npc/cast";
import type { GameRoom } from "../network/GameConnection";
import RemotePlayers from "./RemotePlayers";
import { Physics } from "@react-three/rapier";

import Visitor from "./npc/Visitor";
import AmbientCrowd from "./npc/AmbientCrowd";
import World from "./World";
import RenderBudget from "./RenderBudget";
import PlayerController from "./PlayerController";
import type { CouncilTurn } from "../network/CouncilTurn";
import NPC from "./npc/NPC";
import type { InteractionTarget } from "./npc/interactionTarget";

type Props = {
  room: GameRoom;
  initialPose: { x: number; z: number; height: number; rotY: number };
  dialogueOpen: boolean;
  interaction: InteractionTarget | null;
  onNearbyChange: (target: InteractionTarget | null) => void;
  onInteract: (target: string) => void;
  council: CouncilTurn | null;
};

export default function GameScene({
  room,
  initialPose,
  dialogueOpen,
  interaction,
  onNearbyChange,
  onInteract,
  council,
}: Props) {
  return (
    <Canvas
      frameloop="never"
      dpr={[1, 1.25]}
      shadows
      camera={{
        position: [0, 5, 9],
        fov: 60,
      }}
      style={{
        width: "100%",
        height: "100%",
        isolation: "isolate",
        zIndex: 0,
      }}
    >
      <RenderBudget dialogueOpen={dialogueOpen} />
      <GameMetrics room={room} />
      {/* Цвет неба */}
      <color attach="background" args={["#d4e0db"]} />
      <Sky
        sunPosition={[40, 70, 20]}
        turbidity={3}
        rayleigh={0.7}
        mieCoefficient={0.005}
        mieDirectionalG={0.8}
      />

      {/* Основной свет */}
      <fog attach="fog" args={["#d4e0db", 90, 215]} />
      <hemisphereLight args={["#e3f2ff", "#8c7858", 1.1]} />

      <directionalLight
        position={[10, 15, 5]}
        intensity={2.3}
        color="#fff0d2"
        shadow-bias={-0.0003}
        shadow-normalBias={0.03}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
      />

      <Suspense fallback={null}>
        <Physics gravity={[0, -14, 0]}>
          {/* Игровой мир */}
          <World room={room} initialPose={initialPose} />
          <Visitor room={room} />
          <AmbientCrowd room={room} />

          {/* NPC с анимациями */}
          {cast.map((person) => (
            <NPC
              key={person.id}
              person={person}
              playerNearby={interaction?.target === person.id}
              speaking={!!council?.active && council.currentNpcId === person.id}
            />
          ))}
          <RemotePlayers room={room} />

          {/* Игрок и взаимодействие */}
          <PlayerController
            room={room}
            initialPose={initialPose}
            dialogueOpen={dialogueOpen}
            onNearbyChange={onNearbyChange}
            onInteract={onInteract}
          />
        </Physics>
      </Suspense>
    </Canvas>
  );
}
