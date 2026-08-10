import type { GameCard } from '../types/game';

const inspirationCards: GameCard[] = [
  { id: 'i1', deck: 'Inspiration', title: 'Café Society', description: 'Parisian Chic', effect: 'Gain +5 Prestige. Your next collection has +2 Trend bonus.', value: 5, icon: '☕' },
  { id: 'i2', deck: 'Inspiration', title: 'Effortless Tailoring', description: 'Parisian Chic', effect: 'Gain +4 Prestige and 8 Fashion Dollars.', value: 4, icon: '✂️' },
  { id: 'i3', deck: 'Inspiration', title: 'Monochrome Magic', description: 'Parisian Chic', effect: 'Gain +6 Prestige. All black pieces score double this round.', value: 6, icon: '⬛' },
  { id: 'i4', deck: 'Inspiration', title: 'Seaside Escape', description: 'Coastal Luxe', effect: 'Gain +3 Prestige and +500 Followers.', value: 3, icon: '🌊' },
  { id: 'i5', deck: 'Inspiration', title: 'Ocean Air', description: 'Coastal Luxe', effect: 'Gain +4 Prestige. Linen and Organza fabrics cost half.', value: 4, icon: '🌬' },
  { id: 'i6', deck: 'Inspiration', title: 'Resort Glamour', description: 'Coastal Luxe', effect: 'Gain +5 Prestige and 12 Fashion Dollars.', value: 5, icon: '🏖' },
  { id: 'i7', deck: 'Inspiration', title: 'Golden Hour', description: 'Modern Romance', effect: 'Gain +5 Prestige. Silk Satin collections gain +3 bonus.', value: 5, icon: '🌅' },
  { id: 'i8', deck: 'Inspiration', title: 'Garden Party', description: 'Modern Romance', effect: 'Gain +3 Prestige and +800 Followers.', value: 3, icon: '🌸' },
  { id: 'i9', deck: 'Inspiration', title: 'Velvet Dreams', description: 'Studio 54 Glamour', effect: 'Gain +7 Prestige. Velvet pieces score triple.', value: 7, icon: '💜' },
  { id: 'i10', deck: 'Inspiration', title: 'Disco Revival', description: 'Studio 54 Glamour', effect: 'Gain +6 Prestige and +1000 Followers.', value: 6, icon: '🪩' },
];

const fabricCards: GameCard[] = [
  { id: 'f1', deck: 'Fabric', title: 'Silk Satin', description: 'Quality Rating: 5', effect: 'Upgrade current collection. +3 Prestige per Fashion Week appearance.', value: 5, icon: '✨' },
  { id: 'f2', deck: 'Fabric', title: 'Lace', description: 'Quality Rating: 4', effect: 'Delicate and coveted. +2 Prestige, +500 Followers.', value: 4, icon: '🕸' },
  { id: 'f3', deck: 'Fabric', title: 'Cashmere', description: 'Quality Rating: 5', effect: 'Ultimate luxury. +4 Prestige and 15 Fashion Dollars.', value: 5, icon: '🐑' },
  { id: 'f4', deck: 'Fabric', title: 'Organza', description: 'Quality Rating: 3', effect: 'Ethereal beauty. +3 Prestige and +800 Followers.', value: 3, icon: '🫧' },
  { id: 'f5', deck: 'Fabric', title: 'Velvet', description: 'Quality Rating: 4', effect: 'Rich and opulent. +4 Prestige. Celebrity cards worth +2 more.', value: 4, icon: '🟣' },
  { id: 'f6', deck: 'Fabric', title: 'Crepe', description: 'Quality Rating: 3', effect: 'Timeless elegance. +2 Prestige and 10 Fashion Dollars.', value: 3, icon: '🌀' },
  { id: 'f7', deck: 'Fabric', title: 'Linen', description: 'Quality Rating: 2', effect: 'Coastal and cool. +1 Prestige. Coastal Luxe style bonus doubled.', value: 2, icon: '🌾' },
  { id: 'f8', deck: 'Fabric', title: 'Brocade', description: 'Quality Rating: 5', effect: 'Rare and magnificent. +5 Prestige and 20 Fashion Dollars.', value: 5, icon: '👑' },
];

const trendCards: GameCard[] = [
  { id: 't1', deck: 'Trend', title: 'Quiet Luxury', description: 'Less is more', effect: 'All your collections gain +3 Prestige this round. Understated wins.', value: 6, icon: '○' },
  { id: 't2', deck: 'Trend', title: 'Sustainable Style', description: 'Conscious fashion', effect: 'Linen collections worth +5 extra. Gain +1000 Followers.', value: 5, icon: '🌿' },
  { id: 't3', deck: 'Trend', title: 'Modern Tailoring', description: 'Sharp and precise', effect: 'Tailored Suit silhouette gains +4 Prestige.', value: 4, icon: '📐' },
  { id: 't4', deck: 'Trend', title: 'Maximalism', description: 'More is more', effect: 'Statement Piece gains +6 Prestige. Gain +800 Followers.', value: 6, icon: '✦' },
  { id: 't5', deck: 'Trend', title: 'Old Money Aesthetic', description: 'Timeless prestige', effect: 'Cashmere and Silk gain +3. Gain 15 Fashion Dollars.', value: 5, icon: '🏛' },
  { id: 't6', deck: 'Trend', title: 'Resort Wear Boom', description: 'Holiday is the new runway', effect: 'Resort Dress silhouette doubles Prestige score.', value: 4, icon: '🌴' },
  { id: 't7', deck: 'Trend', title: 'Couture Revival', description: 'Handcrafted luxury', effect: 'Evening Gown gains +5 Prestige and 20 Fashion Dollars.', value: 7, icon: '💎' },
];

