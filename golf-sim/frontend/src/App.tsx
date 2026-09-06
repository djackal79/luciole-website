import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useShotStore } from './store/shotStore';
import { usePlayerStore } from './store/playerStore';
import { useThemeStore } from './store/themeStore';
import { initWebSocket } from './services/wsClient';
import { Header } from './components/common/Header';
import { MultiCameraPlayer } from './components/player/MultiCameraPlayer';
import { Biomechanical3DModel } from './components/player/Biomechanical3DModel';
import { PressureMatVisualizer } from './components/player/PressureMatVisualizer';
import { PlaybackControls } from './components/player/PlaybackControls';
import { TelemetryHUD } from './components/hud';
import { HistoryDrawer } from './components/history/HistoryDrawer';
import { SetupWizardModal } from './components/wizard/SetupWizardModal';
import { SessionControlsModal } from './components/diagnostics/SessionControlsModal';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export const AppContent: React.FC = () => {
  const currentShot = useShotStore((s) => s.getCurrentShot());
  const toggleHistoryDrawer = useShotStore((s) => s.toggleHistoryDrawer);
  const { currentTheme } = useThemeStore();
  const isBoutique = currentTheme === 'boutique';

  const {
    activeTab,
    togglePlay,
    stepFrames,
    jumpToImpact,
    toggleLoop,
    toggleLayoutMode,
  } = usePlayerStore();

  // Active container_fps for frame stepping per Trap #1
  const bodyContainerFps = currentShot?.media.body_swing?.container_fps ?? null;
  const impactContainerFps = currentShot?.media.impact_strike?.container_fps ?? null;
  const containerFps = bodyContainerFps ?? impactContainerFps ?? 30.0;

  // Initialize WebSocket connection to backend on mount
  useEffect(() => {
    initWebSocket();
  }, []);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing inside input or textarea
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          stepFrames(-1, containerFps);
          break;
        case 'ArrowRight':
          e.preventDefault();
          stepFrames(1, containerFps);
          break;
        case 'KeyI':
          e.preventDefault();
          jumpToImpact();
          break;
        case 'KeyL':
          e.preventDefault();
          toggleLoop();
          break;
        case 'KeyS':
          e.preventDefault();
          toggleLayoutMode();
          break;
        case 'KeyH':
          e.preventDefault();
          toggleHistoryDrawer();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, stepFrames, jumpToImpact, toggleLoop, toggleLayoutMode, toggleHistoryDrawer, containerFps]);

  return (
    <div className={`min-h-screen relative font-sans transition-colors duration-300 ${
      isBoutique 
        ? "bg-[url('https://images.unsplash.com/photo-1587329310686-91414b8e3cb7')] bg-cover bg-center bg-fixed text-[#F4F4F2] selection:bg-[#C5A880] selection:text-stone-900" 
        : "bg-[#07090e] text-neutral-200 selection:bg-emerald-500 selection:text-black"
    }`}>
      {/* Ambient golf course background overlay for Boutique Studio */}
      {isBoutique && (
        <div className="fixed inset-0 bg-stone-950/85 pointer-events-none z-0" />
      )}

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Top Header & Diagnostics Bar */}
        <Header />

        {/* Main Studio Viewport */}
        <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5 flex flex-col gap-5">
          {/* Dynamic Studio Stage based on activeTab */}
          <section className="flex flex-col gap-3">
            {activeTab === 'cameras' && <MultiCameraPlayer />}
            {activeTab === '3d-model' && <Biomechanical3DModel />}
            {activeTab === 'pressure-mat' && <PressureMatVisualizer />}
            {activeTab === 'all-in-one' && (
              <div className="flex flex-col gap-4">
                <MultiCameraPlayer />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <Biomechanical3DModel />
                  <PressureMatVisualizer />
                </div>
              </div>
            )}

            {/* Unified Timeline & Transport Controls */}
            <PlaybackControls />
          </section>

          {/* Launch Monitor Telemetry HUD & Vector Visualizers */}
          <section>
            <TelemetryHUD />
          </section>

          {/* Keyboard Shortcuts Hint */}
          <footer className={`mt-auto py-3 text-center text-xs flex flex-wrap items-center justify-center gap-4 border-t transition-colors ${
            isBoutique ? 'border-[#C5A880]/20 text-[#8E928F] font-serif' : 'border-neutral-900 text-neutral-500 font-mono'
          }`}>
            <span>Keyboard Shortcuts:</span>
            <span><kbd className={`px-2 py-0.5 ${isBoutique ? 'rounded-full bg-stone-900/60 text-[#F4F4F2] border border-[#C5A880]/30 font-mono' : 'rounded bg-neutral-800 text-neutral-300 font-mono'}`}>Space</kbd> Play/Pause</span>
            <span><kbd className={`px-2 py-0.5 ${isBoutique ? 'rounded-full bg-stone-900/60 text-[#F4F4F2] border border-[#C5A880]/30 font-mono' : 'rounded bg-neutral-800 text-neutral-300 font-mono'}`}>← / →</kbd> ±1 Frame ({containerFps}fps)</span>
            <span><kbd className={`px-2 py-0.5 ${isBoutique ? 'rounded-full bg-stone-900/60 text-[#F4F4F2] border border-[#C5A880]/30 font-mono' : 'rounded bg-neutral-800 text-neutral-300 font-mono'}`}>I</kbd> Snap Impact</span>
            <span><kbd className={`px-2 py-0.5 ${isBoutique ? 'rounded-full bg-stone-900/60 text-[#F4F4F2] border border-[#C5A880]/30 font-mono' : 'rounded bg-neutral-800 text-neutral-300 font-mono'}`}>S</kbd> View Mode</span>
            <span><kbd className={`px-2 py-0.5 ${isBoutique ? 'rounded-full bg-stone-900/60 text-[#F4F4F2] border border-[#C5A880]/30 font-mono' : 'rounded bg-neutral-800 text-neutral-300 font-mono'}`}>H</kbd> History Drawer</span>
          </footer>
        </main>

        {/* Slide-out Session History Drawer */}
        <HistoryDrawer />

        {/* Setup & Diagnostics Wizard Modal */}
        <SetupWizardModal />

        {/* Session Management Modal */}
        <SessionControlsModal />
      </div>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
};

export default App;
