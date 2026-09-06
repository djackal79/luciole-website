import React, { useState, useEffect } from 'react';
import { useShotStore } from '../../store/shotStore';
import { fetchHealth, toggleListener } from '../../services/api';
import { 
  getStoredSupabaseConfig, 
  saveStoredSupabaseConfig, 
  testSupabaseConnection 
} from '../../services/supabase';
import { KinoveaChecklist } from './KinoveaChecklist';
import type { HealthResponse } from '../../types/diagnostics';
import { 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Activity, 
  Radio, 
  Video, 
  Database, 
  Sparkles, 
  RefreshCw,
  ToggleLeft,
  ToggleRight,
  Send,
  FolderOpen
} from 'lucide-react';

export const SetupWizardModal: React.FC = () => {
  const isSetupWizardOpen = useShotStore((s) => s.isSetupWizardOpen);
  const closeSetupWizard = useShotStore((s) => s.closeSetupWizard);
  const simulateLiveShotArrival = useShotStore((s) => s.simulateLiveShotArrival);
  const cloudSyncEnabled = useShotStore((s) => s.cloudSyncEnabled);
  const setCloudSyncEnabled = useShotStore((s) => s.setCloudSyncEnabled);

  const [activeStep, setActiveStep] = useState<number>(1);
  const [healthData, setHealthData] = useState<HealthResponse | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthError, setHealthError] = useState<string | null>(null);

  // Supabase form state
  const storedConfig = getStoredSupabaseConfig();
  const [supabaseUrl, setSupabaseUrl] = useState(storedConfig.url);
  const [supabaseKey, setSupabaseKey] = useState(storedConfig.anonKey);
  const [supabaseTesting, setSupabaseTesting] = useState(false);
  const [supabaseStatus, setSupabaseStatus] = useState<{ success?: boolean; message?: string } | null>(null);

  // Poll health on mount / modal open
  const loadHealth = async () => {
    setHealthLoading(true);
    setHealthError(null);
    try {
      const data = await fetchHealth();
      setHealthData(data);
    } catch (err: any) {
      setHealthError(err.message || 'Unable to connect to local FastAPI backend on port 8000');
    } finally {
      setHealthLoading(false);
    }
  };

  useEffect(() => {
    if (isSetupWizardOpen) {
      loadHealth();
    }
  }, [isSetupWizardOpen]);

  const handleToggleLM = async () => {
    if (!healthData) return;
    const currentLive = healthData.listeners.gspro_socket.live;
    try {
      await toggleListener(!currentLive);
      await loadHealth();
    } catch (err) {
      console.warn('Listener toggle error:', err);
    }
  };

  const handleTestSupabase = async () => {
    setSupabaseTesting(true);
    setSupabaseStatus(null);
    const res = await testSupabaseConnection(supabaseUrl, supabaseKey);
    setSupabaseStatus(res);
    setSupabaseTesting(false);
    if (res.success) {
      saveStoredSupabaseConfig(supabaseUrl, supabaseKey, true);
      setCloudSyncEnabled(true);
    }
  };

  if (!isSetupWizardOpen) return null;

  const steps = [
    { num: 1, title: 'Backend Service', icon: Activity },
    { num: 2, title: 'Launch Monitor', icon: Radio },
    { num: 3, title: 'Kinovea Setup', icon: Video },
    { num: 4, title: 'Video Ingestion', icon: Sparkles },
    { num: 5, title: 'Supabase Cloud', icon: Database },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-5">
      <div className="relative w-full max-w-2xl bg-[#0b0e17] border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800 bg-[#0e111c]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold font-mono">
              🛠️
            </div>
            <div>
              <h2 className="text-sm font-mono font-bold text-white uppercase tracking-wider">
                Studio Setup & Diagnostic Wizard
              </h2>
              <p className="text-[11px] font-mono text-neutral-400">
                Self-serve calibration for Launch Monitor, Cameras & Cloud Database
              </p>
            </div>
          </div>
          <button
            onClick={closeSetupWizard}
            className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Indicator Bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-800/80 bg-neutral-900/40 overflow-x-auto gap-2">
          {steps.map((s) => {
            const Icon = s.icon;
            const isActive = activeStep === s.num;
            return (
              <button
                key={s.num}
                onClick={() => setActiveStep(s.num)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-emerald-500 text-black font-bold shadow-md shadow-emerald-500/20'
                    : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{s.num}. {s.title}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Content Body */}
        <div className="p-5 overflow-y-auto flex-1 font-mono text-xs">
          {/* STEP 1: Backend Connection */}
          {activeStep === 1 && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-900/80 border border-neutral-800">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${healthData?.ok ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
                  <div>
                    <div className="font-bold text-white">Local Ingest Service (FastAPI)</div>
                    <div className="text-[11px] text-neutral-400">http://127.0.0.1:8000/api/health</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                    healthData?.ok ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  }`}>
                    {healthData?.ok ? 'HEALTHY (200 OK)' : 'OFFLINE (FALLBACK MOCK ACTIVE)'}
                  </span>
                  <button
                    onClick={loadHealth}
                    disabled={healthLoading}
                    className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300"
                    title="Refresh connection"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${healthLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {healthError && (
                <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-900/50 text-rose-300 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div className="text-[11px] leading-relaxed">
                    <span className="font-bold">Backend offline.</span> Ensure FastAPI is running on port 8000:
                    <pre className="mt-1 p-2 bg-black/60 rounded text-emerald-400">uvicorn backend.main:app --port 8000</pre>
                    <em>The dashboard is currently operating smoothly using built-in realistic mock data.</em>
                  </div>
                </div>
              )}

              {healthData && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-neutral-900/50 border border-neutral-800">
                    <span className="text-[10px] text-neutral-500">ACTIVE SESSION</span>
                    <div className="font-bold text-white mt-0.5">{healthData.session_id}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-neutral-900/50 border border-neutral-800">
                    <span className="text-[10px] text-neutral-500">PAIRING WINDOW</span>
                    <div className="font-bold text-emerald-400 mt-0.5">±{healthData.pairing.window_ms}ms</div>
                  </div>
                  <div className="p-3 rounded-xl bg-neutral-900/50 border border-neutral-800">
                    <span className="text-[10px] text-neutral-500">WS CLIENTS</span>
                    <div className="font-bold text-cyan-400 mt-0.5">{healthData.ws_clients} connected</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Launch Monitor Socket */}
          {activeStep === 2 && (
            <div className="flex flex-col gap-4">
              <div className="p-3 rounded-xl bg-neutral-900/80 border border-neutral-800 flex items-center justify-between">
                <div>
                  <div className="font-bold text-white flex items-center gap-2">
                    <span>GSPro Open Connect v1 Listener</span>
                    <span className="px-2 py-0.5 rounded text-[10px] bg-neutral-800 text-neutral-400">127.0.0.1:921</span>
                  </div>
                  <div className="text-[11px] text-neutral-400 mt-1">
                    Square Golf & Launch Monitors stream JSON shot packets over UDP/TCP port 921
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded text-[10px] font-bold ${
                    healthData?.listeners.gspro_socket.live ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                  }`}>
                    {healthData?.listeners.gspro_socket.live ? 'LISTENING (PRACTICE MODE)' : 'MUTED / COURSE PLAY'}
                  </span>
                  <button
                    onClick={handleToggleLM}
                    className="px-3 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs transition-colors"
                  >
                    Toggle Socket
                  </button>
                </div>
              </div>

              <div className="bg-neutral-900/40 p-3 rounded-xl border border-neutral-800/80 text-[11px] text-neutral-300 space-y-2">
                <div className="font-bold text-white">Listener Mode Guidance:</div>
                <p>
                  • <strong>Practice Monitor Mode</strong>: Golf Studio binds port 921 directly to capture ball speed, spin axis, and club telemetry instantly.
                </p>
                <p>
                  • <strong>Course Play Mode (GSPro Running)</strong>: When playing an actual simulator course, GSPro itself binds port 921. Toggle off this listener to prevent port conflicts while continuing to capture synchronized cameras!
                </p>
              </div>
            </div>
          )}

          {/* STEP 3: Kinovea Setup Checklist */}
          {activeStep === 3 && <KinoveaChecklist />}

          {/* STEP 4: Video Ingestion Check */}
          {activeStep === 4 && (
            <div className="flex flex-col gap-4">
              <div className="p-3 rounded-xl bg-neutral-900/80 border border-neutral-800 flex items-center justify-between">
                <div>
                  <div className="font-bold text-white flex items-center gap-2">
                    <FolderOpen className="w-4 h-4 text-cyan-400" />
                    <span>Watch Directory & Video Receiver</span>
                  </div>
                  <div className="text-[11px] text-neutral-400 mt-1">
                    Export Directory: <code className="text-emerald-400">{healthData?.listeners.kinovea_hook.watch_dir || 'data/shots'}</code>
                  </div>
                </div>
                <span className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                  ACTIVE
                </span>
              </div>

              <div className="p-4 rounded-xl bg-neutral-900/40 border border-neutral-800 flex flex-col gap-2.5">
                <div className="font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>Pipeline Live Test</span>
                </div>
                <p className="text-neutral-400 text-[11px] leading-relaxed">
                  Fire a test shot package to verify real-time ingestion: this simulates a launch monitor trigger landing in 50ms, followed 1.5 seconds later by video synchronization.
                </p>
                <button
                  onClick={() => {
                    simulateLiveShotArrival();
                    closeSetupWizard();
                  }}
                  className="mt-2 flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold transition-colors"
                >
                  <Send className="w-4 h-4" />
                  <span>Simulate Live Strike & Video Arrival</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: Supabase Cloud Sync */}
          {activeStep === 5 && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-900/80 border border-neutral-800">
                <div>
                  <div className="font-bold text-white flex items-center gap-2">
                    <Database className="w-4 h-4 text-emerald-400" />
                    <span>Supabase Cloud Database Persistence</span>
                  </div>
                  <div className="text-[11px] text-neutral-400 mt-0.5">
                    Sync shot history, high-speed replay video URLs, and bag telemetry to your cloud database
                  </div>
                </div>

                <button
                  onClick={() => setCloudSyncEnabled(!cloudSyncEnabled)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                    cloudSyncEnabled ? 'bg-emerald-500 text-black' : 'bg-neutral-800 text-neutral-400'
                  }`}
                >
                  {cloudSyncEnabled ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                  <span>{cloudSyncEnabled ? 'Cloud Sync ON' : 'Local Offline Mode'}</span>
                </button>
              </div>

              <div className="space-y-3 p-4 rounded-xl bg-neutral-900/40 border border-neutral-800">
                <div>
                  <label className="block text-[11px] text-neutral-400 mb-1">SUPABASE URL</label>
                  <input
                    type="text"
                    value={supabaseUrl}
                    onChange={(e) => setSupabaseUrl(e.target.value)}
                    placeholder="https://xyzcompany.supabase.co"
                    className="w-full bg-black/60 border border-neutral-800 focus:border-emerald-500 rounded-lg p-2 text-white font-mono text-xs focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-neutral-400 mb-1">SUPABASE ANON KEY</label>
                  <input
                    type="password"
                    value={supabaseKey}
                    onChange={(e) => setSupabaseKey(e.target.value)}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    className="w-full bg-black/60 border border-neutral-800 focus:border-emerald-500 rounded-lg p-2 text-white font-mono text-xs focus:outline-none"
                  />
                </div>

                <div className="pt-2 flex items-center gap-3">
                  <button
                    onClick={handleTestSupabase}
                    disabled={supabaseTesting}
                    className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-bold text-xs transition-colors flex items-center gap-2"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${supabaseTesting ? 'animate-spin' : ''}`} />
                    <span>Test Cloud Connection</span>
                  </button>

                  {supabaseStatus && (
                    <span className={`text-xs ${supabaseStatus.success ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {supabaseStatus.message}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-neutral-800 bg-[#0e111c]">
          <button
            onClick={() => setActiveStep(prev => Math.max(1, prev - 1))}
            disabled={activeStep === 1}
            className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 text-neutral-300 font-mono text-xs transition-colors"
          >
            ← Previous
          </button>

          <span className="text-[11px] font-mono text-neutral-500">Step {activeStep} of 5</span>

          {activeStep < 5 ? (
            <button
              onClick={() => setActiveStep(prev => Math.min(5, prev + 1))}
              className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-mono font-bold text-xs transition-colors"
            >
              Next Step →
            </button>
          ) : (
            <button
              onClick={closeSetupWizard}
              className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-mono font-bold text-xs transition-colors"
            >
              Finish & Return to Studio
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
