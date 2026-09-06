import React from 'react';
import { useShotStore } from '../../store/shotStore';
import { useThemeStore } from '../../store/themeStore';
import { usePlayerStore } from '../../store/playerStore';
import { Activity, Clock, AlertCircle } from 'lucide-react';
import { usePoseData } from '../../hooks/usePoseData';
import { Pose3DCanvas } from './Pose3DCanvas';

export const Biomechanical3DModel: React.FC = () => {
  const currentShot = useShotStore((s) => s.getCurrentShot());
  const { currentTheme } = useThemeStore();
  const { currentTime } = usePlayerStore();
  const isBoutique = currentTheme === 'boutique';
  
  const pose = currentShot?.pose;
  const poseData = usePoseData();

  const isPending = pose?.status === 'pending';
  const isError = pose?.status === 'failed';
  const isUnavailable = pose?.status === 'unavailable';
  
  const is3d = pose?.dimensions === '3d';
  const is2d = pose?.dimensions === '2d';

  const metrics = [
    { label: 'Swing Plane', key: 'swing_plane_deg', unit: '°' },
    { label: 'Spine Angle', key: 'spine_angle_deg', unit: '°' },
    { label: 'Shoulder Turn', key: 'shoulder_turn_deg', unit: '°' },
    { label: 'Pelvis Rotation', key: 'pelvis_rotation_deg', unit: '°' },
    { label: 'X-Factor', key: 'x_factor_deg', unit: '°' },
    { label: 'Hand Speed', key: 'hand_speed_mph', unit: ' mph' },
  ];

  const t_from_impact_sec = currentTime - 2.45;

  return (
    <div className={`p-3 sm:p-4 shadow-2xl flex flex-col gap-3 transition-colors duration-300 ${
      isBoutique 
        ? 'bg-stone-900/40 backdrop-blur-lg border border-[#C5A880]/20 shadow-xl rounded-2xl text-[#F4F4F2]' 
        : 'bg-[#0a0c13] border border-neutral-800/80 rounded-2xl text-white'
    }`}>
      <div className={`flex items-center gap-2 border-b pb-3 ${
        isBoutique ? 'border-[#C5A880]/15' : 'border-neutral-800'
      }`}>
        <div className={`w-7 h-7 flex items-center justify-center ${
          isBoutique 
            ? 'rounded-full bg-[#C5A880]/15 border border-[#C5A880]/30 text-[#E5C07B]' 
            : 'rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
        }`}>
          <Activity className="w-4 h-4" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h3 className={`text-xs font-bold uppercase tracking-wider ${
              isBoutique ? 'font-serif text-[#F4F4F2]' : 'font-mono text-white'
            }`}>
              Biomechanical Data
            </h3>
            {isPending && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[9px] font-bold">
                <Clock className="w-3 h-3 animate-spin" /> PENDING
              </span>
            )}
            {isError && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 text-[9px] font-bold">
                <AlertCircle className="w-3 h-3" /> FAILED
              </span>
            )}
            {is3d && (
              <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 text-[9px] font-bold uppercase">
                3D Tracking
              </span>
            )}
            {is2d && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px] font-bold uppercase">
                2D Tracking
              </span>
            )}
          </div>
          <p className={`text-[10px] ${isBoutique ? 'font-serif text-[#8E928F]' : 'font-mono text-neutral-500'}`}>
            Markerless Pose Extraction {pose?.model ? `(${pose.model})` : ''}
          </p>
        </div>
      </div>

      {is3d && poseData ? (
        <Pose3DCanvas poseData={poseData} t_from_impact_sec={t_from_impact_sec} />
      ) : is2d && pose?.status === 'ready' ? (
        <div className={`p-4 rounded-xl text-xs flex flex-col gap-1 items-center justify-center text-center border mb-3 ${
          isBoutique ? 'bg-stone-900/60 border-[#C5A880]/30 text-[#8E928F]' : 'bg-neutral-900/50 border-amber-500/30 text-amber-500/70'
        }`}>
          <AlertCircle className="w-5 h-5 mb-1" />
          <span className="font-bold">3D Triangulation Disabled</span>
          <span>Cameras uncalibrated or impact frame missing. Rendered in 2D.</span>
        </div>
      ) : null}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {metrics.map(m => {
            const val = pose?.summary?.[m.key as keyof typeof pose.summary];
            return (
              <div key={m.key} className={`flex flex-col p-3 border ${
                isBoutique 
                  ? 'bg-stone-900/60 border-[#C5A880]/20 rounded-2xl' 
                  : 'bg-black/40 border-neutral-800/80 rounded-xl'
              }`}>
                <span className={`text-[10px] uppercase font-bold mb-1 ${
                  isBoutique ? 'font-serif text-[#8E928F]' : 'font-mono text-neutral-500'
                }`}>
                  {m.label}
                </span>
                <span className={`text-xl md:text-2xl font-bold tracking-tight ${
                  isBoutique ? 'font-sans text-[#F4F4F2]' : 'font-mono text-white'
                }`}>
                  {isPending || isUnavailable ? '—' : (val == null ? '—' : `${val.toFixed(1)}${m.unit}`)}
                </span>
              </div>
            );
        })}
      </div>
    </div>
  );
};
