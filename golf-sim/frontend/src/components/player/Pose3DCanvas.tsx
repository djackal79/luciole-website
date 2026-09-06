import React, { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Line } from '@react-three/drei';
import { type PoseData, POSE_CONNECTIONS_NAMED } from '../../hooks/usePoseData';
import { useThemeStore } from '../../store/themeStore';



interface Pose3DCanvasProps {
  poseData: PoseData | null;
  t_from_impact_sec: number;
}

const SkeletonRig = ({ poseData, t_from_impact_sec }: Pose3DCanvasProps) => {
  const world = poseData?.world;
  const { currentTheme } = useThemeStore();
  const isBoutique = currentTheme === 'boutique';
  
  // Find closest frame. t_ms is ALREADY relative to impact. Do NOT subtract impact_ms.
  const target_t_ms = t_from_impact_sec * 1000;
  
  let closestFrame = world?.frames?.[0];
  let minDist = Infinity;
  if (world?.frames && world.frames.length > 0) {
    for (const frame of world.frames) {
      const dist = Math.abs(frame.t_ms - target_t_ms);
      if (dist < minDist) {
        minDist = dist;
        closestFrame = frame;
      }
    }
  }

  // Cap distance limit: frame must be within 35ms of the playhead, otherwise skip
  const isOutOfRange = minDist > 35;
  const pts = (!isOutOfRange && closestFrame) ? closestFrame.points : null;

  // Prepare line segments
  const lines = useMemo(() => {
    const segments: [number, number, number][][] = [];
    const lms = poseData?.landmarks;
    if (!pts || !lms) return segments;
    
    POSE_CONNECTIONS_NAMED.forEach(([name1, name2]) => {
      const i = lms.indexOf(name1);
      const j = lms.indexOf(name2);
      if (i < 0 || j < 0) return;
      
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
  }, [pts, poseData?.landmarks]);

  if (!world || !world.frames || world.frames.length === 0 || !pts) return null;

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
