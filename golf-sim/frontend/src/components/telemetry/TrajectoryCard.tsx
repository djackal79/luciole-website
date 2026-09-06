import React, { useState } from 'react';
import type { TelemetryBlock } from '../../types/contract';
import { useThemeStore } from '../../store/themeStore';
import { AlertCircle, Mountain, ArrowDownRight, MoveHorizontal } from 'lucide-react';

interface TrajectoryCardProps {
  telemetry: TelemetryBlock | null;
  unit: 'yards' | 'meters';
}

export const TrajectoryCard: React.FC<TrajectoryCardProps> = ({ telemetry, unit }) => {
  const [viewMode, setViewMode] = useState<'side' | 'top'>('side');
  const { currentTheme } = useThemeStore();
  const isBoutique = currentTheme === 'boutique';

  if (!telemetry) {
    return (
      <div className={`p-6 flex flex-col items-center justify-center text-center transition-colors ${
        isBoutique 
          ? 'bg-stone-900/40 backdrop-blur-lg border border-[#C5A880]/20 shadow-xl rounded-2xl' 
          : 'bg-[#0b0e17] border border-neutral-800/80 rounded-xl font-mono'
      }`}>
        <AlertCircle className="w-8 h-8 text-neutral-600 mb-2" />
        <span className={`text-xs font-semibold ${isBoutique ? 'font-serif text-[#8E928F]' : 'text-neutral-400'}`}>FLIGHT TRAJECTORY</span>
        <span className="text-xs text-neutral-500 mt-1">Telemetry source absent for this shot</span>
      </div>
    );
  }

  const { ball, distance, flight } = telemetry;
  const unitFactor = unit === 'meters' ? 1.0 : 1.09361;
  const unitLabel = unit === 'meters' ? 'm' : 'yds';

  const hasRawCarry = distance.carry_m !== null;
  const hasFlight = flight != null;

  // Carry
  const carryDisplay = hasRawCarry 
    ? (distance.carry_m! * unitFactor).toFixed(1) 
    : hasFlight && flight.carry_m !== null
    ? (flight.carry_m! * unitFactor).toFixed(1) + ' est'
    : '—';

  // Total
  const totalDisplay = distance.total_m !== null 
    ? (distance.total_m! * unitFactor).toFixed(1) 
    : hasFlight && flight.total_m !== null
    ? (flight.total_m! * unitFactor).toFixed(1) + ' est'
    : '—';

  // Apex Height
  const apexDisplay = hasFlight && flight.apex_m !== null
    ? (unit === 'meters' ? `${flight.apex_m.toFixed(1)} M est` : `${(flight.apex_m * 3.28084).toFixed(1)} FT est`)
    : '—';

  // Descent Angle
  const descentAngle = hasFlight && flight.descent_angle_deg !== null
    ? `${flight.descent_angle_deg.toFixed(1)}° est`
    : '—';

  // Side Offline
  let offlineDisplay = '—';
  let totalOfflineYds = 0;
  if (hasFlight && flight.offline_m !== null) {
    totalOfflineYds = flight.offline_m * 1.09361;
    const offlineDir = flight.offline_m > 0.1 ? 'R' : flight.offline_m < -0.1 ? 'L' : 'C';
    const offlineDistVal = (Math.abs(flight.offline_m) * unitFactor).toFixed(1);
    offlineDisplay = `${offlineDistVal} ${unitLabel.toUpperCase()} ${offlineDir} est`;
  }

  // Flight shape from spin axis and launch direction
  let shapeBadge = 'Straight';
  const spinAxis = ball.spin_axis_deg ?? 0;
  const hla = ball.launch_direction_deg ?? 0;
  if (spinAxis < -2.0) {
    shapeBadge = hla > 0 ? 'Push Draw' : 'Draw';
  } else if (spinAxis > 2.0) {
    shapeBadge = hla < 0 ? 'Pull Fade' : 'Fade';
  } else if (Math.abs(hla) > 1.5) {
    shapeBadge = hla > 0 ? 'Push' : 'Pull';
  }

  return (
    <div className={`p-4 flex flex-col justify-between transition-colors ${
      isBoutique 
        ? 'bg-stone-900/40 backdrop-blur-lg border border-[#C5A880]/20 shadow-xl rounded-2xl' 
        : 'bg-[#0b0e17] border border-neutral-800/80 rounded-xl font-mono'
    }`}>
      {/* Card Header */}
      <div className={`w-full flex items-center justify-between border-b pb-2 mb-2 ${
        isBoutique ? 'border-[#C5A880]/15' : 'border-neutral-800'
      }`}>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium ${isBoutique ? 'font-serif text-[#8E928F]' : 'text-neutral-400'}`}>
            FLIGHT TRAJECTORY
          </span>

        </div>
        <div className={`flex items-center gap-1 p-0.5 text-[10px] ${
          isBoutique ? 'rounded-full bg-stone-900/60 border border-[#C5A880]/20' : 'rounded bg-neutral-900 border border-neutral-800 font-mono'
        }`}>
          <button
            onClick={() => setViewMode('side')}
            className={`px-2.5 py-0.5 transition-colors ${
              viewMode === 'side' 
                ? (isBoutique ? 'rounded-full bg-gradient-to-br from-[#E5C07B] to-[#C5A880] text-stone-900 font-bold shadow-sm font-serif' : 'rounded bg-emerald-500 text-black font-semibold') 
                : (isBoutique ? 'rounded-full text-[#8E928F] hover:text-white font-serif' : 'rounded text-neutral-400 hover:text-white')
            }`}
          >
            Apex Profile
          </button>
          <button
            onClick={() => setViewMode('top')}
            className={`px-2.5 py-0.5 transition-colors ${
              viewMode === 'top' 
                ? (isBoutique ? 'rounded-full bg-gradient-to-br from-[#E5C07B] to-[#C5A880] text-stone-900 font-bold shadow-sm font-serif' : 'rounded bg-cyan-500 text-black font-semibold') 
                : (isBoutique ? 'rounded-full text-[#8E928F] hover:text-white font-serif' : 'rounded text-neutral-400 hover:text-white')
            }`}
          >
            Overhead Radar
          </button>
        </div>
      </div>

      {/* SVG Canvas for Trajectory */}
      <div className="relative w-full h-44 my-1 flex items-center justify-center">
        {viewMode === 'side' ? (
          <svg viewBox="0 0 300 140" className="w-full h-full">
            <defs>
              <linearGradient id="boutiqueTrajectory" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#C5A880" />
                <stop offset="50%" stopColor="#D4AF37" />
                <stop offset="100%" stopColor="#E5C07B" />
              </linearGradient>
              <linearGradient id="cyberTrajectory" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#00f298" />
                <stop offset="100%" stopColor="#00d2ff" />
              </linearGradient>
            </defs>

            {/* Ground line */}
            <line x1="20" y1="120" x2="280" y2="120" stroke={isBoutique ? '#282F2B' : '#1e293b'} strokeWidth="2" />
            <text x="20" y="132" fill={isBoutique ? '#5A635E' : '#475569'} fontSize="8">TEE</text>
            <text x="270" y="132" fill={isBoutique ? '#5A635E' : '#475569'} fontSize="8">TARGET</text>

            {/* Parabolic Flight Curve */}
            <path
              d="M 30 120 Q 140 15 245 120"
              fill="none"
              stroke={isBoutique ? 'url(#boutiqueTrajectory)' : 'url(#cyberTrajectory)'}
              strokeWidth="3.5"
              strokeLinecap="round"
            />

            {/* Rollout dotted extension */}
            <line
              x1="245"
              y1="120"
              x2="265"
              y2="120"
              stroke={isBoutique ? '#C5A880' : '#00d2ff'}
              strokeWidth="2.5"
              strokeDasharray="2 2"
            />

            {/* Apex peak point indicator */}
            <circle cx="138" cy="42" r="3.5" fill={isBoutique ? '#D4AF37' : '#00f298'} />
            <text 
              x="138" 
              y="32" 
              fill={isBoutique ? '#E5C07B' : '#00f298'} 
              fontSize="8" 
              fontWeight="bold"
              textAnchor="middle"
            >
              APEX {apexDisplay}
            </text>

            {/* Carry landing marker */}
            <circle cx="245" cy="120" r="3.5" fill={isBoutique ? '#D4AF37' : '#00f298'} />
            <text x="235" y="112" fill={isBoutique ? '#D4AF37' : '#00f298'} fontSize="8" textAnchor="middle">
              {carryDisplay}
            </text>

            {/* Total rollout marker */}
            <circle cx="265" cy="120" r="3.5" fill={isBoutique ? '#C5A880' : '#00d2ff'} />
            <text x="272" y="112" fill={isBoutique ? '#C5A880' : '#00d2ff'} fontSize="8">
              {totalDisplay}
            </text>

            {/* Launch angle arc */}
            <path
              d="M 50 120 A 20 20 0 0 0 47 105"
              fill="none"
              stroke={isBoutique ? '#D4AF37' : '#facc15'}
              strokeWidth="1.5"
            />
            <text x="56" y="112" fill={isBoutique ? '#D4AF37' : '#facc15'} fontSize="8">
              {ball.launch_angle_deg ?? '—'}°
            </text>
          </svg>
        ) : (
          <svg viewBox="0 0 300 140" className="w-full h-full">
            <line x1="150" y1="130" x2="150" y2="15" stroke={isBoutique ? '#282F2B' : '#334155'} strokeWidth="1" strokeDasharray="3 3" />
            <text x="150" y="138" fill={isBoutique ? '#5A635E' : '#475569'} fontSize="8" textAnchor="middle">TEE</text>
            <text x="150" y="12" fill={isBoutique ? '#5A635E' : '#475569'} fontSize="8" textAnchor="middle">CENTER</text>

            <circle cx="150" cy="130" r="40" fill="none" stroke={isBoutique ? '#1F2622' : '#131926'} strokeWidth="1" />
            <circle cx="150" cy="130" r="80" fill="none" stroke={isBoutique ? '#1F2622' : '#131926'} strokeWidth="1" />

            {(() => {
              const dirOffset = (ball.launch_direction_deg ?? 0) * 8;
              const curveOffset = -(ball.spin_axis_deg ?? 0) * 8;
              const endX = 150 + dirOffset + curveOffset;
              const controlX = 150 + dirOffset * 1.5;
              return (
                <>
                  <path
                    d={`M 150 130 Q ${controlX} 70 ${endX} 25`}
                    fill="none"
                    stroke={isBoutique ? '#D4AF37' : '#00f298'}
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  <circle cx={endX} cy="25" r="4" fill={isBoutique ? '#C5A880' : '#00d2ff'} />
                </>
              );
            })()}
          </svg>
        )}

        <div className={`absolute bottom-1 right-1 px-2.5 py-0.5 text-[10px] font-semibold border ${
          isBoutique 
            ? 'rounded-full bg-[#D4AF37]/15 border-[#D4AF37]/30 text-[#E5C07B] font-serif' 
            : 'rounded bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-mono'
        }`}>
          Shape: {shapeBadge}
        </div>
      </div>

      {/* Upgraded Bottom Row: Apex Height, Descent Angle, and Side Offline */}
      <div className={`w-full grid grid-cols-3 gap-2 text-center pt-2.5 border-t text-xs ${
        isBoutique ? 'border-[#C5A880]/15' : 'border-neutral-800 font-mono'
      }`}>
        {/* 1. Apex Height */}
        <div>
          <div className={`text-[10px] flex items-center justify-center gap-1 ${isBoutique ? 'font-serif text-[#8E928F]' : 'text-neutral-500'}`}>
            <Mountain className="w-3 h-3 text-amber-400" />
            <span>APEX HEIGHT</span>
          </div>
          <div className={`mt-0.5 ${isBoutique ? 'font-sans font-black text-[#F4F4F2] text-sm' : 'font-bold text-neutral-100'}`}>
            {apexDisplay}
          </div>
        </div>

        {/* 2. Descent Angle */}
        <div>
          <div className={`text-[10px] flex items-center justify-center gap-1 ${isBoutique ? 'font-serif text-[#8E928F]' : 'text-neutral-500'}`}>
            <ArrowDownRight className="w-3 h-3 text-cyan-400" />
            <span>DESCENT ANGLE</span>
          </div>
          <div className={`mt-0.5 ${isBoutique ? 'font-sans font-black text-[#D4AF37] text-sm' : 'font-bold text-cyan-400'}`}>
            {descentAngle}
          </div>
        </div>

        {/* 3. Side Offline (L/R) */}
        <div>
          <div className={`text-[10px] flex items-center justify-center gap-1 ${isBoutique ? 'font-serif text-[#8E928F]' : 'text-neutral-500'}`}>
            <MoveHorizontal className="w-3 h-3 text-emerald-400" />
            <span>SIDE OFFLINE</span>
          </div>
          <div className={`mt-0.5 ${
            isBoutique 
              ? 'font-sans font-black text-[#E5C07B] text-sm' 
              : (totalOfflineYds > 0.2 ? 'text-cyan-400 font-bold' : totalOfflineYds < -0.2 ? 'text-amber-400 font-bold' : 'text-emerald-400 font-bold')
          }`}>
            {offlineDisplay}
          </div>
        </div>
      </div>
    </div>
  );
};
