import type { HealthResponse, SessionStartResponse, ListenerToggleResponse } from '../types/diagnostics';
import type { ShotPatch, ShotPackage } from '../types/contract';

const BACKEND_URL = ''; // Proxied by Vite in dev mode

export async function fetchHealth(): Promise<HealthResponse> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/health`);
    if (res.ok) return await res.json();
  } catch {
    // try fallback route
  }
  const fallbackRes = await fetch(`${BACKEND_URL}/health`);
  if (!fallbackRes.ok) {
    throw new Error(`Health check failed with status ${fallbackRes.status}`);
  }
  return await fallbackRes.json();
}

export async function startSession(sessionId?: string, club?: string): Promise<SessionStartResponse> {
  const payload = { session_id: sessionId, club };
  try {
    const res = await fetch(`${BACKEND_URL}/api/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) return await res.json();
  } catch {
    // fallback
  }
  const fallbackRes = await fetch(`${BACKEND_URL}/session/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!fallbackRes.ok) {
    throw new Error(`Start session failed with status ${fallbackRes.status}`);
  }
  return await fallbackRes.json();
}

export async function endSession(): Promise<{ ended_session_id: string; new_session_id: string; ok: boolean }> {
  try {
    const res = await fetch(`${BACKEND_URL}/session/end`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (res.ok) return await res.json();
  } catch {
    // fallback
  }
  return { ended_session_id: 'session-ended', new_session_id: 'new-session', ok: true };
}

export async function toggleListener(enabled: boolean): Promise<ListenerToggleResponse> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/listeners/gspro?enabled=${enabled}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (res.ok) return await res.json();
  } catch {
    // fallback
  }
  const fallbackRes = await fetch(`${BACKEND_URL}/listener/toggle?enabled=${enabled}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  if (!fallbackRes.ok) {
    throw new Error(`Toggle listener failed: ${fallbackRes.status}`);
  }
  return await fallbackRes.json();
}

export async function patchShotRemote(shotId: string, patch: ShotPatch): Promise<void> {
  await fetch(`${BACKEND_URL}/api/shots/${shotId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch)
  });
}

export async function fetchShots(): Promise<ShotPackage[]> {
  const res = await fetch(`${BACKEND_URL}/api/shots`);
  if (!res.ok) {
    throw new Error(`Failed to fetch shots: ${res.status}`);
  }
  return await res.json();
}

