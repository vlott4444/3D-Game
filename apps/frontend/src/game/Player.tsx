
import { useRef } from "react";
import type { RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import type { ThreeElements } from "@react-three/fiber";
import * as THREE from "three";

// Состояние движения персонажа
export type PlayerMovement = {
  moving: RefObject<boolean>;
  running: RefObject<boolean>;
  jumping: RefObject<boolean>;
};

type PlayerProps = ThreeElements["group"] & {
  movement: PlayerMovement;
};

export default function Player({
  movement,
  ...props
}: PlayerProps) {
  const leftArm = useRef<THREE.Group>(null);
  const rightArm = useRef<THREE.Group>(null);
  const leftLeg = useRef<THREE.Group>(null);
  const rightLeg = useRef<THREE.Group>(null);

  const animationTime = useRef(0);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);

    // Читаем актуальные значения на каждом кадре
    const isMoving = movement.moving.current;
    const isRunning = movement.running.current;
    const isJumping = movement.jumping.current;

    // Обновляем фазу анимации
    if (isMoving && !isJumping) {
      animationTime.current += dt * (isRunning ? 13 : 8);
    }

    // Амплитуда движения рук и ног
    const swing =
      isMoving && !isJumping
        ? Math.sin(animationTime.current) *
          (isRunning ? 0.7 : 0.4)
        : 0;

    // Плавное изменение позы
    const smoothing = 1 - Math.exp(-12 * dt);

    function rotate(
      part: THREE.Group | null,
      target: number
    ) {
      if (!part) return;

      part.rotation.x = THREE.MathUtils.lerp(
        part.rotation.x,
        target,
        smoothing
      );
    }

    // Ноги двигаются в противофазе
    rotate(
      leftLeg.current,
      isJumping ? -0.35 : swing
    );

    rotate(
      rightLeg.current,
      isJumping ? -0.35 : -swing
    );

    // Руки двигаются противоположно ногам
    rotate(
      leftArm.current,
      isJumping ? -0.7 : -swing
    );

    rotate(
      rightArm.current,
      isJumping ? -0.7 : swing
    );
  });

  return (
    <group {...props}>
      {/* Тело */}
      <mesh position={[0, 1.2, 0]} castShadow>
        <boxGeometry args={[0.75, 1.1, 0.45]} />
        <meshStandardMaterial color="#3978c6" />
      </mesh>

      {/* Голова */}
      <mesh position={[0, 2, 0]} castShadow>
        <sphereGeometry args={[0.29, 16, 16]} />
        <meshStandardMaterial color="#efc49b" />
      </mesh>

      {/* Левая рука */}
      <group
        ref={leftArm}
        position={[-0.51, 1.65, 0]}
      >
        <mesh position={[0, -0.37, 0]} castShadow>
          <boxGeometry args={[0.23, 0.75, 0.25]} />
          <meshStandardMaterial color="#3978c6" />
        </mesh>
      </group>

      {/* Правая рука */}
      <group
        ref={rightArm}
        position={[0.51, 1.65, 0]}
      >
        <mesh position={[0, -0.37, 0]} castShadow>
          <boxGeometry args={[0.23, 0.75, 0.25]} />
          <meshStandardMaterial color="#3978c6" />
        </mesh>
      </group>

      {/* Левая нога */}
      <group
        ref={leftLeg}
        position={[-0.2, 0.7, 0]}
      >
        <mesh position={[0, -0.35, 0]} castShadow>
          <boxGeometry args={[0.25, 0.7, 0.3]} />
          <meshStandardMaterial color="#283d60" />
        </mesh>
      </group>

      {/* Правая нога */}
      <group
        ref={rightLeg}
        position={[0.2, 0.7, 0]}
      >
        <mesh position={[0, -0.35, 0]} castShadow>
          <boxGeometry args={[0.25, 0.7, 0.3]} />
          <meshStandardMaterial color="#283d60" />
        </mesh>
      </group>
    </group>
  );
}
