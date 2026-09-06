import React, { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Line } from '@react-three/drei';
import type { PoseData } from '../../hooks/usePoseData';
import { useThemeStore } from '../../store/themeStore';

// MediaPipe Pose connections
const POSE_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 7], // Right eye / ear
  [0, 4], [4, 5], [5, 6], [6, 8], // Left eye / ear
  [9, 10], // Mouth
  [11, 12], // Shoulders
  [11, 13], [13, 15], [15, 17], [15, 19], [15, 21], [17, 19], // Right arm/hand
  [12, 14], [14, 16], [16, 18], [16, 20], [16, 22], [18, 20], // Left arm/hand
  [11, 23], [12, 24], [23, 24], // Torso
  [23, 25], [25, 27], [27, 29], [27, 31], [29, 31], // Right leg/foot
  [24, 26], [26, 28], [28, 30], [28, 32], [30, 32]  // Left leg/foot
];

interface Pose3DCanvasProps {
  poseData: PoseData | null;
  t_from_impact_sec: number;
}

const SkeletonRig = ({ poseData, t_from_impact_sec }: Pose3DCanvasProps) => {
  const world = poseData?.world;
  const { currentTheme } = useThemeStore();
  const isBoutique = currentTheme === 'boutique';
  
  if (!world || !world.frames || world.frames.length === 0) return null;

  // Find closest frame. t_ms is ALREADY relative to impact. Do NOT subtract impact_ms.
  const target_t_ms = t_from_impact_sec * 1000;
  
  let closestFrame = world.frames[0];
  let minDist = Infinity;
  for (const frame of world.frames) {
    const dist = Math.abs(frame.t_ms - target_t_ms);
    if (dist < minDist) {
      minDist = dist;
      closestFrame = frame;
    }
  }

  const pts = closestFrame.points;
  if (!pts) return null;

  // Prepare line segments
  const lines = useMemo(() => {
    const segments: [number, number, number][][] = [];
    POSE_CONNECTIONS.forEach(([i, j]) => {
      const p1 = pts[i];
      const p2 = pts[j];
      // If either point is null, draw a gap
      if (p1 && p2) {
        // Map: X -> X, Y -> Z, Z -> Y (Z is up in the world, Y is up in ThreeJS)
        segments.push([
          [p1[0], p1[2], -p1[1]],
          [p2[0], p2[2], -p2[1]]
        ]);
      }
    });
    return segments;
  }, [pts]);

  const lineColor = isBoutique ? '#D4AF37' : '#00f298';
  const jointColor = isBoutique ? '#E5C07B' : '#00d2ff';

  return (
    <group>
      {lines.map((pts_arr, idx) => (
        <Line 
          key={idx} 
          points={pts_arr} 
          color={lineColor} 
          lineWidth={2} 
        />
      ))}
      {pts.map((p, idx) => {
        if (!p) return null;
        // The fourth number is the reprojection error in pixels
        const reprojErr = p[3] ?? 0;
        // Decrease opacity as reprojection error increases
        const opacity = Math.max(0.1, 1.0 - (reprojErr / 25));
        
        return (
          <mesh key={idx} position={[p[0], p[2], -p[1]]}>
            <sphereGeometry args={[0.025, 16, 16]} />
            <meshStandardMaterial color={jointColor} transparent opacity={opacity} />
          </mesh>
        );
      })}
    </group>
  );
};

export const Pose3DCanvas: React.FC<Pose3DCanvasProps> = ({ poseData, t_from_impact_sec }) => {
  return (
    <div className="w-full h-64 bg-black/40 rounded-xl overflow-hidden border border-neutral-800/80 relative mb-3">
      <Canvas camera={{ position: [0, 1.5, 3], fov: 45 }}>
        <ambientLight intensity={0.6} />
        <pointLight position={[10, 10, 10]} intensity={1.5} />
        <SkeletonRig poseData={poseData} t_from_impact_sec={t_from_impact_sec} />
        <gridHelper args={[6, 12, '#444444', '#222222']} position={[0, 0, 0]} />
        <OrbitControls target={[0, 1, 0]} enablePan={true} enableZoom={true} />
      </Canvas>
    </div>
  );
};
