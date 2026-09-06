import { create } from 'zustand';
import type { ShotPackage, ShotPatch, WebSocketEnvelope, PressureSample, BiomechanicsSample } from '../types/contract';
import mockShotsData from '../../../mocks/shots.json';
import { getStoredSupabaseConfig, saveStoredSupabaseConfig } from '../services/supabase';
import { fetchShots } from '../services/api';

// Local storage key for offline patch persistence
const STORAGE_PATCHES_KEY = 'golf_studio_local_patches';

function getStoredPatches(): Record<string, ShotPatch> {
  try {
    const raw = localStorage.getItem(STORAGE_PATCHES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed;
    }
    return {};
  } catch {
    return {};
  }
}

function saveStoredPatch(shotId: string, patch: ShotPatch) {
  try {
    const existing = getStoredPatches();
    existing[shotId] = { ...(existing[shotId] || {}), ...patch };
    localStorage.setItem(STORAGE_PATCHES_KEY, JSON.stringify(existing));
  } catch {
    // Ignore storage errors
  }
}

// Generate realistic ground reaction force & Center of Pressure time-series
export function generateMockPressureData(impactSec = 2.45, durationSec = 4.0): PressureSample[] {
  const samples: PressureSample[] = [];
  const steps = 80;
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * durationSec;
    let leadPct = 55;
    let trailPct = 45;
    let copX = -0.1; // Negative = trail foot, positive = lead foot
    let copY = 0.0;  // -1 = heels, +1 = toes

    if (t < 0.7) {
      // Address: slight 55/45 lead bias
      leadPct = 55;
      trailPct = 45;
      copX = -0.05;
      copY = 0.0;
    } else if (t < 1.6) {
      // Backswing: shifts heavily to trail foot (heel bias)
      const p = (t - 0.7) / (1.6 - 0.7);
      trailPct = 45 + p * 35; // rises to 80%
      leadPct = 100 - trailPct;
      copX = -0.05 - p * 0.55; // shifts right
      copY = -p * 0.25;        // into trail heel
    } else if (t < impactSec) {
      // Downswing transition: dynamic aggressive transfer to lead side
      const p = (t - 1.6) / (impactSec - 1.6);
      leadPct = 20 + p * 65; // rushes to 85% on lead foot!
      trailPct = 100 - leadPct;
      copX = -0.6 + p * 1.15; // rushes left
      copY = 0.35 * (1 - p);  // moves through ball of lead foot
    } else if (t <= impactSec + 0.15) {
      // Impact compression zone
      leadPct = 85;
      trailPct = 15;
      copX = 0.55;
      copY = -0.1;
    } else {
      // Follow-through: 95% on lead heel, balanced finish
      const p = Math.min(1, (t - (impactSec + 0.15)) / (durationSec - impactSec));
      leadPct = 85 + p * 10;
      trailPct = 100 - leadPct;
      copX = 0.55 + p * 0.15;
      copY = -0.1 - p * 0.3; // resting in lead heel
    }

    samples.push({
      time_sec: Number(t.toFixed(3)),
      lead_pct: Math.round(leadPct),
      trail_pct: Math.round(trailPct),
      lead_heel_pct: Math.round(leadPct * 0.55),
      lead_toe_pct: Math.round(leadPct * 0.45),
      trail_heel_pct: Math.round(trailPct * 0.6),
      trail_toe_pct: Math.round(trailPct * 0.4),
      cop_x: Number(copX.toFixed(3)),
      cop_y: Number(copY.toFixed(3)),
      vertical_force_n: Math.round(750 + (t >= impactSec - 0.05 && t <= impactSec + 0.05 ? 650 : 0))
    });
  }
  return samples;
}

