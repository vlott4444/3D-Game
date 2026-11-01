import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, InstancedMesh, Object3D } from "three";
import type { GameRoom } from "../../network/GameConnection";
type Actor = {
  id: string;
  kind: "human" | "deer";
  x: number;
  z: number;
  rotY: number;
  mode: "wander" | "look" | "yield" | "flee" | "eat";
};
type Snapshot = { actors: Actor[]; food: { id: string; x: number; z: number }[] };
type Part = {
  name: string;
  kind: Actor["kind"];
  offset: [number, number, number];
  size: [number, number, number];
  color: string;
  leg?: number;
  detail?: boolean;
};
const parts: Part[] = [
  {
    name: "torso",
    kind: "human",
    offset: [0, 1.12, 0],
    size: [0.65, 0.8, 0.35],
    color: "#ffffff",
  },
  {
    name: "head",
    kind: "human",
    offset: [0, 1.78, 0],
    size: [0.42, 0.42, 0.42],
    color: "#dfbd9d",
  },
  ...[-1, 1].flatMap((side): Part[] => [
    {
      name: `arm${side}`,
      kind: "human",
      offset: [side * 0.42, 1.05, 0],
      size: [0.17, 0.65, 0.2],
      color: "#637f7a",
      leg: side,
      detail: true,
    },
    {
      name: `leg${side}`,
      kind: "human",
      offset: [side * 0.19, 0.4, 0],
      size: [0.22, 0.8, 0.25],
      color: "#3f4d56",
      leg: -side,
      detail: true,
    },
  ]),
  {
    name: "deerBody",
    kind: "deer",
    offset: [0, 0.9, 0],
    size: [0.5, 0.55, 1.1],
    color: "#ae8052",
  },
  {
    name: "neck",
    kind: "deer",
    offset: [0, 1.16, 0.43],
    size: [0.25, 0.55, 0.25],
    color: "#bc9365",
  },
  {
    name: "deerHead",
    kind: "deer",
    offset: [0, 1.48, 0.6],
    size: [0.28, 0.28, 0.5],
    color: "#bc9365",
  },
  ...[-1, 1].flatMap((side): Part[] => [
    {
      name: `deerFront${side}`,
      kind: "deer",
      offset: [side * 0.2, 0.35, 0.37],
      size: [0.1, 0.7, 0.12],
      color: "#755a40",
      leg: side,
      detail: true,
    },
    {
      name: `deerBack${side}`,
      kind: "deer",
      offset: [side * 0.2, 0.35, -0.37],
      size: [0.1, 0.7, 0.12],
      color: "#755a40",
      leg: -side,
      detail: true,
    },
    {
      name: `antler${side}`,
      kind: "deer",
      offset: [side * 0.13, 1.8, 0.5],
      size: [0.07, 0.4, 0.07],
      color: "#746047",
      detail: true,
    },
  ]),
];
const palette = ["#477a80", "#b48a56", "#776486", "#526d55", "#b06a55", "#82949b"];
export default function AmbientCrowd({ room }: { room: GameRoom }) {
  const [snapshot, setSnapshot] = useState<Snapshot>({ actors: [], food: [] });
  const meshes = useRef<Record<string, InstancedMesh | null>>({});
  const current = useRef(new Map<string, { x: number; z: number; rotY: number }>());
  const dummy = useRef(new Object3D());
  const tint = useRef(new Color());
  useEffect(() => {
    const off = room.onMessage("ambient_snapshot", (data: Snapshot) => {
      if (
        !Array.isArray(data.actors) ||
        data.actors.length > 162 ||
        !Array.isArray(data.food) ||
        data.food.length > 8
      )
        return;
      const ids = new Set(data.actors.map((a) => a.id));
      for (const id of current.current.keys())
        if (!ids.has(id)) current.current.delete(id);
      setSnapshot(data);
    });
    room.send("ambient_request", {});
    return off;
  }, [room]);
  useFrame(({ clock, camera }, dt) => {
    const groups = { human: [] as Actor[], deer: [] as Actor[] };
    for (const actor of snapshot.actors) {
      let pose = current.current.get(actor.id);
      if (!pose) {
        pose = { x: actor.x, z: actor.z, rotY: actor.rotY };
        current.current.set(actor.id, pose);
      }
      const smooth = 1 - Math.exp(-10 * Math.min(dt, 0.2));
      pose.x += (actor.x - pose.x) * smooth;
      pose.z += (actor.z - pose.z) * smooth;
      pose.rotY +=
        Math.atan2(Math.sin(actor.rotY - pose.rotY), Math.cos(actor.rotY - pose.rotY)) *
        smooth;
      groups[actor.kind].push(actor);
    }
    for (const part of parts) {
      const mesh = meshes.current[part.name];
      if (!mesh) continue;
      const actors = groups[part.kind];
      mesh.count = actors.length;
      actors.forEach((actor, index) => {
        const pose = current.current.get(actor.id)!;
        const c = Math.cos(pose.rotY),
          s = Math.sin(pose.rotY);
        const [ox, oy, oz] = part.offset;
        const moving =
          actor.mode === "wander" ||
          actor.mode === "flee" ||
          (actor.mode === "eat" && Math.hypot(actor.x - pose.x, actor.z - pose.z) > 0.15);
        const phase = clock.elapsedTime * (actor.mode === "flee" ? 10 : 5) + index;
        dummy.current.position.set(
          pose.x + ox * c + oz * s,
          oy,
          pose.z - ox * s + oz * c,
        );
        dummy.current.rotation.set(
          part.leg && moving
            ? Math.sin(phase) * 0.3 * part.leg
            : part.name === "deerHead" && actor.mode === "eat"
              ? 0.35
              : 0,
          pose.rotY,
          0,
        );
        const hidden =
          part.detail &&
          Math.hypot(camera.position.x - pose.x, camera.position.z - pose.z) > 45;
        dummy.current.scale.set(
          ...(hidden ? ([0, 0, 0] as [number, number, number]) : part.size),
        );
        dummy.current.updateMatrix();
        mesh.setMatrixAt(index, dummy.current.matrix);
        if (part.name === "torso") {
          let hash = 0;
          for (const letter of actor.id) hash = (hash * 31 + letter.charCodeAt(0)) >>> 0;
          tint.current.set(palette[hash % palette.length]);
          mesh.setColorAt(index, tint.current);
        }
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      // Actors are streamed and moved dynamically; avoid stale instance bounds.
      mesh.frustumCulled = false;
    }
  });
  return (
    <>
      {parts.map((part) => (
        <instancedMesh
          key={part.name}
          ref={(mesh) => {
            meshes.current[part.name] = mesh;
          }}
          args={[undefined, undefined, 162]}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={part.color} roughness={1} />
        </instancedMesh>
      ))}
      {snapshot.food.map((food) => (
        <group key={food.id} position={[food.x, 0.07, food.z]}>
          <mesh>
            <cylinderGeometry args={[0.45, 0.45, 0.08, 10]} />
            <meshStandardMaterial color="#8a7657" />
          </mesh>
          <mesh position={[0, 0.12, 0]}>
            <sphereGeometry args={[0.23, 8, 6]} />
            <meshStandardMaterial color="#bbaa59" />
          </mesh>
        </group>
      ))}
    </>
  );
}
