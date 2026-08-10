import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store/gameStore';
import type { PlayerRole } from '../types/game';
import { ROLES } from '../data/roles';

type Tab = 'create' | 'join';

function RolePicker({ selected, onSelect }: { selected: PlayerRole; onSelect: (r: PlayerRole) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {ROLES.map((r) => (
        <button
          key={r.role}
          onClick={() => onSelect(r.role)}
          className={`p-3 border text-left transition-all ${
            selected === r.role ? 'border-gold bg-gold/10' : 'border-gold/20 bg-pearl hover:border-gold/50'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-gold text-sm">{r.icon}</span>
            <span className="font-display text-sm text-obsidian">{r.role}</span>
          </div>
          <p className="text-[9px] text-mink font-sans leading-tight">{r.abilityDetail}</p>
        </button>
      ))}
    </div>
  );
}

function WaitingRoom() {
  const {
    lobbyPlayers, localPlayerId, multiplayerRoomId,
    startMultiplayerGame, leaveRoom, connectionStatus,
  } = useGameStore();

  const isHost = lobbyPlayers.find((p) => p.id === localPlayerId)?.isHost ?? false;
  const shareUrl = `${window.location.origin}${window.location.pathname}?room=${multiplayerRoomId}`;

  const copyLink = () => navigator.clipboard.writeText(shareUrl);

  return (
    <motion.div
      className="flex flex-col items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Room code */}
      <div className="bg-pearl border border-gold/30 p-8 text-center mb-6 w-full max-w-md shadow-card">
        <div className="section-label text-[9px] mb-2">Room Code</div>
        <div className="font-display text-6xl text-gold tracking-[0.2em] mb-4">
          {multiplayerRoomId}
        </div>
        <button
          onClick={copyLink}
          className="btn-outline w-full text-[10px]"
        >
          Copy Invite Link
        </button>
        <p className="text-[9px] text-mink font-sans mt-2">Share this link or code with friends</p>
      </div>

      {/* Players in lobby */}
      <div className="w-full max-w-md mb-6">
        <div className="section-label text-[9px] mb-3">
          Players Joined — {lobbyPlayers.length}/4
        </div>
        <div className="space-y-2">
          {lobbyPlayers.map((p) => {
            const roleData = ROLES.find((r) => r.role === p.role)!;
            const isMe = p.id === localPlayerId;
            return (
              <motion.div
                key={p.id}
                className={`flex items-center gap-4 p-3 border ${isMe ? 'border-gold bg-gold/5' : 'border-gold/20 bg-pearl'}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
              >
                <div className="w-8 h-8 flex items-center justify-center border border-gold/30 text-sm bg-cream">
                  {roleData.icon}
                </div>
                <div className="flex-1">
                  <div className="font-display text-sm text-obsidian">
                    {p.name} {isMe && <span className="text-[9px] text-gold font-sans">(You)</span>}
                  </div>
                  <div className="text-[9px] text-mink font-sans">{p.role}</div>
                </div>
                {p.isHost && (
                  <span className="text-[9px] text-gold font-sans uppercase tracking-widest border border-gold/30 px-2 py-0.5">
                    Host
                  </span>
                )}
                <div className="w-2 h-2 rounded-full bg-green-400" />
              </motion.div>
            );
          })}

          {/* Empty slots */}
          {Array.from({ length: Math.max(0, 2 - lobbyPlayers.length) }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-3 border border-dashed border-gold/20 bg-cream/50">
              <div className="w-8 h-8 border border-dashed border-gold/20 flex items-center justify-center text-gold/20">
                +
              </div>
              <span className="text-[10px] text-mink/50 font-sans italic">Waiting for player...</span>
            </div>
          ))}
        </div>
      </div>

      {/* Status & actions */}
      <div className="w-full max-w-md space-y-3">
        {isHost ? (
          <>
            {lobbyPlayers.length < 2 ? (
              <div className="bg-cream border border-gold/20 p-3 text-center">
                <p className="text-[10px] text-mink font-sans">Waiting for at least 1 more player to join...</p>
              </div>
            ) : (
              <button
                className="btn-gold w-full"
                onClick={startMultiplayerGame}
                disabled={connectionStatus === 'connecting'}
              >
                Start Game — {lobbyPlayers.length} Players Ready
              </button>
            )}
          </>
        ) : (
          <div className="bg-cream border border-gold/20 p-3 text-center">
            <p className="text-[10px] text-mink font-sans">Waiting for the host to start the game...</p>
          </div>
        )}

        <button onClick={leaveRoom} className="btn-outline w-full text-[10px]">
          Leave Room
        </button>
      </div>
    </motion.div>
  );
}

