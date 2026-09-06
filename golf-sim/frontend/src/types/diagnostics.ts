export interface GSProListenerStatus {
  live: boolean;
  host: string;
  port: number;
  clients: number;
  shots_received: number;
  last_error: string | null;
}

export interface KinoveaHookStatus {
  live: boolean;
  endpoint: string;
  watcher_fallback: boolean;
  watch_dir: string;
}

export interface PhoneEndpointStatus {
  live: boolean;
  endpoint: string;
}

export interface HealthResponse {
  ok: boolean;
  session_id: string;
  listeners: {
    gspro_socket: GSProListenerStatus;
    kinovea_hook: KinoveaHookStatus;
    phone_endpoint: PhoneEndpointStatus;
    [key: string]: any;
  };
  pairing: {
    window_ms: number;
    late_attach_ms: number;
    open_shots: number;
  };
  ws_clients: number;
}

export interface SessionStartResponse {
  session_id: string;
  club: string | null;
  monitors_notified: number;
}

export interface ListenerToggleResponse {
  live: boolean;
  started: boolean;
  last_error: string | null;
}

export type WizardStepId = 
  | 'backend-connection'
  | 'launch-monitor'
  | 'kinovea-audio'
  | 'video-ingest'
  | 'supabase-cloud';

export interface WizardStep {
  id: WizardStepId;
  title: string;
  subtitle: string;
  status: 'pending' | 'success' | 'warning' | 'error';
}
