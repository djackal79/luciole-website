import React, { useRef, useEffect, useState } from 'react';
import { useShotStore } from '../../store/shotStore';
import { usePlayerStore } from '../../store/playerStore';
import { 
  Camera, 
  Sparkles, 
  Maximize2, 
  Minimize2, 
  ArrowLeftRight, 
  Eye, 
  EyeOff, 
  Target,
  AlertCircle,
  VideoOff,
  Clock
} from 'lucide-react';

export const DualVideoPlayer: React.FC = () => {
  const currentShot = useShotStore((s) => s.getCurrentShot());

  const {
    isPlaying,
    currentTime,
    duration,
    playbackRate,
    layoutMode,
    primaryView,
    isMuted,
    showGuides,
    setDuration,
    setCurrentTime,
    setIsPlaying,
    swapPrimaryView,
    toggleGuides,
  } = usePlayerStore();

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [simulationMode, setSimulationMode] = useState(true);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const canvasARef = useRef<HTMLCanvasElement | null>(null);
  const canvasBRef = useRef<HTMLCanvasElement | null>(null);

  const videoARef = useRef<HTMLVideoElement | null>(null);
  const videoBRef = useRef<HTMLVideoElement | null>(null);

  const [videoALoadError, setVideoALoadError] = useState(false);
  const [videoBLoadError, setVideoBLoadError] = useState(false);

  // Compute nominal duration from shot metadata
  useEffect(() => {
    if (!currentShot) return;
    const bodyMs = currentShot.media.body_swing?.duration_ms ?? 4000;
    const impactMs = currentShot.media.impact_strike?.duration_ms ?? 1500;
    const maxDurationSec = Math.max(bodyMs / 1000, impactMs / 1000, 3.0);
    setDuration(maxDurationSec);
    setCurrentTime(0);
    setVideoALoadError(false);
    setVideoBLoadError(false);
  }, [currentShot?.shot_id, setDuration, setCurrentTime]);

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

  // Trap #4: Check sources.* before touching media.*
  const hasBodySource = currentShot?.sources.body_swing && Boolean(currentShot?.media.body_swing);
  const hasImpactSource = currentShot?.sources.impact_strike && Boolean(currentShot?.media.impact_strike);

  const bodyMedia = currentShot?.media.body_swing;
  const impactMedia = currentShot?.media.impact_strike;
  const impactOffsetMs = currentShot?.sync.impact_offset_ms ?? 0;
  const impactTime = 2.45;
  const isAtImpact = Math.abs(currentTime - impactTime) < 0.08;

  // Toggle fullscreen
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

  // Render Kinovea Canvas Animation (when video file is absent/mocked)
  useEffect(() => {
    if (!hasBodySource) return;
    const canvas = canvasARef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Background: Dark golf simulator hitting bay
    ctx.fillStyle = '#0a0d14';
    ctx.fillRect(0, 0, width, height);

    // Floor lines
    ctx.strokeStyle = '#182030';
    ctx.lineWidth = 1;
    for (let y = height * 0.7; y < height; y += 20) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Target Line
    ctx.strokeStyle = '#223048';
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(width * 0.2, height * 0.85);
    ctx.lineTo(width * 0.85, height * 0.85);
    ctx.stroke();
    ctx.setLineDash([]);

    const t = currentTime;
    const impactT = impactTime;

    let stage = 'ADDRESS';
    let armAngle = 0.45;
    let shaftAngle = 0.45;

    if (t < 0.7) {
      stage = 'ADDRESS';
    } else if (t < 1.6) {
      stage = 'BACKSWING';
      const progress = (t - 0.7) / (1.6 - 0.7);
      armAngle = 0.45 - progress * 2.5;
      shaftAngle = armAngle - progress * 1.2;
    } else if (t < impactT) {
      stage = 'DOWNSWING';
      const progress = (t - 1.6) / (impactT - 1.6);
      armAngle = -2.05 + progress * 2.5;
      shaftAngle = armAngle + (1 - progress) * 1.5;
    } else if (t <= impactT + 0.08) {
      stage = '★ IMPACT ★';
      armAngle = 0.45;
      shaftAngle = 0.45;
    } else {
      stage = 'FOLLOW-THROUGH';
      const progress = Math.min(1, (t - impactT) / (duration - impactT));
      armAngle = 0.45 + progress * 2.4;
      shaftAngle = armAngle + progress * 1.1;
    }

    const hipX = width * 0.46;
    const hipY = height * 0.58;
    const shoulderX = width * 0.43;
    const shoulderY = height * 0.40;
    const headX = width * 0.42;
    const headY = height * 0.30;
    const feetX = width * 0.45;
    const feetY = height * 0.84;
    const ballX = width * 0.58;
    const ballY = height * 0.84;

    // Body
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(hipX - 8, hipY);
    ctx.lineTo(feetX - 18, feetY);
    ctx.moveTo(hipX + 8, hipY);
    ctx.lineTo(feetX + 10, feetY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(hipX, hipY);
    ctx.lineTo(shoulderX, shoulderY);
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    ctx.beginPath();
    ctx.arc(headX, headY, 14, 0, Math.PI * 2);
    ctx.fill();

    // Arms & Club
    const armLength = 70;
    const handX = shoulderX + Math.sin(armAngle) * armLength;
    const handY = shoulderY + Math.cos(armAngle) * armLength;

    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(shoulderX, shoulderY);
    ctx.lineTo(handX, handY);
    ctx.stroke();

    const shaftLength = 95;
    const clubHeadX = handX + Math.sin(shaftAngle) * shaftLength;
    const clubHeadY = handY + Math.cos(shaftAngle) * shaftLength;

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(handX, handY);
    ctx.lineTo(clubHeadX, clubHeadY);
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.arc(clubHeadX, clubHeadY, 5, 0, Math.PI * 2);
    ctx.fill();

    // Ball
    if (t < impactT) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ballX, ballY - 6, 6, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const flightT = t - impactT;
      const flyX = ballX + flightT * 180;
      const flyY = ballY - 6 - flightT * 140;

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ballX, ballY - 6);
      ctx.lineTo(flyX, flyY);
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(flyX, flyY, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    if (isAtImpact) {
      ctx.strokeStyle = 'rgba(0, 242, 152, 0.8)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(ballX, ballY - 6, 24, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (showGuides) {
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(ballX + 20, ballY + 10);
      ctx.lineTo(shoulderX - 60, shoulderY - 80);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.strokeStyle = 'rgba(0, 210, 255, 0.7)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(headX, headY, 20, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = '#00f298';
    ctx.font = 'bold 11px monospace';
    ctx.fillText(`KINOVEA // ${bodyMedia?.capture_fps ?? 30} FPS`, 12, 22);

    ctx.fillStyle = isAtImpact ? '#facc15' : '#94a3b8';
    ctx.fillText(`PHASE: ${stage}`, 12, 38);

    const frameA = Math.floor(currentTime * (bodyMedia?.container_fps ?? 30));
    ctx.fillStyle = '#64748b';
    ctx.fillText(`FRAME #${frameA.toString().padStart(4, '0')}`, width - 110, 22);
  }, [currentTime, duration, isAtImpact, showGuides, hasBodySource, bodyMedia]);

  // Render Samsung Slow-Mo Canvas Animation
  useEffect(() => {
    if (!hasImpactSource) return;
    const canvas = canvasBRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.fillStyle = '#06080d';
    ctx.fillRect(0, 0, width, height);

    // Trap #2: Align on impact, not on file start. Seek by sync.impact_offset_ms
    const offsetSec = impactOffsetMs / 1000;
    const timeB = Math.max(0, Math.min(duration, currentTime + offsetSec));
    const dt = timeB - impactTime;

    // Turf
    ctx.fillStyle = '#0d2215';
    ctx.fillRect(0, height * 0.88, width, height * 0.12);
    ctx.fillStyle = '#10b981';
    for (let x = 10; x < width; x += 15) {
      ctx.fillRect(x, height * 0.88 - 4, 2, 4);
    }

    // Tee peg
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(width * 0.52 - 3, height * 0.65, 6, height * 0.25);

    if (showGuides) {
      ctx.strokeStyle = '#151c2c';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(width / 2, 0);
      ctx.lineTo(width / 2, height);
      ctx.moveTo(0, height * 0.5);
      ctx.lineTo(width, height * 0.5);
      ctx.stroke();
    }

    const ballBaseX = width * 0.52;
    const ballBaseY = height * 0.52;
    const ballRadius = 36;
    const approachSpeed = 380;
    let clubFaceX = ballBaseX - ballRadius - 10 + dt * approachSpeed;
    const clubFaceY = ballBaseY;

    if (dt > 0) {
      clubFaceX = ballBaseX - ballRadius + dt * (approachSpeed * 0.7);
    }

    ctx.save();
    ctx.translate(clubFaceX, clubFaceY);
    ctx.rotate((-18 * Math.PI) / 180);

    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(-24, -55, 26, 110, [6, 0, 0, 6]);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    for (let g = -35; g <= 35; g += 10) {
      ctx.beginPath();
      ctx.moveTo(2, g);
      ctx.lineTo(-4, g);
      ctx.stroke();
    }
    ctx.restore();

    let compression = 1.0;
    let ballX = ballBaseX;
    let ballY = ballBaseY;

    if (Math.abs(dt) < 0.04) {
      compression = 0.75 + (Math.abs(dt) / 0.04) * 0.25;
    }

    if (dt > 0) {
      const smash = currentShot?.telemetry?.derived.smash_factor ?? 1.44;
      const ballExitSpeed = approachSpeed * smash;
      ballX = ballBaseX + dt * ballExitSpeed;
      ballY = ballBaseY - dt * (ballExitSpeed * 0.35);
    }

    ctx.save();
    ctx.translate(ballX, ballY);
    const spinAngle = dt > 0 ? (dt * 50) % (Math.PI * 2) : 0;
    ctx.rotate(-spinAngle);

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(0, 0, ballRadius * compression, ballRadius, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#cbd5e1';
    for (let d = -20; d <= 20; d += 12) {
      ctx.beginPath();
      ctx.arc(d * compression, 0, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-16 * compression, 0);
    ctx.lineTo(16 * compression, 0);
    ctx.stroke();

    ctx.restore();

    if (Math.abs(dt) < 0.03) {
      ctx.strokeStyle = '#00f298';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(ballBaseX - ballRadius * 0.8, ballBaseY, 40, -Math.PI / 3, Math.PI / 3);
      ctx.stroke();
    }

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 11px monospace';
    ctx.fillText(`SAMSUNG S23+ // ${impactMedia?.capture_fps ?? 240} FPS (${impactMedia?.container_fps ?? 30} FPS CONTAINER)`, 12, 22);

    ctx.fillStyle = Math.abs(dt) < 0.04 ? '#00f298' : '#94a3b8';
    ctx.fillText(`SHUTTER: 1/10000s | ${Math.abs(dt) < 0.04 ? 'COMPRESSION DETECTED' : 'READY'}`, 12, 38);

    const frameB = Math.floor(timeB * (impactMedia?.container_fps ?? 30));
    ctx.fillStyle = '#64748b';
    ctx.fillText(`FRAME #${frameB.toString().padStart(5, '0')}`, width - 118, 22);
  }, [currentTime, duration, impactOffsetMs, currentShot, showGuides, hasImpactSource, impactMedia]);

  const renderViewportA = () => {
    // Trap #7: Pending state
    if (currentShot?.status === 'pending' && !hasBodySource) {
      return (
        <div className="relative w-full h-full bg-[#080a10] border border-dashed border-amber-500/30 rounded-xl flex flex-col items-center justify-center p-6 text-center">
          <Clock className="w-10 h-10 text-amber-400 animate-spin mb-2" />
          <span className="text-sm font-semibold text-neutral-200">Body Swing Ingesting...</span>
          <span className="text-xs font-mono text-neutral-500 mt-1">Status: pending</span>
        </div>
      );
    }

    if (!hasBodySource) {
      return (
        <div className="relative w-full h-full bg-[#080a10] border border-dashed border-neutral-800 rounded-xl flex flex-col items-center justify-center p-6 text-center">
          <VideoOff className="w-10 h-10 text-neutral-600 mb-2" />
          <span className="text-sm font-semibold text-neutral-300">Body Swing Video Absent</span>
          <span className="text-xs font-mono text-neutral-500 mt-1 max-w-xs">
            Kinovea source omitted in package. Status: {currentShot?.status}
          </span>
        </div>
      );
    }

    const videoSrc = `/shots/shot_${currentShot?.shot_id}/${bodyMedia?.path}`;

    return (
      <div className="relative w-full h-full bg-black rounded-xl overflow-hidden shadow-inner flex items-center justify-center">
        {!simulationMode && !videoALoadError ? (
          <video
            ref={videoARef}
            src={videoSrc}
            playsInline
            muted={isMuted}
            onError={() => setVideoALoadError(true)}
            className="w-full h-full object-contain"
          />
        ) : (
          <canvas
            ref={canvasARef}
            width={640}
            height={380}
            className="w-full h-full object-contain"
          />
        )}

        <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-black/70 border border-neutral-700/80 backdrop-blur-md">
          <Camera className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-[11px] font-mono font-semibold text-neutral-200">
            Body Swing ({bodyMedia?.camera ?? 'DTL'})
          </span>
          <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] font-mono rounded">
            {bodyMedia?.capture_fps ?? 30} FPS
          </span>
        </div>

        {isAtImpact && (
          <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/90 text-black font-mono font-bold text-[11px] shadow-lg shadow-emerald-500/50 animate-bounce">
            <Sparkles className="w-3.5 h-3.5" />
            <span>IMPACT</span>
          </div>
        )}
      </div>
    );
  };

  const renderViewportB = () => {
    if (currentShot?.status === 'pending' && !hasImpactSource) {
      return (
        <div className="relative w-full h-full bg-[#080a10] border border-dashed border-amber-500/30 rounded-xl flex flex-col items-center justify-center p-6 text-center">
          <Clock className="w-10 h-10 text-amber-400 animate-spin mb-2" />
          <span className="text-sm font-semibold text-neutral-200">Impact Video Ingesting...</span>
          <span className="text-xs font-mono text-neutral-500 mt-1">Status: pending</span>
        </div>
      );
    }

    if (!hasImpactSource) {
      return (
        <div className="relative w-full h-full bg-[#080a10] border border-dashed border-amber-900/40 rounded-xl flex flex-col items-center justify-center p-6 text-center">
          <AlertCircle className="w-10 h-10 text-amber-500/60 mb-2" />
          <span className="text-sm font-semibold text-neutral-300">Impact Video Absent</span>
          <span className="text-xs font-mono text-neutral-500 mt-1 max-w-xs">
            Phone high-speed camera missed trigger or pairing window expired.
          </span>
          <span className="mt-3 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-[10px] font-mono text-amber-400">
            status: {currentShot?.status}
          </span>
        </div>
      );
    }

    const videoSrc = `/shots/shot_${currentShot?.shot_id}/${impactMedia?.path}`;

    return (
      <div className="relative w-full h-full bg-black rounded-xl overflow-hidden shadow-inner flex items-center justify-center">
        {!simulationMode && !videoBLoadError ? (
          <video
            ref={videoBRef}
            src={videoSrc}
            playsInline
            muted={isMuted}
            onError={() => setVideoBLoadError(true)}
            className="w-full h-full object-contain"
          />
        ) : (
          <canvas
            ref={canvasBRef}
            width={640}
            height={380}
            className="w-full h-full object-contain"
          />
        )}

        <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-black/70 border border-neutral-700/80 backdrop-blur-md">
          <Target className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-[11px] font-mono font-semibold text-neutral-200">
            Impact Slow-Mo
          </span>
          <span className="px-1.5 py-0.5 bg-cyan-500/20 text-cyan-400 text-[10px] font-mono rounded">
            {impactMedia?.capture_fps ?? 240} FPS
          </span>
        </div>

        <div className="absolute bottom-3 left-3 px-2 py-0.5 rounded bg-black/60 border border-neutral-800 text-[10px] font-mono text-neutral-400">
          Club: <span className="text-white font-semibold">{currentShot?.club_used ?? '—'}</span>
        </div>
      </div>
    );
  };

  return (
    <div 
      ref={containerRef} 
      className="relative flex flex-col gap-3 bg-[#0a0c13] border border-neutral-800/80 rounded-2xl p-2.5 sm:p-4 shadow-2xl"
    >
      {/* Top Controls Toolbar */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <button
            onClick={toggleGuides}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono border transition-all ${
              showGuides 
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' 
                : 'bg-neutral-800/60 border-neutral-700 text-neutral-400 hover:text-white'
            }`}
            title="Toggle swing plane lines & impact crosshairs"
          >
            {showGuides ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span>Analysis Guides</span>
          </button>

          {/* Simulation Mode Toggle Button */}
          <button
            onClick={() => setSimulationMode(!simulationMode)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono border transition-colors ${
              simulationMode
                ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                : 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300'
            }`}
            title="Toggle between Canvas visual simulation and native MP4 stream"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{simulationMode ? 'Render: Simulated Video' : 'Render: Native MP4'}</span>
          </button>

          {layoutMode === 'pip' && hasBodySource && hasImpactSource && (
            <button
              onClick={swapPrimaryView}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono border bg-neutral-800/80 hover:bg-neutral-700 border-neutral-700 text-neutral-300 transition-colors"
            >
              <ArrowLeftRight className="w-3.5 h-3.5 text-cyan-400" />
              <span>Swap Primary ({primaryView === 'body' ? 'Body' : 'Impact'})</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded-lg bg-neutral-800/80 hover:bg-neutral-700 text-neutral-400 hover:text-white border border-neutral-700 transition-colors"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Viewport Render: Split vs PiP */}
      {layoutMode === 'split' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 min-h-[300px] sm:min-h-[380px] lg:min-h-[420px]">
          {renderViewportA()}
          {renderViewportB()}
        </div>
      ) : (
        <div className="relative w-full min-h-[340px] sm:min-h-[440px] lg:min-h-[500px]">
          <div className="w-full h-full">
            {primaryView === 'body' ? renderViewportA() : renderViewportB()}
          </div>

          {hasBodySource && hasImpactSource && (
            <div 
              onClick={swapPrimaryView}
              className="absolute bottom-4 right-4 w-48 sm:w-64 h-32 sm:h-40 rounded-xl overflow-hidden border-2 border-emerald-500/80 shadow-2xl cursor-pointer group transition-transform hover:scale-105 z-30"
              title="Click to swap with main video"
            >
              {primaryView === 'body' ? renderViewportB() : renderViewportA()}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
