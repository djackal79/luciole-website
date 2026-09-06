import React, { useState } from 'react';
import { useShotStore } from '../../store/shotStore';
import { useThemeStore } from '../../store/themeStore';
import { SystemStatusBar } from '../diagnostics/SystemStatusBar';
import { Sparkles, ChevronDown, History, Activity, Zap, Landmark } from 'lucide-react';

export const Header: React.FC = () => {
  const {
    shots,
    wsStatus,
    isHistoryDrawerOpen,
    toggleHistoryDrawer,
    loadScenario,
  } = useShotStore();

  const { currentTheme, toggleTheme } = useThemeStore();

  const [showScenarios, setShowScenarios] = useState(false);

  const scenarioNames = [
    'Scenario 1: Complete — 3 Cameras + Ball & Club Data',
    'Scenario 2: Partial — Body + Telemetry (Phone Missed)',
    'Scenario 3: Partial — Both Videos, No Telemetry (LM Disconnected)',
    'Scenario 4: Complete — Ball Data Only (ContainsClubData: false)',
    'Scenario 5: Complete — Heavy Draw (Spin Axis -16.7°, Face-to-Path -6.0°)',
  ];

  const isBoutique = currentTheme === 'boutique';

  return (
    <header className="sticky top-0 z-40 backdrop-blur-md flex flex-col transition-colors duration-300">
      {/* Live System Diagnostics Quick Bar */}
      <SystemStatusBar />

      {/* Main Studio Navigation Bar */}
      <div className={`border-b px-4 py-2.5 transition-colors duration-300 ${
        isBoutique 
          ? 'bg-stone-950/70 backdrop-blur-lg border-[#C5A880]/20 text-[#F4F4F2]' 
          : 'bg-[#090b12]/95 border-neutral-800/80 text-neutral-200'
      }`}>
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Branding */}
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 flex items-center justify-center font-black text-lg transition-all ${
              isBoutique 
                ? 'rounded-full bg-gradient-to-tr from-[#E5C07B] to-[#C5A880] text-stone-900 shadow-lg shadow-[#C5A880]/25' 
                : 'rounded-xl bg-gradient-to-tr from-emerald-500 to-cyan-500 text-black shadow-lg shadow-emerald-500/20 font-mono'
            }`}>
              ⛳
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className={`text-base font-black tracking-wider uppercase ${
                  isBoutique ? 'font-serif text-[#F4F4F2]' : 'font-mono text-white'
                }`}>
                  GOLF STUDIO
                </h1>
                <span className={`px-2 py-0.5 text-[10px] transition-colors ${
                  isBoutique 
                    ? 'rounded-full bg-[#D4AF37]/20 border border-[#D4AF37]/50 text-[#E5C07B] font-serif font-bold' 
                    : 'rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-mono'
                }`}>
                  {isBoutique ? 'Heritage Edition' : 'Build 2.0'}
                </span>
              </div>
              <p className={`text-[11px] ${isBoutique ? 'font-serif text-[#8E928F]' : 'font-mono text-neutral-400'}`}>
                3-Camera Replay • 3D Biomechanics • Pressure Mat • Launch Telemetry
              </p>
            </div>
          </div>

          {/* Status Badge & Actions */}
          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
            {/* Theme Toggle Pill */}
            <button
              onClick={toggleTheme}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold transition-all ${
                isBoutique
                  ? 'rounded-full bg-gradient-to-br from-[#E5C07B] to-[#C5A880] text-stone-900 font-bold shadow-md shadow-[#C5A880]/25 hover:brightness-105 font-serif'
                  : 'rounded-lg bg-neutral-900 border border-neutral-700 text-cyan-300 hover:border-cyan-400 font-mono'
              }`}
              title={`Switch to ${isBoutique ? 'Cyber HUD' : 'Boutique Studio'} Theme`}
            >
              {isBoutique ? (
                <>
                  <Landmark className="w-3.5 h-3.5 text-stone-950" />
                  <span>Boutique Studio</span>
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Cyber HUD</span>
                </>
              )}
            </button>

            {/* Connection Status Pill */}
            <div>
              {wsStatus === 'connected' ? (
                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs ${
                  isBoutique 
                    ? 'bg-stone-900/60 border-[#C5A880]/30 text-[#E5C07B] font-serif' 
                    : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400 font-mono'
                }`}>
                  <span className={`w-2 h-2 rounded-full animate-pulse ${isBoutique ? 'bg-[#D4AF37]' : 'bg-emerald-400'}`} />
                  <span>LIVE WS: CONNECTED</span>
                </div>
              ) : wsStatus === 'connecting' ? (
                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs ${
                  isBoutique 
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 font-serif' 
                    : 'bg-amber-500/15 border-amber-500/40 text-amber-400 font-mono'
                }`}>
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  <span>CONNECTING ws://...</span>
                </div>
              ) : (
                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs ${
                  isBoutique
                    ? 'bg-stone-900/60 border-[#C5A880]/20 text-[#8E928F] font-serif'
                    : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400 font-mono'
                }`}>
                  <Activity className="w-3.5 h-3.5" />
                  <span>MOCK DEV MODE</span>
                </div>
              )}
            </div>

            {/* Contract Scenarios Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowScenarios(!showScenarios)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 border text-xs transition-colors ${
                  isBoutique 
                    ? 'rounded-full bg-stone-900/60 hover:bg-stone-800/80 border-[#C5A880]/30 text-[#F4F4F2] font-serif' 
                    : 'rounded-lg bg-neutral-900 hover:bg-neutral-800 border-neutral-700 text-neutral-200 font-mono'
                }`}
              >
                <Sparkles className={`w-3.5 h-3.5 ${isBoutique ? 'text-[#D4AF37]' : 'text-amber-400'}`} />
                <span>Test Scenarios</span>
                <ChevronDown className="w-3 h-3" />
              </button>

              {showScenarios && (
                <div className={`absolute right-0 top-full mt-1.5 w-80 shadow-2xl p-1.5 z-50 ${
                  isBoutique 
                    ? 'bg-stone-900/90 backdrop-blur-lg border border-[#C5A880]/30 text-[#F4F4F2] rounded-2xl font-serif' 
                    : 'bg-[#0e121d] border border-neutral-700 text-neutral-300 rounded-lg font-mono'
                }`}>
                  <div className={`px-2.5 py-1.5 text-[10px] uppercase border-b ${
                    isBoutique ? 'text-[#8E928F] border-[#C5A880]/20 font-serif' : 'text-neutral-500 border-neutral-800 font-mono'
                  }`}>
                    Select Test Scenario:
                  </div>
                  {scenarioNames.map((name, idx) => (
                    <button
                      key={name}
                      onClick={() => {
                        loadScenario(idx);
                        setShowScenarios(false);
                      }}
                      className={`w-full text-left px-2.5 py-2 text-xs transition-colors block border-b last:border-b-0 ${
                        isBoutique
                          ? 'rounded-xl text-[#F4F4F2] hover:bg-stone-800/80 hover:text-[#E5C07B] border-[#C5A880]/15'
                          : 'rounded text-neutral-300 hover:bg-neutral-800 hover:text-emerald-400 border-neutral-800/40'
                      }`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* History Drawer Toggle Button */}
            <button
              onClick={toggleHistoryDrawer}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 border text-xs font-semibold transition-colors ${
                isBoutique
                  ? 'rounded-full bg-stone-900/60 hover:bg-stone-800 border-[#C5A880]/30 text-[#F4F4F2] font-serif'
                  : 'rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white font-mono'
              }`}
            >
              <History className={`w-3.5 h-3.5 ${isBoutique ? 'text-[#D4AF37]' : 'text-emerald-400'}`} />
              <span>History</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                isBoutique ? 'bg-[#D4AF37]/20 border border-[#D4AF37]/40 text-[#E5C07B]' : 'bg-neutral-800 text-emerald-400'
              }`}>
                {shots.length}
              </span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
