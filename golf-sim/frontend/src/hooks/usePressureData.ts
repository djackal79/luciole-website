import { useState, useEffect } from 'react';
import { useShotStore } from '../store/shotStore';

export interface PressureSampleRaw {
  t_ms: number;
  trail_pct: number;
  lead_pct: number;
  grf_n?: number;
  cop: {
    x_mm: number;
    y_mm: number;
  };
}

export interface PressureData {
  schema_version: string;
  device: string;
  sample_rate_hz: number;
  impact_ms: number | null;
  samples: PressureSampleRaw[];
}

export function usePressureData() {
  const currentShot = useShotStore((s) => s.getCurrentShot());
  const [pressureData, setPressureData] = useState<PressureData | null>(null);

  useEffect(() => {
    let active = true;
    if (!currentShot || currentShot.pressure?.status !== 'ready') {
      setPressureData(null);
      return;
    }
    const fetchPressure = async () => {
      try {
        const res = await fetch(`/shots/shot_${currentShot.shot_id}/${currentShot.pressure!.path}`);
        if (!res.ok) return;
        const data = await res.json();
        if (active) setPressureData(data);
      } catch (err) {
        console.error("Failed to fetch pressure data", err);
      }
    };
    fetchPressure();
    return () => { active = false; };
  }, [currentShot?.shot_id, currentShot?.pressure?.status, currentShot?.pressure?.path]);

  return pressureData;
}
