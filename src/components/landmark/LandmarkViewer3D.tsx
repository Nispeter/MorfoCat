import { Canvas } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";
import { useMemo } from "react";

interface LandmarkViewer3DProps {
  landmarks: number[][];
  consensus?: number[][];
  showLabels?: boolean;
}

function LandmarkPoint({ position, label, showLabel }: { position: [number, number, number]; label: string; showLabel: boolean }) {
  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[0.015, 12, 12]} />
        <meshStandardMaterial color="hsl(221,83%,53%)" />
      </mesh>
      {showLabel && (
        <Text position={[0.02, 0.02, 0]} fontSize={0.018} color="white" anchorX="left">
          {label}
        </Text>
      )}
    </group>
  );
}

function ConsensusPoint({ position }: { position: [number, number, number] }) {
  return (
    <mesh position={position}>
      <sphereGeometry args={[0.01, 8, 8]} />
      <meshStandardMaterial color="gray" opacity={0.4} transparent />
    </mesh>
  );
}

function normalise(lms: number[][]): [number, number, number][] {
  if (!lms.length) return [];
  const xs = lms.map((p) => p[0]);
  const ys = lms.map((p) => p[1]);
  const zs = lms.map((p) => p[2] ?? 0);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const cz = (Math.min(...zs) + Math.max(...zs)) / 2;
  const maxR = Math.max(...lms.map((p) => Math.sqrt((p[0] - cx) ** 2 + (p[1] - cy) ** 2 + ((p[2] ?? 0) - cz) ** 2))) || 1;
  return lms.map((p) => [
    (p[0] - cx) / maxR,
    (p[1] - cy) / maxR,
    ((p[2] ?? 0) - cz) / maxR,
  ]);
}

export function LandmarkViewer3D({ landmarks, consensus, showLabels = true }: LandmarkViewer3DProps) {
  const normLms = useMemo(() => normalise(landmarks), [landmarks]);
  const normCons = useMemo(() => (consensus ? normalise(consensus) : []), [consensus]);

  return (
    <div className="h-80 w-full rounded border bg-black/5">
      <Canvas camera={{ position: [0, 0, 2.5], fov: 45 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 5, 3]} intensity={0.8} />
        {normCons.map((p, i) => (
          <ConsensusPoint key={`c${i}`} position={p} />
        ))}
        {normLms.map((p, i) => (
          <LandmarkPoint key={i} position={p} label={String(i + 1)} showLabel={showLabels} />
        ))}
        <OrbitControls />
      </Canvas>
    </div>
  );
}