export default function LobbyScreen() {
  const { createRoom, joinRoom, setScreen, lobbyPlayers, connectionStatus, roomError, leaveRoom } = useGameStore();

  const [tab, setTab] = useState<Tab>('create');
  const [name, setName] = useState('');
  const [role, setRole] = useState<PlayerRole>('Designer');
  const [joinCode, setJoinCode] = useState('');
  const [inRoom, setInRoom] = useState(false);

  // Pre-fill room code from URL param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
      setJoinCode(roomParam);
      setTab('join');
    }
  }, []);

  // Once we have lobby players, we're in the room
  useEffect(() => {
    if (lobbyPlayers.length > 0) setInRoom(true);
  }, [lobbyPlayers]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    await createRoom(name.trim(), role);
    setInRoom(true);
  };

  const handleJoin = async () => {
    if (!name.trim() || !joinCode.trim()) return;
    await joinRoom(joinCode.trim(), name.trim(), role);
    setInRoom(true);
  };

  return (
    <div className="min-h-screen bg-cream-gradient flex flex-col">
      {/* Header */}
      <div className="border-b border-gold/20 px-8 py-4 flex items-center justify-between bg-pearl">
        <button
          onClick={() => { if (inRoom) leaveRoom(); else setScreen('landing'); }}
          className="text-mink hover:text-charcoal text-xs tracking-widest uppercase font-sans"
        >
          ← Back
        </button>
        <span className="section-label">Play Online</span>
        <span className="font-serif text-gold text-lg">FH</span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-8 py-12">
        <motion.div
          className="text-center mb-8"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h2 className="font-display text-4xl font-light text-obsidian mb-2">
            {inRoom ? 'Fashion House Lobby' : 'Play Online'}
          </h2>
          <div className="gold-divider" />
          <p className="section-label text-mink text-[10px] mt-2">
            {inRoom ? 'Share your room code and wait for players' : '2–4 players · Real-time multiplayer'}
          </p>
        </motion.div>

        <AnimatePresence mode="wait">
          {inRoom ? (
            <motion.div key="waiting" className="w-full max-w-md" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <WaitingRoom />
            </motion.div>
          ) : (
            <motion.div key="setup" className="w-full max-w-md" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {/* Tab switcher */}
              <div className="flex mb-6 border border-gold/20">
                {(['create', 'join'] as Tab[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`flex-1 py-3 text-[10px] font-sans tracking-widest uppercase transition-all ${
                      tab === t ? 'bg-gold text-obsidian' : 'bg-pearl text-mink hover:text-charcoal'
                    }`}
                  >
                    {t === 'create' ? 'Create Room' : 'Join Room'}
                  </button>
                ))}
              </div>

              {/* Error */}
              {roomError && (
                <div className="bg-red-50 border border-red-200 p-3 mb-4 text-center">
                  <p className="text-red-600 font-sans text-xs">{roomError}</p>
                </div>
              )}

              {/* Your name */}
              <div className="mb-5">
                <label className="section-label text-[9px] block mb-2">Your Fashion House Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Maison Noir"
                  className="w-full bg-pearl border border-gold/30 focus:border-gold px-4 py-3 font-display text-obsidian focus:outline-none placeholder-mink/40 text-sm"
                />
              </div>

              {/* Join code (join tab only) */}
              {tab === 'join' && (
                <div className="mb-5">
                  <label className="section-label text-[9px] block mb-2">Room Code</label>
                  <input
                    type="text"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="e.g. ABC123"
                    maxLength={6}
                    className="w-full bg-pearl border border-gold/30 focus:border-gold px-4 py-3 font-display text-obsidian text-center text-2xl tracking-[0.4em] focus:outline-none uppercase"
                  />
                </div>
              )}

              {/* Role */}
              <div className="mb-6">
                <label className="section-label text-[9px] block mb-2">Your Role</label>
                <RolePicker selected={role} onSelect={setRole} />
              </div>

              <button
                className={`btn-gold w-full ${connectionStatus === 'connecting' ? 'opacity-60' : ''}`}
                onClick={tab === 'create' ? handleCreate : handleJoin}
                disabled={connectionStatus === 'connecting' || !name.trim() || (tab === 'join' && joinCode.length < 6)}
              >
                {connectionStatus === 'connecting'
                  ? 'Connecting...'
                  : tab === 'create'
                  ? 'Create Room'
                  : 'Join Room'}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
