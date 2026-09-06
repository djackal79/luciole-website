import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { ShotPackage } from '../types/contract';

const STORAGE_SUPABASE_URL_KEY = 'golf_studio_supabase_url';
const STORAGE_SUPABASE_ANON_KEY = 'golf_studio_supabase_anon_key';
const STORAGE_CLOUD_SYNC_ENABLED = 'golf_studio_cloud_sync_enabled';

export function getStoredSupabaseConfig() {
  const metaEnv = (import.meta as any).env || {};
  const url = localStorage.getItem(STORAGE_SUPABASE_URL_KEY) || (metaEnv.VITE_SUPABASE_URL as string) || '';
  const anonKey = localStorage.getItem(STORAGE_SUPABASE_ANON_KEY) || (metaEnv.VITE_SUPABASE_ANON_KEY as string) || '';
  const isEnabled = localStorage.getItem(STORAGE_CLOUD_SYNC_ENABLED) === 'true';
  return { url, anonKey, isEnabled };
}

export function saveStoredSupabaseConfig(url: string, anonKey: string, isEnabled: boolean) {
  localStorage.setItem(STORAGE_SUPABASE_URL_KEY, url.trim());
  localStorage.setItem(STORAGE_SUPABASE_ANON_KEY, anonKey.trim());
  localStorage.setItem(STORAGE_CLOUD_SYNC_ENABLED, String(isEnabled));
  // Reset cached client
  cachedClient = null;
}

let cachedClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (cachedClient) return cachedClient;

  const { url, anonKey, isEnabled } = getStoredSupabaseConfig();
  if (!isEnabled || !url || !anonKey) {
    return null;
  }

  try {
    cachedClient = createClient(url, anonKey);
    return cachedClient;
  } catch (err) {
    console.warn('[Supabase] Client init failed:', err);
    return null;
  }
}

export async function testSupabaseConnection(url: string, anonKey: string): Promise<{ success: boolean; message: string }> {
  if (!url || !anonKey) {
    return { success: false, message: 'URL and Anon Key are required.' };
  }
  try {
    const testClient = createClient(url, anonKey);
    // Ping with a lightweight query
    const { error } = await testClient.from('sessions').select('count', { count: 'exact', head: true });
    if (error && error.code !== 'PGRST116') {
      // If table doesn't exist yet, it's still reachable as long as auth worked
      if (error.message.includes('relation "sessions" does not exist')) {
        return { success: true, message: 'Connected to Supabase! (Note: "sessions" table not yet migrated, will create on first sync).' };
      }
      return { success: false, message: error.message };
    }
    return { success: true, message: 'Connected successfully to Supabase cloud instance!' };
  } catch (err: any) {
    return { success: false, message: err.message || 'Connection failed.' };
  }
}

export async function fetchCloudHistory(sessionId?: string): Promise<ShotPackage[]> {
  const client = getSupabaseClient();
  if (!client) return [];

  try {
    let query = client.from('shots').select('*').order('created_at', { ascending: false });
    if (sessionId) {
      query = query.eq('session_id', sessionId);
    }
    const { data, error } = await query.limit(50);
    if (error) {
      console.warn('[Supabase Read] Error querying cloud history:', error.message);
      return [];
    }
    return (data || []) as ShotPackage[];
  } catch (err) {
    console.warn('[Supabase Read] Cloud history query failed:', err);
    return [];
  }
}

export async function fetchCloudSessionStats(): Promise<{ totalShots: number; avgBallSpeed: number; avgCarry: number } | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('shots')
      .select('telemetry')
      .limit(100);

    if (error || !data) return null;

    let validBallSpeeds = 0;
    let sumBallSpeed = 0;
    let validCarries = 0;
    let sumCarry = 0;

    data.forEach((row: any) => {
      const ballSpeed = row?.telemetry?.ball?.ball_speed_mph;
      const carry = row?.telemetry?.distance?.carry_distance_yds;
      if (typeof ballSpeed === 'number') {
        validBallSpeeds++;
        sumBallSpeed += ballSpeed;
      }
      if (typeof carry === 'number') {
        validCarries++;
        sumCarry += carry;
      }
    });

    return {
      totalShots: data.length,
      avgBallSpeed: validBallSpeeds > 0 ? sumBallSpeed / validBallSpeeds : 0,
      avgCarry: validCarries > 0 ? sumCarry / validCarries : 0
    };
  } catch (err) {
    console.warn('[Supabase Read] Cloud stats query failed:', err);
    return null;
  }
}

