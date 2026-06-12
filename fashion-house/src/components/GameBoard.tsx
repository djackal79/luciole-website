import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store/gameStore';
import PlayerToken from './shared/PlayerToken';
import Modal from './shared/Modal';
import { ROLES } from '../data/roles';
import type { Player } from '../types/game';

function DiceFace({ value }: { value: number }) {
  const dots: Record<number, [number, number][]> = {
    1: [[50, 50]],
    2: [[25, 25], [75, 75]],
    3: [[25, 25], [50, 50], [75, 75]],
    4: [[25, 25], [75, 25], [25, 75], [75, 75]],
    5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
    6: [[25, 20], [75, 20], [25, 50], [75, 50], [25, 80], [75, 80]],
  };

  return (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <rect width="100" height="100" rx="12" fill="#FAF8F5" stroke="#C9A84C" strokeWidth="2" />
      {(dots[value] || []).map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="8" fill="#0A0A0A" />
      ))}
    </svg>
  );
}

function BoardSpaceCell({ space, playersHere, isHighlighted, onClick }: {
  space: { id: number; name: string; icon: string; color: string; description: string };
  playersHere: Player[];
  isHighlighted: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      onClick={onClick}
      className={`relative p-2 border flex flex-col items-center justify-center text-center cursor-pointer transition-all
        ${isHighlighted ? 'border-gold shadow-gold scale-105 z-10' : 'border-gold/20 hover:border-gold/50'}`}
      style={{ backgroundColor: space.color + (isHighlighted ? 'FF' : '80') }}
      whileHover={{ scale: 1.03 }}
    >
      <span className="text-gold text-lg mb-0.5">{space.icon}</span>
      <span className="font-sans text-[8px] tracking-wider uppercase text-charcoal leading-tight">{space.name}</span>

      {/* Player tokens on this space */}
      {playersHere.length > 0 && (
        <div className="absolute -top-2 -right-2 flex gap-0.5">
          {playersHere.map((p) => (
            <div
              key={p.id}
              className="w-4 h-4 rounded-full border border-pearl shadow-sm flex items-center justify-center text-[8px]"
              style={{ backgroundColor: p.color }}
            />
          ))}
        </div>
      )}
    </motion.button>
  );
}

