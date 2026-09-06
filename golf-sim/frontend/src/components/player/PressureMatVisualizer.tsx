import React, { useRef, useEffect } from 'react';
import { useShotStore } from '../../store/shotStore';
import { usePlayerStore } from '../../store/playerStore';
import { useThemeStore } from '../../store/themeStore';
import { Footprints, Activity, Gauge, Flame, Sparkles, Clock, AlertCircle } from 'lucide-react';
import { usePressureData } from '../../hooks/usePressureData';

export const PressureMatVisualizer: React.FC = () => {
  const currentShot = useShotStore((s) => s.getCurrentShot());
  const { currentTime, duration, masterImpactTime } = usePlayerStore();
  const { currentTheme } = useThemeStore();
  const isBoutique = currentTheme === 'boutique';
  const canvasRef = useRef<HTMLCanvasElement | null>(null);


  const pressureData = usePressureData();
  const samples = pressureData?.samples ?? [];
  const status = currentShot?.pressure?.status ?? 'unavailable';
  
  // Find or interpolate sample at currentTime
  const currentSample = (() => {
    if (!samples.length) {
      return {
        t_ms: currentTime * 1000,
        lead_pct: 55,
        trail_pct: 45,
        lead_heel_pct: 30,
        lead_toe_pct: 25,
        trail_heel_pct: 27,
        trail_toe_pct: 18,
        cop: { x_mm: 0, y_mm: 0 },
        grf_n: 800
      };
    }
    const impactTime = pressureData?.impact_ms ?? 2450;
    const t_from_impact_sec = currentTime - masterImpactTime; // master impact time
    const target_t_ms = impactTime + (t_from_impact_sec * 1000);

    let closest = samples[0];
    let minDiff = Math.abs(closest.t_ms - target_t_ms);
    for (let i = 1; i < samples.length; i++) {
      const diff = Math.abs(samples[i].t_ms - target_t_ms);
      if (diff < minDiff) {
        minDiff = diff;
        closest = samples[i];
      }
    }
    // ensure fallback fields
    return {
      ...closest,
      lead_heel_pct: 25,
      lead_toe_pct: closest.lead_pct - 25,
      trail_heel_pct: 25,
      trail_toe_pct: closest.trail_pct - 25,
    };
  })();


  // Render Dual Foot Pressure Mat & CoP Trace on Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Mat surface
    ctx.fillStyle = '#07090e';
    ctx.fillRect(0, 0, width, height);

    // Grid pattern
    ctx.strokeStyle = '#121826';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 25) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 25) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Center Stance Reference
    ctx.strokeStyle = '#223048';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(width / 2, 20);
    ctx.lineTo(width / 2, height - 20);
    ctx.moveTo(30, height / 2);
    ctx.lineTo(width - 30, height / 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Stance layout coordinates
    const footW = 100;
    const footH = 180;
    const trailX = width * 0.28;  // Right foot for right-handed golfer
    const leadX = width * 0.72;   // Left foot (target side)
    const footY = height * 0.50;

    // Foot Outline Helper
    const drawFootHeatmap = (
      centerX: number,
      centerY: number,
      heelPct: number,
      toePct: number,
      totalPct: number,
      isLead: boolean
    ) => {
      ctx.save();
      ctx.translate(centerX, centerY);

      // Foot sole shape
      ctx.beginPath();
      // Outer foot curve
      ctx.ellipse(0, 35, footW * 0.38, footH * 0.28, 0, 0, Math.PI * 2); // heel
      ctx.ellipse(0, -35, footW * 0.44, footH * 0.32, 0, 0, Math.PI * 2); // forefoot
      ctx.fillStyle = '#0f172a';
      ctx.fill();
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Heel pressure gradient
      const heelIntensity = Math.min(1, heelPct / 60);
      const heelGrad = ctx.createRadialGradient(0, 35, 5, 0, 35, 45);
      heelGrad.addColorStop(0, `rgba(239, 68, 68, ${heelIntensity * 0.95})`);
      heelGrad.addColorStop(0.5, `rgba(245, 158, 11, ${heelIntensity * 0.7})`);
      heelGrad.addColorStop(0.8, `rgba(16, 185, 129, ${heelIntensity * 0.4})`);
      heelGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');
      ctx.fillStyle = heelGrad;
      ctx.beginPath();
      ctx.ellipse(0, 35, 38, 45, 0, 0, Math.PI * 2);
      ctx.fill();

      // Forefoot / Toe pressure gradient
      const toeIntensity = Math.min(1, toePct / 50);
      const toeGrad = ctx.createRadialGradient(0, -35, 5, 0, -35, 50);
      toeGrad.addColorStop(0, `rgba(239, 68, 68, ${toeIntensity * 0.95})`);
      toeGrad.addColorStop(0.5, `rgba(245, 158, 11, ${toeIntensity * 0.7})`);
      toeGrad.addColorStop(0.8, `rgba(16, 185, 129, ${toeIntensity * 0.4})`);
      toeGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');
      ctx.fillStyle = toeGrad;
      ctx.beginPath();
      ctx.ellipse(0, -35, 42, 50, 0, 0, Math.PI * 2);
      ctx.fill();

      // Foot Label & Total %
      ctx.fillStyle = totalPct > 50 ? '#00f298' : '#94a3b8';
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${totalPct}%`, 0, 95);

      ctx.fillStyle = '#64748b';
      ctx.font = '10px monospace';
      ctx.fillText(isLead ? 'LEAD FOOT' : 'TRAIL FOOT', 0, 110);
      ctx.fillText(`Heel ${heelPct}% • Toe ${toePct}%`, 0, -85);

      ctx.restore();
    };

    // Draw Trail foot & Lead foot
    drawFootHeatmap(trailX, footY, currentSample.trail_heel_pct, currentSample.trail_toe_pct, currentSample.trail_pct, false);
    drawFootHeatmap(leadX, footY, currentSample.lead_heel_pct, currentSample.lead_toe_pct, currentSample.lead_pct, true);

    // Draw Complete Center of Pressure (CoP) Path Trace
    if (samples.length > 1) {
      ctx.strokeStyle = 'rgba(0, 242, 152, 0.4)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();

      samples.forEach((s, idx) => {
        // Map cop_x (-1 to 1) and cop_y (-1 to 1) to screen
        const sx = width / 2 + (s.cop.x_mm / 500) * (width * 0.32);
        const sy = height / 2 - (s.cop.y_mm / 500) * (height * 0.32);
        if (idx === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      });
      ctx.stroke();

      // Mark Impact snapshot on the path
      const impactSample = samples.find(s => Math.abs(s.t_ms - (pressureData?.impact_ms ?? 2450)) < 0.05) || samples[Math.floor(samples.length * 0.6)];
      if (impactSample) {
        const ix = width / 2 + (impactSample.cop.x_mm / 500) * (width * 0.32);
        const iy = height / 2 - (impactSample.cop.y_mm / 500) * (height * 0.32);
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.arc(ix, iy, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#facc15';
        ctx.font = 'bold 9px monospace';
        ctx.fillText('★ IMPACT CoP', ix + 8, iy - 4);
      }
    }

    // Draw Current Active CoP Marker
    const curX = width / 2 + (currentSample.cop.x_mm / 500) * (width * 0.32);
    const curY = height / 2 - (currentSample.cop.y_mm / 500) * (height * 0.32);

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.fillStyle = '#00f298';
    ctx.beginPath();
    ctx.arc(curX, curY, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Pulse halo
    ctx.strokeStyle = 'rgba(0, 242, 152, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(curX, curY, 14, 0, Math.PI * 2);
    ctx.stroke();

  }, [currentSample, samples]);

  return (
    <div className={`p-3 sm:p-4 shadow-2xl flex flex-col gap-4 transition-colors duration-300 ${
      isBoutique 
        ? 'bg-stone-900/40 backdrop-blur-lg border border-[#C5A880]/20 shadow-xl rounded-2xl text-[#F4F4F2]' 
        : 'bg-[#0a0c13] border border-neutral-800/80 rounded-2xl text-white'
    }`}>
      {/* Header Info */}
      <div className={`flex flex-wrap items-center justify-between gap-2 border-b pb-3 ${
        isBoutique ? 'border-[#C5A880]/15' : 'border-neutral-800'
      }`}>
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 flex items-center justify-center ${
            isBoutique 
              ? 'rounded-full bg-[#C5A880]/15 border border-[#C5A880]/30 text-[#E5C07B]' 
              : 'rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
          }`}>
            <Footprints className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className={`text-xs font-bold uppercase tracking-wider ${
                isBoutique ? 'font-serif text-[#F4F4F2]' : 'font-mono text-white'
              }`}>
                Dual Force / Pressure Mat (Weight Distribution)
              </h3>
              <span className={`px-2 py-0.5 border text-[9px] font-bold ${
                isBoutique 
                  ? 'rounded-full bg-[#D4AF37]/20 text-[#E5C07B] border-[#D4AF37]/40 font-serif' 
                  : 'rounded bg-amber-500/20 text-amber-300 border-amber-500/30 font-mono'
              }`}>
                {status === 'ready' ? 'Live Tracking' : 'Awaiting hardware'}
              </span>
            </div>
            <p className={`text-[10px] ${isBoutique ? 'font-serif text-[#8E928F]' : 'font-mono text-neutral-500'}`}>
              Real-time Ground Reaction Force (GRF) & Center of Pressure (CoP) trajectory
            </p>
          </div>
        </div>

        {/* Live Balance Chips */}
        <div className="flex items-center gap-3 text-xs">
          <div className={`flex items-center gap-1.5 px-3 py-1 border ${
            isBoutique 
              ? 'rounded-full bg-stone-900/60 border-[#C5A880]/20 font-serif' 
              : 'rounded-lg bg-neutral-900 border-neutral-800 font-mono'
          }`}>
            <span className={`text-[10px] ${isBoutique ? 'text-[#8E928F]' : 'text-neutral-500'}`}>TRAIL:</span>
            <span className={`font-black ${isBoutique ? 'font-sans text-[#C5A880]' : 'text-amber-400'}`}>{currentSample.trail_pct}%</span>
            <span className={isBoutique ? 'text-stone-700' : 'text-neutral-600'}>|</span>
            <span className={`text-[10px] ${isBoutique ? 'text-[#8E928F]' : 'text-neutral-500'}`}>LEAD:</span>
            <span className={`font-black ${isBoutique ? 'font-sans text-[#D4AF37]' : 'text-emerald-400'}`}>{currentSample.lead_pct}%</span>
          </div>

          <div className={`flex items-center gap-1.5 px-3 py-1 border ${
            isBoutique 
              ? 'rounded-full bg-stone-900/60 border-[#C5A880]/20 font-serif' 
              : 'rounded-lg bg-neutral-900 border-neutral-800 font-mono'
          }`}>
            <Gauge className={`w-3.5 h-3.5 ${isBoutique ? 'text-[#D4AF37]' : 'text-cyan-400'}`} />
            <span className={`font-black ${isBoutique ? 'font-sans text-[#E5C07B]' : 'text-cyan-400'}`}>
              {currentSample.grf_n ?? 820} N
            </span>
          </div>
        </div>
      </div>

      {/* Dynamic Weight Balance Bar */}
      <div className="flex flex-col gap-1">
        <div className={`flex items-center justify-between text-[11px] ${isBoutique ? 'font-serif' : 'font-mono'}`}>
          <span className={`font-semibold ${isBoutique ? 'text-[#C5A880]' : 'text-amber-400'}`}>
            Trail Foot ({currentSample.trail_pct}%)
          </span>
          <span className={`font-medium ${isBoutique ? 'text-[#8E928F]' : 'text-neutral-400'}`}>
            Weight Transfer Playhead
          </span>
          <span className={`font-semibold ${isBoutique ? 'text-[#D4AF37]' : 'text-emerald-400'}`}>
            Lead Foot ({currentSample.lead_pct}%)
          </span>
        </div>
        <div className={`w-full h-3 rounded-full overflow-hidden flex p-0.5 border ${
          isBoutique ? 'bg-stone-900/60 border-[#C5A880]/20' : 'bg-neutral-900 border-neutral-800'
        }`}>
          <div 
            className={`h-full rounded-l-full transition-all duration-75 ${
              isBoutique 
                ? 'bg-gradient-to-r from-[#997E58] to-[#C5A880]' 
                : 'bg-gradient-to-r from-amber-500 to-amber-400'
            }`}
            style={{ width: `${currentSample.trail_pct}%` }}
          />
          <div 
            className={`h-full rounded-r-full transition-all duration-75 ${
              isBoutique 
                ? 'bg-gradient-to-r from-[#C5A880] to-[#D4AF37]' 
                : 'bg-gradient-to-r from-emerald-400 to-cyan-400'
            }`}
            style={{ width: `${currentSample.lead_pct}%` }}
          />
        </div>
      </div>

      {/* Mat Canvas */}
      <div className="relative w-full h-[320px] sm:h-[380px] bg-black rounded-xl overflow-hidden shadow-inner flex items-center justify-center">
        <canvas ref={canvasRef} width={800} height={420} className="w-full h-full object-contain" />

        {/* Legend */}
        <div className={`absolute top-3 left-3 flex items-center gap-3 backdrop-blur-md px-3 py-1.5 border text-[10px] ${
          isBoutique 
            ? 'rounded-full bg-stone-900/80 border-[#C5A880]/20 font-serif' 
            : 'rounded-lg bg-neutral-950/80 border-neutral-800 font-mono'
        }`}>
          <div className="flex items-center gap-1">
            <span className={`w-2.5 h-2.5 rounded-full ${isBoutique ? 'bg-[#D4AF37]' : 'bg-emerald-400'}`} />
            <span className={isBoutique ? 'text-[#F4F4F2]' : 'text-neutral-300'}>Active CoP</span>
          </div>
          <div className="flex items-center gap-1">
            <span className={`w-2.5 h-2.5 rounded-full ${isBoutique ? 'bg-[#C5A880]' : 'bg-amber-400'}`} />
            <span className={isBoutique ? 'text-[#F4F4F2]' : 'text-neutral-300'}>Impact CoP</span>
          </div>
          <div className="flex items-center gap-1">
            <span className={`w-4 h-0.5 ${isBoutique ? 'bg-[#D4AF37]/60' : 'bg-emerald-500/60'}`} />
            <span className={isBoutique ? 'text-[#8E928F]' : 'text-neutral-400'}>Trace</span>
          </div>
        </div>

        {/* Hardware integration pill */}
        <div className={`absolute bottom-3 right-3 border px-3 py-1 text-[10px] flex items-center gap-1.5 ${
          isBoutique 
            ? 'rounded-full bg-stone-900/80 border-[#C5A880]/20 text-[#8E928F] font-serif' 
            : 'rounded bg-neutral-900/80 border-neutral-800 text-neutral-400 font-mono'
        }`}>
          <Sparkles className={`w-3 h-3 ${isBoutique ? 'text-[#D4AF37]' : 'text-emerald-400'}`} />
          <span>Hardware Unbuilt • Schema Reserved for Contract v1.1</span>
        </div>
      </div>
    </div>
  );
};
