import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  AnimationMixer,
  Box3,
  Mesh,
  MeshStandardMaterial,
  Vector3,
  type AnimationAction,
} from "three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";

// CC0 Quaternius model, bundled locally. One skeleton per nearby citizen.
export default function CitizenModel({
  moving,
  color = "#81917a",
  seated = false,
}: {
  moving: () => boolean;
  color?: string;
  seated?: boolean;
}) {
  const { scene, animations } = useGLTF("/models/citizen.glb");
  const model = useMemo(() => {
    const root = clone(scene);
    root.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      child.castShadow = true;
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      const copies = materials.map((material) => {
        const m = material.clone() as MeshStandardMaterial;
        m.metalness = 0;
        m.roughness = 0.85;
        if (/shirt/i.test(m.name)) m.color.set(color);
        if (/skin/i.test(m.name)) m.color.set("#d8b59a");
        if (/pants/i.test(m.name)) m.color.set("#40515f");
        return m;
      });
      child.material = Array.isArray(child.material) ? copies : copies[0];
    });
    root.updateMatrixWorld(true);
    root.traverse((child) => {
      if (child instanceof Mesh && "computeBoundingBox" in child)
        (child as any).computeBoundingBox();
    });
    const box = new Box3().setFromObject(root);
    const scale = 1.95 / box.getSize(new Vector3()).y;
    return { root, scale, offset: -box.min.y * scale };
  }, [scene, color]);
  const mixer = useMemo(() => new AnimationMixer(model.root), [model]);
  const actions = useMemo(() => {
    const result: Record<string, AnimationAction> = {};
    for (const name of ["Idle", "Walk", "Sitting"]) {
      const source = animations.find((clip) => clip.name.endsWith(`_${name}`));
      if (!source) continue;
      const clip = source.clone();
      // Remove horizontal root motion without losing the skeleton's bind height.
      for (const track of clip.tracks)
        if (/^(Hips|HumanArmature)\.position$/.test(track.name)) {
          for (let i = 0; i < track.values.length; i += 3) {
            track.values[i] = track.values[0];
            track.values[i + 2] = track.values[2];
          }
        }
      result[name] = mixer.clipAction(clip);
    }
    return result;
  }, [animations, mixer]);
  const active = useRef("");
  useFrame((_, dt) => {
    const name = seated ? "Sitting" : moving() ? "Walk" : "Idle";
    if (name !== active.current) {
      actions[active.current]?.fadeOut(0.22);
      actions[name]?.reset().fadeIn(0.22).play();
      active.current = name;
    }
    mixer.update(Math.min(dt, 0.1));
  });
  useEffect(
    () => () => {
      mixer.stopAllAction();
      mixer.uncacheRoot(model.root);
      model.root.traverse((child) => {
        if (child instanceof Mesh)
          for (const material of Array.isArray(child.material)
            ? child.material
            : [child.material])
            material.dispose();
      });
    },
    [mixer, model],
  );
  return (
    <group position={[0, model.offset, 0]} scale={model.scale}>
      <primitive object={model.root} />
    </group>
  );
}