export default function GameBoard() {
  const {
    players, currentPlayerIndex, boardSpaces, lastDiceRoll,
    rollDice, endTurn, setScreen, turn, openBoutique, winner, resetGame,
  } = useGameStore();

  const [selectedSpace, setSelectedSpace] = useState<typeof boardSpaces[0] | null>(null);
  const [rollingDice, setRollingDice] = useState(false);
  const [diceDisplay, setDiceDisplay] = useState(1);
  const [showStats, setShowStats] = useState(false);

  const currentPlayer = players[currentPlayerIndex];
  const hasRolled = lastDiceRoll !== null;

  const handleRoll = () => {
    if (hasRolled || rollingDice) return;
    setRollingDice(true);

    // Animate dice
    let count = 0;
    const interval = setInterval(() => {
      setDiceDisplay(Math.floor(Math.random() * 6) + 1);
      count++;
      if (count > 10) {
        clearInterval(interval);
        setRollingDice(false);
        rollDice();
      }
    }, 60);
  };

  if (!currentPlayer) return null;

  // Board layout: 20 spaces around a perimeter
  const topRow = boardSpaces.slice(0, 5);
  const rightCol = boardSpaces.slice(5, 10);
  const bottomRow = [...boardSpaces.slice(10, 15)].reverse();
  const leftCol = [...boardSpaces.slice(15, 20)].reverse();

  const playersAt = (spaceId: number) => players.filter((p) => p.position === spaceId);

  const currentSpace = boardSpaces[currentPlayer.position];
  const roleData = ROLES.find((r) => r.role === currentPlayer.role)!;

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      {/* Top bar */}
      <div className="border-b border-gold/20 px-4 py-3 flex items-center justify-between bg-pearl">
        <button onClick={() => setScreen('landing')} className="text-mink hover:text-charcoal text-xs tracking-widest uppercase font-sans">
          ← Menu
        </button>
        <div className="flex items-center gap-2">
          <span className="font-serif text-gold text-lg">FH</span>
          <span className="section-label text-[10px]">Turn {turn}</span>
        </div>
        <button onClick={() => setShowStats(true)} className="text-mink hover:text-charcoal text-xs tracking-widest uppercase font-sans">
          Scores
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Board */}
        <div className="flex-1 p-4 flex flex-col">
          {/* Board grid */}
          <div className="flex-1 max-w-2xl mx-auto w-full">
            <div className="grid grid-cols-7 gap-1 h-full">
              {/* Top row (7 cells) */}
              <div className="col-span-7 grid grid-cols-7 gap-1">
                {topRow.map((space) => (
                  <BoardSpaceCell
                    key={space.id}
                    space={space}
                    playersHere={playersAt(space.id)}
                    isHighlighted={currentPlayer.position === space.id}
                    onClick={() => setSelectedSpace(space)}
                  />
                ))}
                {/* Padding for 5 spaces across 7 cols */}
                <div className="col-span-2" />
              </div>

              {/* Middle rows */}
              <div className="col-span-7 grid grid-cols-7 gap-1 flex-1">
                {/* Left column */}
                <div className="col-span-1 flex flex-col gap-1">
                  {leftCol.map((space) => (
                    <BoardSpaceCell
                      key={space.id}
                      space={space}
                      playersHere={playersAt(space.id)}
                      isHighlighted={currentPlayer.position === space.id}
                      onClick={() => setSelectedSpace(space)}
                    />
                  ))}
                </div>

                {/* Center — runway */}
                <div className="col-span-5 bg-gradient-to-b from-obsidian to-charcoal flex flex-col items-center justify-center p-4 border border-gold/30">
                  {/* Runway */}
                  <div className="w-12 bg-pearl/90 h-full max-h-48 mx-auto relative flex flex-col items-center justify-end pb-4">
                    <div className="absolute inset-0 flex flex-col">
                      {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="flex-1 border-b border-dashed border-gold/20" />
                      ))}
                    </div>
                    {/* Runway lights */}
                    {[-1, 0, 1].map((x) => (
                      Array.from({ length: 4 }).map((_, i) => (
                        <div
                          key={`${x}-${i}`}
                          className="absolute w-1 h-1 bg-gold/60 rounded-full"
                          style={{
                            left: `calc(50% + ${x * 16}px)`,
                            top: `${10 + i * 22}%`,
                          }}
                        />
                      ))
                    ))}
                    <div className="relative z-10 w-2 h-6 bg-charcoal rounded-sm" />
                  </div>

                  {/* Center logo */}
                  <div className="mt-3 text-center">
                    <div className="font-serif text-gold text-2xl tracking-widest">FH</div>
                    <div className="text-pearl/60 text-[8px] tracking-[0.3em] uppercase font-sans">Fashion Week</div>
                  </div>

                  {/* Boutiques */}
                  {currentPlayer.boutiques > 0 && (
                    <div className="mt-2 flex gap-1">
                      {Array.from({ length: currentPlayer.boutiques }).map((_, i) => (
                        <div key={i} className="w-3 h-3 border border-gold/40 bg-gold/20" />
                      ))}
                    </div>
                  )}
                </div>

                {/* Right column */}
                <div className="col-span-1 flex flex-col gap-1">
                  {rightCol.map((space) => (
                    <BoardSpaceCell
                      key={space.id}
                      space={space}
                      playersHere={playersAt(space.id)}
                      isHighlighted={currentPlayer.position === space.id}
                      onClick={() => setSelectedSpace(space)}
                    />
                  ))}
                </div>
              </div>

              {/* Bottom row */}
              <div className="col-span-7 grid grid-cols-7 gap-1">
                <div className="col-span-2" />
                {bottomRow.map((space) => (
                  <BoardSpaceCell
                    key={space.id}
                    space={space}
                    playersHere={playersAt(space.id)}
                    isHighlighted={currentPlayer.position === space.id}
                    onClick={() => setSelectedSpace(space)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right panel — current player controls */}
        <div className="w-64 border-l border-gold/20 bg-pearl flex flex-col p-5 gap-4">
          {/* Current player */}
          <div>
            <div className="section-label text-[9px] mb-2">Current Turn</div>
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-10 h-10 rounded-full border-2 border-gold flex items-center justify-center text-lg"
                style={{ backgroundColor: currentPlayer.color }}
              >
                {roleData.icon}
              </div>
              <div>
                <p className="font-display text-sm text-obsidian">{currentPlayer.name}</p>
                <p className="text-[9px] text-mink font-sans uppercase tracking-widest">{currentPlayer.role}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-center">
              {[
                { label: 'Prestige', value: currentPlayer.prestigeScore },
                { label: 'Dollars', value: `$${currentPlayer.fashionDollars}` },
                { label: 'Followers', value: `${(currentPlayer.followers / 1000).toFixed(1)}K` },
                { label: 'Boutiques', value: currentPlayer.boutiques },
              ].map(({ label, value }) => (
                <div key={label} className="bg-cream border border-gold/20 p-2">
                  <div className="text-gold font-display text-lg">{value}</div>
                  <div className="text-[8px] text-mink uppercase tracking-widest font-sans">{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Current space */}
          <div className="bg-cream border border-gold/20 p-3">
            <div className="text-[8px] text-mink uppercase tracking-widest font-sans mb-1">On Board</div>
            <div className="text-gold text-lg mb-0.5">{currentSpace.icon}</div>
            <div className="font-display text-xs text-obsidian">{currentSpace.name}</div>
            <div className="text-[9px] text-mink font-sans mt-1 leading-tight">{currentSpace.description}</div>
          </div>

          {/* Dice */}
          <div className="flex flex-col items-center gap-3">
            <motion.div
              className="w-16 h-16"
              animate={rollingDice ? { rotate: [0, 15, -15, 10, -10, 0] } : {}}
              transition={{ duration: 0.3, repeat: rollingDice ? Infinity : 0 }}
            >
              <DiceFace value={rollingDice ? diceDisplay : lastDiceRoll ?? 1} />
            </motion.div>

            {lastDiceRoll && (
              <p className="text-[9px] text-mink font-sans">Moved {lastDiceRoll} spaces</p>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-2 mt-auto">
            {!hasRolled ? (
              <button className="btn-gold w-full text-[10px]" onClick={handleRoll}>
                Roll Dice
              </button>
            ) : (
              <>
                <button
                  className="btn-outline w-full text-[10px]"
                  onClick={() => setScreen('collection-builder')}
                >
                  Design Collection
                </button>
                <button
                  className="btn-outline w-full text-[10px]"
                  onClick={() => setScreen('brand-dashboard')}
                >
                  Brand Dashboard
                </button>
                <button
                  className="w-full text-[10px] border border-gold/30 py-2 text-mink hover:text-charcoal hover:border-gold transition-all font-sans tracking-widest uppercase"
                  onClick={openBoutique}
                  disabled={currentPlayer.fashionDollars < (currentPlayer.role === 'Entrepreneur' ? 20 : 25)}
                >
                  Open Boutique ($25)
                </button>
                <button className="btn-gold w-full text-[10px]" onClick={endTurn}>
                  End Turn →
                </button>
              </>
            )}
          </div>

          {/* Other players */}
          <div>
            <div className="section-label text-[9px] mb-2">All Players</div>
            <div className="flex gap-2 flex-wrap">
              {players.map((p, i) => (
                <PlayerToken
                  key={p.id}
                  player={p}
                  size="sm"
                  showName
                  isActive={i === currentPlayerIndex}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Space info modal */}
      <Modal open={!!selectedSpace} onClose={() => setSelectedSpace(null)} title={selectedSpace?.name ?? ''}>
        {selectedSpace && (
          <div className="text-center">
            <div className="text-5xl mb-4 text-gold">{selectedSpace.icon}</div>
            <p className="font-sans text-mink italic mb-4">{selectedSpace.description}</p>
            <div className="bg-cream border border-gold/20 p-4">
              <div className="section-label text-[9px] mb-2">Board Action</div>
              <p className="font-sans text-charcoal text-sm">{selectedSpace.action}</p>
            </div>
          </div>
        )}
      </Modal>

      {/* Scoreboard modal */}
      <Modal open={showStats} onClose={() => setShowStats(false)} title="Prestige Standings">
        <div className="space-y-3">
          {[...players]
            .sort((a, b) => b.prestigeScore - a.prestigeScore)
            .map((p, rank) => (
              <div key={p.id} className="flex items-center gap-4 bg-cream border border-gold/20 p-3">
                <span className="font-display text-2xl text-gold/40">0{rank + 1}</span>
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center border border-gold/30 text-sm"
                  style={{ backgroundColor: p.color }}
                >
                  {ROLES.find((r) => r.role === p.role)?.icon}
                </div>
                <div className="flex-1">
                  <p className="font-display text-sm text-obsidian">{p.name}</p>
                  <p className="text-[9px] text-mink">{p.role}</p>
                </div>
                <div className="text-right">
                  <div className="font-display text-lg text-gold">{p.prestigeScore}</div>
                  <div className="text-[8px] text-mink uppercase">Prestige</div>
                </div>
              </div>
            ))}
        </div>
      </Modal>

      {/* Winner modal */}
      <AnimatePresence>
        {winner && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian/80 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <motion.div
              className="bg-pearl border border-gold p-12 text-center max-w-sm shadow-luxury"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200 }}
            >
              <div className="text-5xl mb-4">♔</div>
              <div className="section-label mb-2">Fashion House Champion</div>
              <h2 className="font-display text-3xl text-obsidian mb-2">{winner.name}</h2>
              <p className="text-mink font-sans italic mb-6">{winner.prestigeScore} Prestige Points</p>
              <div className="h-px bg-gold mb-6" />
              <button className="btn-gold w-full" onClick={resetGame}>
                New Game
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
