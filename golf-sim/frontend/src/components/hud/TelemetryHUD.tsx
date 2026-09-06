import React, { useState } from 'react';
import { useShotStore } from '../../store/shotStore';
import { useThemeStore } from '../../store/themeStore';
import { ClubFaceVisualizer } from '../telemetry/ClubFaceVisualizer';
import { TrajectoryCard } from '../telemetry/TrajectoryCard';
import { 
  Compass, 
  Gauge, 
  ArrowUpRight, 
  ArrowUpLeft, 
  AlertCircle,
  Calculator
} from 'lucide-react';

export const TelemetryHUD: React.FC = () => {
  const currentShot = useShotStore((s) => s.getCurrentShot());
  const distanceUnit = useShotStore((s) => s.distanceUnit);
  const toggleDistanceUnit = useShotStore((s) => s.toggleDistanceUnit);
  const { currentTheme } = useThemeStore();
  const isBoutique = currentTheme === 'boutique';

  const [useBallisticsEstimator, setUseBallisticsEstimator] = useState(false);

  if (!currentShot) {
    return (
      <div className={`border rounded-2xl p-8 text-center font-mono transition-colors ${
        isBoutique ? 'bg-[#181C1A] border-stone-800 text-[#8E928F]' : 'bg-[#0b0e17] border-neutral-800 text-neutral-500'
      }`}>
        Waiting for shot trigger...
      </div>
    );
  }

  const { telemetry, club_used, shot_id, tags, status, sources } = currentShot;

  // Trap #5: telemetry is null when absent, not an empty object
  if (!telemetry || !sources.telemetry) {
    return (
      <div className={`border border-dashed rounded-2xl p-6 shadow-2xl flex flex-col items-center justify-center text-center transition-colors ${
        isBoutique ? 'bg-[#181C1A] border-stone-800' : 'bg-[#0b0e17] border-neutral-800/80'
      }`}>
        <AlertCircle className="w-10 h-10 text-neutral-500 mb-2" />
        <h3 className={`text-base font-bold font-mono ${isBoutique ? 'text-[#F4F4F2]' : 'text-white'}`}>
          TELEMETRY ABSENT // LAUNCH MONITOR DISCONNECTED
        </h3>
        <p className={`text-xs font-mono mt-1 max-w-md ${isBoutique ? 'text-[#8E928F]' : 'text-neutral-400'}`}>
          Shot {shot_id} recorded video sources, but no GSPro Open Connect payload was received during the pairing window.
        </p>
        <span className="mt-3 px-2 py-0.5 rounded bg-neutral-800 text-[11px] font-mono text-neutral-300">
          Status: {status} • Videos Available
        </span>
      </div>
    );
  }

  const { ball, club, derived, distance } = telemetry;
  const unitFactor = distanceUnit === 'meters' ? 1.0 : 1.09361;
  const unitLabel = distanceUnit === 'meters' ? 'M' : 'YDS';

  // Distance computation or degradation to em-dash per GSPro contract (Trap #3)
  const hasRawCarry = distance.carry_m !== null;
  const speed = ball.speed_mph ?? 100;
  const vla = ball.launch_angle_deg ?? 15;
  const estimatedCarryM = speed * 1.55 * Math.sin((vla * Math.PI) / 180) * 2.8;
  const estimatedTotalM = estimatedCarryM * 1.06;

  const carryDisplay = hasRawCarry 
    ? (distance.carry_m! * unitFactor).toFixed(1) 
    : useBallisticsEstimator 
    ? (estimatedCarryM * unitFactor).toFixed(1) 
    : '—';

  const totalDisplay = distance.total_m !== null 
    ? (distance.total_m! * unitFactor).toFixed(1) 
    : useBallisticsEstimator 
    ? (estimatedTotalM * unitFactor).toFixed(1) 
    : '—';

  // Smash factor rating (null if club data absent per contract)
  const hasClubData = club.speed_mph !== null && derived.smash_factor !== null;
  let smashRating = 'Solid';
  let smashColor = isBoutique
    ? 'text-[#E5C07B] border-[#D4AF37]/40 bg-[#D4AF37]/10'
    : 'text-amber-400 border-amber-500/40 bg-amber-500/10';

  if (derived.smash_factor !== null) {
    if (derived.smash_factor >= 1.48) {
      smashRating = 'Tour Elite';
      smashColor = isBoutique
        ? 'text-[#D4AF37] border-[#D4AF37]/60 bg-[#D4AF37]/20 font-bold'
        : 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10';
    } else if (derived.smash_factor < 1.35 && club_used?.toLowerCase().includes('driver')) {
      smashRating = 'Sub-optimal';
      smashColor = 'text-rose-400 border-rose-500/40 bg-rose-500/10';
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Top Header Banner / Hero Numbers */}
      <div className={`p-4 sm:p-5 relative overflow-hidden transition-colors duration-300 ${
        isBoutique 
          ? 'bg-stone-900/40 backdrop-blur-lg border border-[#C5A880]/20 shadow-xl rounded-2xl' 
          : 'bg-[#0b0e17] border border-neutral-800/80 rounded-2xl shadow-2xl font-mono'
      }`}>
        {/* Glow ambient background element */}
        <div className={`absolute top-0 right-0 w-80 h-32 blur-3xl pointer-events-none transition-colors ${
          isBoutique ? 'bg-[#D4AF37]/5' : 'bg-emerald-500/5'
        }`} />

        <div className={`flex flex-wrap items-center justify-between gap-3 border-b pb-3 mb-4 ${
          isBoutique ? 'border-[#C5A880]/15' : 'border-neutral-800/80'
        }`}>
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <span className={`transition-colors ${
              isBoutique 
                ? 'rounded-full px-3.5 py-1 bg-gradient-to-br from-[#E5C07B] to-[#C5A880] text-stone-900 font-serif font-bold text-xs tracking-wider shadow-md shadow-[#C5A880]/20' 
                : 'rounded px-2.5 py-1 bg-emerald-500 text-black font-mono font-bold text-xs tracking-wider'
            }`}>
              SHOT {shot_id}
            </span>
            <span className={`text-lg font-bold tracking-tight ${
              isBoutique ? 'font-serif text-[#F4F4F2]' : 'font-mono text-white'
            }`}>
              {club_used ?? 'Unspecified Club'}
            </span>
            <span className={`uppercase font-bold ${
              status === 'complete' 
                ? (isBoutique ? 'rounded-full px-2.5 py-0.5 text-[10px] bg-[#D4AF37]/20 text-[#E5C07B] border border-[#D4AF37]/40 font-serif' : 'rounded px-2 py-0.5 text-[10px] bg-emerald-500/20 text-emerald-300 font-mono')
                : (isBoutique ? 'rounded-full px-2.5 py-0.5 text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 font-serif' : 'rounded px-2 py-0.5 text-[10px] bg-amber-500/20 text-amber-300 font-mono')
            }`}>
              {status}
            </span>

            <div className="flex items-center gap-1.5 flex-wrap">
              {tags.map((tag) => (
                <span 
                  key={tag} 
                  className={`text-[11px] px-2.5 py-0.5 rounded-full border ${
                    isBoutique 
                      ? 'bg-stone-900/60 border-[#C5A880]/20 text-[#C5A880] font-serif' 
                      : 'bg-neutral-800 border-neutral-700 text-neutral-300 font-mono'
                  }`}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Unit Toggle & Ballistics Estimator Toggle */}
          <div className="flex items-center gap-2">
            {!hasRawCarry && (
              <button
                onClick={() => setUseBallisticsEstimator(!useBallisticsEstimator)}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs border transition-colors ${
                  useBallisticsEstimator 
                    ? (isBoutique ? 'rounded-full bg-gradient-to-br from-[#E5C07B] to-[#C5A880] text-stone-900 font-serif font-bold shadow-sm' : 'rounded-lg bg-cyan-500/20 border-cyan-500/50 text-cyan-300 font-mono') 
                    : (isBoutique ? 'rounded-full bg-stone-900/60 border-[#C5A880]/20 text-[#8E928F] hover:text-white font-serif' : 'rounded-lg bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white font-mono')
                }`}
                title="Toggle client-side ballistics estimation for distance tiles"
              >
                <Calculator className="w-3 h-3" />
                <span>{useBallisticsEstimator ? 'Est. Physics ON' : 'Distance: — (Contract)'}</span>
              </button>
            )}

            <button
              onClick={toggleDistanceUnit}
              className={`flex items-center gap-1 p-1 text-xs font-semibold border transition-colors ${
                isBoutique 
                  ? 'rounded-full bg-stone-900/60 border-[#C5A880]/30 font-serif' 
                  : 'rounded-lg px-3 py-1 bg-neutral-900 border-neutral-700 hover:border-emerald-500/50 text-neutral-200 font-mono'
              }`}
            >
              {isBoutique ? (
                <>
                  <span className={`px-2.5 py-0.5 rounded-full transition-all ${
                    distanceUnit === 'yards' 
                      ? 'bg-gradient-to-br from-[#E5C07B] to-[#C5A880] text-stone-900 font-bold shadow-sm' 
                      : 'text-[#8E928F] hover:text-[#F4F4F2]'
                  }`}>YDS</span>
                  <span className={`px-2.5 py-0.5 rounded-full transition-all ${
                    distanceUnit === 'meters' 
                      ? 'bg-gradient-to-br from-[#E5C07B] to-[#C5A880] text-stone-900 font-bold shadow-sm' 
                      : 'text-[#8E928F] hover:text-[#F4F4F2]'
                  }`}>M</span>
                </>
              ) : (
                <>
                  <span className={distanceUnit === 'yards' ? 'text-emerald-400 font-bold' : 'text-neutral-500'}>YDS</span>
                  <span className="text-neutral-600">/</span>
                  <span className={distanceUnit === 'meters' ? 'text-cyan-400 font-bold' : 'text-neutral-500'}>M</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Hero Metric Grid: Carry Distance & Ball Speed elevated prominently */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          {/* 1. HERO METRIC: Carry Distance */}
          <div className={`p-4 flex flex-col justify-between group transition-all ${
            isBoutique 
              ? 'bg-stone-900/40 backdrop-blur-lg border border-[#C5A880]/20 shadow-xl rounded-2xl hover:border-[#D4AF37]/50' 
              : 'bg-neutral-900/60 border border-neutral-800/80 rounded-xl hover:border-emerald-500/40'
          }`}>
            <div className="flex items-center justify-between">
              <span className={`text-[11px] uppercase tracking-wider ${
                isBoutique ? 'font-serif text-[#8E928F] font-semibold' : 'font-mono text-neutral-400'
              }`}>
                Carry Distance
              </span>
              {!hasRawCarry && !useBallisticsEstimator && (
                <span className={`text-[9px] ${isBoutique ? 'font-serif text-stone-500' : 'font-mono text-neutral-500'}`}>LM unmeasured</span>
              )}
            </div>
            <div className="flex items-baseline gap-1.5 my-2">
              <span className={`text-4xl sm:text-5xl font-black tracking-tight ${
                isBoutique ? 'font-sans text-[#D4AF37] glow-gold' : 'font-mono text-emerald-400 glow-green'
              }`}>
                {carryDisplay}
              </span>
              {carryDisplay !== '—' && (
                <span className={`text-xs ${isBoutique ? 'font-sans font-bold text-[#C5A880]' : 'font-mono text-emerald-500/70'}`}>{unitLabel}</span>
              )}
            </div>
            <div className={`text-[10px] ${isBoutique ? 'font-serif text-[#8E928F]' : 'font-mono text-neutral-500'}`}>
              Total: <span className={`font-semibold ${isBoutique ? 'font-sans text-[#F4F4F2]' : 'font-mono text-neutral-300'}`}>{totalDisplay} {totalDisplay !== '—' && unitLabel}</span>
            </div>
          </div>

          {/* 2. HERO METRIC: Ball Speed */}
          <div className={`p-4 flex flex-col justify-between group transition-all ${
            isBoutique 
              ? 'bg-stone-900/40 backdrop-blur-lg border border-[#C5A880]/20 shadow-xl rounded-2xl hover:border-[#C5A880]/50' 
              : 'bg-neutral-900/60 border border-neutral-800/80 rounded-xl hover:border-cyan-500/40'
          }`}>
            <span className={`text-[11px] uppercase tracking-wider ${
              isBoutique ? 'font-serif text-[#8E928F] font-semibold' : 'font-mono text-neutral-400'
            }`}>
              Ball Speed
            </span>
            <div className="flex items-baseline gap-1.5 my-2">
              <span className={`text-4xl sm:text-5xl font-black tracking-tight ${
                isBoutique ? 'font-sans text-[#F4F4F2] glow-brass' : 'font-mono text-cyan-400 glow-cyan'
              }`}>
                {ball.speed_mph ?? '—'}
              </span>
              {ball.speed_mph !== null && (
                <span className={`text-xs ${isBoutique ? 'font-sans font-bold text-[#C5A880]' : 'font-mono text-cyan-500/70'}`}>MPH</span>
              )}
            </div>
            <div className={`text-[10px] ${isBoutique ? 'font-serif text-[#8E928F]' : 'font-mono text-neutral-500'}`}>
              Launch VLA: <span className={`font-semibold ${isBoutique ? 'font-sans text-[#F4F4F2]' : 'font-mono text-neutral-300'}`}>{ball.launch_angle_deg ?? '—'}°</span>
            </div>
          </div>

          {/* 3. Secondary Metric: Club Speed */}
          <div className={`p-3.5 flex flex-col justify-between group transition-all ${
            isBoutique 
              ? 'bg-stone-900/40 backdrop-blur-lg border border-[#C5A880]/20 shadow-xl rounded-2xl hover:border-stone-600' 
              : 'bg-neutral-900/60 border border-neutral-800/80 rounded-xl hover:border-neutral-700'
          }`}>
            <div className="flex items-center justify-between">
              <span className={`text-[11px] uppercase tracking-wider ${
                isBoutique ? 'font-serif text-[#8E928F]' : 'font-mono text-neutral-400'
              }`}>
                Club Speed
              </span>
              {!hasClubData && (
                <span className={`text-[9px] ${isBoutique ? 'font-serif text-stone-500' : 'font-mono text-neutral-500'}`}>No Club Sensor</span>
              )}
            </div>
            <div className="flex items-baseline gap-1 my-1">
              <span className={`text-2xl sm:text-3xl font-black tracking-tight ${
                isBoutique ? 'font-sans text-[#E5C07B]' : 'font-mono font-bold text-white'
              }`}>
                {club.speed_mph !== null ? club.speed_mph : '—'}
              </span>
              {club.speed_mph !== null && <span className={`text-xs ${isBoutique ? 'font-sans text-[#8E928F]' : 'font-mono text-neutral-400'}`}>MPH</span>}
            </div>
            <div className={`text-[10px] ${isBoutique ? 'font-serif text-[#8E928F]' : 'font-mono text-neutral-500'}`}>
              Path: <span className={`font-semibold ${isBoutique ? 'font-sans text-[#F4F4F2]' : 'font-mono text-neutral-300'}`}>
                {club.path_deg !== null ? (club.path_deg > 0 ? `+${club.path_deg}°` : `${club.path_deg}°`) : '—'}
              </span>
            </div>
          </div>

          {/* 4. Secondary Metric: Smash Factor */}
          <div className={`p-3.5 flex flex-col justify-between group transition-all ${
            isBoutique 
              ? 'bg-stone-900/40 backdrop-blur-lg border border-[#C5A880]/20 shadow-xl rounded-2xl hover:border-[#D4AF37]/30' 
              : 'bg-neutral-900/60 border border-neutral-800/80 rounded-xl hover:border-amber-500/40'
          }`}>
            <div className="flex items-center justify-between">
              <span className={`text-[11px] uppercase tracking-wider ${
                isBoutique ? 'font-serif text-[#8E928F]' : 'font-mono text-neutral-400'
              }`}>
                Smash Factor
              </span>
              {derived.smash_factor !== null && (
                <span className={`text-[10px] ${
                  isBoutique 
                    ? 'rounded-full px-2.5 py-0.5 bg-gradient-to-br from-[#E5C07B] to-[#C5A880] text-stone-900 font-serif font-bold shadow-sm' 
                    : `rounded px-1.5 py-0.5 border font-semibold font-mono ${smashColor}`
                }`}>
                  {smashRating}
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-1 my-1">
              <span className={`text-2xl sm:text-3xl font-black tracking-tight ${
                isBoutique ? 'font-sans text-[#D4AF37]' : 'font-mono font-bold text-amber-400'
              }`}>
                {derived.smash_factor ?? '—'}
              </span>
            </div>
            <div className={`text-[10px] ${isBoutique ? 'font-serif text-[#8E928F]' : 'font-mono text-neutral-500'}`}>
              Ratio: Ball / Club
            </div>
          </div>

          {/* 5. Secondary Metric: Total Spin */}
          <div className={`p-3.5 flex flex-col justify-between group transition-all ${
            isBoutique 
              ? 'bg-stone-900/40 backdrop-blur-lg border border-[#C5A880]/20 shadow-xl rounded-2xl hover:border-[#C5A880]/30' 
              : 'bg-neutral-900/60 border border-neutral-800/80 rounded-xl hover:border-purple-500/40'
          }`}>
            <span className={`text-[11px] uppercase tracking-wider ${
              isBoutique ? 'font-serif text-[#8E928F]' : 'font-mono text-neutral-400'
            }`}>
              Total Spin
            </span>
            <div className="flex items-baseline gap-1 my-1">
              <span className={`text-2xl sm:text-3xl font-black tracking-tight ${
                isBoutique ? 'font-sans text-[#C5A880]' : 'font-mono font-bold text-purple-400'
              }`}>
                {ball.total_spin_rpm ?? '—'}
              </span>
              {ball.total_spin_rpm !== null && (
                <span className={`text-xs ${isBoutique ? 'font-sans text-[#8E928F]' : 'font-mono text-purple-500/70'}`}>RPM</span>
              )}
            </div>
            <div className={`text-[10px] ${isBoutique ? 'font-serif text-[#8E928F]' : 'font-mono text-neutral-500'}`}>
              Spin Axis: <span className={`font-semibold ${isBoutique ? 'font-sans text-[#F4F4F2]' : 'font-mono text-neutral-300'}`}>
                {ball.spin_axis_deg !== null ? (ball.spin_axis_deg < 0 ? `${Math.abs(ball.spin_axis_deg)}° L` : `${ball.spin_axis_deg}° R`) : '—'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Secondary Metric Cards: VLA, HLA, Path, Face */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Launch VLA */}
        <div className={`p-3.5 flex flex-col justify-between transition-colors ${
          isBoutique 
            ? 'bg-stone-900/40 backdrop-blur-lg border border-[#C5A880]/20 shadow-xl rounded-2xl' 
            : 'bg-[#0b0e17] border border-neutral-800/80 rounded-xl font-mono'
        }`}>
          <div className="flex items-center justify-between text-xs">
            <span className={isBoutique ? 'font-serif text-[#8E928F] tracking-wide' : 'font-mono text-neutral-400'}>LAUNCH VLA</span>
            <Gauge className="w-3.5 h-3.5 text-neutral-500" />
          </div>
          <div className={`text-2xl font-black my-1.5 ${isBoutique ? 'font-sans text-[#F4F4F2]' : 'font-mono text-neutral-100'}`}>
            {ball.launch_angle_deg !== null ? `${ball.launch_angle_deg}°` : '—'}
          </div>
          <span className={`text-[10px] ${isBoutique ? 'font-serif text-[#8E928F]' : 'font-mono text-neutral-500'}`}>Vertical Launch Angle</span>
        </div>

        {/* Launch HLA */}
        <div className={`p-3.5 flex flex-col justify-between transition-colors ${
          isBoutique 
            ? 'bg-stone-900/40 backdrop-blur-lg border border-[#C5A880]/20 shadow-xl rounded-2xl' 
            : 'bg-[#0b0e17] border border-neutral-800/80 rounded-xl font-mono'
        }`}>
          <div className="flex items-center justify-between text-xs">
            <span className={isBoutique ? 'font-serif text-[#8E928F] tracking-wide' : 'font-mono text-neutral-400'}>LAUNCH HLA</span>
            <Compass className="w-3.5 h-3.5 text-neutral-500" />
          </div>
          <div className="flex items-center gap-1.5 text-2xl font-black my-1.5">
            <span className={isBoutique ? 'font-sans text-[#F4F4F2]' : 'font-mono text-neutral-100'}>
              {ball.launch_direction_deg !== null ? `${Math.abs(ball.launch_direction_deg)}°` : '—'}
            </span>
            {ball.launch_direction_deg !== null && (
              <span className={`text-xs font-semibold ${isBoutique ? 'font-serif text-[#C5A880]' : 'font-mono text-neutral-400'}`}>
                {ball.launch_direction_deg > 0 ? 'R (Push)' : ball.launch_direction_deg < 0 ? 'L (Pull)' : 'Straight'}
              </span>
            )}
          </div>
          <span className={`text-[10px] ${isBoutique ? 'font-serif text-[#8E928F]' : 'font-mono text-neutral-500'}`}>Horizontal Launch Angle</span>
        </div>

        {/* Club Path */}
        <div className={`p-3.5 flex flex-col justify-between transition-colors ${
          isBoutique 
            ? 'bg-stone-900/40 backdrop-blur-lg border border-[#C5A880]/20 shadow-xl rounded-2xl' 
            : 'bg-[#0b0e17] border border-neutral-800/80 rounded-xl font-mono'
        }`}>
          <div className="flex items-center justify-between text-xs">
            <span className={isBoutique ? 'font-serif text-[#8E928F] tracking-wide' : 'font-mono text-neutral-400'}>CLUB PATH</span>
            {club.path_deg !== null && club.path_deg > 0 ? (
              <ArrowUpRight className={`w-4 h-4 ${isBoutique ? 'text-[#D4AF37]' : 'text-cyan-400'}`} />
            ) : (
              <ArrowUpLeft className="w-4 h-4 text-amber-400" />
            )}
          </div>
          <div className={`text-2xl font-black my-1.5 ${
            isBoutique ? 'font-sans text-[#D4AF37]' : 'font-mono text-cyan-400'
          }`}>
            {club.path_deg !== null 
              ? (club.path_deg > 0 ? `+${club.path_deg}°` : `${club.path_deg}°`)
              : '—'}
          </div>
          <span className={`text-[10px] ${isBoutique ? 'font-serif text-[#8E928F]' : 'font-mono text-neutral-500'}`}>
            {club.path_deg !== null 
              ? (club.path_deg > 0 ? 'In-to-Out (Draw)' : club.path_deg < 0 ? 'Out-to-In (Fade)' : 'Square') 
              : 'Club sensor unmeasured'}
          </span>
        </div>

        {/* Face to Target */}
        <div className={`p-3.5 flex flex-col justify-between transition-colors ${
          isBoutique 
            ? 'bg-stone-900/40 backdrop-blur-lg border border-[#C5A880]/20 shadow-xl rounded-2xl' 
            : 'bg-[#0b0e17] border border-neutral-800/80 rounded-xl font-mono'
        }`}>
          <div className="flex items-center justify-between text-xs">
            <span className={isBoutique ? 'font-serif text-[#8E928F] tracking-wide' : 'font-mono text-neutral-400'}>FACE TO TARGET</span>
            {club.face_to_target_deg !== null && (
              <span className={`text-[10px] ${
                isBoutique 
                  ? 'rounded-full px-2.5 py-0.5 bg-[#D4AF37]/20 border border-[#D4AF37]/40 text-[#E5C07B] font-serif font-bold' 
                  : `rounded px-1.5 font-semibold font-mono ${club.face_to_target_deg < 0 ? 'text-emerald-400' : 'text-amber-400'}`
              }`}>
                {club.face_to_target_deg < 0 ? 'CLOSED' : club.face_to_target_deg > 0 ? 'OPEN' : 'SQUARE'}
              </span>
            )}
          </div>
          <div className={`text-2xl font-black my-1.5 ${
            isBoutique 
              ? 'font-sans text-[#E5C07B]' 
              : (club.face_to_target_deg !== null ? (club.face_to_target_deg < 0 ? 'font-mono text-emerald-400' : 'font-mono text-amber-400') : 'font-mono text-neutral-400')
          }`}>
            {club.face_to_target_deg !== null 
              ? (club.face_to_target_deg > 0 ? `+${club.face_to_target_deg}°` : `${club.face_to_target_deg}°`) 
              : '—'}
          </div>
          <span className={`text-[10px] ${isBoutique ? 'font-serif text-[#8E928F]' : 'font-mono text-neutral-500'}`}>Target Line Reference</span>
        </div>
      </div>

      {/* Visualizers: Club Vector & Flight Trajectory */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ClubFaceVisualizer 
          pathDeg={club.path_deg} 
          faceDeg={club.face_to_target_deg} 
          faceToPathDeg={derived.face_to_path_deg} 
        />
        <TrajectoryCard telemetry={telemetry} unit={distanceUnit} />
      </div>
    </div>
  );
};
