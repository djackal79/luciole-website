import React from 'react';
import { useShotStore } from '../../store/shotStore';
import { usePlayerStore, PlaybackRate } from '../../store/playerStore';
import { useThemeStore } from '../../store/themeStore';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Repeat, 
  ChevronLeft, 
  ChevronRight, 
  Volume2, 
  VolumeX, 
  Columns, 
  PictureInPicture2,
  Crosshair,
  Sliders,
  Zap
} from 'lucide-react';

export const PlaybackControls: React.FC = () => {
  const currentShot = useShotStore((s) => s.getCurrentShot());
  const patchShot = useShotStore((s) => s.patchShot);
  const { currentTheme } = useThemeStore();
  const isBoutique = currentTheme === 'boutique';

  const {
    isPlaying,
    currentTime,
    duration,
    playbackRate,
    isLooping,
    layoutMode,
    isMuted,
    activeTab,
    setActiveTab,
    togglePlay,
    seekTo,
    stepFrames,
    setPlaybackRate,
    toggleLoop,
    toggleLayoutMode,
    toggleMute,
    jumpToImpact,
    masterImpactTime,
  } = usePlayerStore();

  const speedOptions: PlaybackRate[] = [0.1, 0.25, 0.5, 1.0];
  const impactTime = masterImpactTime;
  const progressPercent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const impactPercent = duration > 0 ? Math.min(100, (impactTime / duration) * 100) : 61.25;

  // Active container_fps for frame stepping per Trap #1
  const bodyContainerFps = currentShot?.media.body_swing?.container_fps ?? null;
  const impactContainerFps = currentShot?.media.impact_strike?.container_fps ?? null;
  const containerFps = bodyContainerFps ?? impactContainerFps ?? 30.0;

  // Capture fps for real-time duration readout per Trap #1
  const impactCaptureFps = currentShot?.media.impact_strike?.capture_fps ?? 240.0;

  const currentOffsetMs = currentShot?.sync.impact_offset_ms ?? 0;

  const formatTime = (time: number) => {
    const s = Math.floor(time);
    const ms = Math.floor((time - s) * 100);
    return `${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}s`;
  };

  const handleOffsetChange = (newOffset: number) => {
    if (!currentShot) return;
    patchShot(currentShot.shot_id, { impact_offset_ms: newOffset });
  };

  return (
    <div className={`p-3 sm:p-4 shadow-2xl flex flex-col gap-3 transition-colors duration-300 ${
      isBoutique 
        ? 'bg-stone-900/40 backdrop-blur-lg border border-[#C5A880]/20 shadow-xl rounded-2xl text-[#F4F4F2]' 
        : 'bg-[#0e111a]/95 border border-neutral-800/80 rounded-xl backdrop-blur-md text-neutral-200 font-mono'
    }`}>
      {/* Studio View Navigation Tabs */}
      <div className={`flex items-center justify-between border-b pb-2.5 ${
        isBoutique ? 'border-[#C5A880]/15' : 'border-neutral-800/80'
      }`}>
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          <button
            onClick={() => setActiveTab('cameras')}
            className={`px-3.5 py-1 text-xs transition-all ${
              activeTab === 'cameras'
                ? (isBoutique ? 'rounded-full bg-gradient-to-br from-[#E5C07B] to-[#C5A880] text-stone-900 font-serif font-bold shadow-md shadow-[#C5A880]/25' : 'rounded-lg bg-emerald-500 text-black shadow-md shadow-emerald-500/20 font-semibold font-mono')
                : (isBoutique ? 'rounded-full bg-stone-900/60 text-[#8E928F] hover:text-white border border-[#C5A880]/20 font-serif' : 'rounded-lg bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800 font-mono')
            }`}
          >
            🎥 3-Camera Replay
          </button>
          <button
            onClick={() => setActiveTab('3d-model')}
            className={`px-3.5 py-1 text-xs transition-all ${
              activeTab === '3d-model'
                ? (isBoutique ? 'rounded-full bg-gradient-to-br from-[#E5C07B] to-[#C5A880] text-stone-900 font-serif font-bold shadow-md shadow-[#C5A880]/25' : 'rounded-lg bg-cyan-400 text-black shadow-md shadow-cyan-400/20 font-semibold font-mono')
                : (isBoutique ? 'rounded-full bg-stone-900/60 text-[#8E928F] hover:text-white border border-[#C5A880]/20 font-serif' : 'rounded-lg bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800 font-mono')
            }`}
          >
            🧊 3D Swing Model
          </button>
          <button
            onClick={() => setActiveTab('pressure-mat')}
            className={`px-3.5 py-1 text-xs transition-all ${
              activeTab === 'pressure-mat'
                ? (isBoutique ? 'rounded-full bg-gradient-to-br from-[#E5C07B] to-[#C5A880] text-stone-900 font-serif font-bold shadow-md shadow-[#C5A880]/25' : 'rounded-lg bg-amber-400 text-black shadow-md shadow-amber-400/20 font-semibold font-mono')
                : (isBoutique ? 'rounded-full bg-stone-900/60 text-[#8E928F] hover:text-white border border-[#C5A880]/20 font-serif' : 'rounded-lg bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800 font-mono')
            }`}
          >
            👣 Force & Pressure Mat
          </button>
          <button
            onClick={() => setActiveTab('all-in-one')}
            className={`px-3.5 py-1 text-xs transition-all ${
              activeTab === 'all-in-one'
                ? (isBoutique ? 'rounded-full bg-stone-200 text-stone-900 font-serif font-bold shadow-md' : 'rounded-lg bg-purple-400 text-black shadow-md shadow-purple-400/20 font-semibold font-mono')
                : (isBoutique ? 'rounded-full bg-stone-900/60 text-[#8E928F] hover:text-white border border-[#C5A880]/20 font-serif' : 'rounded-lg bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800 font-mono')
            }`}
          >
            ⚡ All-in-One Studio
          </button>
        </div>
      </div>

      {/* Enhanced Scrubber Section */}
      <div className="flex flex-col gap-1.5 pt-1">
        <div className={`flex items-center justify-between text-xs select-none ${
          isBoutique ? 'text-[#8E928F]' : 'text-neutral-400'
        }`}>
          <div className="flex items-center gap-2">
            <span className={`font-bold ${isBoutique ? 'text-[#D4AF37]' : 'text-emerald-400'}`}>
              {formatTime(currentTime)}
            </span>
            <span className={isBoutique ? 'text-stone-700' : 'text-neutral-600'}>/</span>
            <span>{formatTime(duration)}</span>
            <span className="text-[10px] text-neutral-500">
              ({containerFps} FPS Container • {impactCaptureFps} FPS Capture)
            </span>
          </div>

          <button
            onClick={jumpToImpact}
            className={`flex items-center gap-1.5 px-3 py-1 text-[11px] font-bold transition-all ${
              isBoutique
                ? 'rounded-full bg-gradient-to-br from-[#E5C07B] to-[#C5A880] text-stone-900 font-serif shadow-md shadow-[#C5A880]/20 hover:brightness-105'
                : 'rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono'
            }`}
            title="Snap playhead to calibrated impact point"
          >
            <Crosshair className="w-3 h-3 animate-pulse" />
            <span>Impact ({impactTime.toFixed(2)}s)</span>
          </button>
        </div>

        {/* Thicker 8px Scrubber Track with Champagne/Gold Playhead & ⚡ Impact Pin */}
        <div className="relative w-full h-8 flex items-center group cursor-pointer">
          <div className={`absolute left-0 right-0 h-2 rounded-full overflow-hidden ${
            isBoutique ? 'bg-stone-950/80 border border-[#C5A880]/20' : 'bg-neutral-800'
          }`}>
            <div 
              className={`h-full transition-all ${Math.abs(currentTime - impactTime) < 0.05 ? 'duration-300 ease-out' : 'duration-75 linear'} ${
                isBoutique 
                  ? 'bg-gradient-to-r from-[#C5A880] to-[#D4AF37]' 
                  : 'bg-gradient-to-r from-emerald-500 to-cyan-400'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Prominent ⚡ Impact Badge Pin */}
          <div 
            className="absolute top-0 bottom-0 w-0.5 z-10 pointer-events-none"
            style={{ left: `${impactPercent}%` }}
          >
            <div className={`absolute -top-2.5 -translate-x-1/2 flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-black shadow-md ${
              isBoutique 
                ? 'bg-gradient-to-br from-[#E5C07B] to-[#C5A880] text-stone-900 shadow-[#C5A880]/50 font-serif' 
                : 'bg-amber-400 text-black shadow-amber-400/50 font-mono'
            }`}>
              <span>⚡ Impact</span>
            </div>
            <div className={`w-0.5 h-full ${isBoutique ? 'bg-[#D4AF37]' : 'bg-amber-400'}`} />
          </div>

          {/* Native Range Input with custom thumb */}
          <input
            type="range"
            min={0}
            max={duration}
            step={0.01}
            value={currentTime}
            onChange={(e) => seekTo(parseFloat(e.target.value))}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
          />
        </div>
      </div>

      {/* Center Controls: Playback, Speed, Frame Scrubbing, Layout */}
      <div className={`flex flex-wrap items-center justify-between gap-3 border-t pt-3 ${
        isBoutique ? 'border-[#C5A880]/15' : 'border-neutral-800/60'
      }`}>
        {/* Left: Play/Pause/Rewind/Loop */}
        <div className="flex items-center gap-2">
          {/* Play/Pause Button - subtle metallic gradient in boutique mode */}
          <button
            onClick={togglePlay}
            className={`font-medium transition-all shadow-md flex items-center justify-center ${
              isBoutique
                ? 'rounded-full p-3 bg-gradient-to-br from-[#E5C07B] to-[#C5A880] text-stone-900 font-bold shadow-lg shadow-[#C5A880]/30 hover:brightness-105'
                : (isPlaying ? 'p-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black shadow-amber-500/20' : 'p-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-500/20')
            }`}
            title={isPlaying ? 'Pause Replay (Space)' : 'Play Replay (Space)'}
          >
            {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
          </button>

          <button
            onClick={() => seekTo(0)}
            className={`transition-colors border flex items-center justify-center ${
              isBoutique 
                ? 'rounded-full p-2.5 bg-stone-900/60 hover:bg-stone-800 border-[#C5A880]/20 text-[#F4F4F2]' 
                : 'rounded-lg p-2 bg-neutral-800/80 hover:bg-neutral-700 border-neutral-700 text-neutral-300 hover:text-white'
            }`}
            title="Rewind to start"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            onClick={toggleLoop}
            className={`transition-all border flex items-center justify-center ${
              isLooping 
                ? (isBoutique ? 'rounded-full p-2.5 bg-gradient-to-br from-[#E5C07B] to-[#C5A880] text-stone-900 font-bold shadow-md shadow-[#C5A880]/20' : 'rounded-lg p-2 bg-emerald-500/15 border-emerald-500/40 text-emerald-400')
                : (isBoutique ? 'rounded-full p-2.5 bg-stone-900/60 border-[#C5A880]/20 text-[#8E928F]' : 'rounded-lg p-2 bg-neutral-800/80 border-neutral-700/50 text-neutral-500')
            }`}
            title={isLooping ? 'Looping enabled' : 'Looping disabled'}
          >
            <Repeat className="w-4 h-4" />
          </button>
        </div>

        {/* Middle: Frame Stepping Buttons strictly using containerFps */}
        <div className={`flex items-center gap-1 border p-1 ${
          isBoutique ? 'rounded-full bg-stone-900/60 border-[#C5A880]/20' : 'rounded-lg bg-neutral-900/90 border-neutral-800 font-mono'
        }`}>
          <button
            onClick={() => stepFrames(-1, containerFps)}
            className={`flex items-center gap-1 px-3 py-1 text-xs transition-colors ${
              isBoutique ? 'rounded-full text-[#8E928F] hover:text-[#F4F4F2] hover:bg-stone-800/60 font-serif' : 'rounded text-neutral-300 hover:text-white hover:bg-neutral-800 font-mono'
            }`}
            title={`Step Back 1 Frame (-1/${containerFps}s container frame)`}
          >
            <ChevronLeft className={`w-4 h-4 ${isBoutique ? 'text-[#D4AF37]' : 'text-emerald-400'}`} />
            <span>-1 Frame</span>
          </button>
          <div className={`w-px h-4 ${isBoutique ? 'bg-[#C5A880]/20' : 'bg-neutral-800'}`} />
          <button
            onClick={() => stepFrames(1, containerFps)}
            className={`flex items-center gap-1 px-3 py-1 text-xs transition-colors ${
              isBoutique ? 'rounded-full text-[#8E928F] hover:text-[#F4F4F2] hover:bg-stone-800/60 font-serif' : 'rounded text-neutral-300 hover:text-white hover:bg-neutral-800 font-mono'
            }`}
            title={`Step Forward 1 Frame (+1/${containerFps}s container frame)`}
          >
            <span>+1 Frame</span>
            <ChevronRight className={`w-4 h-4 ${isBoutique ? 'text-[#D4AF37]' : 'text-emerald-400'}`} />
          </button>
        </div>

        {/* Speed Selector Pills */}
        <div className={`flex items-center gap-1 border p-1 ${
          isBoutique ? 'rounded-full bg-stone-900/60 border-[#C5A880]/20' : 'rounded-lg bg-neutral-900/90 border-neutral-800'
        }`}>
          {speedOptions.map((speed) => (
            <button
              key={speed}
              onClick={() => setPlaybackRate(speed)}
              className={`px-3 py-1 text-xs font-medium transition-all ${
                playbackRate === speed
                  ? (isBoutique ? 'rounded-full bg-gradient-to-br from-[#E5C07B] to-[#C5A880] text-stone-900 font-sans font-black shadow-sm' : 'rounded bg-emerald-500 text-black shadow-sm shadow-emerald-500/30 font-mono')
                  : (isBoutique ? 'rounded-full text-[#8E928F] hover:text-white hover:bg-stone-800/60 font-sans' : 'rounded text-neutral-400 hover:text-white hover:bg-neutral-800 font-mono')
              }`}
            >
              {speed}x
            </button>
          ))}
        </div>

        {/* Right: Layout Modes & Audio Toggle */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={toggleLayoutMode}
            className={`border transition-colors flex items-center gap-1.5 text-xs ${
              isBoutique
                ? (layoutMode === 'split' ? 'rounded-full px-3.5 py-1.5 bg-gradient-to-br from-[#E5C07B] to-[#C5A880] text-stone-900 font-serif font-bold shadow-sm' : 'rounded-full px-3.5 py-1.5 bg-stone-900/60 border-[#C5A880]/20 text-[#F4F4F2] font-serif')
                : (layoutMode === 'split' ? 'rounded-lg p-2 bg-cyan-500/15 border-cyan-500/40 text-cyan-400 font-mono' : 'rounded-lg p-2 bg-purple-500/15 border-purple-500/40 text-purple-400 font-mono')
            }`}
            title={`Switch to ${layoutMode === 'split' ? 'Picture-in-Picture' : 'Side-by-Side'} View`}
          >
            {layoutMode === 'split' ? (
              <>
                <Columns className="w-4 h-4" />
                <span className="hidden sm:inline">Split</span>
              </>
            ) : (
              <>
                <PictureInPicture2 className="w-4 h-4" />
                <span className="hidden sm:inline">PiP</span>
              </>
            )}
          </button>

          <button
            onClick={toggleMute}
            className={`border transition-colors flex items-center justify-center ${
              isMuted
                ? (isBoutique ? 'rounded-full p-2.5 bg-stone-900/60 border-[#C5A880]/20 text-[#8E928F]' : 'rounded-lg p-2 bg-neutral-800/80 border-neutral-700/50 text-neutral-500')
                : (isBoutique ? 'rounded-full p-2.5 bg-gradient-to-br from-[#E5C07B] to-[#C5A880] text-stone-900 font-bold shadow-sm' : 'rounded-lg p-2 bg-emerald-500/15 border-emerald-500/40 text-emerald-400')
            }`}
            title={isMuted ? 'Unmute replay audio' : 'Mute replay audio'}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Bottom Impact Offset Calibration Slider */}
      <div className={`p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs transition-colors ${
        isBoutique 
          ? 'rounded-2xl bg-stone-900/40 backdrop-blur-md border border-[#C5A880]/20' 
          : 'rounded-lg bg-neutral-900/70 border border-neutral-800/70'
      }`}>
        <div className="flex items-center gap-2">
          <Sliders className={`w-4 h-4 shrink-0 ${isBoutique ? 'text-[#D4AF37]' : 'text-emerald-400'}`} />
          <div className="flex flex-col">
            <span className={`font-medium ${isBoutique ? 'font-serif text-[#F4F4F2]' : 'font-mono text-neutral-200'}`}>
              Impact Offset Calibration
            </span>
            <span className={`text-[10px] ${isBoutique ? 'font-serif text-[#8E928F]' : 'font-mono text-neutral-400'}`}>
              Positive = impact video lags body swing (written back with PATCH so it survives reload)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 sm:ml-auto">
          <button
            onClick={() => handleOffsetChange(currentOffsetMs - 10)}
            className={`text-[11px] border transition-colors ${
              isBoutique 
                ? 'rounded-full px-3 py-1 bg-stone-800/80 border-[#C5A880]/30 text-[#F4F4F2] hover:bg-stone-700 font-sans' 
                : 'rounded px-1.5 py-0.5 bg-neutral-800 border-neutral-700 text-neutral-300 font-mono'
            }`}
            title="Nudge -10ms"
          >
            -10ms
          </button>

          <div className="flex items-center gap-2 min-w-[140px]">
            <input
              type="range"
              min={-500}
              max={500}
              step={5}
              value={currentOffsetMs}
              onChange={(e) => handleOffsetChange(parseInt(e.target.value))}
              className="w-24 sm:w-32"
            />
            <span className={`font-semibold min-w-[48px] text-right ${
              isBoutique ? 'font-sans text-[#E5C07B]' : 'font-mono text-cyan-400'
            }`}>
              {currentOffsetMs > 0 ? `+${currentOffsetMs}` : currentOffsetMs}ms
            </span>
          </div>

          <button
            onClick={() => handleOffsetChange(currentOffsetMs + 10)}
            className={`text-[11px] border transition-colors ${
              isBoutique 
                ? 'rounded-full px-3 py-1 bg-stone-800/80 border-[#C5A880]/30 text-[#F4F4F2] hover:bg-stone-700 font-sans' 
                : 'rounded px-1.5 py-0.5 bg-neutral-800 border-neutral-700 text-neutral-300 font-mono'
            }`}
            title="Nudge +10ms"
          >
            +10ms
          </button>

          {currentOffsetMs !== 0 && (
            <button
              onClick={() => handleOffsetChange(0)}
              className={`text-[10px] border transition-colors ${
                isBoutique 
                  ? 'rounded-full px-3 py-1 bg-stone-800 border border-[#C5A880]/30 text-[#8E928F] hover:text-white font-serif' 
                  : 'rounded px-2 py-0.5 bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-white font-mono'
              }`}
            >
              Reset
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
