import React, { useState, useMemo } from 'react';
import { useShotStore } from '../../store/shotStore';
import { useThemeStore } from '../../store/themeStore';
import { 
  X, 
  Tag, 
  Filter, 
  History, 
  Video, 
  Target, 
  Activity
} from 'lucide-react';

export const HistoryDrawer: React.FC = () => {
  const {
    shots,
    currentShotId,
    distanceUnit,
    isHistoryDrawerOpen,
    toggleHistoryDrawer,
    selectShot,
    patchShot,
  } = useShotStore();

  const { currentTheme } = useThemeStore();
  const isBoutique = currentTheme === 'boutique';

  const [selectedClubFilter, setSelectedClubFilter] = useState<string>('All');
  const [editingShotId, setEditingShotId] = useState<string | null>(null);
  const [customTagInput, setCustomTagInput] = useState<string>('');
  const [notesInput, setNotesInput] = useState<string>('');

  const unitFactor = distanceUnit === 'meters' ? 1.0 : 1.09361;
  const unitLabel = distanceUnit === 'meters' ? 'm' : 'yds';

  // Free strings specified by contract: Good Strike, Pushed, Shank, Fat, Thin
  const contractQuickTags = [
    'Good Strike', 
    'Pushed', 
    'Shank', 
    'Fat', 
    'Thin',
  ];

  // Distinct clubs
  const clubs = useMemo(() => {
    const set = new Set<string>();
    shots.forEach((s) => {
      if (s.club_used) set.add(s.club_used);
    });
    return ['All', ...Array.from(set)];
  }, [shots]);

  // Filtered shots
  const filteredShots = useMemo(() => {
    if (selectedClubFilter === 'All') return shots;
    return shots.filter((s) => s.club_used === selectedClubFilter);
  }, [shots, selectedClubFilter]);

  // Session summary statistics with safe null handling for scenario 3 (telemetry: null)
  const sessionStats = useMemo(() => {
    const shotsWithBall = shots.filter((s) => s.telemetry?.ball?.speed_mph != null);
    if (shotsWithBall.length === 0) return { avgSpeed: '0.0', maxSpeed: '0.0', avgSmash: '—' };

    const speeds = shotsWithBall.map((s) => s.telemetry!.ball.speed_mph!);
    const avgSpeed = (speeds.reduce((a, b) => a + b, 0) / speeds.length).toFixed(1);
    const maxSpeed = Math.max(...speeds).toFixed(1);

    const smashes = shots
      .filter((s) => s.telemetry?.derived?.smash_factor != null)
      .map((s) => s.telemetry!.derived.smash_factor!);
    const avgSmash = smashes.length > 0 ? (smashes.reduce((a, b) => a + b, 0) / smashes.length).toFixed(2) : '—';

    return { avgSpeed, maxSpeed, avgSmash };
  }, [shots]);

  if (!isHistoryDrawerOpen) return null;

  return (
    <div className={`fixed inset-y-0 right-0 z-50 w-full max-w-md shadow-2xl flex flex-col transition-transform animate-in slide-in-from-right duration-200 ${
      isBoutique 
        ? 'bg-[#111413]/95 backdrop-blur-2xl border-l border-[#C5A880]/20 text-[#F4F4F2]' 
        : 'bg-[#0b0e17] border-l border-neutral-800'
    }`}>
      {/* Drawer Header */}
      <div className={`p-4 border-b flex items-center justify-between ${
        isBoutique ? 'bg-stone-900/60 border-[#C5A880]/20' : 'bg-[#0e121d] border-neutral-800'
      }`}>
        <div className="flex items-center gap-2">
          <History className={`w-5 h-5 ${isBoutique ? 'text-[#D4AF37]' : 'text-emerald-400'}`} />
          <div>
            <h2 className={`text-base font-bold tracking-tight ${
              isBoutique ? 'font-serif text-[#F4F4F2]' : 'text-white'
            }`}>
              Session Shot History
            </h2>
            <p className={`text-xs ${isBoutique ? 'font-serif text-[#8E928F]' : 'font-mono text-neutral-400'}`}>
              {shots.length} shots recorded this session
            </p>
          </div>
        </div>
        <button
          onClick={toggleHistoryDrawer}
          className={`p-1.5 transition-colors ${
            isBoutique 
              ? 'rounded-full bg-stone-900/60 hover:bg-stone-800 text-[#8E928F] hover:text-white border border-[#C5A880]/20' 
              : 'rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white'
          }`}
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Session Aggregates Ribbon */}
      <div className={`grid grid-cols-3 gap-2 p-3 border-b text-center ${
        isBoutique ? 'bg-stone-900/40 border-[#C5A880]/15' : 'bg-neutral-900/80 border-neutral-800 font-mono'
      }`}>
        <div>
          <span className={`text-[10px] uppercase block ${isBoutique ? 'font-serif text-[#8E928F]' : 'text-neutral-500'}`}>Avg Ball Spd</span>
          <div className={`mt-0.5 ${isBoutique ? 'font-sans font-black text-sm text-[#E5C07B]' : 'text-sm font-bold text-emerald-400'}`}>
            {sessionStats.avgSpeed} mph
          </div>
        </div>
        <div>
          <span className={`text-[10px] uppercase block ${isBoutique ? 'font-serif text-[#8E928F]' : 'text-neutral-500'}`}>Top Ball Spd</span>
          <div className={`mt-0.5 ${isBoutique ? 'font-sans font-black text-sm text-[#D4AF37]' : 'text-sm font-bold text-cyan-400'}`}>
            {sessionStats.maxSpeed} mph
          </div>
        </div>
        <div>
          <span className={`text-[10px] uppercase block ${isBoutique ? 'font-serif text-[#8E928F]' : 'text-neutral-500'}`}>Avg Smash</span>
          <div className={`mt-0.5 ${isBoutique ? 'font-sans font-black text-sm text-[#C5A880]' : 'text-sm font-bold text-amber-400'}`}>
            {sessionStats.avgSmash}
          </div>
        </div>
      </div>

      {/* Club Filter Pills */}
      <div className={`p-3 border-b flex items-center gap-1.5 overflow-x-auto select-none ${
        isBoutique ? 'border-[#C5A880]/15' : 'border-neutral-800'
      }`}>
        <Filter className={`w-3.5 h-3.5 shrink-0 mr-1 ${isBoutique ? 'text-[#C5A880]' : 'text-neutral-500'}`} />
        {clubs.map((c) => (
          <button
            key={c}
            onClick={() => setSelectedClubFilter(c)}
            className={`px-3 py-1 text-xs whitespace-nowrap transition-colors ${
              isBoutique ? 'rounded-full' : 'rounded-md font-mono'
            } ${
              selectedClubFilter === c
                ? (isBoutique ? 'bg-gradient-to-br from-[#E5C07B] to-[#C5A880] text-stone-900 font-bold shadow-sm font-serif' : 'bg-emerald-500 text-black font-semibold')
                : (isBoutique ? 'bg-stone-900/60 border border-[#C5A880]/20 text-[#8E928F] hover:text-white font-serif' : 'bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white')
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Shots List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {filteredShots.map((shot) => {
          const isSelected = shot.shot_id === currentShotId;
          const carry = shot.telemetry?.distance?.carry_m != null 
            ? (shot.telemetry.distance.carry_m * unitFactor).toFixed(1)
            : '—';

          return (
            <div
              key={shot.shot_id}
              className={`p-3.5 transition-all cursor-pointer ${
                isBoutique 
                  ? (isSelected 
                      ? 'rounded-2xl bg-[#C5A880]/15 border-2 border-[#C5A880] shadow-lg shadow-[#C5A880]/15' 
                      : 'rounded-2xl bg-stone-900/40 backdrop-blur-md border border-[#C5A880]/15 hover:border-[#C5A880]/40 hover:bg-stone-900/60')
                  : (isSelected
                      ? 'rounded-xl bg-emerald-500/10 border border-emerald-500/80 shadow-md shadow-emerald-500/10'
                      : 'rounded-xl bg-neutral-900/50 border border-neutral-800/80 hover:bg-neutral-900 hover:border-neutral-700')
              }`}
              onClick={() => selectShot(shot.shot_id)}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-0.5 text-[11px] font-bold ${
                    isBoutique 
                      ? (isSelected ? 'rounded-full bg-gradient-to-br from-[#E5C07B] to-[#C5A880] text-stone-900 font-serif' : 'rounded-full bg-stone-900/80 text-[#C5A880] border border-[#C5A880]/20 font-serif')
                      : (isSelected ? 'rounded bg-emerald-500 text-black font-mono' : 'rounded bg-neutral-800 text-neutral-300 font-mono')
                  }`}>
                    {shot.shot_id}
                  </span>
                  <span className={`text-sm font-semibold ${isBoutique ? 'font-serif text-[#F4F4F2]' : 'text-white'}`}>
                    {shot.club_used ?? '—'}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className={`text-[10px] px-2 py-0.5 uppercase font-bold ${
                    isBoutique 
                      ? (shot.status === 'complete' 
                          ? 'rounded-full bg-[#D4AF37]/20 text-[#E5C07B] border border-[#D4AF37]/40 font-serif' 
                          : 'rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-serif')
                      : (shot.status === 'complete' 
                          ? 'rounded bg-emerald-500/20 text-emerald-400 font-mono' 
                          : 'rounded bg-amber-500/20 text-amber-400 font-mono')
                  }`}>
                    {shot.status}
                  </span>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (editingShotId === shot.shot_id) {
                        setEditingShotId(null);
                      } else {
                        setEditingShotId(shot.shot_id);
                        setNotesInput(shot.notes || '');
                      }
                    }}
                    className={`p-1 transition-colors ${
                      isBoutique 
                        ? 'rounded-full hover:bg-stone-800 text-[#8E928F] hover:text-[#C5A880]' 
                        : 'rounded hover:bg-neutral-800 text-neutral-500 hover:text-neutral-300'
                    }`}
                    title="Manage tags and notes"
                  >
                    <Tag className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Sources Indicator Icons */}
              <div className="flex items-center gap-2 text-[10px] text-neutral-500 mb-2">
                <span className={`flex items-center gap-1 ${shot.sources.body_swing ? (isBoutique ? 'text-[#E5C07B]' : 'text-emerald-400') : 'text-neutral-600 line-through'}`}>
                  <Video className="w-3 h-3" /> Body
                </span>
                <span>•</span>
                <span className={`flex items-center gap-1 ${shot.sources.impact_strike ? (isBoutique ? 'text-[#D4AF37]' : 'text-cyan-400') : 'text-neutral-600 line-through'}`}>
                  <Target className="w-3 h-3" /> Impact
                </span>
                <span>•</span>
                <span className={`flex items-center gap-1 ${shot.sources.telemetry ? (isBoutique ? 'text-[#C5A880]' : 'text-purple-400') : 'text-neutral-600 line-through'}`}>
                  <Activity className="w-3 h-3" /> Telemetry
                </span>
              </div>

              {/* Metrics row */}
              <div className={`grid grid-cols-3 gap-2 text-xs pt-1 border-t ${
                isBoutique ? 'border-[#C5A880]/10' : 'border-transparent font-mono'
              }`}>
                <div>
                  <span className={`text-[10px] block ${isBoutique ? 'font-serif text-[#8E928F]' : 'text-neutral-500'}`}>CARRY</span>
                  <span className={`mt-0.5 ${isBoutique ? 'font-sans font-black text-sm text-[#F4F4F2]' : 'font-bold text-emerald-400'}`}>
                    {carry} {carry !== '—' && unitLabel}
                  </span>
                </div>
                <div>
                  <span className={`text-[10px] block ${isBoutique ? 'font-serif text-[#8E928F]' : 'text-neutral-500'}`}>BALL SPD</span>
                  <span className={`mt-0.5 ${isBoutique ? 'font-sans font-black text-sm text-[#D4AF37]' : 'font-bold text-cyan-400'}`}>
                    {shot.telemetry?.ball?.speed_mph != null ? `${shot.telemetry.ball.speed_mph} mph` : '—'}
                  </span>
                </div>
                <div>
                  <span className={`text-[10px] block ${isBoutique ? 'font-serif text-[#8E928F]' : 'text-neutral-500'}`}>SMASH</span>
                  <span className={`mt-0.5 ${isBoutique ? 'font-sans font-black text-sm text-[#E5C07B]' : 'font-bold text-amber-400'}`}>
                    {shot.telemetry?.derived?.smash_factor != null ? shot.telemetry.derived.smash_factor.toFixed(2) : '—'}
                  </span>
                </div>
              </div>

              {/* Tags & Notes display */}
              {(shot.tags.length > 0 || shot.notes) && (
                <div className={`flex flex-col gap-1 mt-2 pt-2 border-t ${
                  isBoutique ? 'border-[#C5A880]/15' : 'border-neutral-800/60'
                }`}>
                  {shot.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {shot.tags.map((t) => (
                        <span
                          key={t}
                          className={`text-[10px] px-2 py-0.5 flex items-center gap-1 ${
                            isBoutique 
                              ? 'rounded-full bg-stone-900/60 border border-[#C5A880]/20 text-[#C5A880] font-serif' 
                              : 'rounded bg-neutral-800 text-neutral-300 font-mono'
                          }`}
                        >
                          {t}
                          {editingShotId === shot.shot_id && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                patchShot(shot.shot_id, { tags: shot.tags.filter((tag) => tag !== t) });
                              }}
                              className="hover:text-rose-400 text-neutral-500 font-bold ml-0.5"
                            >
                              ×
                            </button>
                          )}
                        </span>
                      ))}
                    </div>
                  )}
                  {shot.notes && (
                    <span className={`text-[11px] italic ${isBoutique ? 'text-[#8E928F] font-serif' : 'text-neutral-400'}`}>
                      "{shot.notes}"
                    </span>
                  )}
                </div>
              )}

              {/* Tag & Notes editing drawer pop-in */}
              {editingShotId === shot.shot_id && (
                <div
                  className={`mt-2 p-2.5 border space-y-2 ${
                    isBoutique 
                      ? 'bg-stone-900/90 border-[#C5A880]/30 rounded-xl font-serif' 
                      : 'bg-[#06080d] border-neutral-700/80 rounded-lg font-mono'
                  }`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className={`text-[10px] block ${isBoutique ? 'text-[#8E928F]' : 'text-neutral-400'}`}>
                    Quick Tag Selector (persists via PATCH):
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {contractQuickTags.map((preset) => {
                      const hasTag = shot.tags.includes(preset);
                      return (
                        <button
                          key={preset}
                          onClick={() => {
                            const newTags = hasTag 
                              ? shot.tags.filter((t) => t !== preset)
                              : [...shot.tags, preset];
                            patchShot(shot.shot_id, { tags: newTags });
                          }}
                          className={`text-[10px] px-2.5 py-0.5 border transition-colors ${
                            isBoutique ? 'rounded-full' : 'rounded'
                          } ${
                            hasTag
                              ? (isBoutique ? 'bg-[#D4AF37]/20 border-[#D4AF37]/50 text-[#E5C07B]' : 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300')
                              : (isBoutique ? 'bg-stone-800 border-stone-700 text-[#8E928F] hover:text-white' : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-white')
                          }`}
                        >
                          {preset} {hasTag && '✓'}
                        </button>
                      );
                    })}
                  </div>

                  {/* Custom tag input */}
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      placeholder="Add tag..."
                      value={customTagInput}
                      onChange={(e) => setCustomTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && customTagInput.trim()) {
                          patchShot(shot.shot_id, { tags: [...shot.tags, customTagInput.trim()] });
                          setCustomTagInput('');
                        }
                      }}
                      className={`flex-1 px-2.5 py-1 text-xs text-white placeholder-stone-500 focus:outline-none ${
                        isBoutique 
                          ? 'rounded-full bg-stone-950 border border-[#C5A880]/30 focus:border-[#C5A880]' 
                          : 'rounded bg-neutral-900 border border-neutral-700 focus:border-emerald-500'
                      }`}
                    />
                    <button
                      onClick={() => {
                        if (customTagInput.trim()) {
                          patchShot(shot.shot_id, { tags: [...shot.tags, customTagInput.trim()] });
                          setCustomTagInput('');
                        }
                      }}
                      className={`px-3 py-1 text-xs font-bold ${
                        isBoutique 
                          ? 'rounded-full bg-gradient-to-br from-[#E5C07B] to-[#C5A880] text-stone-900 shadow-sm' 
                          : 'rounded bg-emerald-500 hover:bg-emerald-400 text-black'
                      }`}
                    >
                      Add
                    </button>
                  </div>

                  {/* Notes input */}
                  <div className="pt-1">
                    <span className={`text-[10px] block mb-1 ${isBoutique ? 'text-[#8E928F]' : 'text-neutral-400'}`}>
                      Shot Notes:
                    </span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        placeholder="Add notes for swing..."
                        value={notesInput}
                        onChange={(e) => setNotesInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            patchShot(shot.shot_id, { notes: notesInput });
                          }
                        }}
                        className={`flex-1 px-2.5 py-1 text-xs text-white placeholder-stone-500 focus:outline-none ${
                          isBoutique 
                            ? 'rounded-full bg-stone-950 border border-[#C5A880]/30 focus:border-[#C5A880]' 
                            : 'rounded bg-neutral-900 border border-neutral-700 focus:border-emerald-500'
                        }`}
                      />
                      <button
                        onClick={() => patchShot(shot.shot_id, { notes: notesInput })}
                        className={`px-3 py-1 text-xs ${
                          isBoutique 
                            ? 'rounded-full bg-stone-800 hover:bg-stone-700 text-[#E5C07B] border border-[#C5A880]/30' 
                            : 'rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200'
                        }`}
                      >
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filteredShots.length === 0 && (
          <div className="text-center py-12 text-neutral-500 font-mono text-xs">
            No shots found for the selected filter.
          </div>
        )}
      </div>
    </div>
  );
};
