import { motion } from 'framer-motion';
import { useGameStore } from '../store/gameStore';

const fadeUp = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
};

export default function LandingScreen() {
  const { setScreen, players } = useGameStore();
  const hasGame = players.length > 0;

  return (
    <div className="min-h-screen bg-cream-gradient flex flex-col relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-64 h-64 bg-gold/5 rounded-full -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-blush/30 rounded-full translate-x-1/2 translate-y-1/2" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] border border-gold/10 rounded-full" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] border border-gold/8 rounded-full" />
      </div>

      {/* Top navigation strip */}
      <div className="border-b border-gold/20 px-8 py-3 flex justify-between items-center">
        <span className="section-label text-[10px]">The Fashion House™</span>
        <span className="section-label text-[10px]">Est. MMXXVI</span>
      </div>

      {/* Hero content */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 py-16 text-center">
        {/* Monogram */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, ease: 'easeOut' }}
        >
          <div className="w-24 h-24 border border-gold mx-auto flex items-center justify-center mb-4 relative">
            <div className="absolute inset-1 border border-gold/40" />
            <span className="font-serif text-3xl font-light text-gold tracking-widest">FH</span>
          </div>
        </motion.div>

        {/* Title */}
        <motion.div {...fadeUp} transition={{ delay: 0.3, duration: 0.8 }}>
          <h1 className="font-display text-6xl md:text-8xl font-light text-obsidian tracking-[0.08em] leading-none mb-2">
            THE
          </h1>
          <h1 className="font-display text-6xl md:text-8xl font-light text-obsidian tracking-[0.08em] leading-none mb-1">
            FASHION
          </h1>
          <div className="flex items-center justify-center gap-4 mb-6">
            <div className="h-px flex-1 max-w-24 bg-gold" />
            <h1 className="font-display text-6xl md:text-8xl font-light text-obsidian tracking-[0.08em] leading-none">
              HOUSE
            </h1>
            <span className="font-serif text-lg text-gold self-start mt-2">™</span>
            <div className="h-px flex-1 max-w-24 bg-gold" />
          </div>
        </motion.div>

        {/* Tagline */}
        <motion.p
          className="section-label text-mink tracking-[0.4em] mb-16 text-[11px]"
          {...fadeUp}
          transition={{ delay: 0.6, duration: 0.8 }}
        >
          Build Your Brand. Own The Runway.
        </motion.p>

        {/* Buttons */}
        <motion.div
          className="flex flex-col items-center gap-4 w-full max-w-xs"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9, duration: 0.8 }}
        >
          <button className="btn-gold w-full" onClick={() => setScreen('setup')}>
            Start New Game
          </button>

          {hasGame && (
            <button className="btn-outline w-full" onClick={() => setScreen('board')}>
              Continue Game
            </button>
          )}

          <button className="btn-outline w-full" onClick={() => setScreen('collection-builder')}>
            Create Collection
          </button>

          <button
            className="btn-outline w-full"
            onClick={() => setScreen('gallery')}
          >
            Fashion House Gallery
          </button>

          <button
            className="text-mink hover:text-charcoal transition-colors font-sans text-xs tracking-widest uppercase mt-2"
            onClick={() => setScreen('instructions')}
          >
            How to Play
          </button>
        </motion.div>
      </div>

      {/* Bottom strip */}
      <div className="border-t border-gold/20 px-8 py-3 flex justify-between items-center">
        <span className="font-sans text-[10px] text-mink tracking-widest">2–4 Players</span>
        <div className="flex gap-2">
          {['◇', '◈', '◉', '○'].map((s, i) => (
            <span key={i} className="text-gold/40 text-xs">{s}</span>
          ))}
        </div>
        <span className="font-sans text-[10px] text-mink tracking-widest">Ages 16+</span>
      </div>
    </div>
  );
}
