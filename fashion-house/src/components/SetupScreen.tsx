import { useState } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../store/gameStore';
import type { PlayerRole } from '../types/game';
import { ROLES } from '../data/roles';

const MAX_PLAYERS = 4;

interface PlayerSetup {
  name: string;
  role: PlayerRole;
}

export default function SetupScreen() {
  const { startGame, setScreen } = useGameStore();
  const [players, setPlayers] = useState<PlayerSetup[]>([
    { name: 'Player 1', role: 'Designer' },
    { name: 'Player 2', role: 'Buyer' },
  ]);

  const addPlayer = () => {
    if (players.length < MAX_PLAYERS) {
      setPlayers([...players, { name: `Player ${players.length + 1}`, role: 'Stylist' }]);
    }
  };

  const removePlayer = (i: number) => {
    setPlayers(players.filter((_, idx) => idx !== i));
  };

  const updatePlayer = (i: number, field: keyof PlayerSetup, value: string) => {
    setPlayers(players.map((p, idx) => (idx === i ? { ...p, [field]: value } : p)));
  };

  return (
    <div className="min-h-screen bg-cream-gradient flex flex-col">
      {/* Header */}
      <div className="border-b border-gold/20 px-8 py-4 flex items-center justify-between">
        <button onClick={() => setScreen('landing')} className="text-mink hover:text-charcoal transition-colors text-xs tracking-widest uppercase font-sans">
          ← Back
        </button>
        <span className="section-label">Player Setup</span>
        <span className="font-serif text-gold text-lg">FH</span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-8 py-12 max-w-3xl mx-auto w-full">
        <motion.h2
          className="font-display text-4xl font-light text-obsidian tracking-wide mb-2 text-center"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          Choose Your Players
        </motion.h2>
        <div className="gold-divider" />
        <p className="section-label text-mink text-[10px] mb-10">2–4 Fashion Houses Compete</p>

        <div className="w-full space-y-4 mb-8">
          {players.map((player, i) => {
            const roleData = ROLES.find((r) => r.role === player.role)!;
            return (
              <motion.div
                key={i}
                className="bg-pearl border border-gold/20 p-6 shadow-card"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <div className="flex items-start gap-6">
                  {/* Role icon */}
                  <div
                    className="w-12 h-12 flex items-center justify-center border border-gold/30 shrink-0 text-xl"
                    style={{ backgroundColor: roleData.color }}
                  >
                    {roleData.icon}
                  </div>

                  <div className="flex-1">
                    {/* Name input */}
                    <input
                      type="text"
                      value={player.name}
                      onChange={(e) => updatePlayer(i, 'name', e.target.value)}
                      className="w-full bg-transparent border-b border-gold/30 pb-1 mb-3 font-display text-lg text-obsidian focus:outline-none focus:border-gold placeholder-mink/40"
                      placeholder="Fashion House Name"
                    />

                    {/* Role selector */}
                    <div className="flex flex-wrap gap-2">
                      {ROLES.map((r) => (
                        <button
                          key={r.role}
                          onClick={() => updatePlayer(i, 'role', r.role)}
                          className={`px-3 py-1 text-[10px] font-sans tracking-widest uppercase border transition-all ${
                            player.role === r.role
                              ? 'bg-gold border-gold-dark text-obsidian'
                              : 'border-mink/30 text-mink hover:border-gold hover:text-charcoal'
                          }`}
                        >
                          {r.icon} {r.role}
                        </button>
                      ))}
                    </div>

                    {/* Ability */}
                    <p className="mt-2 text-[10px] text-mink font-sans italic">{roleData.abilityDetail}</p>
                    <p className="text-[10px] text-gold font-sans mt-1">
                      Start: ${roleData.startingDollars} Fashion Dollars · {roleData.startingPrestige} Prestige
                    </p>
                  </div>

                  {players.length > 2 && (
                    <button onClick={() => removePlayer(i)} className="text-mink/40 hover:text-mink transition-colors text-xl">
                      ×
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4 w-full">
          {players.length < MAX_PLAYERS && (
            <button className="btn-outline flex-1" onClick={addPlayer}>
              + Add Player
            </button>
          )}
          <button
            className="btn-gold flex-1"
            onClick={() => startGame(players)}
            disabled={players.length < 2}
          >
            Begin — Fashion Week Awaits
          </button>
        </div>
      </div>
    </div>
  );
}
