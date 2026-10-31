
import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { RapierRigidBody } from "@react-three/rapier";
import * as THREE from "three";

type Props = {
  target: RefObject<RapierRigidBody | null>;
  yawRef: RefObject<number>;
};

const desiredPosition = new THREE.Vector3();
const desiredLookAt = new THREE.Vector3();
const currentLookAt = new THREE.Vector3(0, 1.3, 0);

export default function FollowCamera({
  target,
  yawRef,
}: Props): null {
  const { gl } = useThree();

  const pitch = useRef(0.3);
  const distance = useRef(7);

  useEffect(() => {
    const canvas = gl.domElement;

    function onClick() {
      if (document.pointerLockElement !== canvas) {
        void canvas.requestPointerLock().catch(console.error);
      }
    }

    function onMouseMove(event: MouseEvent) {
      if (document.pointerLockElement !== canvas) return;

      yawRef.current -= event.movementX * 0.003;
      pitch.current += event.movementY * 0.003;

      pitch.current = THREE.MathUtils.clamp(
        pitch.current,
        -0.25,
        1.1
      );
    }

    function onWheel(event: WheelEvent) {
      event.preventDefault();

      distance.current = THREE.MathUtils.clamp(
        distance.current + event.deltaY * 0.01,
        3,
        12
      );
    }

    canvas.addEventListener("click", onClick);
    document.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("wheel", onWheel, {
      passive: false,
    });

    return () => {
      canvas.removeEventListener("click", onClick);
      document.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [gl, yawRef]);

  useFrame(({ camera }, delta) => {
    const body = target.current;
    if (!body) return;

    const position = body.translation();

    const yaw = yawRef.current;
    const angle = pitch.current;
    const radius = distance.current;

    const horizontalDistance =
      radius * Math.cos(angle);

    desiredPosition.set(
      position.x + Math.sin(yaw) * horizontalDistance,
      position.y + Math.sin(angle) * radius,
      position.z + Math.cos(yaw) * horizontalDistance
    );

    const smoothing =
      1 - Math.exp(-8 * Math.min(delta, 0.05));

    camera.position.lerp(desiredPosition, smoothing);

    desiredLookAt.set(
      position.x,
      position.y,
      position.z
    );

    currentLookAt.lerp(desiredLookAt, smoothing);
    camera.lookAt(currentLookAt);
  });

  return null;
}
