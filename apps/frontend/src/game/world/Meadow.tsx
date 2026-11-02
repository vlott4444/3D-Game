import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useRef, useState } from "react";
import { Color, DoubleSide, InstancedMesh, Object3D, Shape } from "three";
import type { Building, Path } from "./Town";
// Seeded grass is derived from the currently streamed ground, never downloaded as extra chunks.
export default function Meadow({
  buildings,
  paths,
}: {
  buildings: Building[];
  paths: Path[];
}) {
  const bladeShape = new Shape()
    .moveTo(-0.035, 0)
    .lineTo(-0.025, 0.16)
    .lineTo(0.065, 0.4)
    .lineTo(0.025, 0.16)
    .lineTo(0.035, 0)
    .closePath();
  const [center, setCenter] = useState({ x: 0, z: 0 });
  const next = useRef(0),
    mesh = useRef<InstancedMesh>(null);
  useFrame(({ camera, clock }) => {
    if (clock.elapsedTime < next.current) return;
    next.current = clock.elapsedTime + 0.5;
    const x = Math.floor(camera.position.x / 9.2) * 9.2,
      z = Math.floor(camera.position.z / 9.2) * 9.2;
    setCenter((old) => (old.x === x && old.z === z ? old : { x, z }));
  });
  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const dummy = new Object3D(),
      color = new Color();
    let count = 0;
    for (let dx = -25; dx <= 25; dx++)
      for (let dz = -25; dz <= 25; dz++) {
        const x = center.x + dx * 1.15,
          z = center.z + dz * 1.15;
        if (
          (Math.abs(x) < 15 && Math.abs(z) < 16) ||
          buildings.some(
            (b) =>
              Math.abs(x - b.x) < b.width / 2 + 1 && Math.abs(z - b.z) < b.depth / 2 + 1,
          ) ||
          paths.some(
            (p) =>
              Math.abs(x - p.x) < p.width / 2 + 0.3 &&
              Math.abs(z - p.z) < p.depth / 2 + 0.3,
          ) ||
          Math.hypot(x - 30, z - 91) < 8.5
        )
          continue;
        let n =
          (Math.imul(Math.round(x * 10), 73856093) ^
            Math.imul(Math.round(z * 10), 19349663)) >>>
          0;
        n = (Math.imul(n, 1664525) + 1013904223) >>> 0;
        const r = n / 4294967296;
        for (let blade = 0; blade < 3; blade++) {
          dummy.position.set(x + (r - 0.5) * 0.8, 0.01, z + (r - 0.5) * 0.8);
          dummy.rotation.set(0, r * 6.28 + blade * 1.04, (r - 0.5) * 0.3);
          dummy.scale.set(0.6 + r, 0.6 + r, 1);
          dummy.updateMatrix();
          m.setMatrixAt(count, dummy.matrix);
          color.setHSL(0.23 + r * 0.045, 0.48, 0.17 + r * 0.08);
          m.setColorAt(count++, color);
        }
      }
    m.count = count;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }, [center, buildings, paths]);
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, 8000]}>
      <shapeGeometry args={[bladeShape]} />
      <meshStandardMaterial color="#ffffff" side={DoubleSide} roughness={1} />
    </instancedMesh>
  );
}
