import { useEffect, useMemo, useRef, useLayoutEffect, useState } from "react";
import { RigidBody, CuboidCollider, CylinderCollider } from "@react-three/rapier";
import { InstancedMesh, Object3D } from "three";
import type { GameRoom } from "../network/GameConnection";
import Hall from "./Hall";
import WorldChanges, { type WorldEdit } from "./world/WorldChanges";
type WorldObject = { kind: "tree" | "rock"; x: number; z: number; scale: number };
type Chunk = {
  id: string;
  cx: number;
  cz: number;
  objects: WorldObject[];
  edits?: WorldEdit[];
};
type Snapshot = { chunkSize: number; chunks: Chunk[] };
const SIZE = 64;
function bootstrap(x: number, z: number): Snapshot {
  const chunks: Chunk[] = [];
  for (let dx = -1; dx <= 1; dx++)
    for (let dz = -1; dz <= 1; dz++) {
      const cx = Math.floor(x / SIZE) + dx,
        cz = Math.floor(z / SIZE) + dz;
      chunks.push({ id: `${cx}:${cz}`, cx, cz, objects: [] });
    }
  return { chunkSize: SIZE, chunks };
}
function Grove({ objects }: { objects: WorldObject[] }) {
  const trunk = useRef<InstancedMesh>(null),
    leaves = useRef<InstancedMesh>(null),
    rock = useRef<InstancedMesh>(null);
  const trees = useMemo(() => objects.filter((o) => o.kind === "tree"), [objects]);
  const rocks = useMemo(() => objects.filter((o) => o.kind === "rock"), [objects]);
  useLayoutEffect(() => {
    const dummy = new Object3D();
    function place(
      mesh: InstancedMesh | null,
      items: WorldObject[],
      height: number,
      verticalScale = 1,
    ) {
      if (!mesh) return;
      items.forEach((o, i) => {
        dummy.position.set(o.x, height * o.scale, o.z);
        dummy.scale.set(o.scale, o.scale * verticalScale, o.scale);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
    place(trunk.current, trees, 1);
    place(leaves.current, trees, 3);
    place(rock.current, rocks, 0.3, 0.65);
  }, [trees, rocks]);
  return (
    <>
      <instancedMesh ref={trunk} args={[undefined, undefined, trees.length]} castShadow>
        <cylinderGeometry args={[0.22, 0.32, 2, 6]} />
        <meshStandardMaterial color="#695339" />
      </instancedMesh>
      <instancedMesh ref={leaves} args={[undefined, undefined, trees.length]} castShadow>
        <coneGeometry args={[1.6, 3.2, 7]} />
        <meshStandardMaterial color="#4d795b" />
      </instancedMesh>
      <instancedMesh ref={rock} args={[undefined, undefined, rocks.length]}>
        <dodecahedronGeometry args={[0.8, 0]} />
        <meshStandardMaterial color="#939b91" />
      </instancedMesh>
      {trees.map((o, i) => (
        <RigidBody key={i} type="fixed" colliders={false} position={[o.x, 0, o.z]}>
          <CylinderCollider args={[o.scale, 0.3 * o.scale]} position={[0, o.scale, 0]} />
        </RigidBody>
      ))}
    </>
  );
}
export default function World({
  room,
  initialPose,
}: {
  room: GameRoom;
  initialPose: { x: number; z: number };
}) {
  const [snapshot, setSnapshot] = useState(() => bootstrap(initialPose.x, initialPose.z));
  useEffect(() => {
    const off = room.onMessage("world_snapshot", (data: Snapshot) => {
      if (data.chunkSize !== SIZE || data.chunks.length > 9) return;
      setSnapshot(data);
    });
    room.send("world_request", {});
    return off;
  }, [room]);
  const objects = useMemo(() => snapshot.chunks.flatMap((c) => c.objects), [snapshot]);
  return (
    <>
      {snapshot.chunks.map((c) => (
        <RigidBody key={c.id} type="fixed" colliders={false}>
          <CuboidCollider
            position={[(c.cx + 0.5) * SIZE, -0.15, (c.cz + 0.5) * SIZE]}
            args={[SIZE / 2, 0.15, SIZE / 2]}
          />
          <mesh
            position={[(c.cx + 0.5) * SIZE, -0.15, (c.cz + 0.5) * SIZE]}
            receiveShadow
          >
            <boxGeometry args={[SIZE, 0.3, SIZE]} />
            <meshStandardMaterial color="#8d9c76" roughness={1} />
          </mesh>
        </RigidBody>
      ))}
      <Grove key={snapshot.chunks.map((c) => c.id).join(",")} objects={objects} />
      <Hall />
      <WorldChanges edits={snapshot.chunks.flatMap((chunk) => chunk.edits || [])} />
    </>
  );
}