// Generate realistic 3D biomechanics swing coordinates
export function generateMockBiomechanics(impactSec = 2.45, durationSec = 4.0): BiomechanicsSample[] {
  const samples: BiomechanicsSample[] = [];
  const steps = 60;
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * durationSec;
    let spineTilt = 28;
    let pelvisRot = 0;
    let shoulderRot = 0;

    if (t < 0.7) {
      spineTilt = 28;
      pelvisRot = 0;
      shoulderRot = 0;
    } else if (t < 1.6) {
      const p = (t - 0.7) / (1.6 - 0.7);
      pelvisRot = -p * 45;
      shoulderRot = -p * 92;
      spineTilt = 28 + p * 2;
    } else if (t < impactSec) {
      const p = (t - 1.6) / (impactSec - 1.6);
      pelvisRot = -45 + p * 85;    // +40 at impact (open)
      shoulderRot = -92 + p * 115; // +23 at impact (open)
      spineTilt = 30 - p * 4;
    } else {
      const p = Math.min(1, (t - impactSec) / (durationSec - impactSec));
      pelvisRot = 40 + p * 50;     // fully cleared
      shoulderRot = 23 + p * 80;
      spineTilt = 26 - p * 6;
    }

    samples.push({
      time_sec: Number(t.toFixed(3)),
      spine_tilt_deg: Number(spineTilt.toFixed(1)),
      pelvic_rotation_deg: Number(pelvisRot.toFixed(1)),
      shoulder_rotation_deg: Number(shoulderRot.toFixed(1)),
      swing_plane_angle_deg: 62.4,
      head_displacement_cm: { x: Number((Math.sin(t) * 1.5).toFixed(1)), y: 0.8, z: 0.2 }
    });
  }
  return samples;
}

function enrichMockShots(rawShots: ShotPackage[]): ShotPackage[] {
  const patches = getStoredPatches();
  return rawShots.map((s, idx) => {
    const p = patches[s.shot_id];
    const impactSec = 2.45;
    const durationSec = 4.0;

    const base: ShotPackage = {
      ...s,
      sources: {
        ...s.sources,
        behind_swing: true,
      },
      media: {
        ...s.media,
        behind_swing: {
          path: 'behind_swing.mp4',
          camera: 'down_the_line',
          capture_fps: 60.0,
          container_fps: 30.0,
          duration_ms: 4000,
          width: 1280,
          height: 720
        }
      },
      pressure_data: {
        sensor_model: 'Studio-DualMat-Pro',
        sample_rate_hz: 60,
        samples: generateMockPressureData(impactSec, durationSec)
      },
      biomechanics_3d: {
        model_version: 'Skeleton-v2.1',
        samples: generateMockBiomechanics(impactSec, durationSec)
      }
    };

    if (!p) return base;

    return {
      ...base,
      tags: Array.isArray(p.tags) ? p.tags : base.tags,
      notes: typeof p.notes === 'string' ? p.notes : base.notes,
      club_used: typeof p.club_used === 'string' ? p.club_used : base.club_used,
      sync: {
        ...base.sync,
        impact_offset_ms: typeof p.impact_offset_ms === 'number' ? p.impact_offset_ms : base.sync.impact_offset_ms
      }
    };
  });
}

const initialShots = enrichMockShots(mockShotsData as ShotPackage[]);
const { isEnabled: initialCloudSync } = getStoredSupabaseConfig();

interface ShotStoreState {
  shots: ShotPackage[];
  currentShotId: string | null;
  distanceUnit: 'yards' | 'meters';
  isHistoryDrawerOpen: boolean;
  wsStatus: 'connected' | 'connecting' | 'disconnected';
  lastWsMessageTime: string | null;

  // Session & Studio Management
  activeSessionId: string;
  activeClub: string;
  isSessionActive: boolean;
  isSessionModalOpen: boolean;
  isSetupWizardOpen: boolean;
  cloudSyncEnabled: boolean;

  // Actions
  selectShot: (shotId: string) => void;
  loadScenario: (index: number) => void;
  loadShotsFromBackend: () => Promise<void>;
  toggleDistanceUnit: () => void;
  toggleHistoryDrawer: () => void;
  setWsStatus: (status: 'connected' | 'connecting' | 'disconnected') => void;
  handleWsEvent: (event: WebSocketEnvelope) => void;
  patchShot: (shotId: string, patch: ShotPatch) => Promise<void>;
  getCurrentShot: () => ShotPackage | null;

  // Modals & Cloud Toggles
  toggleSetupWizard: () => void;
  openSetupWizard: () => void;
  closeSetupWizard: () => void;
  toggleSessionModal: () => void;
  setCloudSyncEnabled: (enabled: boolean) => void;
  setActiveSession: (sessionId: string, club?: string) => void;
  simulateLiveShotArrival: () => void;
}