const eventCards: GameCard[] = [
  { id: 'e1', deck: 'Event', title: 'Magazine Cover Feature', description: 'Vogue calls!', effect: 'Gain +10 Prestige and +2000 Followers immediately.', value: 10, icon: '📰' },
  { id: 'e2', deck: 'Event', title: 'Celebrity Wearing Your Design', description: 'She wore it first', effect: 'Gain +8 Prestige and +1500 Followers.', value: 8, icon: '⭐' },
  { id: 'e3', deck: 'Event', title: 'Fabric Delay', description: 'Setback strikes', effect: 'Lose 5 Fashion Dollars. Skip building a collection next turn.', value: -5, icon: '⚠' },
  { id: 'e4', deck: 'Event', title: 'Fashion Week Scandal', description: 'Drama unfolds', effect: 'Lose -3 Prestige but gain +500 Followers (any publicity…).', value: -3, icon: '👀' },
  { id: 'e5', deck: 'Event', title: 'Influencer Partnership', description: 'Social media storm', effect: 'Gain +3000 Followers and 10 Fashion Dollars.', value: 5, icon: '📱' },
  { id: 'e6', deck: 'Event', title: 'Press Blackout', description: 'Nobody talks about it', effect: 'Lose -500 Followers. Gain 5 Fashion Dollars (exclusive feel).', value: -2, icon: '🤐' },
  { id: 'e7', deck: 'Event', title: 'Award Nomination', description: 'Recognition arrives', effect: 'Gain +6 Prestige. Enter next Award Ceremony with advantage.', value: 6, icon: '🏆' },
  { id: 'e8', deck: 'Event', title: 'Runway Disaster', description: 'The heel breaks mid-show', effect: 'Lose -5 Prestige. All players gain +200 Followers (viral moment).', value: -5, icon: '💔' },
];

const celebrityCards: GameCard[] = [
  { id: 'c1', deck: 'Celebrity', title: 'The Style Icon', description: 'A global fashion icon', effect: 'Gain +12 Prestige and +5000 Followers. Open a Boutique for free.', value: 12, icon: '👑' },
  { id: 'c2', deck: 'Celebrity', title: 'The Pop Star', description: 'Music meets fashion', effect: 'Gain +3000 Followers and 20 Fashion Dollars.', value: 8, icon: '🎤' },
  { id: 'c3', deck: 'Celebrity', title: 'The A-List Actress', description: 'Red carpet royalty', effect: 'Gain +10 Prestige and +2000 Followers.', value: 10, icon: '🎬' },
  { id: 'c4', deck: 'Celebrity', title: 'The Royal', description: 'Worn by royalty', effect: 'Gain +15 Prestige. Your collection becomes iconic (permanent +2).', value: 15, icon: '♔' },
  { id: 'c5', deck: 'Celebrity', title: 'The Influencer', description: 'Digital-first fame', effect: 'Gain +5000 Followers and 15 Fashion Dollars.', value: 7, icon: '📸' },
];

const buyerCards: GameCard[] = [
  { id: 'b1', deck: 'Buyer', title: 'Department Store Deal', description: 'Nationwide distribution', effect: 'Gain 25 Fashion Dollars per Boutique you own.', value: 8, icon: '🏬' },
  { id: 'b2', deck: 'Buyer', title: 'Exclusive Boutique', description: 'Luxury retail partner', effect: 'Gain 30 Fashion Dollars. +5 Prestige.', value: 9, icon: '🛍' },
  { id: 'b3', deck: 'Buyer', title: 'International Export', description: 'Global market entry', effect: 'Gain 40 Fashion Dollars. +2000 Followers from international fans.', value: 10, icon: '✈' },
  { id: 'b4', deck: 'Buyer', title: 'Online Platform', description: 'Direct to consumer', effect: 'Gain 20 Fashion Dollars and +3000 Followers.', value: 7, icon: '💻' },
  { id: 'b5', deck: 'Buyer', title: 'Luxury Conglomerate', description: 'The ultimate deal', effect: 'Gain 50 Fashion Dollars. +8 Prestige. Open a Boutique for free.', value: 12, icon: '💎' },
];

export const ALL_CARDS: GameCard[] = [
  ...inspirationCards,
  ...fabricCards,
  ...trendCards,
  ...eventCards,
  ...celebrityCards,
  ...buyerCards,
];

export function shuffleDeck(cards: GameCard[]): GameCard[] {
  const deck = [...cards];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}
