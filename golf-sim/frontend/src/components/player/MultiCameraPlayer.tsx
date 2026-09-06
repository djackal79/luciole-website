import React, { useRef, useEffect, useState } from 'react';
import { useShotStore } from '../../store/shotStore';
import { usePlayerStore, CameraViewId, CameraLayout } from '../../store/playerStore';
import { useThemeStore } from '../../store/themeStore';
import { 
  Camera, 
  Sparkles, 
  Maximize2, 
  Minimize2, 
  Eye, 
  EyeOff, 
  Target,
  AlertCircle,
  VideoOff,
  Clock,
  Grid,
  Columns,
  LayoutTemplate,
  Compass
} from 'lucide-react';

import { usePoseData } from '../../hooks/usePoseData';

export const MultiCameraPlayer: React.FC = () => {
  const currentShot = useShotStore((s) => s.getCurrentShot());
  const { currentTheme } = useThemeStore();
  const isBoutique = currentTheme === 'boutique';

  const {
    isPlaying,
    currentTime,
    duration,
    playbackRate,
    cameraLayout,
    primaryCamera,
    isMuted,
    showGuides,
    setDuration,
    setCurrentTime,
    setCameraLayout,
    setPrimaryCamera,
    cyclePrimaryCamera,
    toggleGuides,
  } = usePlayerStore();

  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Canvases for simulated 3-camera playback
  const canvasFaceOnRef = useRef<HTMLCanvasElement | null>(null);
  const canvasBehindRef = useRef<HTMLCanvasElement | null>(null);
  const canvasImpactRef = useRef<HTMLCanvasElement | null>(null);

  // Video elements for native MP4 playback
  const videoFaceOnRef = useRef<HTMLVideoElement | null>(null);
  const videoBehindRef = useRef<HTMLVideoElement | null>(null);
  const videoImpactRef = useRef<HTMLVideoElement | null>(null);

  const [videoErrors, setVideoErrors] = useState<Record<string, boolean>>({});

  const handleVideoError = (camId: string) => {
    setVideoErrors(prev => ({ ...prev, [camId]: true }));
  };

  // Sync nominal duration
  useEffect(() => {
    if (!currentShot) return;
    const bodyMs = currentShot.media.body_swing?.duration_ms ?? 4000;
    const impactMs = currentShot.media.impact_strike?.duration_ms ?? 1500;
    const behindMs = (currentShot.media.body_swing_dtl || currentShot.media.behind_swing)?.duration_ms ?? 4000;
    const maxDurationSec = Math.max(bodyMs / 1000, impactMs / 1000, behindMs / 1000, 3.0);
    setDuration(maxDurationSec);
    setVideoErrors({});
  }, [currentShot?.shot_id, setDuration]);

  // Master animation ticker
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const loop = () => {
      const now = performance.now();
      const delta = (now - lastTime) / 1000;
      lastTime = now;

      if (isPlaying) {
        const nextTime = currentTime + delta * playbackRate;
        if (nextTime >= duration) {
          setCurrentTime(0);
        } else {
          setCurrentTime(nextTime);
        }
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, currentTime, duration, playbackRate, setCurrentTime]);

  const hasBodySource = Boolean(currentShot?.sources.body_swing && currentShot?.media.body_swing);
  const behindMedia = currentShot?.media.body_swing_dtl || currentShot?.media.behind_swing;
  const hasBehindSource = Boolean((currentShot?.sources.body_swing_dtl || currentShot?.sources.behind_swing) && behindMedia);
  const hasImpactSource = Boolean(currentShot?.sources.impact_strike && currentShot?.media.impact_strike);

  const bodyMedia = currentShot?.media.body_swing;
  const impactMedia = currentShot?.media.impact_strike;
  const impactOffsetMs = currentShot?.sync.impact_offset_ms ?? 0;
  const impactTime = 2.45;
  const isAtImpact = Math.abs(currentTime - impactTime) < 0.08;

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };



  const poseData = usePoseData();

  // Video sync & Skeleton Draw effect
  useEffect(() => {
    let animId: number;
    const loop = () => {
      const t_from_impact_sec = currentTime - impactTime;
      
      const syncVideo = (videoElem: HTMLVideoElement | null, media: any, manualOffsetMs = 0) => {
        if (!videoElem || !media) return;
        const clipImpactSec = (media.impact_ms ?? 0) / 1000;
        const offsetSec = manualOffsetMs / 1000;
        const targetTime = clipImpactSec + offsetSec + t_from_impact_sec;
        
        // Fast seek / native play logic
        if (isPlaying) {
            // Keep roughly in sync if playing natively
            if (Math.abs(videoElem.currentTime - targetTime) > 0.15) {
                videoElem.currentTime = targetTime;
            }
            if (videoElem.paused) videoElem.play().catch(()=>{});
        } else {
            if (!videoElem.paused) videoElem.pause();
            // Scrubbing
            videoElem.currentTime = targetTime;
        }
      };

      syncVideo(videoFaceOnRef.current, bodyMedia, 0);
      syncVideo(videoBehindRef.current, behindMedia, 0);
      syncVideo(videoImpactRef.current, impactMedia, impactOffsetMs);

      // Draw skeleton overlays
      const drawSkeleton = (canvasElem: HTMLCanvasElement | null, trackName: string) => {
        if (!canvasElem || !poseData || !poseData.tracks || !showGuides) return;
        const ctx = canvasElem.getContext('2d');
        if (!ctx) return;
        
        const width = canvasElem.width;
        const height = canvasElem.height;
        ctx.clearRect(0, 0, width, height);

        const track = (poseData.tracks as any)[trackName];
        if (!track || !track.frames || track.frames.length === 0) return;

        if (track.impact_ms == null) {
          ctx.fillStyle = "rgba(255, 50, 50, 0.8)";
          ctx.font = "14px monospace";
          ctx.fillText("⚠ POSE UNALIGNED: Missing impact_ms", 10, 24);
          return;
        }

        // Find frame closest to current video time
        const target_t_ms = (t_from_impact_sec * 1000) + track.impact_ms;
        let closestFrame = track.frames[0];
        let minDist = Infinity;
        for (const frame of track.frames) {
           const dist = Math.abs(frame.t_ms - target_t_ms);
           if (dist < minDist) {
               minDist = dist;
               closestFrame = frame;
           }
        }

        const lms = poseData.landmarks;
        const pts = closestFrame.points;
        const getPt = (name: string) => {
            const idx = lms.indexOf(name);
            if (idx === -1 || !pts[idx]) return null;
            const p = pts[idx];
            if (p[2] < 0.5) return null; // visibility < 0.5
            return { x: p[0] * width, y: p[1] * height };
        };

        const drawLine = (p1: any, p2: any) => {
            if (!p1 || !p2) return;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
        };

        const connections = [
            ['left_shoulder', 'right_shoulder'],
            ['left_shoulder', 'left_elbow'],
            ['left_elbow', 'left_wrist'],
            ['right_shoulder', 'right_elbow'],
            ['right_elbow', 'right_wrist'],
            ['left_shoulder', 'left_hip'],
            ['right_shoulder', 'right_hip'],
            ['left_hip', 'right_hip'],
            ['left_hip', 'left_knee'],
            ['left_knee', 'left_ankle'],
            ['right_hip', 'right_knee'],
            ['right_knee', 'right_ankle'],
            ['left_ankle', 'left_foot_index'],
            ['right_ankle', 'right_foot_index']
        ];

        ctx.strokeStyle = '#00f298';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        
        for (const [a, b] of connections) {
            drawLine(getPt(a), getPt(b));
        }
        
        ctx.fillStyle = '#facc15';
        for (const pt of pts) {
            if (pt[2] < 0.5) continue;
            ctx.beginPath();
            ctx.arc(pt[0] * width, pt[1] * height, 4, 0, Math.PI*2);
            ctx.fill();
        }
      };

      drawSkeleton(canvasFaceOnRef.current, 'body_swing');
      drawSkeleton(canvasBehindRef.current, 'body_swing_dtl');

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [currentTime, isPlaying, poseData, bodyMedia, behindMedia, impactMedia, impactOffsetMs, showGuides]);
  const renderViewport = (camId: CameraViewId) => {
    if (camId === 'face_on') {
      if (currentShot?.status === 'pending' && !hasBodySource) {
        return (
          <div className="w-full h-full bg-[#080a10] border border-dashed border-amber-500/30 rounded-xl flex flex-col items-center justify-center p-4 text-center">
            <Clock className="w-8 h-8 text-amber-400 animate-spin mb-2" />
            <span className="text-xs font-semibold text-neutral-200">Body Swing Ingesting...</span>
            <span className="text-[10px] font-mono text-neutral-500 mt-1">Kinovea Automation Hook</span>
          </div>
        );
      }
      if (!hasBodySource) {
        return (
          <div className="w-full h-full bg-[#080a10] border border-dashed border-neutral-800 rounded-xl flex flex-col items-center justify-center p-4 text-center">
            <VideoOff className="w-8 h-8 text-neutral-600 mb-2" />
            <span className="text-xs font-semibold text-neutral-300">Body Swing Absent</span>
            <span className="text-[10px] font-mono text-neutral-500 mt-1">Kinovea missed capture</span>
          </div>
        );
      }
      const videoSrc = `/shots/shot_${currentShot?.shot_id}/${bodyMedia?.path}`;
      return (
        <div className="relative w-full h-full bg-black rounded-xl overflow-hidden shadow-inner flex items-center justify-center">
          {!videoErrors['face_on'] && (
            <video
              ref={videoFaceOnRef}
              src={videoSrc}
              playsInline
              muted={isMuted}
              onError={() => handleVideoError('face_on')}
              className="w-full h-full object-contain"
            />
          )}
          <canvas ref={canvasFaceOnRef} width={1280} height={720} className="absolute inset-0 w-full h-full object-contain pointer-events-none" />
          <div className={`absolute top-2.5 left-2.5 flex items-center gap-1.5 px-2.5 py-0.5 border backdrop-blur-md text-[10px] ${
            isBoutique 
              ? 'rounded-full bg-black/80 border-[#C5A880]/30 font-serif text-[#E5C07B]' 
              : 'rounded bg-black/70 border-neutral-700/80 font-mono text-emerald-400'
          }`}>
            <Camera className="w-3 h-3" />
            <span className="text-white font-semibold">Face-On</span>
            <span>{bodyMedia?.capture_fps ?? 30} FPS</span>
          </div>
          {isAtImpact && (
            <div className={`absolute top-2.5 right-2.5 flex items-center gap-1 px-2.5 py-0.5 text-[10px] shadow-lg animate-bounce ${
              isBoutique 
                ? 'rounded-full bg-gradient-to-br from-[#E5C07B] to-[#C5A880] text-stone-900 font-serif font-bold shadow-[#C5A880]/40' 
                : 'rounded bg-emerald-500 text-black font-mono font-bold shadow-emerald-500/50'
            }`}>
              <Sparkles className="w-3 h-3" />
              <span>IMPACT</span>
            </div>
          )}
        </div>
      );
    }

    if (camId === 'behind') {
      if (!hasBehindSource) {
        return (
          <div className={`w-full h-full border border-dashed rounded-xl flex flex-col items-center justify-center p-4 text-center ${
            isBoutique ? 'bg-stone-900/30 border-[#C5A880]/20' : 'bg-[#080a10] border-neutral-800'
          }`}>
            <VideoOff className="w-8 h-8 text-neutral-600 mb-2" />
            <span className={`text-xs font-semibold ${isBoutique ? 'font-serif text-[#F4F4F2]' : 'text-neutral-300'}`}>Behind (DTL) Absent</span>
            <span className="text-[10px] font-mono text-neutral-500 mt-1">Secondary angle unattached</span>
          </div>
        );
      }
      const videoSrc = `/shots/shot_${currentShot?.shot_id}/${behindMedia?.path}`;
      return (
        <div className="relative w-full h-full bg-black rounded-xl overflow-hidden shadow-inner flex items-center justify-center">
          {!videoErrors['behind'] && (
            <video
              ref={videoBehindRef}
              src={videoSrc}
              playsInline
              muted={isMuted}
              onError={() => handleVideoError('behind')}
              className="w-full h-full object-contain"
            />
          )}
          <canvas ref={canvasBehindRef} width={1280} height={720} className="absolute inset-0 w-full h-full object-contain pointer-events-none" />
          <div className={`absolute top-2.5 left-2.5 flex items-center gap-1.5 px-2.5 py-0.5 border backdrop-blur-md text-[10px] ${
            isBoutique 
              ? 'rounded-full bg-black/80 border-[#C5A880]/30 font-serif text-[#D4AF37]' 
              : 'rounded bg-black/70 border-neutral-700/80 font-mono text-cyan-400'
          }`}>
            <Compass className="w-3 h-3" />
            <span className="text-white font-semibold">Behind (DTL)</span>
            <span>{behindMedia?.capture_fps ?? 60} FPS</span>
          </div>
        </div>
      );
    }

    if (camId === 'impact') {
      if (currentShot?.status === 'pending' && !hasImpactSource) {
        return (
          <div className={`w-full h-full border border-dashed rounded-xl flex flex-col items-center justify-center p-4 text-center ${
            isBoutique ? 'bg-stone-900/30 border-[#D4AF37]/30' : 'bg-[#080a10] border-amber-500/30'
          }`}>
            <Clock className="w-8 h-8 text-amber-400 animate-spin mb-2" />
            <span className={`text-xs font-semibold ${isBoutique ? 'font-serif text-[#F4F4F2]' : 'text-neutral-200'}`}>Impact Clip Ingesting...</span>
            <span className="text-[10px] font-mono text-neutral-500 mt-1">Samsung S23+ (4-9s store-and-forward)</span>
          </div>
        );
      }
      if (!hasImpactSource) {
        return (
          <div className={`w-full h-full border border-dashed rounded-xl flex flex-col items-center justify-center p-4 text-center ${
            isBoutique ? 'bg-stone-900/30 border-[#C5A880]/20' : 'bg-[#080a10] border-amber-900/40'
          }`}>
            <AlertCircle className="w-8 h-8 text-amber-500/60 mb-2" />
            <span className={`text-xs font-semibold ${isBoutique ? 'font-serif text-[#F4F4F2]' : 'text-neutral-300'}`}>Impact Close-up Absent</span>
            <span className="text-[10px] font-mono text-neutral-500 mt-1">Samsung S23+ missed trigger or upload pending</span>
          </div>
        );
      }
      const videoSrc = `/shots/shot_${currentShot?.shot_id}/${impactMedia?.path}`;
      return (
        <div className="relative w-full h-full bg-black rounded-xl overflow-hidden shadow-inner flex items-center justify-center">
          {!videoErrors['impact'] && (
            <video
              ref={videoImpactRef}
              src={videoSrc}
              playsInline
              muted={isMuted}
              onError={() => handleVideoError('impact')}
              className="w-full h-full object-contain"
            />
          )}
          <canvas ref={canvasImpactRef} width={1280} height={720} className="absolute inset-0 w-full h-full object-contain pointer-events-none" />
          <div className={`absolute top-2.5 left-2.5 flex items-center gap-1.5 px-2.5 py-0.5 border backdrop-blur-md text-[10px] ${
            isBoutique 
              ? 'rounded-full bg-black/80 border-[#C5A880]/30 font-serif text-[#E5C07B]' 
              : 'rounded bg-black/70 border-neutral-700/80 font-mono text-amber-400'
          }`}>
            <Target className="w-3 h-3" />
            <span className="text-white font-semibold">Impact Strike</span>
            <span>{impactMedia?.capture_fps ?? 240} FPS</span>
          </div>
        </div>
      );
    }

    return null;
  };

  const getSecondaryCameras = (main: CameraViewId): CameraViewId[] => {
    const all: CameraViewId[] = ['face_on', 'behind', 'impact'];
    return all.filter(c => c !== main);
  };

  return (
    <div 
      ref={containerRef} 
      className={`relative flex flex-col gap-3 p-2.5 sm:p-4 shadow-2xl transition-colors duration-300 ${
        isBoutique 
          ? 'bg-stone-900/40 backdrop-blur-lg border border-[#C5A880]/20 shadow-xl rounded-2xl' 
          : 'bg-[#0a0c13] border border-neutral-800/80 rounded-2xl'
      }`}
    >
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Analysis Guides */}
          <button
            onClick={toggleGuides}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs border transition-all ${
              isBoutique ? 'rounded-full font-serif' : 'rounded-lg font-mono'
            } ${
              showGuides 
                ? (isBoutique ? 'bg-gradient-to-br from-[#E5C07B] to-[#C5A880] text-stone-900 font-bold border-transparent shadow-sm' : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400')
                : (isBoutique ? 'bg-stone-900/60 border-[#C5A880]/20 text-[#8E928F] hover:text-white' : 'bg-neutral-800/60 border-neutral-700 text-neutral-400 hover:text-white')
            }`}
            title="Toggle swing plane lines & crosshairs"
          >
            {showGuides ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span>Guides</span>
          </button>



          {/* Layout Switcher */}
          <div className={`flex items-center border p-0.5 text-xs ${
            isBoutique ? 'rounded-full bg-stone-900/60 border-[#C5A880]/20 font-serif' : 'rounded-lg bg-neutral-900 border-neutral-800 font-mono'
          }`}>
            <button
              onClick={() => setCameraLayout('3-grid')}
              className={`flex items-center gap-1 px-2.5 py-0.5 transition-colors ${
                isBoutique ? 'rounded-full' : 'rounded'
              } ${
                cameraLayout === '3-grid' 
                  ? (isBoutique ? 'bg-gradient-to-br from-[#E5C07B] to-[#C5A880] text-stone-900 font-bold shadow-sm' : 'bg-emerald-500 text-black font-semibold') 
                  : (isBoutique ? 'text-[#8E928F] hover:text-white' : 'text-neutral-400 hover:text-white')
              }`}
              title="3 Cameras Grid"
            >
              <Grid className="w-3 h-3" />
              <span className="hidden sm:inline">3-Cam Grid</span>
            </button>
            <button
              onClick={() => setCameraLayout('dual-split')}
              className={`flex items-center gap-1 px-2.5 py-0.5 transition-colors ${
                isBoutique ? 'rounded-full' : 'rounded'
              } ${
                cameraLayout === 'dual-split' 
                  ? (isBoutique ? 'bg-gradient-to-br from-[#E5C07B] to-[#C5A880] text-stone-900 font-bold shadow-sm' : 'bg-emerald-500 text-black font-semibold') 
                  : (isBoutique ? 'text-[#8E928F] hover:text-white' : 'text-neutral-400 hover:text-white')
              }`}
              title="Dual Split (Primary + Impact)"
            >
              <Columns className="w-3 h-3" />
              <span className="hidden sm:inline">Dual</span>
            </button>
            <button
              onClick={() => setCameraLayout('pip')}
              className={`flex items-center gap-1 px-2.5 py-0.5 transition-colors ${
                isBoutique ? 'rounded-full' : 'rounded'
              } ${
                cameraLayout === 'pip' 
                  ? (isBoutique ? 'bg-gradient-to-br from-[#E5C07B] to-[#C5A880] text-stone-900 font-bold shadow-sm' : 'bg-emerald-500 text-black font-semibold') 
                  : (isBoutique ? 'text-[#8E928F] hover:text-white' : 'text-neutral-400 hover:text-white')
              }`}
              title="Picture-in-Picture"
            >
              <LayoutTemplate className="w-3 h-3" />
              <span>PiP</span>
            </button>
          </div>

          {/* Swap / Focus Camera button */}
          <button
            onClick={cyclePrimaryCamera}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs border transition-colors ${
              isBoutique 
                ? 'rounded-full bg-stone-900/60 hover:bg-stone-800 border-[#C5A880]/20 text-[#F4F4F2] font-serif' 
                : 'rounded-lg bg-neutral-800/80 hover:bg-neutral-700 border-neutral-700 text-neutral-300 font-mono'
            }`}
            title="Cycle main focus camera"
          >
            <Camera className={`w-3 h-3 ${isBoutique ? 'text-[#D4AF37]' : 'text-cyan-400'}`} />
            <span>Focus: {primaryCamera === 'face_on' ? 'Face-On' : primaryCamera === 'behind' ? 'Behind' : 'Impact'}</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleFullscreen}
            className={`p-1.5 border transition-colors ${
              isBoutique 
                ? 'rounded-full bg-stone-900/60 hover:bg-stone-800 text-[#8E928F] hover:text-white border-[#C5A880]/20' 
                : 'rounded-lg bg-neutral-800/80 hover:bg-neutral-700 text-neutral-400 hover:text-white border-neutral-700'
            }`}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Viewport Rendering */}
      {cameraLayout === '3-grid' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 min-h-[280px] sm:min-h-[340px] lg:min-h-[380px]">
          <div className="w-full h-full min-h-[220px]">{renderViewport('face_on')}</div>
          <div className="w-full h-full min-h-[220px]">{renderViewport('behind')}</div>
          <div className="w-full h-full min-h-[220px]">{renderViewport('impact')}</div>
        </div>
      )}

      {cameraLayout === 'dual-split' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 min-h-[320px] sm:min-h-[380px] lg:min-h-[420px]">
          <div className="w-full h-full">{renderViewport(primaryCamera)}</div>
          <div className="w-full h-full">
            {renderViewport(primaryCamera === 'impact' ? 'face_on' : 'impact')}
          </div>
        </div>
      )}

      {cameraLayout === 'pip' && (
        <div className="relative w-full min-h-[360px] sm:min-h-[440px] lg:min-h-[500px]">
          {/* Main Stage View */}
          <div className="w-full h-full">
            {renderViewport(primaryCamera)}
          </div>

          {/* Floating PiP Thumbnails */}
          <div className="absolute bottom-4 right-4 flex items-center gap-2 z-30">
            {getSecondaryCameras(primaryCamera).map((cam) => (
              <div
                key={cam}
                onClick={() => setPrimaryCamera(cam)}
                className={`w-36 sm:w-44 h-24 sm:h-28 rounded-xl overflow-hidden border-2 shadow-2xl cursor-pointer transition-all hover:scale-105 bg-black ${
                  isBoutique ? 'border-[#D4AF37]/80 hover:border-[#D4AF37]' : 'border-emerald-500/70 hover:border-emerald-400'
                }`}
                title={`Click to switch to ${cam}`}
              >
                {renderViewport(cam)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
