import { motion } from 'framer-motion';
import { useGameStore } from '../store/gameStore';
import { ROLES } from '../data/roles';

export default function BrandDashboard() {
  const { players, currentPlayerIndex, setScreen, openBoutique } = useGameStore();
  const player = players[currentPlayerIndex];
  const roleData = ROLES.find((r) => r.role === player?.role);

  if (!player) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <button className="btn-gold" onClick={() => setScreen('landing')}>← Back to Menu</button>
      </div>
    );
  }

  const brandLevel = Math.floor(player.prestigeScore / 20) + 1;
  const brandLabels = ['Emerging', 'Rising', 'Established', 'Iconic', 'Legendary'];
  const brandLabel = brandLabels[Math.min(brandLevel - 1, brandLabels.length - 1)];

  const progressToNext = ((player.prestigeScore % 20) / 20) * 100;

  return (
    <div className="min-h-screen bg-cream-gradient flex flex-col">
      {/* Header */}
      <div className="border-b border-gold/20 px-8 py-4 flex items-center justify-between bg-pearl">
        <button onClick={() => setScreen('board')} className="text-mink hover:text-charcoal text-xs tracking-widest uppercase font-sans">
          ← Board
        </button>
        <span className="section-label">Brand Dashboard</span>
        <span className="font-serif text-gold text-lg">FH</span>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-3xl mx-auto">
          {/* Brand header */}
          <motion.div
            className="text-center mb-10"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div
              className="w-20 h-20 rounded-full border-2 border-gold mx-auto mb-4 flex items-center justify-center text-3xl"
              style={{ backgroundColor: player.color }}
            >
              {roleData?.icon}
            </div>
            <h2 className="font-display text-4xl text-obsidian font-light">{player.name}</h2>
            <p className="section-label text-mink mt-1">{player.role} · {brandLabel} Fashion House</p>
          </motion.div>

          {/* Brand level progress */}
          <div className="bg-pearl border border-gold/20 p-6 mb-6 shadow-card">
            <div className="flex justify-between items-end mb-3">
              <div>
                <div className="section-label text-[9px] mb-1">Brand Level</div>
                <div className="font-display text-3xl text-obsidian">Level {brandLevel}</div>
                <div className="text-xs text-mink font-sans">{brandLabel}</div>
              </div>
              <div className="text-right">
                <div className="text-[9px] text-mink font-sans mb-1">{player.prestigeScore} / {brandLevel * 20} Prestige</div>
                <div className="text-[9px] text-gold font-sans">Next: {brandLevel * 20 - player.prestigeScore} pts</div>
              </div>
            </div>
            <div className="bg-cream h-2 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gold rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progressToNext}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
              />
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            {[
              { icon: '★', label: 'Prestige', value: player.prestigeScore, sub: 'points' },
              { icon: '◎', label: 'Revenue', value: `$${player.fashionDollars}`, sub: 'fashion dollars' },
              { icon: '◉', label: 'Followers', value: `${(player.followers / 1000).toFixed(1)}K`, sub: 'social reach' },
              { icon: '⬡', label: 'Boutiques', value: player.boutiques, sub: 'locations' },
            ].map(({ icon, label, value, sub }) => (
              <motion.div
                key={label}
                className="bg-pearl border border-gold/20 p-5 text-center shadow-card"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="text-gold text-2xl mb-1">{icon}</div>
                <div className="font-display text-2xl text-obsidian">{value}</div>
                <div className="text-[9px] text-mink uppercase tracking-widest font-sans">{label}</div>
                <div className="text-[8px] text-mink/60 font-sans">{sub}</div>
              </motion.div>
            ))}
          </div>

          {/* Collections portfolio */}
          <div className="bg-pearl border border-gold/20 p-6 mb-6 shadow-card">
            <div className="flex justify-between items-center mb-4">
              <div className="section-label">Collection Portfolio</div>
              <button
                className="text-[10px] text-gold hover:text-gold-dark font-sans uppercase tracking-widest transition-colors"
                onClick={() => setScreen('collection-builder')}
              >
                + New Collection
              </button>
            </div>

            {player.collections.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-gold/30 text-4xl mb-2">◈</div>
                <p className="text-mink font-sans text-sm italic">No collections yet. Visit the Design Studio.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {player.collections.map((col) => (
                  <div key={col.id} className="bg-cream border border-gold/20 p-4 text-center">
                    <div className="text-2xl mb-2">{col.silhouette.icon}</div>
                    <div className="font-display text-sm text-obsidian leading-tight mb-1">{col.name}</div>
                    <div className="text-[9px] text-mink font-sans italic mb-2">in {col.fabric.name}</div>
                    <div className="text-gold font-display text-lg">{col.prestigeScore}</div>
                    <div className="text-[8px] text-mink uppercase tracking-widest font-sans">prestige</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Awards */}
          <div className="bg-pearl border border-gold/20 p-6 mb-6 shadow-card">
            <div className="section-label mb-4">Awards & Recognition</div>
            {player.awards.length === 0 ? (
              <p className="text-mink font-sans text-sm italic text-center py-4">Land on Award Ceremony to win your first accolade.</p>
            ) : (
              <div className="flex gap-3 flex-wrap">
                {player.awards.map((award, i) => (
                  <div key={i} className="border border-gold/40 px-3 py-1 text-[10px] font-sans text-gold uppercase tracking-widest">
                    ♔ {award}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="bg-pearl border border-gold/20 p-6 shadow-card">
            <div className="section-label mb-4">Brand Actions</div>
            <div className="grid grid-cols-2 gap-3">
              <button
                className="btn-outline text-[10px]"
                onClick={() => setScreen('collection-builder')}
              >
                Design Collection
              </button>
              <button
                className="btn-outline text-[10px]"
                onClick={openBoutique}
                disabled={player.fashionDollars < (player.role === 'Entrepreneur' ? 20 : 25)}
              >
                Open Boutique
                <span className="block text-[8px] text-mink/60 mt-0.5">
                  {player.role === 'Entrepreneur' ? '$20' : '$25'}
                </span>
              </button>
              <button className="btn-outline text-[10px]" onClick={() => setScreen('gallery')}>
                Visit Gallery
              </button>
              <button className="btn-gold text-[10px]" onClick={() => setScreen('board')}>
                Return to Board
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
