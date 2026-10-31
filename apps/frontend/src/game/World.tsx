
import {
  RigidBody,
  CuboidCollider,
  CylinderCollider,
} from "@react-three/rapier";

// Тип координат объекта
type Position = [number, number, number];

// Ящик или прямоугольное препятствие
type BoxObjectProps = {
  position: Position;
  size: Position;
  color: string;
};

function BoxObject({
  position,
  size,
  color,
}: BoxObjectProps) {
  return (
    <RigidBody
      type="fixed"
      colliders={false}
      position={position}
    >
      <CuboidCollider
        args={[size[0] / 2, size[1] / 2, size[2] / 2]}
      />

      <mesh castShadow receiveShadow>
        <boxGeometry args={size} />
        <meshStandardMaterial color={color} />
      </mesh>
    </RigidBody>
  );
}

// Дерево: физическое столкновение только со стволом
function Tree({ position }: { position: Position }) {
  return (
    <RigidBody
      type="fixed"
      colliders={false}
      position={position}
    >
      <CylinderCollider
        args={[1, 0.35]}
        position={[0, 1, 0]}
      />

      {/* Ствол */}
      <mesh position={[0, 1, 0]} castShadow>
        <cylinderGeometry args={[0.25, 0.35, 2, 8]} />
        <meshStandardMaterial color="#795548" />
      </mesh>

      {/* Крона */}
      <mesh position={[0, 2.7, 0]} castShadow>
        <coneGeometry args={[1.25, 3, 8]} />
        <meshStandardMaterial color="#3c8c57" />
      </mesh>
    </RigidBody>
  );
}

// Здание: коллайдер только на основной части
function Building({
  position,
  color,
}: {
  position: Position;
  color: string;
}) {
  return (
    <RigidBody
      type="fixed"
      colliders={false}
      position={position}
    >
      {/* Стены здания */}
      <CuboidCollider
        args={[3, 2, 2.5]}
        position={[0, 2, 0]}
      />

      <mesh
        position={[0, 2, 0]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[6, 4, 5]} />
        <meshStandardMaterial color={color} />
      </mesh>

      {/* Крыша — без коллайдера */}
      <mesh position={[0, 4.6, 0]} castShadow>
        <coneGeometry args={[4.5, 2, 4]} />
        <meshStandardMaterial color="#a64f3d" />
      </mesh>

      {/* Дверь — декоративная */}
      <mesh position={[0, 1, 2.51]}>
        <boxGeometry args={[1.2, 2, 0.05]} />
        <meshStandardMaterial color="#654321" />
      </mesh>

      {/* Окна */}
      <mesh position={[-1.8, 2.5, 2.52]}>
        <boxGeometry args={[0.8, 0.9, 0.05]} />
        <meshStandardMaterial color="#9ed9f5" />
      </mesh>

      <mesh position={[1.8, 2.5, 2.52]}>
        <boxGeometry args={[0.8, 0.9, 0.05]} />
        <meshStandardMaterial color="#9ed9f5" />
      </mesh>
    </RigidBody>
  );
}

// Основной игровой мир
export default function World() {
  return (
    <>
      {/* Земля */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider
          args={[50, 0.15, 50]}
          position={[0, -0.15, 0]}
        />

        <mesh position={[0, -0.15, 0]} receiveShadow>
          <boxGeometry args={[100, 0.3, 100]} />
          <meshStandardMaterial color="#83b56e" />
        </mesh>
      </RigidBody>

      {/* Здания */}
      <Building
        position={[-12, 0, -12]}
        color="#e2ba83"
      />

      <Building
        position={[12, 0, -12]}
        color="#d5a6c8"
      />

      {/* Деревья */}
      <Tree position={[-7, 0, 3]} />
      <Tree position={[7, 0, 3]} />
      <Tree position={[-16, 0, 6]} />
      <Tree position={[16, 0, 6]} />

      {/* Ящики */}
      <BoxObject
        position={[4, 0.75, -4]}
        size={[1.5, 1.5, 1.5]}
        color="#a87c4f"
      />

      <BoxObject
        position={[6, 0.75, -4]}
        size={[1.5, 1.5, 1.5]}
        color="#ad895b"
      />

      {/* Стена для проверки столкновений */}
      <BoxObject
        position={[0, 1.25, -8]}
        size={[10, 2.5, 0.5]}
        color="#b6b9c0"
      />

      {/* Каменная дорожка */}
      <mesh
        position={[0, 0.015, -4]}
        receiveShadow
      >
        <boxGeometry args={[3, 0.02, 14]} />
        <meshStandardMaterial color="#c2bbb1" />
      </mesh>
    </>
  );
}
