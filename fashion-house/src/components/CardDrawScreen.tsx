import { motion } from 'framer-motion';
import { useGameStore } from '../store/gameStore';
import CardDisplay from './shared/CardDisplay';

export default function CardDrawScreen() {
  const { drawnCard, dismissCard, players, currentPlayerIndex } = useGameStore();
  const currentPlayer = players[currentPlayerIndex];

  if (!drawnCard) return null;

  return (
    <div className="min-h-screen bg-dark-gradient flex flex-col items-center justify-center p-8">
      {/* Background shimmer */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gold/5 rounded-full blur-3xl" />
      </div>

      <motion.div
        className="text-center mb-8"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="section-label text-gold/80 mb-2">{currentPlayer?.name} draws</div>
        <div className="h-px w-24 bg-gold/40 mx-auto" />
      </motion.div>

      {/* Card */}
      <div className="mb-10">
        <CardDisplay card={drawnCard} size="lg" animate />
      </div>

      {/* Effect explanation */}
      <motion.div
        className="bg-pearl/10 border border-gold/20 p-6 max-w-sm text-center mb-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        <div className="text-gold text-2xl mb-3">{drawnCard.icon}</div>
        <h2 className="font-display text-xl text-pearl mb-2">{drawnCard.title}</h2>
        <p className="text-pearl/70 font-sans text-sm leading-relaxed">{drawnCard.effect}</p>

        {drawnCard.value > 0 ? (
          <div className="mt-4 flex justify-center gap-4 text-[10px] text-gold/80 font-sans uppercase tracking-widest">
            <span>+{drawnCard.value} Prestige</span>
            <span>·</span>
            <span>Effect Applied</span>
          </div>
        ) : (
          <div className="mt-4 text-[10px] text-blush/80 font-sans uppercase tracking-widest">
            Setback — resilience is everything
          </div>
        )}
      </motion.div>

      <motion.button
        className="btn-gold px-12"
        onClick={dismissCard}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9 }}
      >
        Continue
      </motion.button>
    </div>
  );
}