export const useShotStore = create<ShotStoreState>((set, get) => ({
  shots: initialShots,
  currentShotId: initialShots[0]?.shot_id ?? null,
  distanceUnit: 'yards',
  isHistoryDrawerOpen: false,
  wsStatus: 'disconnected',
  lastWsMessageTime: null,

  activeSessionId: '20260906-morning',
  activeClub: '7I',
  isSessionActive: true,
  isSessionModalOpen: false,
  isSetupWizardOpen: false,
  cloudSyncEnabled: initialCloudSync,

  getCurrentShot: () => {
    const { shots, currentShotId } = get();
    return shots.find((s) => s.shot_id === currentShotId) ?? shots[0] ?? null;
  },

  selectShot: (shotId: string) => {
    set({ currentShotId: shotId });
  },

  loadScenario: (index: number) => {
    const { shots } = get();
    if (shots[index]) {
      set({ currentShotId: shots[index].shot_id });
    }
  },

  loadShotsFromBackend: async () => {
    try {
      const remoteShots = await fetchShots();
      if (Array.isArray(remoteShots) && remoteShots.length > 0) {
        const enriched = enrichMockShots(remoteShots);
        set((state) => ({
          shots: enriched,
          currentShotId: enriched.find((s) => s.shot_id === state.currentShotId)
            ? state.currentShotId
            : enriched[0].shot_id
        }));
      }
    } catch (err) {
      console.warn('[shotStore] Real backend shots fetch fallback to cache:', err);
    }
  },


  toggleDistanceUnit: () => {
    set((state) => ({
      distanceUnit: state.distanceUnit === 'yards' ? 'meters' : 'yards'
    }));
  },

  toggleHistoryDrawer: () => {
    set((state) => ({ isHistoryDrawerOpen: !state.isHistoryDrawerOpen }));
  },

  setWsStatus: (status) => set({ wsStatus: status }),

  toggleSetupWizard: () => set((s) => ({ isSetupWizardOpen: !s.isSetupWizardOpen })),
  openSetupWizard: () => set({ isSetupWizardOpen: true }),
  closeSetupWizard: () => set({ isSetupWizardOpen: false }),

  toggleSessionModal: () => set((s) => ({ isSessionModalOpen: !s.isSessionModalOpen })),

  setCloudSyncEnabled: (enabled: boolean) => {
    const cfg = getStoredSupabaseConfig();
    saveStoredSupabaseConfig(cfg.url, cfg.anonKey, enabled);
    set({ cloudSyncEnabled: enabled });
  },

  setActiveSession: (sessionId: string, club?: string) => {
    set((s) => ({
      activeSessionId: sessionId,
      activeClub: club ?? s.activeClub,
      isSessionActive: true
    }));
  },

  // Handles fast 50ms telemetry + delayed video attachments
  handleWsEvent: (event: WebSocketEnvelope) => {
    const nowStr = new Date().toLocaleTimeString();
    set({ lastWsMessageTime: nowStr });

    if (event.type === 'session.reset') {
      set({ shots: [], currentShotId: null });
      return;
    }

    const payload = event.payload as ShotPackage | undefined;
    if (!payload || !payload.shot_id) return;

    set((state) => {
      const existingIdx = state.shots.findIndex((s) => s.shot_id === payload.shot_id);
      let updatedShots: ShotPackage[];

      // Enforce 3-camera and sensor structures
      const enrichedPayload: ShotPackage = {
        ...payload,
        sources: {
          ...payload.sources,
          behind_swing: payload.sources?.behind_swing ?? true,
        },
        media: {
          ...payload.media,
          behind_swing: payload.media?.behind_swing ?? {
            path: 'behind_swing.mp4',
            camera: 'down_the_line',
            capture_fps: 60,
            container_fps: 30,
            duration_ms: 4000,
            width: 1280,
            height: 720
          }
        },
        pressure_data: payload.pressure_data ?? {
          sensor_model: 'Studio-DualMat-Pro',
          sample_rate_hz: 60,
          samples: generateMockPressureData(2.45, 4.0)
        },
        biomechanics_3d: payload.biomechanics_3d ?? {
          model_version: 'Skeleton-v2.1',
          samples: generateMockBiomechanics(2.45, 4.0)
        }
      };

      if (existingIdx >= 0) {
        // Post-completion update: video arrived 2s after telemetry!
        const prev = state.shots[existingIdx];
        updatedShots = [...state.shots];
        updatedShots[existingIdx] = {
          ...enrichedPayload,
          tags: enrichedPayload.tags?.length ? enrichedPayload.tags : prev.tags,
          notes: enrichedPayload.notes || prev.notes
        };
      } else {
        // Prepend new shot
        updatedShots = [enrichedPayload, ...state.shots];
      }

      const shouldFocus = event.type === 'shot.created' || state.currentShotId === payload.shot_id;

      return {
        shots: updatedShots,
        currentShotId: shouldFocus ? payload.shot_id : state.currentShotId
      };
    });
  },

  patchShot: async (shotId: string, patch: ShotPatch) => {
    set((state) => {
      const updated = state.shots.map((s) => {
        if (s.shot_id !== shotId) return s;
        return {
          ...s,
          tags: patch.tags !== undefined ? patch.tags : s.tags,
          notes: patch.notes !== undefined ? patch.notes : s.notes,
          club_used: patch.club_used !== undefined ? patch.club_used : s.club_used,
          sync: {
            ...s.sync,
            impact_offset_ms: patch.impact_offset_ms !== undefined ? patch.impact_offset_ms : s.sync.impact_offset_ms
          }
        };
      });
      return { shots: updated };
    });

    saveStoredPatch(shotId, patch);

    try {
      await fetch(`/api/shots/${shotId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch)
      });
    } catch {
      // offline fallback
    }
  },

  // Mock Mode: simulate live shot arriving in 50ms followed 1.5s later by video attachment
  simulateLiveShotArrival: () => {
    const timestamp = new Date().toISOString();
    const id = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 15) + '-' + Math.floor(Math.random() * 900 + 100);
    const club = get().activeClub;

    // 1. Initial shot created event (telemetry lands fast, video is still pending)
    const partialShot: ShotPackage = {
      schema_version: '1.0',
      shot_id: id,
      session_id: get().activeSessionId,
      created_at: timestamp,
      status: 'pending',
      sources: {
        body_swing: false,
        impact_strike: false,
        behind_swing: false,
        telemetry: true
      },
      media: {},
      sync: {
        trigger_ts: timestamp,
        impact_offset_ms: 0
      },
      telemetry: {
        source: 'gspro_connect_v1',
        received_at: timestamp,
        ball: {
          speed_mph: +(130 + Math.random() * 15).toFixed(1),
          total_spin_rpm: Math.round(5800 + Math.random() * 800),
          back_spin_rpm: 5700,
          side_spin_rpm: -350,
          spin_axis_deg: -3.8,
          launch_angle_deg: +(15 + Math.random() * 3).toFixed(1),
          launch_direction_deg: +(Math.random() * 2 - 1).toFixed(1)
        },
        club: {
          speed_mph: +(90 + Math.random() * 8).toFixed(1),
          angle_of_attack_deg: -2.8,
          path_deg: +(Math.random() * 3 - 0.5).toFixed(1),
          face_to_target_deg: -1.0,
          loft_deg: 24.0,
          closure_rate_dps: null
        },
        derived: {
          smash_factor: +(1.42 + Math.random() * 0.05).toFixed(2),
          face_to_path_deg: -1.8
        },
        distance: {
          carry_m: null,
          total_m: null
        },
        raw: {}
      },
      club_used: club,
      tags: ['Simulated Strike'],
      notes: 'Real-time test shot'
    };

    get().handleWsEvent({
      type: 'shot.created',
      ts: timestamp,
      shot_id: id,
      payload: partialShot
    });

    // 2. Video arrives 1.5 seconds later (shot updated event)
    setTimeout(() => {
      const completedShot: ShotPackage = {
        ...partialShot,
        status: 'complete',
        sources: {
          body_swing: true,
          impact_strike: true,
          behind_swing: true,
          telemetry: true
        },
        media: {
          body_swing: {
            path: 'body_swing.mp4',
            camera: 'face_on',
            capture_fps: 30,
            container_fps: 30,
            duration_ms: 4000,
            width: 1280,
            height: 720
          },
          impact_strike: {
            path: 'impact_strike.mp4',
            camera: 'impact',
            capture_fps: 240,
            container_fps: 30,
            duration_ms: 1500,
            width: 1920,
            height: 1080
          },
          behind_swing: {
            path: 'behind_swing.mp4',
            camera: 'down_the_line',
            capture_fps: 60,
            container_fps: 30,
            duration_ms: 4000,
            width: 1280,
            height: 720
          }
        }
      };

      get().handleWsEvent({
        type: 'shot.updated',
        ts: new Date().toISOString(),
        shot_id: id,
        payload: completedShot
      });
    }, 1500);
  }
}));
