
import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  RigidBody,
  CylinderCollider,
} from "@react-three/rapier";
import * as THREE from "three";

export const EINSTEIN_POSITION = [0, 0, -4] as const;

type Props = {
  playerNearby?: boolean;
};

export default function NPC({
  playerNearby = false,
}: Props) {
  const bodyRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);

  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);

  const timeRef = useRef(0);
  const reactionTimeRef = useRef(10);

  // Реакция только в момент приближения
  useEffect(() => {
    if (playerNearby) {
      reactionTimeRef.current = 0;
    }
  }, [playerNearby]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);

    timeRef.current += dt;
    reactionTimeRef.current += dt;

    const time = timeRef.current;
    const reactionTime = reactionTimeRef.current;

    const body = bodyRef.current;
    const head = headRef.current;

    if (!body || !head) return;

    // -----------------------------
    // Спокойная анимация
    // -----------------------------

    const idleSway =
      Math.sin(time * 1.5) * 0.025;

    const idleBob =
      Math.sin(time * 2) * 0.015;

    // -----------------------------
    // Вздрагивание
    // -----------------------------

    const reaction =
      reactionTime < 1.2
        ? Math.sin(reactionTime * 24) *
          Math.exp(-reactionTime * 5)
        : 0;

    const leanBack =
      reactionTime < 1.2
        ? -0.15 * Math.exp(-reactionTime * 4)
        : 0;

    // Покачивание тела
    body.rotation.z =
      idleSway + reaction * 0.09;

    body.rotation.x = leanBack;

    body.position.y = idleBob;
    body.position.x = reaction * 0.04;

    // Движение головы
    head.rotation.y =
      Math.sin(time * 0.8) * 0.12;

    head.rotation.z = reaction * 0.15;

    // Небольшие движения рук
    if (leftArmRef.current) {
      leftArmRef.current.rotation.x =
        Math.sin(time * 1.7) * 0.05 -
        reaction * 0.4;
    }

    if (rightArmRef.current) {
      rightArmRef.current.rotation.x =
        Math.sin(time * 1.7 + Math.PI) * 0.05 -
        reaction * 0.4;
    }
  });

  return (
    <RigidBody
      type="fixed"
      colliders={false}
      position={[...EINSTEIN_POSITION]}
    >
      {/* Неподвижный физический коллайдер */}
      <CylinderCollider
        args={[1, 0.4]}
        position={[0, 1, 0]}
      />

      {/* Анимируемая модель */}
      <group ref={bodyRef}>
        {/* Туловище */}
        <mesh position={[0, 1.1, 0]} castShadow>
          <boxGeometry args={[0.8, 1.2, 0.5]} />
          <meshStandardMaterial color="#795548" />
        </mesh>

        {/* Голова */}
        <group
          ref={headRef}
          position={[0, 2, 0]}
        >
          <mesh castShadow>
            <sphereGeometry args={[0.32, 16, 16]} />
            <meshStandardMaterial color="#edc9a7" />
          </mesh>

          {/* Белые волосы */}
          <mesh position={[0, 0.23, 0]} castShadow>
            <sphereGeometry args={[0.35, 12, 12]} />
            <meshStandardMaterial color="#eeeeee" />
          </mesh>

          {/* Нос */}
          <mesh position={[0, -0.05, 0.3]} castShadow>
            <sphereGeometry args={[0.08, 8, 8]} />
            <meshStandardMaterial color="#edc9a7" />
          </mesh>

          {/* Усы */}
          <mesh position={[-0.11, -0.16, 0.29]}>
            <boxGeometry args={[0.17, 0.06, 0.05]} />
            <meshStandardMaterial color="#eeeeee" />
          </mesh>

          <mesh position={[0.11, -0.16, 0.29]}>
            <boxGeometry args={[0.17, 0.06, 0.05]} />
            <meshStandardMaterial color="#eeeeee" />
          </mesh>
        </group>

        {/* Левая рука */}
        <group
          ref={leftArmRef}
          position={[-0.52, 1.55, 0]}
        >
          <mesh position={[0, -0.4, 0]} castShadow>
            <boxGeometry args={[0.2, 0.8, 0.25]} />
            <meshStandardMaterial color="#795548" />
          </mesh>
        </group>

        {/* Правая рука */}
        <group
          ref={rightArmRef}
          position={[0.52, 1.55, 0]}
        >
          <mesh position={[0, -0.4, 0]} castShadow>
            <boxGeometry args={[0.2, 0.8, 0.25]} />
            <meshStandardMaterial color="#795548" />
          </mesh>
        </group>

        {/* Левая нога */}
        <mesh position={[-0.2, 0.35, 0]} castShadow>
          <boxGeometry args={[0.25, 0.7, 0.3]} />
          <meshStandardMaterial color="#303030" />
        </mesh>

        {/* Правая нога */}
        <mesh position={[0.2, 0.35, 0]} castShadow>
          <boxGeometry args={[0.25, 0.7, 0.3]} />
          <meshStandardMaterial color="#303030" />
        </mesh>
      </group>

      {/* Неподвижная подставка */}
      <mesh position={[0, 0.04, 0]}>
        <cylinderGeometry args={[0.65, 0.65, 0.08, 24]} />
        <meshStandardMaterial color="#e9c46a" />
      </mesh>
    </RigidBody>
  );
}
