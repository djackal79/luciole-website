import React, { useState } from 'react';
import { useShotStore } from '../../store/shotStore';
import { startSession, endSession } from '../../services/api';
import { X, Play, Square, Activity, Award } from 'lucide-react';

const CLUBS = ['Driver', '3W', '5W', '4I', '5I', '6I', '7I', '8I', '9I', 'PW', 'GW', 'SW', 'LW', 'Putter'];

export const SessionControlsModal: React.FC = () => {
  const isSessionModalOpen = useShotStore((s) => s.isSessionModalOpen);
  const toggleSessionModal = useShotStore((s) => s.toggleSessionModal);
  const activeSessionId = useShotStore((s) => s.activeSessionId);
  const activeClub = useShotStore((s) => s.activeClub);
  const setActiveSession = useShotStore((s) => s.setActiveSession);
  const shots = useShotStore((s) => s.shots);

  const [selectedClub, setSelectedClub] = useState(activeClub);
  const [customSessionId, setCustomSessionId] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isSessionModalOpen) return null;

  const handleStartNewSession = async () => {
    setIsLoading(true);
    const newSessionId = customSessionId.trim() || `session-${new Date().toISOString().slice(0, 10)}-${Date.now().toString().slice(-4)}`;
    try {
      await startSession(newSessionId, selectedClub);
    } catch {
      // offline fallback
    }
    setActiveSession(newSessionId, selectedClub);
    setIsLoading(false);
    toggleSessionModal();
  };

  const handleEndSession = async () => {
    setIsLoading(true);
    try {
      await endSession();
    } catch {
      // offline fallback
    }
    setIsLoading(false);
    toggleSessionModal();
  };

  // Compute session stats
  const validBallSpeeds = shots
    .map(s => s.telemetry?.ball?.speed_mph)
    .filter((v): v is number => v !== null && v !== undefined);
  const avgBallSpeed = validBallSpeeds.length 
    ? (validBallSpeeds.reduce((a, b) => a + b, 0) / validBallSpeeds.length).toFixed(1)
    : '—';

  const validSmash = shots
    .map(s => s.telemetry?.derived?.smash_factor)
    .filter((v): v is number => v !== null && v !== undefined);
  const avgSmash = validSmash.length
    ? (validSmash.reduce((a, b) => a + b, 0) / validSmash.length).toFixed(2)
    : '—';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="relative w-full max-w-lg bg-[#0b0e17] border border-neutral-800 rounded-2xl shadow-2xl p-5 font-mono text-xs flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold">
              🏌️
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">Session Management</h3>
              <p className="text-[11px] text-neutral-400">Current Session: {activeSessionId}</p>
            </div>
          </div>
          <button
            onClick={toggleSessionModal}
            className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Current Session Summary */}
        <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-neutral-900/60 border border-neutral-800 text-center">
          <div>
            <span className="text-[10px] text-neutral-500">TOTAL SHOTS</span>
            <div className="text-base font-bold text-white mt-0.5">{shots.length}</div>
          </div>
          <div>
            <span className="text-[10px] text-neutral-500">AVG BALL SPEED</span>
            <div className="text-base font-bold text-cyan-400 mt-0.5">{avgBallSpeed} {avgBallSpeed !== '—' && 'MPH'}</div>
          </div>
          <div>
            <span className="text-[10px] text-neutral-500">AVG SMASH</span>
            <div className="text-base font-bold text-amber-400 mt-0.5">{avgSmash}</div>
          </div>
        </div>

        {/* Club Selection */}
        <div>
          <label className="block text-[11px] text-neutral-400 mb-2 font-bold">ACTIVE CLUB SELECTION</label>
          <div className="grid grid-cols-5 sm:grid-cols-7 gap-1.5">
            {CLUBS.map((club) => (
              <button
                key={club}
                onClick={() => setSelectedClub(club)}
                className={`py-1.5 rounded-lg text-center font-bold transition-all ${
                  selectedClub === club
                    ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/20'
                    : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-800'
                }`}
              >
                {club}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2 border-t border-neutral-800">
          <button
            onClick={handleStartNewSession}
            disabled={isLoading}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold transition-colors"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Start New Session</span>
          </button>

          <button
            onClick={handleEndSession}
            disabled={isLoading}
            className="px-4 py-2.5 rounded-lg bg-neutral-800 hover:bg-rose-500/20 hover:text-rose-400 border border-neutral-700 text-neutral-300 font-bold transition-colors flex items-center gap-1.5"
          >
            <Square className="w-3.5 h-3.5" />
            <span>End Session</span>
          </button>
        </div>
      </div>
    </div>
  );
};
