import { create } from 'zustand';
import type { GameState, Player, PlayerRole, Collection, GameCard, LobbyPlayer } from '../types/game';
import { ALL_CARDS, shuffleDeck } from '../data/cards';
import { BOARD_SPACES } from '../data/boardSpaces';
import { ROLES } from '../data/roles';
import { scoreCollection } from '../data/collections';
import type { Silhouette, Fabric, Style } from '../types/game';
import { supabase } from '../lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

const PLAYER_COLORS = ['#C9A84C', '#E8D5D0', '#6B5B4E', '#A8C5DA'];

// Module-level refs — not part of Zustand state so they don't serialize
let realtimeChannel: RealtimeChannel | null = null;
let isApplyingRemoteUpdate = false;

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

function generateRoomCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// State that gets synced to Supabase (no static data, no functions)
type SyncableState = {
  screen: GameState['screen'];
  players: Player[];
  currentPlayerIndex: number;
  drawDeck: GameCard[];
  discardPile: GameCard[];
  drawnCard: GameCard | null;
  lastDiceRoll: number | null;
  turn: number;
  phase: GameState['phase'];
  winner: Player | null;
  savedCollections: Collection[];
  lobbyPlayers: LobbyPlayer[];
};

function buildSyncable(s: GameStore): SyncableState {
  return {
    screen: s.screen,
    players: s.players,
    currentPlayerIndex: s.currentPlayerIndex,
    drawDeck: s.drawDeck,
    discardPile: s.discardPile,
    drawnCard: s.drawnCard,
    lastDiceRoll: s.lastDiceRoll,
    turn: s.turn,
    phase: s.phase,
    winner: s.winner,
    savedCollections: s.savedCollections,
    lobbyPlayers: s.lobbyPlayers,
  };
}

interface MultiplayerFields {
  isMultiplayer: boolean;
  multiplayerRoomId: string | null;
  localPlayerId: string | null;
  lobbyPlayers: LobbyPlayer[];
  connectionStatus: 'idle' | 'connecting' | 'connected' | 'error';
  roomError: string | null;
}

interface GameStore extends GameState, MultiplayerFields {
  // Navigation
  setScreen: (screen: GameState['screen']) => void;

  // Single-player game
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

  // Multiplayer
  createRoom: (name: string, role: PlayerRole) => Promise<string>;
  joinRoom: (code: string, name: string, role: PlayerRole) => Promise<void>;
  startMultiplayerGame: () => Promise<void>;
  leaveRoom: () => void;
  syncMultiplayerState: () => Promise<void>;
  subscribeToRoom: (roomId: string) => void;
}

