import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store/gameStore';

export default function FashionWeekScreen() {
  const { players, currentPlayerIndex, scoreCurrentPlayer, endTurn } = useGameStore();
  const currentPlayer = players[currentPlayerIndex];
  const [phase, setPhase] = useState<'intro' | 'runway' | 'scoring' | 'results'>('intro');
  const [scored, setScored] = useState(false);

  const bestCollection = [...currentPlayer.collections].sort((a, b) => b.prestigeScore - a.prestigeScore)[0];

  const criteriaScores = bestCollection
    ? {
        'Trend Match': Math.min(10, bestCollection.style.trendBonus * 2 + Math.floor(Math.random() * 3)),
        'Fabric Quality': Math.min(10, bestCollection.fabric.qualityRating * 2),
        'Style Combination': Math.min(10, bestCollection.silhouette.creativityBonus * 2 + 1),
        Creativity: Math.min(10, bestCollection.prestigeScore + Math.floor(Math.random() * 2)),
        'Buyer Appeal': Math.min(10, 5 + Math.floor(Math.random() * 5)),
      }
    : {
        'Trend Match': 4,
        'Fabric Quality': 3,
        'Style Combination': 4,
        Creativity: 5,
        'Buyer Appeal': 3,
      };

  const totalScore = Object.values(criteriaScores).reduce((a, b) => a + b, 0);

  const handleScore = () => {
    if (!scored) {
      scoreCurrentPlayer();
      setScored(true);
    }
    setPhase('results');
  };

  return (
    <div className="min-h-screen bg-dark-gradient flex flex-col items-center justify-center p-8 relative overflow-hidden">
      {/* Ambient lights */}
      <div className="absolute top-0 left-1/4 w-48 h-48 bg-gold/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-blush/10 rounded-full blur-3xl" />

      <AnimatePresence mode="wait">
        {phase === 'intro' && (
          <motion.div
            key="intro"
            className="text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="text-6xl mb-6"
              animate={{ y: [0, -10, 0] }}
              transition={{ repeat: Infinity, duration: 2 }}
            >
              ★
            </motion.div>
            <div className="section-label text-gold/80 mb-2">The Runway Awaits</div>
            <h1 className="font-display text-5xl text-pearl mb-4 font-light">Fashion Week</h1>
            <div className="h-px w-32 bg-gold mx-auto mb-4" />
            <p className="text-pearl/60 font-sans text-sm mb-2">{currentPlayer.name}'s presentation</p>
            {bestCollection ? (
              <p className="text-gold/80 font-display italic text-lg mb-10">
                "{bestCollection.style.name} {bestCollection.silhouette.name}"
              </p>
            ) : (
              <p className="text-pearl/40 font-sans text-sm italic mb-10">No collection yet — presenting raw talent</p>
            )}
            <button className="btn-gold px-16" onClick={() => setPhase('runway')}>
              Enter The Runway
            </button>
          </motion.div>
        )}

        {phase === 'runway' && (
          <motion.div
            key="runway"
            className="w-full max-w-lg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Runway visualization */}
            <div className="bg-pearl/5 border border-gold/20 p-8 mb-8 text-center">
              <div className="text-[10px] text-gold/60 uppercase tracking-widest font-sans mb-4">Live From The Runway</div>

              {/* Catwalk */}
              <div className="relative h-48 flex items-end justify-center mb-4">
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-16 h-full bg-pearl/10" />
                {/* Lights */}
                {[-60, -30, 0, 30, 60].map((x, i) => (
                  <motion.div
                    key={i}
                    className="absolute top-0 w-1 h-1 bg-gold rounded-full"
                    style={{ left: `calc(50% + ${x}px)` }}
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ delay: i * 0.2, repeat: Infinity, duration: 1.5 }}
                  />
                ))}

                {/* Model silhouette */}
                <motion.div
                  className="relative z-10 text-pearl/80 text-6xl"
                  initial={{ y: 80, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 100, delay: 0.3 }}
                >
                  {bestCollection?.silhouette.icon ?? '👗'}
                </motion.div>
              </div>

              <motion.div
                className="text-pearl"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
              >
                <p className="font-display text-xl mb-1">
                  {bestCollection?.silhouette.name ?? 'Original Design'}
                </p>
                <p className="text-pearl/50 font-sans text-xs italic">
                  in {bestCollection?.fabric.name ?? 'Signature Fabric'} · {bestCollection?.style.name ?? 'House Style'}
                </p>
              </motion.div>
            </div>

            <motion.button
              className="btn-gold w-full"
              onClick={() => setPhase('scoring')}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.5 }}
            >
              Reveal The Scores
            </motion.button>
          </motion.div>
        )}

        {phase === 'scoring' && (
          <motion.div
            key="scoring"
            className="w-full max-w-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="text-center mb-6">
              <div className="section-label text-gold/80 mb-2">Judging Panel</div>
              <h2 className="font-display text-3xl text-pearl">Scoring Your Collection</h2>
            </div>

            <div className="space-y-3 mb-8">
              {Object.entries(criteriaScores).map(([criterion, score], i) => (
                <motion.div
                  key={criterion}
                  className="flex items-center gap-4 bg-pearl/5 border border-gold/20 p-3"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.2 }}
                >
                  <span className="text-pearl/60 font-sans text-xs w-32 uppercase tracking-wider">{criterion}</span>
                  <div className="flex-1 bg-pearl/10 h-1.5 rounded-full">
                    <motion.div
                      className="h-full bg-gold rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${score * 10}%` }}
                      transition={{ delay: i * 0.2 + 0.3, duration: 0.8 }}
                    />
                  </div>
                  <span className="text-gold font-display text-lg w-8 text-right">{score}</span>
                </motion.div>
              ))}
            </div>

            <div className="bg-gold/10 border border-gold/40 p-4 text-center mb-6">
              <div className="text-[9px] text-gold/60 uppercase tracking-widest font-sans mb-1">Total Score</div>
              <div className="font-display text-5xl text-gold">{totalScore}</div>
              <div className="text-pearl/50 text-[10px] font-sans">out of 50</div>
            </div>

            <button className="btn-gold w-full" onClick={handleScore}>
              Claim Your Prestige
            </button>
          </motion.div>
        )}

        {phase === 'results' && (
          <motion.div
            key="results"
            className="text-center max-w-sm"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className="text-5xl mb-4">♔</div>
            <div className="section-label text-gold/80 mb-2">Fashion Week Complete</div>
            <h2 className="font-display text-3xl text-pearl mb-6">{currentPlayer.name}</h2>

            <div className="grid grid-cols-2 gap-3 mb-8">
              {[
                { label: 'Prestige Score', value: currentPlayer.prestigeScore },
                { label: 'Fashion Dollars', value: `$${currentPlayer.fashionDollars}` },
                { label: 'Followers', value: `${(currentPlayer.followers / 1000).toFixed(1)}K` },
                { label: 'Collections', value: currentPlayer.collections.length },
              ].map(({ label, value }) => (
                <div key={label} className="bg-pearl/10 border border-gold/20 p-4">
                  <div className="font-display text-2xl text-gold">{value}</div>
                  <div className="text-[9px] text-pearl/50 uppercase tracking-widest font-sans">{label}</div>
                </div>
              ))}
            </div>

            {currentPlayer.prestigeScore >= 100 && (
              <div className="bg-gold/20 border border-gold p-4 mb-6">
                <div className="text-gold font-display text-lg">Fashion House Champion!</div>
                <div className="text-pearl/60 text-xs font-sans">100 Prestige reached</div>
              </div>
            )}

            <button className="btn-gold w-full" onClick={endTurn}>
              Return to Board
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
