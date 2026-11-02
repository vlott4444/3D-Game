import { WORLD_BOUNDS } from "../network/WorldCache";
import { localPoses } from "../network/InteractiveState";
import ObjectInteraction from "./world/ObjectInteraction";
import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  RigidBody,
  CapsuleCollider,
  type RapierRigidBody,
  useRapier,
} from "@react-three/rapier";
import * as THREE from "three";

import type { GameRoom } from "../network/GameConnection";
import Player from "./Player";
import FollowCamera from "./FollowCamera";
import NPCInteraction from "./npc/NPCInteraction";
import type { InteractionTarget } from "./npc/interactionTarget";

// Размеры персонажа
const BODY_HEIGHT = 1.18;
const CAPSULE_HALF_HEIGHT = 0.8;
const CAPSULE_RADIUS = 0.35;
const CAPSULE_BOTTOM = CAPSULE_HALF_HEIGHT + CAPSULE_RADIUS;

// Скорости
const WALK_SPEED = 6;
const RUN_SPEED = 12;

// Прыжок
const JUMP_SPEED = 5;

// Ускоренное падение
const FALL_GRAVITY_MULTIPLIER = 2.5;

const direction = new THREE.Vector3();

type Props = {
  room: GameRoom;
  initialPose: { x: number; z: number; height: number; rotY: number };
  dialogueOpen: boolean;
  onNearbyChange: (target: InteractionTarget | null) => void;
  onInteract: (target: string) => void;
};

export default function PlayerController({
  room,
  initialPose,
  dialogueOpen,
  onNearbyChange,
  onInteract,
}: Props) {
  const bodyRef = useRef<RapierRigidBody>(null);
  const visualRef = useRef<THREE.Group>(null);

  const keys = useRef<Record<string, boolean>>({});
  const jumpRequested = useRef(false);

  const yawRef = useRef(initialPose.rotY);
  const lastSend = useRef(0);
  const sequence = useRef(0);
  useEffect(
    () =>
      room.onMessage("spawn", (p: any) => {
        bodyRef.current?.setTranslation({ x: p.x, y: p.height, z: p.z }, true);
        bodyRef.current?.setLinvel({ x: 0, y: 0, z: 0 }, true);
        yawRef.current = p.rotY;
      }),
    [room],
  );
  // Persist both standing and moving poses, including while the dialogue is open.
  useFrame(({ clock }) => {
    const body = bodyRef.current;
    if (!body || clock.elapsedTime - lastSend.current < 0.2) return;
    lastSend.current = clock.elapsedTime;
    const p = body.translation();
    const x = Math.max(WORLD_BOUNDS.min + 1, Math.min(WORLD_BOUNDS.max - 1, p.x));
    const z = Math.max(WORLD_BOUNDS.min + 1, Math.min(WORLD_BOUNDS.max - 1, p.z));
    if (p.y < -5) {
      body.setTranslation({ x: initialPose.x, y: BODY_HEIGHT, z: initialPose.z }, true);
      return;
    }
    if (x !== p.x || z !== p.z) body.setTranslation({ x, y: p.y, z }, true);
    room.send("pose", {
      x,
      z,
      height: Math.max(1.18, p.y),
      rotY: yawRef.current,
      seq: ++sequence.current,
    });
  });

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
          ["INPUT", "TEXTAREA", "SELECT"].includes(element.tagName))
      ) {
        return;
      }

      if (
        ["KeyW", "KeyA", "KeyS", "KeyD", "Space", "ShiftLeft", "ShiftRight"].includes(
          event.code,
        )
      ) {
        event.preventDefault();
      }

      if (event.code === "Space" && !event.repeat) {
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
        true,
      );

      keys.current = {};
      jumpRequested.current = false;

      isMoving.current = false;
      isRunning.current = false;

      // Даже во время разговора игрок должен
      // продолжать падать под действием гравитации
      body.setGravityScale(velocity.y < -0.1 ? FALL_GRAVITY_MULTIPLIER : 1, true);

      return;
    }

    // WASD
    const forward = Number(!!keys.current["KeyW"]) - Number(!!keys.current["KeyS"]);

    const strafe = Number(!!keys.current["KeyD"]) - Number(!!keys.current["KeyA"]);

    const running = Boolean(keys.current["ShiftLeft"] || keys.current["ShiftRight"]);

    direction.set(0, 0, 0);

    // Направление относительно камеры
    if (forward !== 0 || strafe !== 0) {
      const yaw = yawRef.current;

      direction.set(
        -Math.sin(yaw) * forward + Math.cos(yaw) * strafe,
        0,
        -Math.cos(yaw) * forward - Math.sin(yaw) * strafe,
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
      true,
    );

    // -----------------------------
    // Проверка земли
    // -----------------------------

    const position = body.translation();
    localPoses.set(room, {
      x: position.x,
      y: position.y,
      z: position.z,
      rotY: yawRef.current,
    });

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
      },
    );

    // Игнорируем собственное физическое тело
    const hit = world.castRay(ray, 0.25, true, undefined, undefined, undefined, body);

    const grounded = hit !== null && hit.timeOfImpact <= 0.2 && velocity.y <= 0.5;

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
        true,
      );

      justJumped = true;
    }

    jumpRequested.current = false;

    // -----------------------------
    // Усиленная гравитация при падении
    // -----------------------------

    const verticalVelocity = body.linvel().y;

    if (verticalVelocity < -0.1) {
      body.setGravityScale(FALL_GRAVITY_MULTIPLIER, true);
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

      const targetRotation = Math.atan2(-direction.x, -direction.z);

      const difference = Math.atan2(
        Math.sin(targetRotation - model.rotation.y),
        Math.cos(targetRotation - model.rotation.y),
      );

      const smoothing = 1 - Math.exp(-12 * Math.min(delta, 0.05));

      model.rotation.y += difference * smoothing;
    }
  });

  return (
    <>
      {/* Физическое тело */}
      <RigidBody
        ref={bodyRef}
        type="dynamic"
        position={[initialPose.x, initialPose.height, initialPose.z]}
        colliders={false}
        lockRotations
        friction={0.8}
        restitution={0}
        ccd
      >
        <CapsuleCollider args={[CAPSULE_HALF_HEIGHT, CAPSULE_RADIUS]} />

        {/* Анимированный персонаж */}
        <group ref={visualRef} position={[0, -BODY_HEIGHT, 0]}>
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
      <FollowCamera target={bodyRef} yawRef={yawRef} />

      <ObjectInteraction room={room} playerRef={bodyRef} enabled={!dialogueOpen} />
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
