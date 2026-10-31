import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid } from "@react-three/drei";

export default function GameScene() {
  return (
    <Canvas
      shadows
      camera={{
        position: [8, 7, 10],
        fov: 60
      }}
      style={{ width: "100%", height: "100%" }}
    >
      {/* Фоновый цвет */}
      <color attach="background" args={["#bde0fe"]} />

      {/* Освещение */}
      <ambientLight intensity={0.8} />

      <directionalLight
        position={[10, 15, 5]}
        intensity={2}
        castShadow
      />

      {/* Земля */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#83b56e" />
      </mesh>

      {/* Тестовый объект */}
      <mesh position={[0, 1, 0]} castShadow>
        <boxGeometry args={[2, 2, 2]} />
        <meshStandardMaterial color="#d97757" />
      </mesh>

      <Grid
        position={[0, 0.01, 0]}
        args={[100, 100]}
        sectionColor="#666666"
        cellColor="#aaaaaa"
        fadeDistance={50}
      />

      <OrbitControls />
    </Canvas>
  );
}