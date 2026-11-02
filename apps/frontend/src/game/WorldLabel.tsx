import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type ReactNode, type CSSProperties } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Group, Mesh, Object3D, Raycaster, Vector3 } from "three";
export function labelOccluder(object: Object3D | null) {
  object?.traverse((child) => {
    if (child instanceof Mesh) child.layers.enable(3);
  });
}
export function labelBlocked(
  ray: Raycaster,
  scene: Object3D,
  from: Vector3,
  to: Vector3,
) {
  ray.layers.set(3);
  ray.set(from, to.clone().sub(from).normalize());
  ray.far = Math.max(0, from.distanceTo(to) - 0.12);
  return ray.intersectObject(scene, true).length > 0;
}
function useOverlay(children: ReactNode) {
  const { gl } = useThree();
  const node = useRef<{ host: HTMLDivElement; root: Root; alive: boolean } | null>(null);
  useEffect(() => {
    const host = document.createElement("div");
    Object.assign(host.style, {
      position: "absolute",
      top: "0",
      left: "0",
      pointerEvents: "none",
      zIndex: "5",
      display: "none",
    });
    gl.domElement.parentElement!.appendChild(host);
    const value = { host, root: createRoot(host), alive: true };
    node.current = value;
    // Never mount/unmount a second React root during the R3F commit itself.
    queueMicrotask(() => {
      if (value.alive) value.root.render(children);
    });
    return () => {
      value.alive = false;
      node.current = null;
      queueMicrotask(() => {
        value.root.unmount();
        host.remove();
      });
    };
  }, [gl]);
  useEffect(() => {
    const value = node.current;
    queueMicrotask(() => {
      if (value?.alive) value.root.render(children);
    });
  }, [children]);
  return node;
}
export function SceneOverlay({ children }: { children: ReactNode }): null {
  const node = useOverlay(children);
  useFrame(() => {
    const value = node.current;
    if (value)
      Object.assign(value.host.style, {
        display: "block",
        width: "100%",
        height: "100%",
        zIndex: "8",
      });
  });
  return null;
}
type Props = {
  children: ReactNode;
  position?: [number, number, number];
  center?: boolean;
  distanceFactor?: number;
  transform?: boolean;
  maxDistance?: number;
  style?: CSSProperties;
};
export default function WorldLabel({
  children,
  position = [0, 0, 0],
  center = false,
  distanceFactor = 10,
  maxDistance = 32,
  style,
}: Props) {
  const anchor = useRef<Group>(null),
    node = useOverlay(children),
    next = useRef(0),
    visible = useRef(false);
  const test = useMemo(
    () => ({
      ray: new Raycaster(),
      point: new Vector3(),
      camera: new Vector3(),
      projected: new Vector3(),
    }),
    [],
  );
  useFrame(({ camera, scene, clock, size }) => {
    const value = node.current;
    if (!value || !anchor.current) return;
    anchor.current.getWorldPosition(test.point);
    camera.getWorldPosition(test.camera);
    test.projected.copy(test.point).project(camera);
    const distance = test.camera.distanceTo(test.point);
    if (clock.elapsedTime >= next.current) {
      next.current = clock.elapsedTime + 0.12;
      visible.current =
        distance < maxDistance && !labelBlocked(test.ray, scene, test.camera, test.point);
    }
    const onscreen =
      Math.abs(test.projected.x) < 1.15 &&
      Math.abs(test.projected.y) < 1.15 &&
      test.projected.z > -1 &&
      test.projected.z < 1;
    Object.assign(value.host.style, style, {
      display: visible.current && onscreen ? "block" : "none",
      transform: `translate3d(${(test.projected.x * 0.5 + 0.5) * size.width}px,${(-test.projected.y * 0.5 + 0.5) * size.height}px,0) ${center ? "translate(-50%,-50%)" : ""} scale(${Math.min(2, distanceFactor / Math.max(1, distance))})`,
      transformOrigin: center ? "center" : "top left",
    });
  });
  return <group ref={anchor} position={position} />;
}
