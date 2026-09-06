import { useState, useEffect } from 'react';
import { useShotStore } from '../store/shotStore';

export const POSE_CONNECTIONS_NAMED = [
  ['left_shoulder', 'right_shoulder'],
  ['left_shoulder', 'left_elbow'],
  ['left_elbow', 'left_wrist'],
  ['right_shoulder', 'right_elbow'],
  ['right_elbow', 'right_wrist'],
  ['left_shoulder', 'left_hip'],
  ['right_shoulder', 'right_hip'],
  ['left_hip', 'right_hip'],
  ['left_hip', 'left_knee'],
  ['left_knee', 'left_ankle'],
  ['right_hip', 'right_knee'],
  ['right_knee', 'right_ankle'],
  ['left_ankle', 'left_foot_index'],
  ['right_ankle', 'right_foot_index']
];

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

export interface PoseWorldFrame {
  t_ms: number;
  points: ([number, number, number, number] | null)[];
}

export interface PoseWorldTrack {
  coordinate_space: string;
  origin: string;
  point_format: string[];
  t_ms_origin: string;
  frame_count: number;
  frames: PoseWorldFrame[];
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
  world?: PoseWorldTrack;
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
