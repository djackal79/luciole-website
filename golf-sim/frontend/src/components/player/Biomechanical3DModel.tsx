import React, { useRef, useEffect, useState } from 'react';
import { useShotStore } from '../../store/shotStore';
import { usePlayerStore } from '../../store/playerStore';
import { useThemeStore } from '../../store/themeStore';
import { Activity, RotateCcw, Box, Compass, Eye, Sparkles } from 'lucide-react';

type PerspectiveAngle = 'front' | 'side' | 'overhead' | 'iso';

export const Biomechanical3DModel: React.FC = () => {
  const currentShot = useShotStore((s) => s.getCurrentShot());
  const { currentTime, duration, isPlaying } = usePlayerStore();
  const { currentTheme } = useThemeStore();
  const isBoutique = currentTheme === 'boutique';
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [perspective, setPerspective] = useState<PerspectiveAngle>('iso');
  const [showPlane, setShowPlane] = useState(true);
  const [showJointTracers, setShowJointTracers] = useState(true);

  // 3D Rendering simulation of biomechanical skeleton and swing plane
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Dark grid background
    ctx.fillStyle = '#06080d';
    ctx.fillRect(0, 0, width, height);

    const centerX = width / 2;
    const centerY = height * 0.58;

    // Perspective transformation matrices / angles
    let rotX = 0.25;
    let rotY = 0.45;

    if (perspective === 'front') {
      rotX = 0;
      rotY = 0;
    } else if (perspective === 'side') {
      rotX = 0;
      rotY = Math.PI / 2;
    } else if (perspective === 'overhead') {
      rotX = Math.PI / 2;
      rotY = 0;
    } else if (perspective === 'iso') {
      rotX = 0.35;
      rotY = 0.65;
    }

    // 3D Projector helper
    const project3D = (x: number, y: number, z: number): [number, number] => {
      // Rotate around Y axis
      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);
      const x1 = x * cosY - z * sinY;
      const z1 = x * sinY + z * cosY;

      // Rotate around X axis
      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);
      const y2 = y * cosX - z1 * sinX;
      const z2 = y * sinX + z1 * cosX;

      const scale = 1.35;
      const screenX = centerX + x1 * scale;
      const screenY = centerY + y2 * scale;
      return [screenX, screenY];
    };

    // Draw 3D floor circular grid
    ctx.strokeStyle = '#141d2e';
    ctx.lineWidth = 1;
    for (let r = 40; r <= 160; r += 40) {
      ctx.beginPath();
      for (let th = 0; th <= Math.PI * 2; th += 0.2) {
        const [gx, gy] = project3D(Math.cos(th) * r, 120, Math.sin(th) * r);
        if (th === 0) ctx.moveTo(gx, gy);
        else ctx.lineTo(gx, gy);
      }
      ctx.stroke();
    }

    // Draw Target line through floor
    const [tlx1, tly1] = project3D(-180, 120, 0);
    const [tlx2, tly2] = project3D(180, 120, 0);
    ctx.strokeStyle = '#223048';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(tlx1, tly1);
    ctx.lineTo(tlx2, tly2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Compute dynamic kinematics based on current time
    const t = currentTime;
    const impactT = 2.45;
    const isAtImpact = Math.abs(t - impactT) < 0.08;

    let swingPhase = 'ADDRESS';
    let progress = 0;
    let pelvisRot = 0;
    let shoulderRot = 0;
    let leadArmElev = 0.5;
    let clubHeadProgress = 0;

    if (t < 0.7) {
      swingPhase = 'ADDRESS';
      pelvisRot = 0;
      shoulderRot = 0;
      clubHeadProgress = 0;
    } else if (t < 1.6) {
      swingPhase = 'BACKSWING';
      progress = (t - 0.7) / (1.6 - 0.7);
      pelvisRot = -progress * 42;
      shoulderRot = -progress * 90;
      leadArmElev = 0.5 + progress * 1.8;
      clubHeadProgress = -progress * 180;
    } else if (t < impactT) {
      swingPhase = 'DOWNSWING';
      progress = (t - 1.6) / (impactT - 1.6);
      pelvisRot = -42 + progress * 80;
      shoulderRot = -90 + progress * 115;
      leadArmElev = 2.3 - progress * 1.8;
      clubHeadProgress = -180 + progress * 180;
    } else {
      swingPhase = 'FOLLOW-THROUGH';
      progress = Math.min(1, (t - impactT) / (duration - impactT));
      pelvisRot = 38 + progress * 50;
      shoulderRot = 25 + progress * 75;
      leadArmElev = 0.5 + progress * 1.7;
      clubHeadProgress = progress * 180;
    }

    const radPelvis = (pelvisRot * Math.PI) / 180;
    const radShoulder = (shoulderRot * Math.PI) / 180;

    // Biomechanical Joints (X, Y, Z coordinates in 3D world space)
    // Feet fixed on floor
    const leadFoot: [number, number, number] = [25, 120, 0];
    const trailFoot: [number, number, number] = [-30, 120, -5];

    const leadKnee: [number, number, number] = [20 + Math.sin(radPelvis) * 5, 75, Math.cos(radPelvis) * 5];
    const trailKnee: [number, number, number] = [-25, 75, -5];

    const pelvisCenter: [number, number, number] = [-2, 35, 0];
    const leadHip: [number, number, number] = [
      pelvisCenter[0] + Math.cos(radPelvis) * 16,
      pelvisCenter[1],
      pelvisCenter[2] + Math.sin(radPelvis) * 16
    ];
    const trailHip: [number, number, number] = [
      pelvisCenter[0] - Math.cos(radPelvis) * 16,
      pelvisCenter[1],
      pelvisCenter[2] - Math.sin(radPelvis) * 16
    ];

    const spineMid: [number, number, number] = [0, 0, 5];
    const spineTop: [number, number, number] = [2, -35, 12];
    const head: [number, number, number] = [4, -58, 14];

    const leadShoulder: [number, number, number] = [
      spineTop[0] + Math.cos(radShoulder) * 24,
      spineTop[1],
      spineTop[2] + Math.sin(radShoulder) * 24
    ];
    const trailShoulder: [number, number, number] = [
      spineTop[0] - Math.cos(radShoulder) * 24,
      spineTop[1],
      spineTop[2] - Math.sin(radShoulder) * 24
    ];

    // Hands & Clubhead
    const handRadius = 38;
    const handAngle = (clubHeadProgress * Math.PI) / 180;
    const hands: [number, number, number] = [
      spineTop[0] + Math.sin(handAngle) * handRadius * 0.8,
      spineTop[1] + 35 + Math.cos(handAngle) * 30,
      spineTop[2] - Math.cos(handAngle) * handRadius * 0.7
    ];

    const clubHead: [number, number, number] = [
      hands[0] + Math.sin(handAngle + 0.3) * 75,
      hands[1] + Math.cos(handAngle + 0.3) * 60,
      hands[2] - Math.cos(handAngle + 0.3) * 65
    ];

    // Draw Swing Plane 3D Ellipse
    if (showPlane) {
      ctx.strokeStyle = 'rgba(0, 242, 152, 0.25)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let a = 0; a <= Math.PI * 2; a += 0.15) {
        const px = spineTop[0] + Math.sin(a) * 125;
        const py = spineTop[1] + 20 + Math.cos(a) * 90;
        const pz = spineTop[2] - Math.cos(a) * 85;
        const [sx, sy] = project3D(px, py, pz);
        if (a === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();
    }

    // Connect Skeleton Bones
    const drawBone = (p1: [number, number, number], p2: [number, number, number], color = '#64748b', width = 3) => {
      const [x1, y1] = project3D(...p1);
      const [x2, y2] = project3D(...p2);
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    };

    const drawJoint = (p: [number, number, number], color = '#00f298', radius = 3.5) => {
      const [x, y] = project3D(...p);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    };

    // Lower body bones
    drawBone(leadFoot, leadKnee, '#334155', 4);
    drawBone(leadKnee, leadHip, '#475569', 4);
    drawBone(trailFoot, trailKnee, '#334155', 4);
    drawBone(trailKnee, trailHip, '#475569', 4);
    drawBone(leadHip, trailHip, '#00d2ff', 4);

    // Spine & Head
    drawBone(pelvisCenter, spineMid, '#94a3b8', 6);
    drawBone(spineMid, spineTop, '#94a3b8', 6);
    drawBone(spineTop, head, '#e2e8f0', 5);

    // Shoulders
    drawBone(leadShoulder, trailShoulder, '#00f298', 5);

    // Arms
    drawBone(leadShoulder, hands, '#38bdf8', 3.5);
    drawBone(trailShoulder, hands, '#38bdf8', 3.5);

    // Club Shaft & Head
    drawBone(hands, clubHead, '#facc15', 3);

    // Joints
    if (showJointTracers) {
      [leadFoot, trailFoot, leadKnee, trailKnee, leadHip, trailHip, pelvisCenter, spineMid, spineTop, leadShoulder, trailShoulder, hands].forEach(j => {
        drawJoint(j, '#00d2ff', 3);
      });
      drawJoint(head, '#ffffff', 6);
      drawJoint(clubHead, '#facc15', 5);
    }

    // Impact burst in 3D
    if (isAtImpact) {
      const [hx, hy] = project3D(...clubHead);
      ctx.strokeStyle = '#00f298';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(hx, hy, 18, 0, Math.PI * 2);
      ctx.stroke();
    }

    // HUD overlays on Canvas
    ctx.fillStyle = '#00f298';
    ctx.font = 'bold 11px monospace';
    ctx.fillText(`BIOMECHANICS 3D // PHASE: ${swingPhase}`, 14, 24);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px monospace';
    ctx.fillText(`PELVIC ROTATION: ${Math.round(pelvisRot)}°`, 14, 40);
    ctx.fillText(`SHOULDER TURN: ${Math.round(shoulderRot)}°`, 14, 54);
    ctx.fillText(`SWING PLANE: 62.4°`, 14, 68);

  }, [currentTime, duration, perspective, showPlane, showJointTracers]);

  return (
    <div className={`p-3 sm:p-4 shadow-2xl flex flex-col gap-3 transition-colors duration-300 ${
      isBoutique 
        ? 'bg-stone-900/40 backdrop-blur-lg border border-[#C5A880]/20 shadow-xl rounded-2xl text-[#F4F4F2]' 
        : 'bg-[#0a0c13] border border-neutral-800/80 rounded-2xl text-white'
    }`}>
      {/* Top Toolbar */}
      <div className={`flex flex-wrap items-center justify-between gap-2 border-b pb-3 ${
        isBoutique ? 'border-[#C5A880]/15' : 'border-neutral-800'
      }`}>
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 flex items-center justify-center ${
            isBoutique 
              ? 'rounded-full bg-[#C5A880]/15 border border-[#C5A880]/30 text-[#E5C07B]' 
              : 'rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
          }`}>
            <Box className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className={`text-xs font-bold uppercase tracking-wider ${
                isBoutique ? 'font-serif text-[#F4F4F2]' : 'font-mono text-white'
              }`}>
                3D Swing Biomechanical Model
              </h3>
              <span className={`px-2 py-0.5 border text-[9px] font-bold ${
                isBoutique 
                  ? 'rounded-full bg-[#D4AF37]/20 text-[#E5C07B] border-[#D4AF37]/40 font-serif' 
                  : 'rounded bg-amber-500/20 text-amber-300 border-amber-500/30 font-mono'
              }`}>
                Placeholder
              </span>
            </div>
            <p className={`text-[10px] ${isBoutique ? 'font-serif text-[#8E928F]' : 'font-mono text-neutral-500'}`}>
              Future integration: Markerless AI Pose Estimation & Swing Plane Reconstruction
            </p>
          </div>
        </div>

        {/* Perspective buttons */}
        <div className={`flex items-center gap-1 border p-0.5 text-xs ${
          isBoutique ? 'rounded-full bg-stone-900/60 border-[#C5A880]/20 font-serif' : 'rounded-lg bg-neutral-900 border-neutral-800 font-mono'
        }`}>
          {(['iso', 'front', 'side', 'overhead'] as PerspectiveAngle[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setPerspective(mode)}
              className={`px-2.5 py-0.5 transition-colors capitalize ${
                isBoutique ? 'rounded-full' : 'rounded'
              } ${
                perspective === mode 
                  ? (isBoutique ? 'bg-gradient-to-br from-[#E5C07B] to-[#C5A880] text-stone-900 font-bold shadow-sm' : 'bg-emerald-500 text-black font-semibold') 
                  : (isBoutique ? 'text-[#8E928F] hover:text-white' : 'text-neutral-400 hover:text-white')
              }`}
            >
              {mode === 'iso' ? 'Isometric' : mode === 'side' ? 'Side DTL' : mode}
            </button>
          ))}
        </div>
      </div>

      {/* 3D Canvas Viewport */}
      <div className="relative w-full h-[360px] sm:h-[420px] bg-black rounded-xl overflow-hidden shadow-inner flex items-center justify-center">
        <canvas ref={canvasRef} width={800} height={450} className="w-full h-full object-contain" />

        {/* Feature Toggles */}
        <div className="absolute bottom-3 left-3 flex items-center gap-2 z-20">
          <button
            onClick={() => setShowPlane(!showPlane)}
            className={`px-3 py-1 text-[10px] border transition-colors ${
              isBoutique ? 'rounded-full font-serif' : 'rounded font-mono'
            } ${
              showPlane 
                ? (isBoutique ? 'bg-gradient-to-br from-[#E5C07B] to-[#C5A880] text-stone-900 font-bold border-transparent shadow-sm' : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400') 
                : (isBoutique ? 'bg-stone-900/80 border-[#C5A880]/20 text-[#8E928F]' : 'bg-neutral-800/80 border-neutral-700 text-neutral-400')
            }`}
          >
            {showPlane ? 'Plane: Active' : 'Plane: Hidden'}
          </button>
          <button
            onClick={() => setShowJointTracers(!showJointTracers)}
            className={`px-3 py-1 text-[10px] border transition-colors ${
              isBoutique ? 'rounded-full font-serif' : 'rounded font-mono'
            } ${
              showJointTracers 
                ? (isBoutique ? 'bg-[#C5A880]/20 border-[#C5A880]/40 text-[#C5A880]' : 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400') 
                : (isBoutique ? 'bg-stone-900/80 border-[#C5A880]/20 text-[#8E928F]' : 'bg-neutral-800/80 border-neutral-700 text-neutral-400')
            }`}
          >
            {showJointTracers ? 'Joints: ON' : 'Joints: OFF'}
          </button>
        </div>

        {/* Biomechanics Spec Callout */}
        <div className={`absolute top-3 right-3 max-w-xs backdrop-blur-md border p-2.5 text-left text-[10px] ${
          isBoutique 
            ? 'bg-stone-900/80 border-[#C5A880]/20 rounded-2xl font-serif' 
            : 'bg-neutral-900/85 border-neutral-800 rounded-xl font-mono'
        }`}>
          <div className={`flex items-center gap-1.5 font-bold mb-1 ${
            isBoutique ? 'text-[#D4AF37]' : 'text-emerald-400'
          }`}>
            <Sparkles className="w-3 h-3" />
            <span>Telemetry Pipeline Ready</span>
          </div>
          <p className={`leading-relaxed ${isBoutique ? 'text-[#8E928F]' : 'text-neutral-400'}`}>
            Ready to receive 3D quaternion or joint vectors from MediaPipe / OpenPose / Samsung depth sensor streams.
          </p>
        </div>
      </div>
    </div>
  );
};
