import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store/gameStore';
import { SILHOUETTES, FABRICS, STYLES, scoreCollection } from '../data/collections';
import type { Silhouette, Fabric, Style } from '../types/game';

function SelectionCard<T extends { id: string; name: string; icon: string }>({
  item, selected, onSelect, detail,
}: { item: T; selected: boolean; onSelect: (item: T) => void; detail?: string }) {
  return (
    <motion.button
      onClick={() => onSelect(item)}
      className={`p-4 border text-center transition-all flex flex-col items-center gap-2 ${
        selected
          ? 'border-gold bg-gold/10 shadow-gold'
          : 'border-gold/20 bg-pearl hover:border-gold/50'
      }`}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <span className="text-2xl">{item.icon}</span>
      <span className="font-display text-sm text-obsidian leading-tight">{item.name}</span>
      {detail && <span className="text-[9px] text-mink font-sans">{detail}</span>}
      {selected && (
        <motion.span
          className="text-gold text-xs"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
        >
          ✓
        </motion.span>
      )}
    </motion.button>
  );
}

export default function CollectionBuilder() {
  const { buildCollection, setScreen, players, currentPlayerIndex } = useGameStore();
  const currentPlayer = players[currentPlayerIndex];

  const [silhouette, setSilhouette] = useState<Silhouette | null>(null);
  const [fabric, setFabric] = useState<Fabric | null>(null);
  const [style, setStyle] = useState<Style | null>(null);
  const [collectionName, setCollectionName] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const score = silhouette && fabric && style ? scoreCollection(silhouette, fabric, style) : 0;
  const canBuild = !!silhouette && !!fabric && !!style;
  const canAfford = fabric ? (currentPlayer?.fashionDollars ?? 0) >= fabric.cost : true;
  const isStandalone = !currentPlayer;

  const handleBuild = () => {
    if (!silhouette || !fabric || !style) return;
    if (isStandalone) {
      setSubmitted(true);
      return;
    }
    buildCollection(silhouette, fabric, style);
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-cream-gradient flex flex-col">
      {/* Header */}
      <div className="border-b border-gold/20 px-8 py-4 flex items-center justify-between bg-pearl">
        <button onClick={() => setScreen(currentPlayer ? 'board' : 'landing')} className="text-mink hover:text-charcoal text-xs tracking-widest uppercase font-sans">
          ← {currentPlayer ? 'Board' : 'Menu'}
        </button>
        <span className="section-label">Design Studio</span>
        {currentPlayer && (
          <span className="text-[10px] text-gold font-sans">${currentPlayer.fashionDollars} available</span>
        )}
      </div>

      <AnimatePresence mode="wait">
        {submitted ? (
          <motion.div
            key="success"
            className="flex-1 flex flex-col items-center justify-center p-8 text-center"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className="text-5xl mb-4">✦</div>
            <h2 className="font-display text-3xl text-obsidian mb-2">Collection Created</h2>
            <p className="section-label text-mink mb-2">
              {style?.name} {silhouette?.name} in {fabric?.name}
            </p>
            <div className="h-px w-24 bg-gold mx-auto mb-4" />
            <div className="flex gap-6 mb-8">
              <div className="text-center">
                <div className="font-display text-3xl text-gold">{score}</div>
                <div className="text-[9px] text-mink uppercase tracking-widest">Prestige Score</div>
              </div>
              {fabric && (
                <div className="text-center">
                  <div className="font-display text-3xl text-charcoal">{fabric.qualityRating}</div>
                  <div className="text-[9px] text-mink uppercase tracking-widest">Quality Rating</div>
                </div>
              )}
            </div>

            {/* Collection preview card */}
            <div className="bg-pearl border border-gold/30 p-8 max-w-xs w-full shadow-card mb-8">
              <div className="text-[8px] tracking-widest uppercase text-gold font-sans mb-2">Collection Board</div>
              <div className="h-px bg-gold/30 mb-4" />
              <div className="text-4xl mb-3">{silhouette?.icon}</div>
              <h3 className="font-display text-lg text-obsidian mb-1">
                {style?.name}<br />{silhouette?.name}
              </h3>
              <p className="text-[10px] text-mink font-sans italic mb-3">in {fabric?.name}</p>
              <div className="h-px bg-gold/20 mb-3" />
              <div className="flex justify-between text-[9px] font-sans text-mink">
                <span>{fabric?.icon} {fabric?.name}</span>
                <span>{style?.icon} {style?.name}</span>
              </div>
            </div>

            <button className="btn-gold" onClick={() => {
              setSilhouette(null);
              setFabric(null);
              setStyle(null);
              setSubmitted(false);
              if (currentPlayer) setScreen('board');
            }}>
              {currentPlayer ? 'Return to Board' : 'Create Another'}
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="builder"
            className="flex-1 overflow-y-auto p-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-8">
                <h2 className="font-display text-4xl font-light text-obsidian mb-2">Create Your Collection</h2>
                <div className="gold-divider" />
                <p className="section-label text-mink text-[10px] mt-2">Combine silhouette, fabric and style to define your look</p>
              </div>

              {/* Collection name */}
              <div className="mb-8 text-center">
                <input
                  type="text"
                  value={collectionName}
                  onChange={(e) => setCollectionName(e.target.value)}
                  placeholder="Name your collection..."
                  className="bg-transparent border-b-2 border-gold/30 focus:border-gold pb-2 font-display text-xl text-obsidian text-center focus:outline-none w-full max-w-xs placeholder-mink/40 transition-colors"
                />
              </div>

              {/* Step 1: Silhouette */}
              <section className="mb-8">
                <div className="flex items-center gap-4 mb-4">
                  <div className="section-label">01 — Silhouette</div>
                  <div className="flex-1 h-px bg-gold/20" />
                  {silhouette && <span className="text-gold text-xs">+{silhouette.creativityBonus} Creativity</span>}
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                  {SILHOUETTES.map((s) => (
                    <SelectionCard
                      key={s.id}
                      item={s}
                      selected={silhouette?.id === s.id}
                      onSelect={setSilhouette}
                      detail={`+${s.creativityBonus} creativity`}
                    />
                  ))}
                </div>
              </section>

              {/* Step 2: Fabric */}
              <section className="mb-8">
                <div className="flex items-center gap-4 mb-4">
                  <div className="section-label">02 — Fabric</div>
                  <div className="flex-1 h-px bg-gold/20" />
                  {fabric && (
                    <span className={`text-xs ${canAfford ? 'text-gold' : 'text-red-400'}`}>
                      ${fabric.cost} · Quality {fabric.qualityRating}/5
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                  {FABRICS.map((f) => (
                    <SelectionCard
                      key={f.id}
                      item={f}
                      selected={fabric?.id === f.id}
                      onSelect={setFabric}
                      detail={`$${f.cost} · Q${f.qualityRating}`}
                    />
                  ))}
                </div>
              </section>

              {/* Step 3: Style */}
              <section className="mb-10">
                <div className="flex items-center gap-4 mb-4">
                  <div className="section-label">03 — Style Direction</div>
                  <div className="flex-1 h-px bg-gold/20" />
                  {style && <span className="text-gold text-xs">+{style.trendBonus} Trend</span>}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {STYLES.map((s) => (
                    <SelectionCard
                      key={s.id}
                      item={s}
                      selected={style?.id === s.id}
                      onSelect={setStyle}
                      detail={`+${s.trendBonus} trend`}
                    />
                  ))}
                </div>
              </section>

              {/* Score preview */}
              {canBuild && (
                <motion.div
                  className="bg-pearl border border-gold/30 p-6 mb-6 flex items-center justify-between"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div>
                    <div className="section-label text-[9px] mb-1">Collection Score</div>
                    <div className="font-display text-3xl text-gold">{score} Prestige</div>
                    <div className="text-[9px] text-mink font-sans">
                      {silhouette?.name} · {fabric?.name} · {style?.name}
                    </div>
                  </div>
                  <div className="text-4xl">{silhouette?.icon}</div>
                </motion.div>
              )}

              <div className="flex justify-center">
                <button
                  className={`btn-gold px-16 ${!canBuild || (!isStandalone && !canAfford) ? 'opacity-40 cursor-not-allowed' : ''}`}
                  onClick={handleBuild}
                  disabled={!canBuild || (!isStandalone && !canAfford)}
                >
                  {!canAfford && !isStandalone
                    ? `Need $${fabric!.cost} (have $${currentPlayer?.fashionDollars})`
                    : 'Complete Collection'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
