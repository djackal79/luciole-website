export type Screen =
  | 'landing'
  | 'setup'
  | 'board'
  | 'collection-builder'
  | 'card-draw'
  | 'fashion-week'
  | 'brand-dashboard'
  | 'gallery'
  | 'instructions';

export type PlayerRole = 'Designer' | 'Stylist' | 'Buyer' | 'Entrepreneur';

export type BoardSpace =
  | 'Inspiration'
  | 'Fabric Market'
  | 'Design Studio'
  | 'Sampling'
  | 'Fashion Shoot'
  | 'Fashion Week'
  | 'Buyer Meeting'
  | 'Celebrity Client'
  | 'Retail Launch'
  | 'Award Ceremony';

export type CardDeck = 'Inspiration' | 'Fabric' | 'Trend' | 'Event' | 'Celebrity' | 'Buyer';

export interface GameCard {
  id: string;
  deck: CardDeck;
  title: string;
  description: string;
  effect: string;
  value: number;
  icon: string;
}

export interface Player {
  id: string;
  name: string;
  role: PlayerRole;
  position: number;
  prestigeScore: number;
  fashionDollars: number;
  followers: number;
  hand: GameCard[];
  collections: Collection[];
  boutiques: number;
  awards: string[];
  color: string;
}

export interface Silhouette {
  id: string;
  name: string;
  icon: string;
  creativityBonus: number;
}

export interface Fabric {
  id: string;
  name: string;
  icon: string;
  qualityRating: number;
  cost: number;
}

export interface Style {
  id: string;
  name: string;
  icon: string;
  trendBonus: number;
}

export interface Collection {
  id: string;
  name: string;
  silhouette: Silhouette;
  fabric: Fabric;
  style: Style;
  prestigeScore: number;
  createdAt: number;
}

export interface GameState {
  screen: Screen;
  players: Player[];
  currentPlayerIndex: number;
  boardSpaces: BoardSpaceData[];
  drawDeck: GameCard[];
  discardPile: GameCard[];
  drawnCard: GameCard | null;
  lastDiceRoll: number | null;
  turn: number;
  phase: 'setup' | 'playing' | 'fashion-week' | 'ended';
  winner: Player | null;
  savedCollections: Collection[];
}

export interface BoardSpaceData {
  id: number;
  name: BoardSpace;
  icon: string;
  description: string;
  action: string;
  cardDeck?: CardDeck;
  color: string;
}

export interface RoleData {
  role: PlayerRole;
  description: string;
  ability: string;
  abilityDetail: string;
  startingDollars: number;
  startingPrestige: number;
  icon: string;
  color: string;
}