const initialGameState: GameState = {
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

const initialMultiplayer: MultiplayerFields = {
  isMultiplayer: false,
  multiplayerRoomId: null,
  localPlayerId: null,
  lobbyPlayers: [],
  connectionStatus: 'idle',
  roomError: null,
};

export const useGameStore = create<GameStore>((set, get) => ({
  ...initialGameState,
  ...initialMultiplayer,

  setScreen: (screen) => set({ screen }),

  // ─── Single-player ─────────────────────────────────────────────────────────

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
    get().syncMultiplayerState();
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
      setTimeout(() => { get().drawCard(space.cardDeck); get().syncMultiplayerState(); }, 600);
    } else {
      get().applySpaceEffect(space, currentPlayerIndex);
      get().syncMultiplayerState();
    }
  },

  applySpaceEffect: (space, playerIdx) => {
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
    let source = drawDeck.length > 0 ? drawDeck : shuffleDeck([...discardPile]);
    if (drawDeck.length === 0) set({ discardPile: [] });

    const filtered = deck ? source.filter((c) => c.deck === deck) : source;
    const rest = deck ? [...source.filter((c) => c.deck !== deck), ...source.filter((c) => c.deck === deck).slice(1)] : source.slice(1);
    const card = filtered[0];
    if (!card) return;

    set({ drawnCard: card, drawDeck: rest, screen: 'card-draw' });
    get().syncMultiplayerState();
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
        followers:
          p.followers +
          (drawnCard.deck === 'Celebrity' ? 2000 : drawnCard.deck === 'Event' ? 500 : 0),
        hand: [...p.hand, drawnCard],
      };
    });

    set({ drawnCard: null, discardPile: [...discardPile, drawnCard], players: updated, screen: 'board' });
    get().syncMultiplayerState();
  },

  buildCollection: (silhouette, fabric, style) => {
    const { players, currentPlayerIndex } = get();
    const player = players[currentPlayerIndex];
    if (player.fashionDollars < fabric.cost) return;

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
        ? { ...p, fashionDollars: p.fashionDollars - fabric.cost, prestigeScore: p.prestigeScore + prestige, collections: [...p.collections, collection] }
        : p
    );
    set({ players: updated, screen: 'board' });
    get().syncMultiplayerState();
  },

  saveCollection: (collection) => {
    set((s) => ({ savedCollections: [...s.savedCollections, collection] }));
    get().syncMultiplayerState();
  },

  scoreCurrentPlayer: () => {
    const { players, currentPlayerIndex } = get();
    const player = players[currentPlayerIndex];
    const bonus = player.collections.reduce((sum, c) => sum + c.prestigeScore, 0);
    const updated = players.map((p, i) =>
      i === currentPlayerIndex
        ? { ...p, prestigeScore: p.prestigeScore + bonus + 5, fashionDollars: p.fashionDollars + p.boutiques * 10, followers: p.followers + bonus * 100 }
        : p
    );
    const winner = updated.find((p) => p.prestigeScore >= 100) ?? null;
    set({ players: updated, winner, phase: winner ? 'ended' : 'playing' });
    get().syncMultiplayerState();
  },

  endTurn: () => {
    const { players, currentPlayerIndex, turn } = get();
    const next = (currentPlayerIndex + 1) % players.length;
    const updatedPlayers = players.map((p) => ({ ...p, fashionDollars: p.fashionDollars + p.boutiques * 5 }));
    set({ currentPlayerIndex: next, turn: next === 0 ? turn + 1 : turn, lastDiceRoll: null, players: updatedPlayers, screen: 'board' });
    get().syncMultiplayerState();
  },

  openBoutique: () => {
    const { players, currentPlayerIndex } = get();
    const player = players[currentPlayerIndex];
    const cost = player.role === 'Entrepreneur' ? 20 : 25;
    if (player.fashionDollars < cost) return;
    const updated = players.map((p, i) =>
      i === currentPlayerIndex ? { ...p, fashionDollars: p.fashionDollars - cost, boutiques: p.boutiques + 1 } : p
    );
    set({ players: updated });
    get().syncMultiplayerState();
  },

  resetGame: () => {
    if (realtimeChannel) { supabase.removeChannel(realtimeChannel); realtimeChannel = null; }
    set({ ...initialGameState, ...initialMultiplayer, drawDeck: shuffleDeck(ALL_CARDS) });
  },

  // ─── Multiplayer ───────────────────────────────────────────────────────────

  createRoom: async (name, role) => {
    set({ connectionStatus: 'connecting', roomError: null });
    const roomId = generateRoomCode();
    const playerId = `player-0`;
    const lobbyPlayers: LobbyPlayer[] = [{ id: playerId, name, role, isHost: true }];

    const initialSync: SyncableState = {
      ...buildSyncable({ ...get(), lobbyPlayers }),
      screen: 'lobby',
      phase: 'setup',
      players: [],
      lobbyPlayers,
    };

    const { error } = await supabase.from('fashion_house_sessions').insert({
      id: roomId,
      state: initialSync,
      host_id: playerId,
    });

    if (error) {
      set({ connectionStatus: 'error', roomError: 'Could not create room. Please try again.' });
      throw error;
    }

    localStorage.setItem('fh_player_id', playerId);
    localStorage.setItem('fh_room_id', roomId);

    set({
      isMultiplayer: true,
      multiplayerRoomId: roomId,
      localPlayerId: playerId,
      lobbyPlayers,
      screen: 'lobby',
      connectionStatus: 'connected',
    });

    get().subscribeToRoom(roomId);
    return roomId;
  },

  joinRoom: async (code, name, role) => {
    set({ connectionStatus: 'connecting', roomError: null });
    const roomId = code.toUpperCase().trim();

    const { data, error } = await supabase
      .from('fashion_house_sessions')
      .select('state')
      .eq('id', roomId)
      .single();

    if (error || !data) {
      set({ connectionStatus: 'error', roomError: 'Room not found. Check the code and try again.' });
      return;
    }

    const remoteState = data.state as SyncableState;

    if (remoteState.phase !== 'setup') {
      set({ connectionStatus: 'error', roomError: 'This game has already started.' });
      return;
    }

    const existingPlayers: LobbyPlayer[] = remoteState.lobbyPlayers ?? [];
    if (existingPlayers.length >= 4) {
      set({ connectionStatus: 'error', roomError: 'This room is full (max 4 players).' });
      return;
    }

    const playerId = `player-${existingPlayers.length}`;
    const newLobbyPlayers: LobbyPlayer[] = [...existingPlayers, { id: playerId, name, role, isHost: false }];

    const updatedSync: SyncableState = { ...remoteState, lobbyPlayers: newLobbyPlayers };

    await supabase.from('fashion_house_sessions').update({ state: updatedSync, updated_at: new Date().toISOString() }).eq('id', roomId);

    localStorage.setItem('fh_player_id', playerId);
    localStorage.setItem('fh_room_id', roomId);

    set({
      isMultiplayer: true,
      multiplayerRoomId: roomId,
      localPlayerId: playerId,
      lobbyPlayers: newLobbyPlayers,
      screen: 'lobby',
      connectionStatus: 'connected',
    });

    get().subscribeToRoom(roomId);
  },

  startMultiplayerGame: async () => {
    const { lobbyPlayers, multiplayerRoomId } = get();
    if (!multiplayerRoomId || lobbyPlayers.length < 2) return;

    const players = lobbyPlayers.map((lp, i) => makePlayer(lp.name, lp.role, i));
    const newState = {
      players,
      currentPlayerIndex: 0,
      phase: 'playing' as const,
      screen: 'board' as const,
      drawDeck: shuffleDeck(ALL_CARDS),
      discardPile: [],
      drawnCard: null,
      lastDiceRoll: null,
      turn: 1,
      winner: null,
    };

    set(newState);
    await get().syncMultiplayerState();
  },

  leaveRoom: () => {
    if (realtimeChannel) { supabase.removeChannel(realtimeChannel); realtimeChannel = null; }
    localStorage.removeItem('fh_player_id');
    localStorage.removeItem('fh_room_id');
    set({ ...initialGameState, ...initialMultiplayer, drawDeck: shuffleDeck(ALL_CARDS) });
  },

  syncMultiplayerState: async () => {
    const state = get();
    if (!state.isMultiplayer || !state.multiplayerRoomId || isApplyingRemoteUpdate) return;

    await supabase
      .from('fashion_house_sessions')
      .update({ state: buildSyncable(state), updated_at: new Date().toISOString() })
      .eq('id', state.multiplayerRoomId);
  },

  subscribeToRoom: (roomId) => {
    if (realtimeChannel) supabase.removeChannel(realtimeChannel);

    realtimeChannel = supabase
      .channel(`fh:${roomId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'fashion_house_sessions', filter: `id=eq.${roomId}` },
        (payload) => {
          if (!payload.new) return;
          const remote = payload.new.state as SyncableState;
          isApplyingRemoteUpdate = true;
          set({
            screen: remote.screen,
            players: remote.players,
            currentPlayerIndex: remote.currentPlayerIndex,
            drawDeck: remote.drawDeck,
            discardPile: remote.discardPile,
            drawnCard: remote.drawnCard,
            lastDiceRoll: remote.lastDiceRoll,
            turn: remote.turn,
            phase: remote.phase,
            winner: remote.winner,
            savedCollections: remote.savedCollections,
            lobbyPlayers: remote.lobbyPlayers ?? [],
            boardSpaces: BOARD_SPACES,
          });
          isApplyingRemoteUpdate = false;
        }
      )
      .subscribe();
  },
}));
