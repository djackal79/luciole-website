import React, { useState } from 'react';
import { useShotStore } from '../../store/shotStore';
import { ClubFaceVisualizer } from './ClubFaceVisualizer';
import { TrajectoryCard } from './TrajectoryCard';
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


  if (!currentShot) {
    return (
      <div className="bg-[#0b0e17] border border-neutral-800/80 rounded-2xl p-8 text-center text-neutral-500 font-mono">
        Waiting for shot trigger...
      </div>
    );
  }

  const { telemetry, club_used, shot_id, tags, status, sources } = currentShot;

  // Trap #5: telemetry is null when absent, not an empty object
  if (!telemetry || !sources.telemetry) {
    return (
      <div className="bg-[#0b0e17] border border-dashed border-neutral-800/80 rounded-2xl p-6 shadow-2xl flex flex-col items-center justify-center text-center">
        <AlertCircle className="w-10 h-10 text-neutral-500 mb-2" />
        <h3 className="text-base font-bold text-white font-mono">
          TELEMETRY ABSENT // LAUNCH MONITOR DISCONNECTED
        </h3>
        <p className="text-xs text-neutral-400 font-mono mt-1 max-w-md">
          Shot {shot_id} recorded video sources, but no GSPro Open Connect payload was received during the pairing window.
        </p>
        <span className="mt-3 px-2 py-0.5 rounded bg-neutral-800 text-[11px] font-mono text-neutral-300">
          Status: {status} • Videos Available
        </span>
      </div>
    );
  }

  const { ball, club, derived, distance, flight } = telemetry;
  const unitFactor = distanceUnit === 'meters' ? 1.0 : 1.09361; // Canonical distance is metres
  const unitLabel = distanceUnit === 'meters' ? 'M' : 'YDS';

  const hasRawCarry = distance.carry_m !== null;
  const hasFlight = flight != null;

  const carryDisplay = hasRawCarry 
    ? (distance.carry_m! * unitFactor).toFixed(1) 
    : hasFlight && flight.carry_m !== null
    ? (flight.carry_m! * unitFactor).toFixed(1) 
    : '—';

  const totalDisplay = distance.total_m !== null 
    ? (distance.total_m! * unitFactor).toFixed(1) 
    : hasFlight && flight.total_m !== null
    ? (flight.total_m! * unitFactor).toFixed(1)
    : '—';

  // Smash factor rating (null if club data absent per contract)
  const hasClubData = club.speed_mph !== null && derived.smash_factor !== null;
  let smashRating = 'Solid';
  let smashColor = 'text-amber-400 border-amber-500/40 bg-amber-500/10';
  if (derived.smash_factor !== null) {
    if (derived.smash_factor >= 1.48) {
      smashRating = 'Tour Elite';
      smashColor = 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10';
    } else if (derived.smash_factor < 1.35 && club_used?.toLowerCase().includes('driver')) {
      smashRating = 'Sub-optimal';
      smashColor = 'text-rose-400 border-rose-500/40 bg-rose-500/10';
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Top Header Banner / Hero Numbers */}
      <div className="bg-[#0b0e17] border border-neutral-800/80 rounded-2xl p-4 sm:p-5 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-32 bg-emerald-500/5 blur-3xl pointer-events-none" />

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800/80 pb-3 mb-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="px-2.5 py-1 rounded bg-emerald-500 text-black font-mono font-bold text-xs tracking-wider">
              SHOT {shot_id}
            </span>
            <span className="text-lg font-bold text-white tracking-tight">
              {club_used ?? 'Unspecified Club'}
            </span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold ${
              status === 'complete' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
            }`}>
              {status}
            </span>

            <div className="flex items-center gap-1.5 flex-wrap">
              {tags.map((tag) => (
                <span 
                  key={tag} 
                  className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-neutral-800 border border-neutral-700 text-neutral-300"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Unit Toggle & Ballistics Estimator Toggle */}
          <div className="flex items-center gap-2">
  

            <button
              onClick={toggleDistanceUnit}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono font-semibold bg-neutral-900 border border-neutral-700 hover:border-emerald-500/50 text-neutral-200 transition-colors"
            >
              <span className={distanceUnit === 'yards' ? 'text-emerald-400' : 'text-neutral-500'}>YDS</span>
              <span className="text-neutral-600">/</span>
              <span className={distanceUnit === 'meters' ? 'text-cyan-400' : 'text-neutral-500'}>M</span>
            </button>
          </div>
        </div>

        {/* Hero Metric Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          {/* 1. Carry Distance (Trap #3: gracefully renders em-dash —) */}
          <div className="bg-neutral-900/60 border border-neutral-800/80 rounded-xl p-3 flex flex-col justify-between group hover:border-emerald-500/40 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">
                Carry Distance
              </span>
              {!hasRawCarry && hasFlight && (<span className="text-[9px] font-mono text-amber-500/70 border border-amber-500/30 px-1 rounded bg-amber-500/10">Est.</span>)}
              {!hasRawCarry && !hasFlight && (<span className="text-[9px] font-mono text-neutral-500">LM unmeasured</span>)}
            </div>
            <div className="flex items-baseline gap-1 my-1">
              <span className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-emerald-400 glow-green">
                {carryDisplay}
              </span>
              {carryDisplay !== '—' && (
                <span className="text-xs font-mono text-emerald-500/70">{unitLabel}</span>
              )}
            </div>
            <div className="text-[10px] font-mono text-neutral-500">
              Total: <span className="text-neutral-300 font-semibold">{totalDisplay} {totalDisplay !== '—' && unitLabel}</span>
            </div>
          </div>

          {/* 2. Ball Speed */}
          <div className="bg-neutral-900/60 border border-neutral-800/80 rounded-xl p-3 flex flex-col justify-between group hover:border-cyan-500/40 transition-all">
            <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">
              Ball Speed
            </span>
            <div className="flex items-baseline gap-1 my-1">
              <span className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-cyan-400 glow-cyan">
                {ball.speed_mph ?? '—'}
              </span>
              {ball.speed_mph !== null && <span className="text-xs font-mono text-cyan-500/70">MPH</span>}
            </div>
            <div className="text-[10px] font-mono text-neutral-500">
              Launch VLA: <span className="text-neutral-300 font-semibold">{ball.launch_angle_deg ?? '—'}°</span>
            </div>
          </div>

          {/* 3. Club Speed (Nullable) */}
          <div className="bg-neutral-900/60 border border-neutral-800/80 rounded-xl p-3 flex flex-col justify-between group hover:border-neutral-700 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">
                Club Speed
              </span>
              {!hasClubData && (
                <span className="text-[9px] font-mono text-neutral-500">No Club Sensor</span>
              )}
            </div>
            <div className="flex items-baseline gap-1 my-1">
              <span className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-white">
                {club.speed_mph !== null ? club.speed_mph : '—'}
              </span>
              {club.speed_mph !== null && <span className="text-xs font-mono text-neutral-400">MPH</span>}
            </div>
            <div className="text-[10px] font-mono text-neutral-500">
              Path: <span className="text-neutral-300 font-semibold">
                {club.path_deg !== null ? (club.path_deg > 0 ? `+${club.path_deg}°` : `${club.path_deg}°`) : '—'}
              </span>
            </div>
          </div>

          {/* 4. Smash Factor (Nullable) */}
          <div className="bg-neutral-900/60 border border-neutral-800/80 rounded-xl p-3 flex flex-col justify-between group hover:border-amber-500/40 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">
                Smash Factor
              </span>
              {derived.smash_factor !== null && (
                <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${smashColor}`}>
                  {smashRating}
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-1 my-1">
              <span className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-amber-400">
                {derived.smash_factor !== null ? derived.smash_factor.toFixed(2) : '—'}
              </span>
            </div>
            <div className="text-[10px] font-mono text-neutral-500">
              {derived.smash_factor !== null ? 'Ratio: Ball / Club' : 'Club data missing'}
            </div>
          </div>

          {/* 5. Total Spin */}
          <div className="bg-neutral-900/60 border border-neutral-800/80 rounded-xl p-3 flex flex-col justify-between group hover:border-purple-500/40 transition-all">
            <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">
              Total Spin
            </span>
            <div className="flex items-baseline gap-1 my-1">
              <span className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-purple-400">
                {ball.total_spin_rpm ?? '—'}
              </span>
              {ball.total_spin_rpm !== null && <span className="text-xs font-mono text-purple-500/70">RPM</span>}
            </div>
            <div className="text-[10px] font-mono text-neutral-500">
              Spin Axis: <span className="text-neutral-300 font-semibold">
                {ball.spin_axis_deg !== null 
                  ? (ball.spin_axis_deg < 0 ? `${Math.abs(ball.spin_axis_deg)}° L` : `${ball.spin_axis_deg}° R`)
                  : '—'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Secondary Detailed Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[#0b0e17] border border-neutral-800/80 rounded-xl p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between text-neutral-400 text-xs font-mono">
            <span>LAUNCH VLA</span>
            <Gauge className="w-3.5 h-3.5 text-neutral-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-neutral-100 my-1">
            {ball.launch_angle_deg ?? '—'}°
          </div>
          <span className="text-[10px] font-mono text-neutral-500">Vertical Launch Angle</span>
        </div>

        <div className="bg-[#0b0e17] border border-neutral-800/80 rounded-xl p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between text-neutral-400 text-xs font-mono">
            <span>LAUNCH HLA</span>
            <Compass className="w-3.5 h-3.5 text-neutral-500" />
          </div>
          <div className="flex items-center gap-1 text-2xl font-bold font-mono text-neutral-100 my-1">
            <span>{ball.launch_direction_deg !== null ? `${Math.abs(ball.launch_direction_deg)}°` : '—'}</span>
            {ball.launch_direction_deg !== null && (
              <span className="text-sm font-semibold text-neutral-400">
                {ball.launch_direction_deg > 0 ? 'R (Push)' : ball.launch_direction_deg < 0 ? 'L (Pull)' : 'Center'}
              </span>
            )}
          </div>
          <span className="text-[10px] font-mono text-neutral-500">Horizontal Launch Angle</span>
        </div>

        <div className="bg-[#0b0e17] border border-neutral-800/80 rounded-xl p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between text-neutral-400 text-xs font-mono">
            <span>CLUB PATH</span>
            {club.path_deg !== null && (club.path_deg > 0 ? (
              <ArrowUpRight className="w-4 h-4 text-cyan-400" />
            ) : (
              <ArrowUpLeft className="w-4 h-4 text-amber-400" />
            ))}
          </div>
          <div className="text-2xl font-bold font-mono text-cyan-400 my-1">
            {club.path_deg !== null ? (club.path_deg > 0 ? `+${club.path_deg}°` : `${club.path_deg}°`) : '—'}
          </div>
          <span className="text-[10px] font-mono text-neutral-500">
            {club.path_deg !== null ? (club.path_deg > 0 ? 'In-to-Out (Draw)' : 'Out-to-In (Fade)') : 'Unmeasured'}
          </span>
        </div>

        <div className="bg-[#0b0e17] border border-neutral-800/80 rounded-xl p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between text-neutral-400 text-xs font-mono">
            <span>FACE TO TARGET</span>
            {club.face_to_target_deg !== null && (
              <span className={`text-[10px] font-mono font-semibold ${club.face_to_target_deg > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {club.face_to_target_deg > 0 ? 'OPEN' : club.face_to_target_deg < 0 ? 'CLOSED' : 'SQUARE'}
              </span>
            )}
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400 my-1">
            {club.face_to_target_deg !== null ? (club.face_to_target_deg > 0 ? `+${club.face_to_target_deg}°` : `${club.face_to_target_deg}°`) : '—'}
          </div>
          <span className="text-[10px] font-mono text-neutral-500">
            Target Line Reference
          </span>
        </div>
      </div>

      {/* Visualizers Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ClubFaceVisualizer telemetry={telemetry} />
        <TrajectoryCard telemetry={telemetry} unit={distanceUnit} />
      </div>
    </div>
  );
};
