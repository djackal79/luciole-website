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
  const [simulationMode, setSimulationMode] = useState(true);
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

  // 1. Render Face-On Canvas (Kinovea)
  useEffect(() => {
    if (!hasBodySource) return;
    const canvas = canvasFaceOnRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

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
      stage = 'FINISH';
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
    ctx.lineWidth = 5;
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
    ctx.arc(headX, headY, 13, 0, Math.PI * 2);
    ctx.fill();

    // Arms & Club
    const armLength = 65;
    const handX = shoulderX + Math.sin(armAngle) * armLength;
    const handY = shoulderY + Math.cos(armAngle) * armLength;

    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(shoulderX, shoulderY);
    ctx.lineTo(handX, handY);
    ctx.stroke();

    const shaftLength = 90;
    const clubHeadX = handX + Math.sin(shaftAngle) * shaftLength;
    const clubHeadY = handY + Math.cos(shaftAngle) * shaftLength;

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
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
      ctx.arc(headX, headY, 18, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = '#00f298';
    ctx.font = 'bold 11px monospace';
    ctx.fillText(`CAM 1 // FACE-ON (${bodyMedia?.capture_fps ?? 30} FPS)`, 12, 22);

    ctx.fillStyle = isAtImpact ? '#facc15' : '#94a3b8';
    ctx.fillText(`STAGE: ${stage}`, 12, 38);

    const frameA = Math.floor(currentTime * (bodyMedia?.container_fps ?? 30));
    ctx.fillStyle = '#64748b';
    ctx.fillText(`FR #${frameA.toString().padStart(4, '0')}`, width - 90, 22);
  }, [currentTime, duration, isAtImpact, showGuides, hasBodySource, bodyMedia]);

  // 2. Render Down-The-Line / Behind Canvas
  useEffect(() => {
    if (!hasBehindSource) return;
    const canvas = canvasBehindRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.fillStyle = '#07090f';
    ctx.fillRect(0, 0, width, height);

    // Target Line down the fairway
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(width * 0.48, height * 0.88);
    ctx.lineTo(width * 0.50, height * 0.35);
    ctx.stroke();

    const t = currentTime;
    const impactT = impactTime;

    // Posture from behind: golfer facing right into distance
    const pelvisX = width * 0.44;
    const pelvisY = height * 0.62;
    const spineAngle = 0.38; // forward bend
    const torsoLen = 65;
    const chestX = pelvisX + Math.sin(spineAngle) * torsoLen;
    const chestY = pelvisY - Math.cos(spineAngle) * torsoLen;

    // Legs
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(pelvisX, pelvisY);
    ctx.lineTo(pelvisX - 10, height * 0.88); // trail foot
    ctx.moveTo(pelvisX + 15, pelvisY);
    ctx.lineTo(pelvisX + 12, height * 0.88); // lead foot
    ctx.stroke();

    // Spine
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(pelvisX, pelvisY);
    ctx.lineTo(chestX, chestY);
    ctx.stroke();

    // Head
    const headX = chestX + 6;
    const headY = chestY - 14;
    ctx.fillStyle = '#94a3b8';
    ctx.beginPath();
    ctx.arc(headX, headY, 12, 0, Math.PI * 2);
    ctx.fill();

    // Arms & Shaft Plane from DTL angle
    let dtlArmAngle = 0.6;
    let dtlShaftAngle = 1.2;

    if (t < 0.7) {
      dtlArmAngle = 0.6;
      dtlShaftAngle = 1.2;
    } else if (t < 1.6) {
      // Top of swing: hands high and deep
      const p = (t - 0.7) / (1.6 - 0.7);
      dtlArmAngle = 0.6 - p * 2.2;
      dtlShaftAngle = 1.2 - p * 1.8;
    } else if (t < impactT) {
      // Downswing: dropping into slot
      const p = (t - 1.6) / (impactT - 1.6);
      dtlArmAngle = -1.6 + p * 2.2;
      dtlShaftAngle = -0.6 + p * 1.8;
    } else {
      // Exit left through chest
      const p = Math.min(1, (t - impactT) / (duration - impactT));
      dtlArmAngle = 0.6 + p * 1.8;
      dtlShaftAngle = 1.2 + p * 1.5;
    }

    const handX = chestX + Math.sin(dtlArmAngle) * 45;
    const handY = chestY + Math.cos(dtlArmAngle) * 45;

    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(chestX, chestY);
    ctx.lineTo(handX, handY);
    ctx.stroke();

    const clubX = handX + Math.sin(dtlShaftAngle) * 80;
    const clubY = handY + Math.cos(dtlShaftAngle) * 80;

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(handX, handY);
    ctx.lineTo(clubX, clubY);
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.arc(clubX, clubY, 4, 0, Math.PI * 2);
    ctx.fill();

    // Ball on target line
    const ballDTLX = width * 0.49;
    const ballDTLY = height * 0.88;

    if (t < impactT) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ballDTLX, ballDTLY - 5, 5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const flightT = t - impactT;
      const flyX = ballDTLX + flightT * 12; // slight push/pull
      const flyY = ballDTLY - 5 - flightT * 160;
      const flySize = Math.max(2, 5 - flightT * 1.2);

      ctx.fillStyle = '#00f298';
      ctx.beginPath();
      ctx.arc(flyX, flyY, flySize, 0, Math.PI * 2);
      ctx.fill();
    }

    // Guides: Shaft plane line from ball through hands/elbow
    if (showGuides) {
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(ballDTLX, ballDTLY);
      ctx.lineTo(chestX - 60, chestY - 90);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 11px monospace';
    ctx.fillText(`CAM 2 // BEHIND DTL (${behindMedia?.capture_fps ?? 60} FPS)`, 12, 22);

    ctx.fillStyle = '#94a3b8';
    ctx.fillText('HAND PATH: ON-PLANE', 12, 38);

    const frameB = Math.floor(currentTime * (behindMedia?.container_fps ?? 30));
    ctx.fillStyle = '#64748b';
    ctx.fillText(`FR #${frameB.toString().padStart(4, '0')}`, width - 90, 22);
  }, [currentTime, duration, isAtImpact, showGuides, hasBehindSource, behindMedia]);

  // 3. Render Samsung Slow-Mo Canvas Animation
  useEffect(() => {
    if (!hasImpactSource) return;
    const canvas = canvasImpactRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.fillStyle = '#06080d';
    ctx.fillRect(0, 0, width, height);

    // Trap #2: Align on impact, seek by sync.impact_offset_ms
    const offsetSec = impactOffsetMs / 1000;
    const timeC = Math.max(0, Math.min(duration, currentTime + offsetSec));
    const dt = timeC - impactTime;

    // Turf & tee
    ctx.fillStyle = '#0d2215';
    ctx.fillRect(0, height * 0.88, width, height * 0.12);
    ctx.fillStyle = '#10b981';
    for (let x = 10; x < width; x += 15) {
      ctx.fillRect(x, height * 0.88 - 4, 2, 4);
    }

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
    const ballRadius = 34;
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

    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 11px monospace';
    ctx.fillText(`CAM 3 // SAMSUNG S23+ SUPER SLOW-MO (${impactMedia?.capture_fps ?? 240} FPS)`, 12, 22);

    ctx.fillStyle = Math.abs(dt) < 0.04 ? '#00f298' : '#94a3b8';
    ctx.fillText(`SHUTTER: 1/10000s | ${Math.abs(dt) < 0.04 ? 'COMPRESSION ACTIVE' : 'READY'}`, 12, 38);

    const frameC = Math.floor(timeC * (impactMedia?.container_fps ?? 30));
    ctx.fillStyle = '#64748b';
    ctx.fillText(`FR #${frameC.toString().padStart(5, '0')}`, width - 100, 22);
  }, [currentTime, duration, impactOffsetMs, currentShot, showGuides, hasImpactSource, impactMedia]);

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
          {!simulationMode && !videoErrors['face_on'] ? (
            <video
              ref={videoFaceOnRef}
              src={videoSrc}
              playsInline
              muted={isMuted}
              onError={() => handleVideoError('face_on')}
              className="w-full h-full object-contain"
            />
          ) : (
            <canvas ref={canvasFaceOnRef} width={640} height={380} className="w-full h-full object-contain" />
          )}
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
          {!simulationMode && !videoErrors['behind'] ? (
            <video
              ref={videoBehindRef}
              src={videoSrc}
              playsInline
              muted={isMuted}
              onError={() => handleVideoError('behind')}
              className="w-full h-full object-contain"
            />
          ) : (
            <canvas ref={canvasBehindRef} width={640} height={380} className="w-full h-full object-contain" />
          )}
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
          {!simulationMode && !videoErrors['impact'] ? (
            <video
              ref={videoImpactRef}
              src={videoSrc}
              playsInline
              muted={isMuted}
              onError={() => handleVideoError('impact')}
              className="w-full h-full object-contain"
            />
          ) : (
            <canvas ref={canvasImpactRef} width={640} height={380} className="w-full h-full object-contain" />
          )}
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

          {/* Simulation Mode Toggle */}
          <button
            onClick={() => setSimulationMode(!simulationMode)}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs border transition-colors ${
              isBoutique ? 'rounded-full font-serif' : 'rounded-lg font-mono'
            } ${
              simulationMode
                ? (isBoutique ? 'bg-[#D4AF37]/20 border-[#D4AF37]/40 text-[#E5C07B]' : 'bg-amber-500/15 border-amber-500/30 text-amber-300')
                : (isBoutique ? 'bg-[#C5A880]/20 border-[#C5A880]/40 text-[#C5A880]' : 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300')
            }`}
            title="Toggle between Canvas 3-Angle simulation and local MP4 streams"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{simulationMode ? 'Render: 3-Angle Simulation' : 'Render: Native MP4s'}</span>
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
