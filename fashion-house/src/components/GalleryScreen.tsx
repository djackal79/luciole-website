import { motion } from 'framer-motion';
import { useGameStore } from '../store/gameStore';
import type { Collection } from '../types/game';

function CollectionMoodBoard({ collection }: { collection: Collection }) {
  return (
    <motion.div
      className="bg-pearl border border-gold/20 overflow-hidden shadow-card group cursor-default"
      whileHover={{ y: -4, boxShadow: '0 20px 60px rgba(201,168,76,0.2)' }}
      transition={{ duration: 0.3 }}
    >
      {/* Editorial header */}
      <div className="bg-gradient-to-r from-obsidian to-charcoal p-4 flex justify-between items-start">
        <div>
          <div className="text-[8px] text-gold/60 uppercase tracking-widest font-sans mb-1">The Fashion House™</div>
          <div className="font-display text-pearl text-sm leading-tight">{collection.name}</div>
        </div>
        <div className="text-gold text-2xl">{collection.silhouette.icon}</div>
      </div>

      {/* Mood board grid */}
      <div className="grid grid-cols-3 gap-1 p-1 bg-cream">
        {/* Main piece */}
        <div
          className="col-span-2 row-span-2 flex items-center justify-center p-6 min-h-24"
          style={{ backgroundColor: collection.style.trendBonus > 3 ? '#F5F0E8' : '#FAF8F5' }}
        >
          <div className="text-center">
            <div className="text-5xl mb-2">{collection.silhouette.icon}</div>
            <p className="font-display text-xs text-obsidian">{collection.silhouette.name}</p>
          </div>
        </div>

        {/* Fabric swatch */}
        <div className="flex items-center justify-center p-3 bg-champagne text-center">
          <div>
            <div className="text-lg mb-0.5">{collection.fabric.icon}</div>
            <p className="text-[8px] font-sans text-mink">{collection.fabric.name}</p>
          </div>
        </div>

        {/* Style tag */}
        <div className="flex items-center justify-center p-3 bg-blush text-center">
          <div>
            <div className="text-lg mb-0.5">{collection.style.icon}</div>
            <p className="text-[8px] font-sans text-mink leading-tight">{collection.style.name}</p>
          </div>
        </div>
      </div>

      {/* Footer details */}
      <div className="p-4 border-t border-gold/20">
        <div className="flex justify-between items-center">
          <div>
            <div className="text-[8px] text-mink uppercase tracking-widest font-sans">Prestige Score</div>
            <div className="font-display text-xl text-gold">{collection.prestigeScore}</div>
          </div>
          <div className="text-right">
            <div className="text-[8px] text-mink uppercase tracking-widest font-sans">Quality</div>
            <div className="flex gap-0.5 justify-end mt-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full ${i < collection.fabric.qualityRating ? 'bg-gold' : 'bg-gold/20'}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function GalleryScreen() {
  const { players, savedCollections, setScreen } = useGameStore();

  const allCollections: Array<{ collection: Collection; playerName: string }> = [
    ...players.flatMap((p) =>
      p.collections.map((c) => ({ collection: c, playerName: p.name }))
    ),
    ...savedCollections.map((c) => ({ collection: c, playerName: 'Gallery' })),
  ];

  return (
    <div className="min-h-screen bg-cream-gradient flex flex-col">
      {/* Header */}
      <div className="border-b border-gold/20 px-8 py-4 flex items-center justify-between bg-pearl">
        <button
          onClick={() => setScreen(players.length > 0 ? 'board' : 'landing')}
          className="text-mink hover:text-charcoal text-xs tracking-widest uppercase font-sans"
        >
          ← Back
        </button>
        <div className="text-center">
          <div className="section-label text-[10px]">Fashion House Gallery</div>
        </div>
        <span className="font-serif text-gold text-lg">FH</span>
      </div>

      {/* Gallery header */}
      <div className="text-center py-10 px-8 border-b border-gold/20">
        <motion.h1
          className="font-display text-5xl font-light text-obsidian mb-3"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          The Collection Gallery
        </motion.h1>
        <div className="gold-divider" />
        <p className="section-label text-mink text-[10px] mt-3">
          {allCollections.length} {allCollections.length === 1 ? 'Collection' : 'Collections'} on Display
        </p>
      </div>

      {/* Gallery grid */}
      <div className="flex-1 overflow-y-auto p-8">
        {allCollections.length === 0 ? (
          <motion.div
            className="text-center py-20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="text-gold/20 text-6xl mb-4">◈</div>
            <h2 className="font-display text-2xl text-obsidian mb-2">Gallery Awaits Your Designs</h2>
            <p className="text-mink font-sans text-sm italic mb-6">
              Start a game and build collections to see them displayed here.
            </p>
            <button className="btn-gold" onClick={() => setScreen('collection-builder')}>
              Create Your First Collection
            </button>
          </motion.div>
        ) : (
          <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {allCollections.map(({ collection, playerName }, i) => (
              <motion.div
                key={collection.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
              >
                <div className="mb-2 flex items-center gap-2">
                  <div className="text-[9px] text-mink uppercase tracking-widest font-sans">{playerName}</div>
                  <div className="flex-1 h-px bg-gold/20" />
                </div>
                <CollectionMoodBoard collection={collection} />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
