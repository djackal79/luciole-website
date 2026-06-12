import { create } from 'zustand';
import type { GameState, Player, PlayerRole, Collection, GameCard } from '../types/game';
import { ALL_CARDS, shuffleDeck } from '../data/cards';
import { BOARD_SPACES } from '../data/boardSpaces';
import { ROLES } from '../data/roles';
import { scoreCollection } from '../data/collections';
import type { Silhouette, Fabric, Style } from '../types/game';

const PLAYER_COLORS = ['#C9A84C', '#E8D5D0', '#6B5B4E', '#A8C5DA'];

function makePlayer(name: string, role: PlayerRole, index: number): Player {
  const roleData = ROLES.find((r) => r.role === role)!;
  return {
    id: `player-${index}`,
    name,
    role,
    position: 0,
    prestigeScore: roleData.startingPrestige,
    fashionDollars: roleData.startingDollars + (role === 'Buyer' ? 10 : 0),
    followers: 1000,
    hand: [],
    collections: [],
    boutiques: role === 'Buyer' ? 1 : 0,
    awards: [],
    color: PLAYER_COLORS[index % PLAYER_COLORS.length],
  };
}

interface GameStore extends GameState {
  setScreen: (screen: GameState['screen']) => void;
  startGame: (playerSetups: Array<{ name: string; role: PlayerRole }>) => void;
  rollDice: () => void;
  drawCard: (deck?: GameCard['deck']) => void;
  dismissCard: () => void;
  buildCollection: (silhouette: Silhouette, fabric: Fabric, style: Style) => void;
  saveCollection: (collection: Collection) => void;
  scoreCurrentPlayer: () => void;
  endTurn: () => void;
  openBoutique: () => void;
  resetGame: () => void;
  applySpaceEffect: (space: typeof BOARD_SPACES[0], playerIdx: number) => void;
}

const initialState: GameState = {
  screen: 'landing',
  players: [],
  currentPlayerIndex: 0,
  boardSpaces: BOARD_SPACES,
  drawDeck: shuffleDeck(ALL_CARDS),
  discardPile: [],
  drawnCard: null,
  lastDiceRoll: null,
  turn: 1,
  phase: 'setup',
  winner: null,
  savedCollections: [],
};

