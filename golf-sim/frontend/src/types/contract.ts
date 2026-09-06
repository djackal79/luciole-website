export type ShotStatus = 'pending' | 'complete' | 'partial';

export interface SourcesConfig {
  body_swing: boolean;
  body_swing_dtl?: boolean;
  impact_strike: boolean;
  telemetry: boolean;
  pose?: boolean;
  pressure?: boolean;
  behind_swing?: boolean; // legacy alias for body_swing_dtl
}

export interface MediaEntry {
  path: string;
  camera: string;
  capture_fps: number | null;
  container_fps: number | null;
  duration_ms: number | null;
  impact_ms?: number | null; // v1.1 per-clip impact position
  width: number | null;
  height: number | null;
}

export interface PoseSummary {
  swing_plane_deg: number | null;
  spine_angle_deg: number | null;
  shoulder_turn_deg: number | null;
  pelvis_rotation_deg: number | null;
  x_factor_deg: number | null;
  hand_speed_mph: number | null;
}

export interface PoseWorldPoint {
  x: number;
  y: number;
  z: number;
  reprojection_px: number;
}

export interface PoseWorldFrame {
  t_ms: number;
  points: ([number, number, number, number] | null)[];
}

export interface PoseWorldBlock {
  coordinate_space: string;
  origin: string;
  point_format: string[];
  t_ms_origin: string;
  frame_count: number;
  frames: PoseWorldFrame[];
}

export interface PoseBlock {
  status: 'pending' | 'ready' | 'failed' | 'unavailable';
  path: string;
  model: string;
  dimensions: '2d' | '3d';
  cameras: string[];
  frame_count: number;
  error: string | null;
  summary: PoseSummary;
  world?: PoseWorldBlock;
}

export interface PressureSummary {
  peak_grf_n: number | null;
  trail_pct_at_impact: number | null;
  lead_pct_at_impact: number | null;
  cop_excursion_mm: number | null;
}

export interface PressureBlock {
  status: 'ready' | 'unavailable';
  path: string;
  device: string;
  sample_rate_hz: number;
  samples: number;
  impact_ms: number | null;
  summary: PressureSummary;
}

export interface PressureSample {
  time_sec: number;
  lead_pct: number;     // Left foot (for right-handed golfer)
  trail_pct: number;    // Right foot
  lead_heel_pct: number;
  lead_toe_pct: number;
  trail_heel_pct: number;
  trail_toe_pct: number;
  cop_x: number;        // Center of pressure X (-1.0 to 1.0)
  cop_y: number;        // Center of pressure Y (-1.0 to 1.0)
  vertical_force_n?: number;
}

export interface PressureDataBlock {
  sensor_model: string;
  sample_rate_hz: number;
  samples: PressureSample[];
}

export interface BiomechanicsSample {
  time_sec: number;
  spine_tilt_deg: number;
  pelvic_rotation_deg: number;
  shoulder_rotation_deg: number;
  swing_plane_angle_deg: number;
  head_displacement_cm: { x: number; y: number; z: number };
}

export interface Biomechanics3DBlock {
  model_version: string;
  samples: BiomechanicsSample[];
}

export interface SyncBlock {
  trigger_ts: string;
  impact_offset_ms: number;
}

export interface BallData {
  speed_mph: number | null;
  total_spin_rpm: number | null;
  back_spin_rpm: number | null;
  side_spin_rpm: number | null;
  spin_axis_deg: number | null;
  launch_angle_deg: number | null;
  launch_direction_deg: number | null;
}

export interface ClubData {
  speed_mph: number | null;
  angle_of_attack_deg: number | null;
  path_deg: number | null;
  face_to_target_deg: number | null;
  loft_deg: number | null;
  closure_rate_dps: number | null;
}

export interface DerivedData {
  smash_factor: number | null;
  face_to_path_deg: number | null;
}

export interface FlightData {
  model: string;
  carry_m: number | null;
  total_m: number | null;
  apex_m: number | null;
  descent_angle_deg: number | null;
  offline_m: number | null;
  flight_time_s: number | null;
  conditions: {
    altitude_m: number;
    temperature_c: number;
  };
}

export interface DistanceData {
  carry_m: number | null;
  total_m: number | null;
}

export interface TelemetryBlock {
  source: string;
  received_at: string;
  ball: BallData;
  club: ClubData;
  derived: DerivedData;
  distance: DistanceData;
  flight?: FlightData | null;
  raw: Record<string, any>;
}

export interface ShotPackage {
  schema_version: string;
  shot_id: string;
  session_id: string;
  created_at: string;
  status: ShotStatus;
  sources: SourcesConfig;
  media: {
    body_swing?: MediaEntry;       // Face-On Kinovea
    body_swing_dtl?: MediaEntry;   // Down-The-Line Kinovea
    impact_strike?: MediaEntry;    // High-speed Samsung slow-mo
    behind_swing?: MediaEntry;     // Down-The-Line / Behind Cam (alias)
    [key: string]: MediaEntry | undefined;
  };
  sync: SyncBlock;
  telemetry: TelemetryBlock | null;
  pose?: PoseBlock;
  pressure?: PressureBlock;
  pressure_data?: PressureDataBlock;
  biomechanics_3d?: Biomechanics3DBlock;
  club_used: string | null;
  tags: string[];
  notes: string;
}

export interface ShotPatch {
  tags?: string[];
  notes?: string;
  club_used?: string | null;
  impact_offset_ms?: number;
}

export type WebSocketEventType =
  | 'shot.created'
  | 'shot.updated'
  | 'shot.completed'
  | 'shot.patched'
  | 'session.reset';

export interface WebSocketEnvelope {
  type: WebSocketEventType;
  ts: string;
  shot_id: string | null;
  payload?: ShotPackage | { session_id: string };
}
