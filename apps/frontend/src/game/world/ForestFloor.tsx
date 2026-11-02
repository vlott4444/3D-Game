import { useTexture } from "@react-three/drei";
import { useMemo } from "react";
import { RepeatWrapping, SRGBColorSpace, Vector2 } from "three";
export function ForestFloor() {
  const [map, normalMap] = useTexture([
    "/models/forest-ground.jpg",
    "/models/forest-normal.jpg",
  ]);
  useMemo(() => {
    for (const t of [map, normalMap]) {
      t.wrapS = t.wrapT = RepeatWrapping;
      t.repeat.set(16, 16);
      t.anisotropy = 4;
    }
    map.colorSpace = SRGBColorSpace;
  }, [map, normalMap]);
  return (
    <meshStandardMaterial
      map={map}
      normalMap={normalMap}
      normalScale={new Vector2(0.35, 0.35)}
      roughness={1}
      color="#bbc9a0"
    />
  );
}
