import { GableInfill } from "./Architecture";
import { useGLTF } from "@react-three/drei";
import { useLayoutEffect, useMemo, useRef } from "react";
import { Box3, InstancedMesh, Mesh, Object3D, Vector3, type Material } from "three";
import { labelOccluder } from "../WorldLabel";
import type { Building } from "./Town";
export type Decoration = {
  id: string;
  kind: "bench" | "pine" | "pond";
  x: number;
  z: number;
  rotY: number;
};
type Part = {
  x: number;
  y?: number;
  z: number;
  rot?: number;
  size: [number, number, number];
};
function BatchMesh({
  geometry,
  material,
  parts,
}: {
  geometry: Mesh["geometry"];
  material: Material | Material[];
  parts: Part[];
}) {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const dummy = new Object3D();
    parts.forEach((p, i) => {
      dummy.position.set(p.x, p.y || 0, p.z);
      dummy.rotation.set(0, p.rot || 0, 0);
      dummy.scale.set(...p.size);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    labelOccluder(mesh);
  }, [parts]);
  return (
    <instancedMesh
      ref={ref}
      args={[geometry, material, parts.length]}
      castShadow
      receiveShadow
    />
  );
}
// Geometry, materials and textures are shared across every house; not one GLTF clone per wall.
export function KitBatch({ name, parts }: { name: string; parts: Part[] }) {
  const { scene } = useGLTF(name.startsWith("/") ? name : `/models/village/${name}.gltf`);
  const meshes = useMemo(() => {
    scene.updateMatrixWorld(true);
    const box = new Box3().setFromObject(scene),
      size = box.getSize(new Vector3()),
      center = box.getCenter(new Vector3());
    const list: { geometry: Mesh["geometry"]; material: Material | Material[] }[] = [];
    scene.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      const geometry = child.geometry
        .clone()
        .applyMatrix4(child.matrixWorld)
        .translate(-center.x, -box.min.y, -center.z);
      geometry.scale(
        1 / Math.max(0.001, size.x),
        1 / Math.max(0.001, size.y),
        1 / Math.max(0.001, size.z),
      );
      list.push({ geometry, material: child.material });
    });
    return list;
  }, [scene]);
  return (
    <>
      {meshes.map((mesh, i) => (
        <BatchMesh key={i} {...mesh} parts={parts} />
      ))}
    </>
  );
}
export function VillageRoof({
  width,
  depth,
  y,
}: {
  width: number;
  depth: number;
  y: number;
}) {
  return (
    <KitBatch
      name="Roof_RoundTiles_8x8"
      parts={[{ x: 0, y, z: 0, size: [width + 1.2, width * 0.27, depth + 1.4] }]}
    />
  );
}
export function VillageDoor() {
  return (
    <KitBatch
      name="Door_1_Round"
      parts={[{ x: 0.93, y: 0, z: 0, size: [1.85, 2.6, 0.2] }]}
    />
  );
}
export default function VillageAssets({
  buildings,
  decor,
}: {
  buildings: Building[];
  decor: Decoration[];
}) {
  const parts = useMemo(() => {
    const windows: Part[] = [],
      wall: Part[] = [],
      roofs: Part[] = [],
      chimneys: Part[] = [],
      vines: Part[] = [],
      frames: Part[] = [];
    for (const b of buildings) {
      const w = b.width / 2,
        d = b.depth / 2;
      // Full-height window modules replace the old box facades; physical envelope is unchanged.
      for (const side of [-1, 1]) {
        windows.push({
          x: b.x + (side * (w + 1)) / 2,
          z: b.z + d,
          rot: 0,
          size: [w - 1, 3.4, 0.42],
        });
        for (let i = 0; i < 4; i++)
          windows.push({
            x: b.x + side * w,
            z: b.z - d + ((i + 0.5) * b.depth) / 4,
            rot: (side * Math.PI) / 2,
            size: [b.depth / 4, 3.4, 0.42],
          });
        frames.push({
          x: b.x + (side * (w + 1)) / 2,
          y: 0.85,
          z: b.z + d + 0.1,
          size: [1.35, 1.55, 0.18],
        });
      }
      wall.push({ x: b.x, z: b.z - d, rot: Math.PI, size: [b.width, 3.4, 0.4] });
      roofs.push({
        x: b.x,
        y: 3.5,
        z: b.z,
        size: [b.width + 1.2, b.width * 0.27, b.depth + 1.4],
      });
      chimneys.push({ x: b.x + w - 1, y: 4.1, z: b.z - 1.5, size: [0.9, 2.5, 0.95] });
      vines.push({
        x: b.x - w + 0.4,
        y: 0.15,
        z: b.z + d + 0.26,
        size: [1.1, 2.9, 0.15],
      });
    }
    return { windows, wall, roofs, chimneys, vines, frames };
  }, [buildings]);
  return (
    <>
      {buildings.map((b) => (
        <group key={`gable${b.id}`} position={[b.x, 0, b.z]}>
          <GableInfill width={b.width} depth={b.depth} y={3.5} height={b.width * 0.27} />
        </group>
      ))}
      <KitBatch name="Wall_Plaster_Window_Wide_Round" parts={parts.windows} />
      <KitBatch name="Wall_Plaster_Straight" parts={parts.wall} />
      <KitBatch name="Window_Wide_Round1" parts={parts.frames} />
      <KitBatch name="Roof_RoundTiles_8x8" parts={parts.roofs} />
      <KitBatch name="Prop_Chimney" parts={parts.chimneys} />
      <KitBatch name="Prop_Vine1" parts={parts.vines} />
      <KitBatch
        name="Prop_WoodenFence_Single"
        parts={decor
          .filter((d) => d.kind === "pond")
          .flatMap((d) =>
            [-6, -3, 0, 3, 6].map((dx) => ({
              x: d.x + dx,
              z: d.z + 8.3,
              size: [3, 1.1, 0.2] as [number, number, number],
            })),
          )}
      />
      <KitBatch
        name="/models/bench.glb"
        parts={decor
          .filter((d) => d.kind === "bench")
          .map((d) => ({ x: d.x, z: d.z, rot: d.rotY, size: [2.8, 1.1, 0.85] }))}
      />
      <KitBatch
        name="/models/pine.glb"
        parts={decor
          .filter((d) => d.kind === "pine")
          .map((d) => ({ x: d.x, z: d.z, rot: d.rotY, size: [3.3, 6.5, 3.3] }))}
      />
    </>
  );
}
