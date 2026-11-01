import { useEffect, useMemo, useRef } from "react";
import type { RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import type { ThreeElements } from "@react-three/fiber";
import { useAnimations, useGLTF } from "@react-three/drei";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import * as THREE from "three";

export type PlayerMovement = {
  moving: RefObject<boolean>;
  running: RefObject<boolean>;
  jumping: RefObject<boolean>;
};

type PlayerProps = ThreeElements["group"] & {
  movement: PlayerMovement;
};

const MODEL_SCALE = 2.2;

export default function Player({ movement, ...props }: PlayerProps) {
  const { scene, animations } = useGLTF("/models/urotsuki.glb");
  const model = useMemo(() => clone(scene), [scene]);
  const { actions, mixer } = useAnimations(animations, model);
  const current = useRef<string | null>(null);

  useEffect(() => {
    model.traverse((part) => {
      if (part instanceof THREE.Mesh) {
        part.castShadow = true;
        part.receiveShadow = true;
      }
    });
  }, [model]);

  useFrame(() => {
    const desired =
      movement.moving.current && !movement.jumping.current
        ? "Walking"
        : "Idle";

    if (current.current !== desired) {
      if (current.current) {
        actions[current.current]?.fadeOut(0.2);
      }

      const next = actions[desired];
      if (next) {
        next
          .reset()
          .setLoop(THREE.LoopRepeat, Infinity)
          .fadeIn(0.2)
          .play();
      }

      current.current = desired;
    }

    const walking = actions.Walking;
    if (walking) {
      const target = movement.running.current ? 1.65 : 1;
      walking.timeScale += (target - walking.timeScale) * 0.14;
    }
  });

  useEffect(() => {
    return () => {
      mixer.stopAllAction();
    };
  }, [mixer]);

return (
  <group {...props}>
    <group rotation={[0, Math.PI, 0]}>
      <group
        position={[0, 0.04, 0]}
        rotation={[0, 0, 0]}
        scale={MODEL_SCALE}
      >
        <primitive object={model} />
      </group>
    </group>
  </group>
);
}

useGLTF.preload("/models/urotsuki.glb");