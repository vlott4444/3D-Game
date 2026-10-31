
import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  RigidBody,
  CapsuleCollider,
  type RapierRigidBody,
  useRapier,
} from "@react-three/rapier";
import * as THREE from "three";

import Player from "./Player";
import FollowCamera from "./FollowCamera";
import NPCInteraction from "./npc/NPCInteraction";

// Размеры персонажа
const BODY_HEIGHT = 1.18;
const CAPSULE_HALF_HEIGHT = 0.8;
const CAPSULE_RADIUS = 0.35;
const CAPSULE_BOTTOM =
  CAPSULE_HALF_HEIGHT + CAPSULE_RADIUS;

// Скорости
const WALK_SPEED = 6;
const RUN_SPEED = 12;

// Прыжок
const JUMP_SPEED = 5;

// Ускоренное падение
const FALL_GRAVITY_MULTIPLIER = 2.5;

const direction = new THREE.Vector3();

type Props = {
  dialogueOpen: boolean;
  onNearbyChange: (nearby: boolean) => void;
  onInteract: () => void;
};

export default function PlayerController({
  dialogueOpen,
  onNearbyChange,
  onInteract,
}: Props) {
  const bodyRef = useRef<RapierRigidBody>(null);
  const visualRef = useRef<THREE.Group>(null);

  const keys = useRef<Record<string, boolean>>({});
  const jumpRequested = useRef(false);

  const yawRef = useRef(0);

  // Состояния анимации
  const isMoving = useRef(false);
  const isRunning = useRef(false);
  const isJumping = useRef(false);

  // Актуальное состояние диалога
  const dialogueOpenRef = useRef(dialogueOpen);
  dialogueOpenRef.current = dialogueOpen;

  const { world, rapier } = useRapier();

  // -----------------------------
  // Клавиатура
  // -----------------------------

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (dialogueOpenRef.current) return;

      const element = event.target;

      if (
        element instanceof HTMLElement &&
        (element.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(
            element.tagName
          ))
      ) {
        return;
      }

      if (
        [
          "KeyW",
          "KeyA",
          "KeyS",
          "KeyD",
          "Space",
          "ShiftLeft",
          "ShiftRight",
        ].includes(event.code)
      ) {
        event.preventDefault();
      }

      if (
        event.code === "Space" &&
        !event.repeat
      ) {
        jumpRequested.current = true;
      }

      keys.current[event.code] = true;
    }

    function onKeyUp(event: KeyboardEvent) {
      keys.current[event.code] = false;
    }

    function onBlur() {
      keys.current = {};
      jumpRequested.current = false;
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  // Сброс движения при открытии диалога
  useEffect(() => {
    if (!dialogueOpen) return;

    keys.current = {};
    jumpRequested.current = false;

    isMoving.current = false;
    isRunning.current = false;
  }, [dialogueOpen]);

  // -----------------------------
  // Игровой цикл
  // -----------------------------

  useFrame((_, delta) => {
    const body = bodyRef.current;
    if (!body) return;

    // Блокируем движение во время диалога
    if (dialogueOpenRef.current) {
      const velocity = body.linvel();

      body.setLinvel(
        {
          x: 0,
          y: velocity.y,
          z: 0,
        },
        true
      );

      keys.current = {};
      jumpRequested.current = false;

      isMoving.current = false;
      isRunning.current = false;

      // Даже во время разговора игрок должен
      // продолжать падать под действием гравитации
      body.setGravityScale(
        velocity.y < -0.1
          ? FALL_GRAVITY_MULTIPLIER
          : 1,
        true
      );

      return;
    }

    // WASD
    const forward =
      Number(!!keys.current["KeyW"]) -
      Number(!!keys.current["KeyS"]);

    const strafe =
      Number(!!keys.current["KeyD"]) -
      Number(!!keys.current["KeyA"]);

    const running = Boolean(
      keys.current["ShiftLeft"] ||
      keys.current["ShiftRight"]
    );

    direction.set(0, 0, 0);

    // Направление относительно камеры
    if (forward !== 0 || strafe !== 0) {
      const yaw = yawRef.current;

      direction.set(
        -Math.sin(yaw) * forward +
          Math.cos(yaw) * strafe,
        0,
        -Math.cos(yaw) * forward -
          Math.sin(yaw) * strafe
      );

      direction.normalize();
    }

    const moving = direction.lengthSq() > 0;
    const speed = running ? RUN_SPEED : WALK_SPEED;

    // Горизонтальное движение через Rapier
    const velocity = body.linvel();

    body.setLinvel(
      {
        x: direction.x * speed,
        y: velocity.y,
        z: direction.z * speed,
      },
      true
    );

    // -----------------------------
    // Проверка земли
    // -----------------------------

    const position = body.translation();

    const ray = new rapier.Ray(
      {
        x: position.x,
        y: position.y - CAPSULE_BOTTOM + 0.15,
        z: position.z,
      },
      {
        x: 0,
        y: -1,
        z: 0,
      }
    );

    // Игнорируем собственное физическое тело
    const hit = world.castRay(
      ray,
      0.25,
      true,
      undefined,
      undefined,
      undefined,
      body
    );

    const grounded =
      hit !== null &&
      hit.timeOfImpact <= 0.2 &&
      velocity.y <= 0.5;

    // -----------------------------
    // Прыжок
    // -----------------------------

    let justJumped = false;

    if (jumpRequested.current && grounded) {
      body.setLinvel(
        {
          x: direction.x * speed,
          y: JUMP_SPEED,
          z: direction.z * speed,
        },
        true
      );

      justJumped = true;
    }

    jumpRequested.current = false;

    // -----------------------------
    // Усиленная гравитация при падении
    // -----------------------------

    const verticalVelocity = body.linvel().y;

    if (verticalVelocity < -0.1) {
      body.setGravityScale(
        FALL_GRAVITY_MULTIPLIER,
        true
      );
    } else {
      body.setGravityScale(1, true);
    }

    // -----------------------------
    // Анимации
    // -----------------------------

    isMoving.current = moving;
    isRunning.current = moving && running;
    isJumping.current = !grounded || justJumped;

    // -----------------------------
    // Поворот визуальной модели
    // -----------------------------

    if (moving && visualRef.current) {
      const model = visualRef.current;

      const targetRotation = Math.atan2(
        -direction.x,
        -direction.z
      );

      const difference = Math.atan2(
        Math.sin(targetRotation - model.rotation.y),
        Math.cos(targetRotation - model.rotation.y)
      );

      const smoothing =
        1 - Math.exp(-12 * Math.min(delta, 0.05));

      model.rotation.y += difference * smoothing;
    }
  });

  return (
    <>
      {/* Физическое тело */}
      <RigidBody
        ref={bodyRef}
        type="dynamic"
        position={[0, BODY_HEIGHT, 5]}
        colliders={false}
        lockRotations
        friction={0.8}
        restitution={0}
        ccd
      >
        <CapsuleCollider
          args={[
            CAPSULE_HALF_HEIGHT,
            CAPSULE_RADIUS,
          ]}
        />

        {/* Анимированный персонаж */}
        <group
          ref={visualRef}
          position={[0, -BODY_HEIGHT, 0]}
        >
          <Player
            movement={{
              moving: isMoving,
              running: isRunning,
              jumping: isJumping,
            }}
          />
        </group>
      </RigidBody>

      {/* Камера */}
      <FollowCamera
        target={bodyRef}
        yawRef={yawRef}
      />

      {/* Взаимодействие с NPC */}
      <NPCInteraction
        playerRef={bodyRef}
        enabled={!dialogueOpen}
        onNearbyChange={onNearbyChange}
        onInteract={onInteract}
      />
    </>
  );
}
