import { useMemo } from "react";
import { CanvasTexture, RepeatWrapping, SRGBColorSpace, Shape } from "three";
import { labelOccluder } from "../WorldLabel";

const textures = new Map<string, CanvasTexture>();
function texture(kind: "stone" | "plaster" | "roof") {
  if (textures.has(kind)) return textures.get(kind)!;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const c = canvas.getContext("2d")!;
  let seed = 71239;
  const rand = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  c.fillStyle = kind === "stone" ? "#777467" : kind === "roof" ? "#554c43" : "#e4ddc8";
  c.fillRect(0, 0, 128, 128);
  if (kind === "plaster")
    for (let i = 0; i < 3500; i++) {
      c.fillStyle = `rgba(95,83,63,${rand() * 0.13})`;
      c.fillRect(rand() * 128, rand() * 128, 1 + rand() * 2, 1);
    }
  else
    for (let row = -1; row < 9; row++)
      for (let col = -1; col < 6; col++) {
        const x = col * 32 + (row % 2) * 16,
          y = row * 16;
        const value = kind === "roof" ? 90 + rand() * 45 : 155 + rand() * 35;
        c.fillStyle = `rgb(${value},${value * (kind === "roof" ? 0.72 : 0.97)},${value * (kind === "roof" ? 0.58 : 0.88)})`;
        c.beginPath();
        c.roundRect(x + 1, y + 1, 30, 14, kind === "roof" ? 3 : 4);
        c.fill();
        c.strokeStyle = "rgba(255,247,220,.15)";
        c.stroke();
      }
  const map = new CanvasTexture(canvas);
  map.colorSpace = SRGBColorSpace;
  map.wrapS = map.wrapT = RepeatWrapping;
  map.repeat.set(kind === "plaster" ? 2 : 4, kind === "plaster" ? 2 : 4);
  map.anisotropy = 2;
  textures.set(kind, map);
  return map;
}
export function Surface({
  kind,
  color = "#ffffff",
}: {
  kind: "stone" | "plaster" | "roof";
  color?: string;
}) {
  const map = useMemo(() => texture(kind), [kind]);
  return (
    <meshStandardMaterial map={map} color={color} roughness={kind === "roof" ? 0.9 : 1} />
  );
}
export function Beam({
  p,
  s,
  color = "#544336",
  rotation = 0,
}: {
  p: [number, number, number];
  s: [number, number, number];
  color?: string;
  rotation?: number;
}) {
  return (
    <mesh
      ref={labelOccluder}
      position={p}
      rotation={[0, 0, rotation]}
      castShadow
      receiveShadow
    >
      <boxGeometry args={s} />
      <meshStandardMaterial color={color} roughness={0.9} />
    </mesh>
  );
}
export function GableRoof({
  width,
  depth,
  y,
  color,
}: {
  width: number;
  depth: number;
  y: number;
  color: string;
}) {
  const w = width / 2 + 0.65,
    h = width * 0.24,
    angle = Math.atan2(h, w),
    length = Math.hypot(w, h);
  const shape = useMemo(
    () => new Shape().moveTo(-w, 0).lineTo(0, h).lineTo(w, 0).closePath(),
    [w, h],
  );
  return (
    <group ref={labelOccluder}>
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh
            position={[(side * w) / 2, y + h / 2, 0]}
            rotation={[0, 0, -side * angle]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[length + 0.15, 0.18, depth + 1.4]} />
            <Surface kind="roof" color={color} />
          </mesh>
          <Beam
            p={[(side * w) / 2, y + h / 2, (depth + 1.5) / 2]}
            s={[length + 0.3, 0.22, 0.22]}
            rotation={-side * angle}
          />
          <Beam
            p={[(side * w) / 2, y + h / 2, -(depth + 1.5) / 2]}
            s={[length + 0.3, 0.22, 0.22]}
            rotation={-side * angle}
          />
        </group>
      ))}
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[0, y, (side * depth) / 2]}
          rotation={[0, side < 0 ? Math.PI : 0, 0]}
        >
          <shapeGeometry args={[shape]} />
          <Surface kind="plaster" color="#ded0b6" />
        </mesh>
      ))}
      <Beam p={[0, y + h + 0.05, 0]} s={[0.25, 0.25, depth + 1.8]} />
    </group>
  );
}
export function WindowFrame({
  x,
  z,
  y = 1.95,
  scale = 1,
}: {
  x: number;
  z: number;
  y?: number;
  scale?: number;
}) {
  return (
    <group position={[x, y, z]} scale={scale}>
      <Beam p={[0, 0, 0]} s={[1.15, 1.35, 0.09]} color="#91b0aa" />
      {[-1, 1].map((side) => (
        <group key={side}>
          <Beam p={[side * 0.62, 0, 0.06]} s={[0.12, 1.55, 0.16]} color="#e8ddbf" />
          <Beam p={[side * 0.89, 0, -0.03]} s={[0.36, 1.35, 0.11]} color="#526f64" />
        </group>
      ))}
      {[-1, 0, 1].map((i) => (
        <Beam key={i} p={[0, i * 0.7, 0.08]} s={[1.38, 0.11, 0.16]} color="#e8ddbf" />
      ))}
      <Beam p={[0, 0, 0.09]} s={[0.08, 1.4, 0.12]} color="#e8ddbf" />
      <Beam p={[0, -0.85, 0.2]} s={[1.65, 0.16, 0.55]} color="#9b8d75" />
      {[-0.48, 0, 0.48].map((dx, i) => (
        <group key={dx} position={[dx, -0.65, 0.2]}>
          <mesh>
            <sphereGeometry args={[0.22, 8, 6]} />
            <meshStandardMaterial color="#536b43" />
          </mesh>
          <mesh position={[0, 0.12, 0.06]}>
            <sphereGeometry args={[0.08, 6, 5]} />
            <meshStandardMaterial color={["#b78183", "#e3c177", "#c2a0bf"][i]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
export function Lantern({ p }: { p: [number, number, number] }) {
  return (
    <group position={p}>
      <Beam p={[0, 0.45, 0]} s={[0.08, 1.1, 0.08]} color="#343f3d" />
      <mesh>
        <cylinderGeometry args={[0.15, 0.19, 0.4, 6]} />
        <meshStandardMaterial
          color="#ffe6a8"
          emissive="#e0b667"
          emissiveIntensity={0.45}
        />
      </mesh>
      {[-0.24, 0.24].map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <coneGeometry args={[0.26, 0.12, 6]} />
          <meshStandardMaterial color="#3b4c47" />
        </mesh>
      ))}
    </group>
  );
}
export function GardenBed({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.09, 0]}>
        <cylinderGeometry args={[2.2, 2.3, 0.18, 24]} />
        <Surface kind="stone" color="#c2b89e" />
      </mesh>
      <mesh position={[0, 0.19, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[2.1, 24]} />
        <meshStandardMaterial color="#564d35" />
      </mesh>
      {Array.from({ length: 12 }, (_, i) => {
        const a = i * 2.4,
          r = 0.5 + (i % 3) * 0.5;
        return (
          <group key={i} position={[Math.sin(a) * r, 0.32, Math.cos(a) * r]}>
            <mesh scale={[0.28, 0.2, 0.28]}>
              <sphereGeometry args={[1, 7, 5]} />
              <meshStandardMaterial color="#527443" />
            </mesh>
            <mesh position={[0, 0.2, 0]}>
              <sphereGeometry args={[0.1, 6, 5]} />
              <meshStandardMaterial color={["#d3ab6b", "#a88aba", "#e1ce9c"][i % 3]} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

export function GableInfill({
  width,
  depth,
  y,
  height,
}: {
  width: number;
  depth: number;
  y: number;
  height: number;
}) {
  const shape = useMemo(
    () =>
      new Shape()
        .moveTo(-width / 2, 0)
        .lineTo(0, height)
        .lineTo(width / 2, 0)
        .closePath(),
    [width, height],
  );
  return (
    <group ref={labelOccluder}>
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[0, y, (side * depth) / 2]}
          rotation={[0, side < 0 ? Math.PI : 0, 0]}
        >
          <shapeGeometry args={[shape]} />
          <Surface kind="plaster" color="#ded2b7" />
        </mesh>
      ))}
    </group>
  );
}