export const useGameStore = create<GameStore>((set, get) => ({
  ...initialState,

  setScreen: (screen) => set({ screen }),

  startGame: (playerSetups) => {
    const players = playerSetups.map((p, i) => makePlayer(p.name, p.role, i));
    set({
      players,
      currentPlayerIndex: 0,
      phase: 'playing',
      screen: 'board',
      drawDeck: shuffleDeck(ALL_CARDS),
      discardPile: [],
      drawnCard: null,
      lastDiceRoll: null,
      turn: 1,
      winner: null,
    });
  },

  rollDice: () => {
    const roll = Math.floor(Math.random() * 6) + 1;
    const { players, currentPlayerIndex, boardSpaces } = get();
    const player = players[currentPlayerIndex];
    const newPosition = (player.position + roll) % boardSpaces.length;
    const space = boardSpaces[newPosition];

    const updatedPlayers = players.map((p, i) =>
      i === currentPlayerIndex ? { ...p, position: newPosition } : p
    );

    let screenAfterRoll: GameState['screen'] = 'board';
    if (space.name === 'Fashion Week') screenAfterRoll = 'fashion-week';
    else if (space.name === 'Design Studio') screenAfterRoll = 'collection-builder';

    set({ lastDiceRoll: roll, players: updatedPlayers, screen: screenAfterRoll });

    if (space.cardDeck) {
      setTimeout(() => get().drawCard(space.cardDeck), 600);
    } else {
      get().applySpaceEffect(space, currentPlayerIndex);
    }
  },

  applySpaceEffect: (space: typeof BOARD_SPACES[0], playerIdx: number) => {
    const { players } = get();
    const updated = players.map((p, i) => {
      if (i !== playerIdx) return p;
      let { prestigeScore, fashionDollars, followers } = p;
      if (space.name === 'Fashion Shoot') followers += 500;
      if (space.name === 'Award Ceremony') prestigeScore += 5;
      if (space.name === 'Retail Launch') {
        if (fashionDollars >= 25) {
          fashionDollars -= 25;
          return { ...p, prestigeScore, fashionDollars, followers, boutiques: p.boutiques + 1 };
        }
      }
      return { ...p, prestigeScore, fashionDollars, followers };
    });
    set({ players: updated });
  },

  drawCard: (deck) => {
    const { drawDeck, discardPile } = get();
    let deck_ = drawDeck;
    if (deck_.length === 0) {
      deck_ = shuffleDeck([...discardPile]);
      set({ discardPile: [] });
    }
    const [card, ...rest] = deck_.length > 0
      ? (deck ? deck_.filter(c => c.deck === deck).concat(deck_.filter(c => c.deck !== deck)) : deck_)
      : [deck_[0], ...deck_.slice(1)];

    if (!card) return;

    set({
      drawnCard: card,
      drawDeck: rest,
      screen: 'card-draw',
    });
  },

  dismissCard: () => {
    const { drawnCard, discardPile, players, currentPlayerIndex } = get();
    if (!drawnCard) return;

    const updated = players.map((p, i) => {
      if (i !== currentPlayerIndex) return p;
      const val = drawnCard.value;
      return {
        ...p,
        prestigeScore: p.prestigeScore + Math.max(0, val),
        fashionDollars: p.fashionDollars + (val > 5 ? 10 : val > 0 ? 5 : 0),
        followers: p.followers + (drawnCard.deck === 'Celebrity' ? 2000 : drawnCard.deck === 'Event' ? 500 : 0),
        hand: [...p.hand, drawnCard],
      };
    });

    set({
      drawnCard: null,
      discardPile: [...discardPile, drawnCard],
      players: updated,
      screen: 'board',
    });
  },

  buildCollection: (silhouette, fabric, style) => {
    const { players, currentPlayerIndex } = get();
    const player = players[currentPlayerIndex];
    const cost = fabric.cost;
    if (player.fashionDollars < cost) return;

    const prestige = scoreCollection(silhouette, fabric, style);
    const collection: Collection = {
      id: `col-${Date.now()}`,
      name: `${style.name} ${silhouette.name}`,
      silhouette,
      fabric,
      style,
      prestigeScore: prestige,
      createdAt: Date.now(),
    };

    const updated = players.map((p, i) =>
      i === currentPlayerIndex
        ? {
            ...p,
            fashionDollars: p.fashionDollars - cost,
            prestigeScore: p.prestigeScore + prestige,
            collections: [...p.collections, collection],
          }
        : p
    );

    set({ players: updated, screen: 'board' });
  },

  saveCollection: (collection) => {
    set((state) => ({ savedCollections: [...state.savedCollections, collection] }));
  },

  scoreCurrentPlayer: () => {
    const { players, currentPlayerIndex } = get();
    const player = players[currentPlayerIndex];
    const bonus = player.collections.reduce((sum, c) => sum + c.prestigeScore, 0);
    const dollarBonus = player.boutiques * 10;
    const followerBonus = Math.floor(bonus * 100);

    const updated = players.map((p, i) =>
      i === currentPlayerIndex
        ? {
            ...p,
            prestigeScore: p.prestigeScore + bonus + 5,
            fashionDollars: p.fashionDollars + dollarBonus,
            followers: p.followers + followerBonus,
          }
        : p
    );

    const winner = updated.find((p) => p.prestigeScore >= 100) ?? null;
    set({ players: updated, winner, phase: winner ? 'ended' : 'playing' });
  },

  endTurn: () => {
    const { players, currentPlayerIndex, turn } = get();
    const next = (currentPlayerIndex + 1) % players.length;
    const newTurn = next === 0 ? turn + 1 : turn;

    const updatedPlayers = players.map((p) => ({
      ...p,
      fashionDollars: p.fashionDollars + p.boutiques * 5,
    }));

    set({
      currentPlayerIndex: next,
      turn: newTurn,
      lastDiceRoll: null,
      players: updatedPlayers,
      screen: 'board',
    });
  },

  openBoutique: () => {
    const { players, currentPlayerIndex } = get();
    const player = players[currentPlayerIndex];
    const cost = player.role === 'Entrepreneur' ? 20 : 25;
    if (player.fashionDollars < cost) return;

    const updated = players.map((p, i) =>
      i === currentPlayerIndex
        ? { ...p, fashionDollars: p.fashionDollars - cost, boutiques: p.boutiques + 1 }
        : p
    );
    set({ players: updated });
  },

  resetGame: () => set({ ...initialState, drawDeck: shuffleDeck(ALL_CARDS) }),
}));
