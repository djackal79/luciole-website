import { motion } from 'framer-motion';
import { useGameStore } from '../store/gameStore';

const steps = [
  {
    num: '01',
    title: 'Set Up Your Fashion House',
    body: 'Choose 2–4 players and select a role — Designer, Stylist, Buyer, or Entrepreneur. Each role has unique abilities and starting resources.',
  },
  {
    num: '02',
    title: 'Move Around the Board',
    body: 'Roll the dice on your turn. Move your token around the runway board and trigger the action of the space you land on.',
  },
  {
    num: '03',
    title: 'Draw Cards',
    body: 'Land on card spaces to draw from Inspiration, Fabric, Trend, Event, Celebrity, or Buyer decks. Each card has an immediate effect on your Prestige, Fashion Dollars, or Followers.',
  },
  {
    num: '04',
    title: 'Build Your Collection',
    body: 'Visit the Design Studio to combine a Silhouette, Fabric, and Style Direction. The right combination earns Prestige and can unlock synergy bonuses.',
  },
  {
    num: '05',
    title: 'Conquer Fashion Week',
    body: 'Landing on Fashion Week triggers a runway presentation. Your collection is scored on Trend Match, Fabric Quality, Style Combination, Creativity, and Buyer Appeal.',
  },
  {
    num: '06',
    title: 'Grow Your Brand',
    body: 'Open Boutiques for passive income. Secure celebrity endorsements. Build your Follower count. The first player to reach 100 Prestige wins!',
  },
];

const roles = [
  { icon: '✂', name: 'Designer', ability: '+2 Creativity per collection. Premium fabrics at reduced cost.' },
  { icon: '◈', name: 'Stylist', ability: 'Double Trend bonuses when style matches card. Bonus followers at Fashion Shoots.' },
  { icon: '◎', name: 'Buyer', ability: '+10 Fashion Dollars on all Buyer Cards. Passive boutique income. Starts with one boutique.' },
  { icon: '♛', name: 'Entrepreneur', ability: 'Boutiques cost $5 less. Celebrity Cards give +2 extra Prestige.' },
];

export default function InstructionsScreen() {
  const { setScreen } = useGameStore();

  return (
    <div className="min-h-screen bg-cream-gradient flex flex-col">
      <div className="border-b border-gold/20 px-8 py-4 flex items-center justify-between bg-pearl">
        <button onClick={() => setScreen('landing')} className="text-mink hover:text-charcoal text-xs tracking-widest uppercase font-sans">
          ← Back
        </button>
        <span className="section-label">How to Play</span>
        <span className="font-serif text-gold text-lg">FH</span>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-2xl mx-auto">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h1 className="font-display text-5xl font-light text-obsidian mb-3">How to Play</h1>
            <div className="gold-divider" />
            <p className="font-sans text-mink italic mt-3 text-sm">
              Build your brand. Own the runway. Reach 100 Prestige to win.
            </p>
          </motion.div>

          {/* Win condition */}
          <div className="bg-gold/10 border border-gold/40 p-6 mb-10 text-center">
            <div className="section-label text-gold mb-2">Objective</div>
            <p className="font-display text-xl text-obsidian">
              Be the first Fashion House to reach <span className="text-gold">100 Prestige Points</span>
            </p>
          </div>

          {/* Steps */}
          <div className="space-y-6 mb-12">
            {steps.map((step, i) => (
              <motion.div
                key={step.num}
                className="flex gap-6 bg-pearl border border-gold/20 p-6 shadow-card"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <div className="font-display text-3xl text-gold/30 shrink-0 w-10">{step.num}</div>
                <div>
                  <h3 className="font-display text-lg text-obsidian mb-2">{step.title}</h3>
                  <p className="font-sans text-mink text-sm leading-relaxed">{step.body}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Roles */}
          <div className="mb-10">
            <h2 className="font-display text-2xl text-obsidian mb-4 text-center">Player Roles</h2>
            <div className="grid grid-cols-2 gap-4">
              {roles.map((r) => (
                <div key={r.name} className="bg-pearl border border-gold/20 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-gold text-xl">{r.icon}</span>
                    <span className="font-display text-base text-obsidian">{r.name}</span>
                  </div>
                  <p className="font-sans text-mink text-[11px] leading-relaxed">{r.ability}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Card types */}
          <div className="mb-10">
            <h2 className="font-display text-2xl text-obsidian mb-4 text-center">Card Decks</h2>
            <div className="grid grid-cols-3 gap-3">
              {[
                { deck: 'Inspiration', icon: '✦', desc: '10 cards. Creative sparks and Prestige bonuses.' },
                { deck: 'Fabric', icon: '◉', desc: '8 cards. Material upgrades and quality boosts.' },
                { deck: 'Trend', icon: '○', desc: '7 cards. Match the trend for Prestige multipliers.' },
                { deck: 'Event', icon: '⚡', desc: '8 cards. Magazine covers, scandals, and opportunities.' },
                { deck: 'Celebrity', icon: '♛', desc: '5 cards. Massive Prestige and Follower surges.' },
                { deck: 'Buyer', icon: '◎', desc: '5 cards. Secure retail deals for Fashion Dollars.' },
              ].map((d) => (
                <div key={d.deck} className="bg-pearl border border-gold/20 p-3 text-center">
                  <div className="text-gold text-xl mb-1">{d.icon}</div>
                  <div className="font-display text-sm text-obsidian mb-1">{d.deck}</div>
                  <p className="text-[9px] text-mink font-sans leading-tight">{d.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="text-center">
            <button className="btn-gold px-12" onClick={() => setScreen('setup')}>
              Start Your Fashion House
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
