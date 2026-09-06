import React, { useState, useEffect } from 'react';
import { useShotStore } from '../../store/shotStore';
import { useThemeStore } from '../../store/themeStore';
import { fetchHealth, toggleListener } from '../../services/api';
import type { HealthResponse } from '../../types/diagnostics';
import { 
  Activity, 
  Radio, 
  Database, 
  Wrench, 
  Calendar, 
  Play,
  RotateCcw
} from 'lucide-react';

export const SystemStatusBar: React.FC = () => {
  const openSetupWizard = useShotStore((s) => s.openSetupWizard);
  const toggleSessionModal = useShotStore((s) => s.toggleSessionModal);
  const activeSessionId = useShotStore((s) => s.activeSessionId);
  const activeClub = useShotStore((s) => s.activeClub);
  const cloudSyncEnabled = useShotStore((s) => s.cloudSyncEnabled);
  const simulateLiveShotArrival = useShotStore((s) => s.simulateLiveShotArrival);
  const { currentTheme } = useThemeStore();
  const isBoutique = currentTheme === 'boutique';

  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      try {
        const h = await fetchHealth();
        if (mounted) setHealth(h);
      } catch {
        if (mounted) setHealth(null);
      }
    };
    check();
    const timer = setInterval(check, 5000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  const handleQuickToggleLM = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!health) return;
    const next = !health.listeners.gspro_socket.live;
    try {
      await toggleListener(next);
      const updated = await fetchHealth();
      setHealth(updated);
    } catch (err) {
      console.warn('Toggle failed:', err);
    }
  };

  return (
    <div className={`px-3 sm:px-4 py-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] select-none border-b transition-colors duration-300 ${
      isBoutique 
        ? 'bg-stone-950/80 backdrop-blur-md border-[#C5A880]/15 text-[#8E928F] font-serif' 
        : 'bg-[#080a11] border-neutral-900 text-neutral-400 font-mono'
    }`}>
      {/* Left System Feeds Status */}
      <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
        {/* Backend Ingest Service */}
        <div 
          onClick={openSetupWizard}
          className={`flex items-center gap-1.5 px-2.5 py-0.5 cursor-pointer transition-colors border ${
            isBoutique 
              ? 'rounded-full bg-stone-900/60 hover:bg-stone-800/80 border-[#C5A880]/20' 
              : 'rounded bg-neutral-900 hover:bg-neutral-800 border-neutral-800'
          }`}
          title="Click to open Studio Setup & Diagnostics"
        >
          <span className={`w-2 h-2 rounded-full ${health?.ok ? (isBoutique ? 'bg-[#D4AF37] animate-pulse' : 'bg-emerald-400 animate-pulse') : 'bg-amber-400'}`} />
          <span className={isBoutique ? 'text-[#8E928F]' : 'text-neutral-400'}>API:</span>
          <span className={health?.ok ? (isBoutique ? 'text-[#E5C07B] font-bold' : 'text-emerald-300 font-bold') : 'text-amber-300 font-bold'}>
            {health?.ok ? 'ONLINE (8000)' : 'DEV MOCK'}
          </span>
        </div>

        {/* Launch Monitor 921 */}
        <div 
          onClick={handleQuickToggleLM}
          className={`flex items-center gap-1.5 px-2.5 py-0.5 cursor-pointer transition-colors border ${
            isBoutique 
              ? 'rounded-full bg-stone-900/60 hover:bg-stone-800/80 border-[#C5A880]/20' 
              : 'rounded bg-neutral-900 hover:bg-neutral-800 border-neutral-800'
          }`}
          title="Click to toggle between Practice Mode & GSPro Course Play"
        >
          <Radio className={`w-3 h-3 ${health?.listeners.gspro_socket.live ? (isBoutique ? 'text-[#D4AF37]' : 'text-emerald-400') : (isBoutique ? 'text-stone-600' : 'text-neutral-500')}`} />
          <span className={isBoutique ? 'text-[#8E928F]' : 'text-neutral-400'}>LM (921):</span>
          <span className={health?.listeners.gspro_socket.live ? (isBoutique ? 'text-[#E5C07B] font-bold' : 'text-emerald-300 font-bold') : (isBoutique ? 'text-stone-500' : 'text-neutral-400')}>
            {health?.listeners.gspro_socket.live ? 'PRACTICE' : 'COURSE PLAY'}
          </span>
        </div>

        {/* Session Info */}
        <div 
          onClick={toggleSessionModal}
          className={`flex items-center gap-1.5 px-2.5 py-0.5 cursor-pointer transition-colors border ${
            isBoutique 
              ? 'rounded-full bg-stone-900/60 hover:bg-stone-800/80 border-[#C5A880]/20' 
              : 'rounded bg-neutral-900 hover:bg-neutral-800 border-neutral-800'
          }`}
          title="Click to manage session or switch active club"
        >
          <Calendar className={`w-3 h-3 ${isBoutique ? 'text-[#D4AF37]' : 'text-cyan-400'}`} />
          <span className={isBoutique ? 'text-[#8E928F]' : 'text-neutral-400'}>SESSION:</span>
          <span className={`font-bold ${isBoutique ? 'text-[#E5C07B]' : 'text-cyan-300'}`}>{activeSessionId}</span>
          <span className={`px-2 py-0.5 font-bold text-[10px] ${
            isBoutique ? 'rounded-full bg-stone-800 text-[#F4F4F2] border border-[#C5A880]/30' : 'rounded bg-neutral-800 text-white'
          }`}>{activeClub}</span>
        </div>

        {/* Cloud Sync Status */}
        <div 
          onClick={openSetupWizard}
          className={`flex items-center gap-1.5 px-2.5 py-0.5 cursor-pointer transition-colors border ${
            isBoutique 
              ? 'rounded-full bg-stone-900/60 hover:bg-stone-800/80 border-[#C5A880]/20' 
              : 'rounded bg-neutral-900 hover:bg-neutral-800 border-neutral-800'
          }`}
          title="Configure Supabase Cloud Sync in Setup Wizard"
        >
          <Database className={`w-3 h-3 ${cloudSyncEnabled ? (isBoutique ? 'text-[#D4AF37]' : 'text-emerald-400') : (isBoutique ? 'text-stone-600' : 'text-neutral-500')}`} />
          <span className={isBoutique ? 'text-[#8E928F]' : 'text-neutral-400'}>CLOUD:</span>
          <span className={cloudSyncEnabled ? (isBoutique ? 'text-[#E5C07B] font-bold' : 'text-emerald-300 font-bold') : (isBoutique ? 'text-stone-500' : 'text-neutral-500')}>
            {cloudSyncEnabled ? 'SUPABASE SYNCED' : 'LOCAL OFFLINE'}
          </span>
        </div>
      </div>

      {/* Right Quick Actions */}
      <div className="flex items-center gap-2 ml-auto">
        {/* Simulate Live Shot Test Button - metallic gradient in boutique mode */}
        <button
          onClick={simulateLiveShotArrival}
          className={`flex items-center gap-1 px-3 py-1 transition-all ${
            isBoutique 
              ? 'rounded-full bg-gradient-to-br from-[#E5C07B] to-[#C5A880] text-stone-900 font-bold shadow-md shadow-[#C5A880]/20 hover:brightness-105' 
              : 'rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
          }`}
          title="Simulate immediate live strike (50ms telemetry + 1.5s video arrival)"
        >
          <Play className="w-3 h-3 fill-current" />
          <span>Simulate Strike</span>
        </button>


        <button
          onClick={() => setShowDetails(!showDetails)}
          className={`flex items-center gap-1.5 px-2.5 py-0.5 transition-colors border ${
            isBoutique 
              ? 'rounded-full bg-stone-900/60 hover:bg-stone-800 border-[#C5A880]/30 text-[#F4F4F2]' 
              : 'rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700'
          }`}
        >
          <Activity className={`w-3 h-3 ${isBoutique ? 'text-[#D4AF37]' : 'text-blue-400'}`} />
          <span>Diag</span>
        </button>

        {/* Setup Wizard Button */}
        <button
          onClick={openSetupWizard}
          className={`flex items-center gap-1 px-3 py-1 transition-colors border ${
            isBoutique 
              ? 'rounded-full bg-stone-900/60 hover:bg-stone-800 border-[#C5A880]/30 text-[#F4F4F2]' 
              : 'rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700'
          }`}
        >
          <Wrench className={`w-3 h-3 ${isBoutique ? 'text-[#D4AF37]' : 'text-amber-400'}`} />
          <span>Studio Setup</span>
        </button>
      </div>

      {showDetails && health && (
        <div className={`w-full mt-2 p-2 border rounded text-[10px] ${
          isBoutique ? 'bg-stone-900/40 border-[#C5A880]/20' : 'bg-black/40 border-neutral-800'
        } grid grid-cols-1 md:grid-cols-3 gap-4`}>
          <div>
            <div className={`font-bold mb-1 ${isBoutique ? 'text-[#E5C07B]' : 'text-emerald-400'}`}>LM Socket (GSPro)</div>
            <div>Live: {health.listeners.gspro_socket.live ? 'Yes' : 'No'}</div>
            <div>Clients: {health.listeners.gspro_socket.clients}</div>
            {health.listeners.gspro_socket.clients > 0 && health.listeners.gspro_socket.shots_received === 0 && health.listeners.gspro_socket.heartbeats_received > 0 ? (
               <div className="text-amber-400 font-bold mt-1 mb-1">Status: Connected but idle (not receiving strikes)</div>
            ) : (
               <div className="mb-1">Status: {health.listeners.gspro_socket.clients > 0 ? 'Receiving data' : 'Waiting for connection'}</div>
            )}
            <div>Shots: {health.listeners.gspro_socket.shots_received} | Heartbeats: {health.listeners.gspro_socket.heartbeats_received} | Ignored: {health.listeners.gspro_socket.frames_ignored}</div>
            {health.listeners.gspro_socket.last_error && <div className="text-red-400 mt-1">Error: {health.listeners.gspro_socket.last_error}</div>}
            {health.listeners.gspro_socket.pass_through && (
              <div className="mt-2 pt-2 border-t border-neutral-700/50">
                <div className={`font-bold mb-1 ${isBoutique ? 'text-[#E5C07B]' : 'text-emerald-400'}`}>GSPro Pass-Through</div>
                <div>Enabled: {health.listeners.gspro_socket.pass_through.enabled ? 'Yes' : 'No'} | Target: {health.listeners.gspro_socket.pass_through.target || 'None'}</div>
                <div>Status: {health.listeners.gspro_socket.pass_through.active ? 'Active' : 'Idle'} | Forwarded: {health.listeners.gspro_socket.pass_through.frames_forwarded}</div>
                {health.listeners.gspro_socket.pass_through.last_error && <div className="text-red-400 mt-1">Fault: {health.listeners.gspro_socket.pass_through.last_error}</div>}
              </div>
            )}
          </div>
          <div>
            <div className={`font-bold mb-1 ${isBoutique ? 'text-[#E5C07B]' : 'text-emerald-400'}`}>Pose Worker</div>
            <div>Live: {health.listeners.pose_worker.live ? 'Yes' : 'No'} | Enabled: {health.listeners.pose_worker.enabled ? 'Yes' : 'No'}</div>
            <div>Model: {health.listeners.pose_worker.model}</div>
            <div>Reason: {health.listeners.pose_worker.reason}</div>
          </div>
          <div>
            <div className={`font-bold mb-1 ${isBoutique ? 'text-[#E5C07B]' : 'text-emerald-400'}`}>Correlator (Pairing)</div>
            <div>Window: {health.pairing.window_ms}ms | Late Attach: {health.pairing.late_attach_ms}ms</div>
            <div>Open Shots: {health.pairing.open_shots}</div>
          </div>
        </div>
      )}
    </div>
  );
};
