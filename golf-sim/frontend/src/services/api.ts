import type { HealthResponse, SessionStartResponse, ListenerToggleResponse } from '../types/diagnostics';
import type { ShotPatch, ShotPackage } from '../types/contract';

const BACKEND_URL = ''; // Proxied by Vite in dev mode

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch(`${BACKEND_URL}/api/health`);
  if (!res.ok) {
    throw new Error(`Health check failed with status ${res.status}`);
  }
  return await res.json();
}

export async function startSession(sessionId?: string, club?: string): Promise<SessionStartResponse> {
  const payload = { session_id: sessionId, club };
  const res = await fetch(`${BACKEND_URL}/api/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    throw new Error(`Start session failed with status ${res.status}`);
  }
  return await res.json();
}

export async function endSession(): Promise<{ ended_session_id: string; new_session_id: string; ok: boolean }> {
  // End session uses root until converged on backend
  const res = await fetch(`${BACKEND_URL}/session/end`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  if (!res.ok) {
    throw new Error(`End session failed with status ${res.status}`);
  }
  return await res.json();
}

export async function toggleListener(enabled: boolean): Promise<ListenerToggleResponse> {
  const res = await fetch(`${BACKEND_URL}/api/listeners/gspro?enabled=${enabled}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  if (!res.ok) {
    throw new Error(`Toggle listener failed: ${res.status}`);
  }
  return await res.json();
}

export async function patchShotRemote(shotId: string, patch: ShotPatch): Promise<void> {
  const res = await fetch(`${BACKEND_URL}/api/shots/${shotId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch)
  });
  if (!res.ok) {
    throw new Error(`Patch shot failed: ${res.status}`);
  }
}

export async function fetchShots(): Promise<ShotPackage[]> {
  const res = await fetch(`${BACKEND_URL}/api/shots`);
  if (!res.ok) {
    throw new Error(`Failed to fetch shots: ${res.status}`);
  }
  return await res.json();
}
