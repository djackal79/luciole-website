import React from 'react';
import type { TelemetryBlock } from '../../types/contract';
import { useThemeStore } from '../../store/themeStore';
import { AlertCircle } from 'lucide-react';

interface ClubFaceVisualizerProps {
  telemetry?: TelemetryBlock | null;
  pathDeg?: number | null;
  faceDeg?: number | null;
  faceToPathDeg?: number | null;
}

export const ClubFaceVisualizer: React.FC<ClubFaceVisualizerProps> = ({
  telemetry,
  pathDeg: propPathDeg,
  faceDeg: propFaceDeg,
  faceToPathDeg: propFaceToPathDeg,
}) => {
  const { currentTheme } = useThemeStore();
  const isBoutique = currentTheme === 'boutique';

  const clubPathDeg = propPathDeg !== undefined ? propPathDeg : telemetry?.club?.path_deg ?? null;
  const faceAngleDeg = propFaceDeg !== undefined ? propFaceDeg : telemetry?.club?.face_to_target_deg ?? null;
  const faceToPath = propFaceToPathDeg !== undefined ? propFaceToPathDeg : telemetry?.derived?.face_to_path_deg ?? null;

  const hasClubData = clubPathDeg !== null && faceAngleDeg !== null;

  if (!hasClubData && !telemetry) {
    return (
      <div className={`p-6 flex flex-col items-center justify-center text-center transition-colors ${
        isBoutique 
          ? 'bg-stone-900/40 backdrop-blur-lg border border-[#C5A880]/20 shadow-xl rounded-2xl' 
          : 'bg-[#0b0e17] border border-neutral-800/80 rounded-xl font-mono'
      }`}>
        <AlertCircle className="w-8 h-8 text-neutral-600 mb-2" />
        <span className={`text-xs font-semibold ${isBoutique ? 'font-serif text-[#8E928F]' : 'text-neutral-400'}`}>CLUB DELIVERY VECTOR</span>
        <span className="text-xs text-neutral-500 mt-1">Club sensor unmeasured for this shot</span>
      </div>
    );
  }

  const pDeg = clubPathDeg ?? 0;
  const fDeg = faceAngleDeg ?? 0;

  const pathLabel = !hasClubData 
    ? '—' 
    : pDeg > 0.3 
    ? `${Math.abs(pDeg).toFixed(1)}° In-to-Out` 
    : pDeg < -0.3 
    ? `${Math.abs(pDeg).toFixed(1)}° Out-to-In` 
    : '0.0° Square';

  const faceLabel = !hasClubData 
    ? '—' 
    : fDeg > 0.3 
    ? `${Math.abs(fDeg).toFixed(1)}° Open` 
    : fDeg < -0.3 
    ? `${Math.abs(fDeg).toFixed(1)}° Closed` 
    : '0.0° Square';

  const centerX = 100;
  const centerY = 100;

  const visualPathAngle = (pDeg * 3.5 * Math.PI) / 180;
  const pathLength = 65;
  const pathEndX = centerX + Math.sin(visualPathAngle) * pathLength;
  const pathEndY = centerY - Math.cos(visualPathAngle) * pathLength;
  const pathStartX = centerX - Math.sin(visualPathAngle) * pathLength * 0.7;
  const pathStartY = centerY + Math.cos(visualPathAngle) * pathLength * 0.7;

  const visualFaceAngle = (fDeg * 3.5 * Math.PI) / 180;
  const faceHalfWidth = 48;
  const faceX1 = centerX - Math.cos(visualFaceAngle) * faceHalfWidth;
  const faceY1 = centerY - Math.sin(visualFaceAngle) * faceHalfWidth;
  const faceX2 = centerX + Math.cos(visualFaceAngle) * faceHalfWidth;
  const faceY2 = centerY + Math.sin(visualFaceAngle) * faceHalfWidth;

  const pathColor = isBoutique ? '#D4AF37' : '#00d2ff';
  const faceColor = isBoutique ? '#E5C07B' : '#00f298';

  return (
    <div className={`p-4 flex flex-col items-center justify-between transition-colors ${
      isBoutique 
        ? 'bg-stone-900/40 backdrop-blur-lg border border-[#C5A880]/20 shadow-xl rounded-2xl' 
        : 'bg-[#0b0e17] border border-neutral-800/80 rounded-xl font-mono'
    }`}>
      <div className={`w-full flex items-center justify-between border-b pb-2 mb-2 ${
        isBoutique ? 'border-[#C5A880]/15' : 'border-neutral-800'
      }`}>
        <span className={`text-xs font-medium ${isBoutique ? 'font-serif text-[#8E928F]' : 'text-neutral-400'}`}>
          CLUB DELIVERY VECTOR
        </span>
        <span className={`text-[10px] px-2.5 py-0.5 ${
          isBoutique ? 'rounded-full bg-stone-900/60 text-[#C5A880] border border-[#C5A880]/20 font-serif' : 'rounded bg-neutral-800 text-neutral-300 font-mono'
        }`}>
          Overhead Impact View
        </span>
      </div>

      {hasClubData ? (
        <div className="relative w-48 h-48 sm:w-52 sm:h-52 my-1">
          <svg viewBox="0 0 200 200" className="w-full h-full">
            {/* Target Center Line */}
            <line
              x1="100"
              y1="10"
              x2="100"
              y2="190"
              stroke={isBoutique ? '#38423D' : '#334155'}
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />

            <circle cx="100" cy="100" r="75" fill="none" stroke={isBoutique ? '#202623' : '#1e293b'} strokeWidth="1" />

            {/* Club Path Line */}
            <line
              x1={pathStartX}
              y1={pathStartY}
              x2={pathEndX}
              y2={pathEndY}
              stroke={pathColor}
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            <circle cx={pathEndX} cy={pathEndY} r="4.5" fill={pathColor} />

            {/* Club Face Orientation Line */}
            <line
              x1={faceX1}
              y1={faceY1}
              x2={faceX2}
              y2={faceY2}
              stroke={faceColor}
              strokeWidth="5"
              strokeLinecap="round"
            />

            {/* Ball center point */}
            <circle cx="100" cy="100" r="3.5" fill="#ffffff" />
          </svg>

          {/* Path & Face Legends */}
          <div className="absolute top-1 left-1 text-[9px] flex items-center gap-1">
            <span className="w-2.5 h-0.5" style={{ backgroundColor: pathColor }} />
            <span style={{ color: pathColor }}>Path: {pDeg.toFixed(1)}°</span>
          </div>
          <div className="absolute bottom-1 left-1 text-[9px] flex items-center gap-1">
            <span className="w-2.5 h-1" style={{ backgroundColor: faceColor }} />
            <span style={{ color: faceColor }}>Face: {fDeg.toFixed(1)}°</span>
          </div>
        </div>
      ) : (
        <div className="h-48 flex items-center justify-center text-xs text-neutral-500">
          Club data not measured by launch monitor
        </div>
      )}

      {/* Summary Footer */}
      <div className={`w-full grid grid-cols-3 gap-2 text-center pt-2.5 border-t text-xs ${
        isBoutique ? 'border-[#C5A880]/15' : 'border-neutral-800 font-mono'
      }`}>
        <div>
          <div className={`text-[10px] ${isBoutique ? 'font-serif text-[#8E928F]' : 'text-neutral-500'}`}>PATH</div>
          <div className={`mt-0.5 ${isBoutique ? 'font-sans font-black text-sm' : 'font-semibold'}`} style={{ color: pathColor }}>
            {hasClubData ? (pDeg > 0 ? `+${pDeg.toFixed(1)}°` : `${pDeg.toFixed(1)}°`) : '—'}
          </div>
        </div>
        <div>
          <div className={`text-[10px] ${isBoutique ? 'font-serif text-[#8E928F]' : 'text-neutral-500'}`}>FACE TO TARGET</div>
          <div className={`mt-0.5 ${isBoutique ? 'font-sans font-black text-sm' : 'font-semibold'}`} style={{ color: faceColor }}>
            {hasClubData ? (fDeg > 0 ? `+${fDeg.toFixed(1)}°` : `${fDeg.toFixed(1)}°`) : '—'}
          </div>
        </div>
        <div>
          <div className={`text-[10px] ${isBoutique ? 'font-serif text-[#8E928F]' : 'text-neutral-500'}`}>FACE TO PATH</div>
          <div className={`mt-0.5 ${isBoutique ? 'font-sans font-black text-sm text-[#C5A880]' : 'font-semibold text-cyan-400'}`}>
            {faceToPath !== null 
              ? (faceToPath > 0 ? `+${faceToPath.toFixed(1)}°` : `${faceToPath.toFixed(1)}°`) 
              : '—'}
          </div>
        </div>
      </div>
    </div>
  );
};
