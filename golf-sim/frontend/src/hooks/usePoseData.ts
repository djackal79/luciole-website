import { useState, useEffect } from 'react';
import { useShotStore } from '../store/shotStore';

export interface PoseFrame {
  t_ms: number;
  points: number[][];
}

export interface PoseTrack {
  camera: string;
  fps: number;
  width: number;
  height: number;
  impact_ms: number | null;
  frame_count: number;
  frames: PoseFrame[];
}

export interface PoseData {
  schema_version: string;
  model: string;
  dimensions: '2d' | '3d';
  coordinate_space: string;
  point_format: string[];
  landmarks: string[];
  tracks: {
    body_swing?: PoseTrack;
    body_swing_dtl?: PoseTrack;
  };
}

export function usePoseData() {
  const currentShot = useShotStore((s) => s.getCurrentShot());
  const [poseData, setPoseData] = useState<PoseData | null>(null);

  useEffect(() => {
    let active = true;
    if (!currentShot || currentShot.pose?.status !== 'ready') {
      setPoseData(null);
      return;
    }
    const fetchPose = async () => {
      try {
        const res = await fetch(`/shots/shot_${currentShot.shot_id}/${currentShot.pose!.path}`);
        if (!res.ok) return;
        const data = await res.json();
        if (active) setPoseData(data);
      } catch (err) {
        console.error("Failed to fetch pose data", err);
      }
    };
    fetchPose();
    return () => { active = false; };
  }, [currentShot?.shot_id, currentShot?.pose?.status, currentShot?.pose?.path]);

  return poseData;
}
