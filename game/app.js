import { prompts } from './data/prompts.js';
import { cards, cardByNumber, FAMILY_REMOVED_TITLES } from './data/cards.js';
import { INTRO_STEPS, CHARACTER_BACKSTORIES, PHASE_TIPS } from './data/tutorial.js';
import { supabase, SESSION_ID } from './supabase.js';

// ===== CONSTANTS =====

// OPEN-7: game name is not locked ("Crack Up" is the leading alternative).
// Every user-facing title string must read from this constant.
const GAME_TITLE = 'Pull Another One';

// OPEN-5: "Prompt Card" and "Power Card" are a near-rhyme and have been
// confused inside this project. A rename of the personal card (candidate:
// "Setlist") is under consideration — change these two lines only.
const PERSONAL_CARD_LABEL = 'Prompt Card';
const PERSONAL_CARD_LABEL_PLURAL = 'Prompt Cards';

// Rules configuration — §1.9. Nothing below may hard-code these values.
// MINI-CANON §3. 3 is the last CONFIRMED value. Do not lower it silently —
// a previous session changed the default to 2 without flagging it, which is
// the exact failure this config comments against. Any value below 3 is
// unverified and must reach the player as a labelled experimental choice.
const RULES_CONFIG = {
  tokensInPool: 8,
  winCondition: {
    default: 3,
    byPlayerCount: {
      3: 3,   // untested
      4: 3,   // simulation found this too fast; 4 was the untested recommendation, never actioned
      5: 3,   // CONFIRMED TOO SLOW / STALLS — needs a real fix, not a silent number change
      6: 3,   // confirmed correct
      7: 3,   // untested
      8: 3,   // untested, Pool can plausibly run empty — see §7
    },
  },
  minPlayers: 3,              // §7 — 2 players is explicitly not supported
  maxPlayers: 8,
  familyMode: false,
  // Labelled experimental override, surfaced in the UI as "Fast game:
  // 2 tokens, untested". Off by default so the confirmed ruleset is what
  // runs unless the tester deliberately opts out of it.
  fastGameUnverified: false,
  fastGameTokens: 2,
};

// Win condition for the current table size. Never compare against a literal.
function tokenGoal(numPlayers) {
  // The experimental fast game is an explicit, labelled opt-in (§3).
  if (state && state.fastGameUnverified) return RULES_CONFIG.fastGameTokens;
  const n = numPlayers != null ? numPlayers : (state && state.numPlayers);
  return RULES_CONFIG.winCondition.byPlayerCount[n] ?? RULES_CONFIG.winCondition.default;
}

const PROP_TOKENS = [
  { number:1, name:'The Golden Mic',      file:'1. The golden mike.png' },
  { number:2, name:'The Script Scroll',   file:'2. The script scroll.png' },
  { number:3, name:'The Giggle Gavel',    file:'3. The gilden gavel.png' },
  { number:4, name:'The Tiny Trombone',   file:'4. the tiny trombone.png' },
  { number:5, name:'The Rubber Chicken',  file:'5. The rubber chicken.png' },
  { number:6, name:'The Banana Skin',     file:'6 The banana skin.png' },
  { number:7, name:'The Mask of Comedy',  file:'7. The mask of comedy.png' },
  { number:8, name:'The Prop Box',        file:'8. The prop box.png' },
];

function tokenImgUrl(file) {
  return `url("assets/token/${encodeURIComponent(file)}")`;
}

function buildTokenChip(token, clickFn) {
  const chip = document.createElement('button');
  chip.className = 'token-chip';
  if (token.file) {
    const img = document.createElement('div');
    img.className = 'token-img';
    img.style.backgroundImage = tokenImgUrl(token.file);
    chip.appendChild(img);
  }
  const lbl = document.createElement('span');
  lbl.textContent = token.name;
  chip.appendChild(lbl);
  if (clickFn) chip.addEventListener('click', clickFn);
  return chip;
}

// Character card art (see game/data/card_manifest.csv) gives each animal a
// proper name in addition to its species and archetype, e.g. "Nev — The
// Heckled Stand-up". personalName is optional so older saved games without
// it still render.
const CHARACTERS = [
  {id:'kookaburra', name:'Kookaburra', personalName:'Nev',   archetype:'The Heckled Stand-up',       venue:'comedy_lounge', img:'1'},
  {id:'cockatoo',   name:'Cockatoo',   personalName:'Shazza',archetype:'The Bitter Satirist',        venue:'comedy_lounge', img:'2'},
  {id:'quokka',     name:'Quokka',     personalName:'Trev',  archetype:'The Sweaty Warm-up Act',     venue:'the_club',         img:'3'},
  {id:'magpie',     name:'Magpie',     personalName:'Timbo', archetype:'The Tragic Songbird',        venue:'the_club',         img:'4'},
  {id:'emu',        name:'Emu',        personalName:'Bev',   archetype:'The Chaotic Prop Comic',     venue:'royal_show',  img:'5'},
  {id:'galah',      name:'Galah',      personalName:'Kel',   archetype:'The Woozy Clown',            venue:'royal_show',  img:'6'},
  {id:'echidna',    name:'Echidna',    personalName:'Simmo', archetype:'The Pretentious Improvisor', venue:'school_play', img:'7'},
  {id:'platypus',   name:'Platypus',   personalName:'Val',   archetype:'The Deadpan Magician',       venue:'school_play', img:'8'},
];

const VENUES = {
  comedy_lounge: {name:'Comedy Lounge',  icon:'🎤', cssClass:'comedy',     act:'Tell jokes'},
  the_club:         {name:'The Club',       icon:'🎵', cssClass:'the_club',         act:'Sing or rhyme'},
  royal_show:  {name:'The Royal Show', icon:'🎪', cssClass:'royal_show',  act:'Clown around'},
  school_play: {name:'School Play',    icon:'🎭', cssClass:'school_play', act:'Act'},
};

const SUCCESS_DISPLAY = {
  vote:        {icon:'🗳️', label:'Majority vote'},
  objective:   {icon:'✅', label:'Objective — the table can see it'},
  named_judge: {icon:'👤', label:'Judge — player to your left decides'},
};

// ===== STATE =====

let state = null;
let myPlayerIndex = null;  // which player slot this device has claimed
let timerInterval = null;
let timerRemaining = 0;
let timerRunning = false;
let saveDebounceTimer = null;
let realtimeIgnoreNext = false;

function defaultState() {
  return {
    phase: 'setup',
    numPlayers: 5,
    players: [],
    currentPlayerIndex: 0,
    deck: [],
    discard: [],
    drawnCard: null,
    drawnPromptPos: null,
    pendingOutcome: null,
    // The Pool — §1.2. The shared face-up supply. Tokens only ever come from
    // here, and only ever return here. Never moves player-to-player.
    pool: buildPool(),
    // Interrupt stack — §1.7. LIFO; resolved last-played-first.
    interruptStack: [],
    // §1.4 Step 0 — set on the flip, cleared only when the turn passes.
    drawnThisTurn: false,
    familyMode: false,
    tutorialMode: false,
    fastGameUnverified: false,  // §3 — labelled experimental opt-in
    turnNumber: 0,
    turnLog: [],
    currentTurn: null,
  };
}

// ===== PERSISTENCE (SUPABASE) =====

function save() {
  realtimeIgnoreNext = true;
  if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
  saveDebounceTimer = setTimeout(async () => {
    try {
      await supabase.from('game_sessions').upsert({
        id: SESSION_ID,
        state: state,
        updated_at: new Date().toISOString(),
      });
    } catch(e) { console.error('save failed', e); }
  }, 80);
}

async function load() {
  try {
    const { data } = await supabase
      .from('game_sessions')
      .select('state')
      .eq('id', SESSION_ID)
      .single();
    if (data?.state) { state = data.state; migrateVenueKeys(); return; }
  } catch(e) {}
  state = defaultState();
}

function subscribeRealtime() {
  supabase
    .channel('game-state')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'game_sessions',
      filter: `id=eq.${SESSION_ID}`,
    }, (payload) => {
      if (realtimeIgnoreNext) { realtimeIgnoreNext = false; return; }
      if (payload.new?.state) {
        state = payload.new.state;
        renderCurrentPhase();
      }
    })
    .subscribe();
}

// ===== PLAYER IDENTITY =====

function loadMyPlayerIndex() {
  const raw = localStorage.getItem('pao_my_player');
  if (raw === null) return;
  const idx = parseInt(raw);
  if (!isNaN(idx)) myPlayerIndex = idx;
}

function claimPlayerSlot(idx) {
  myPlayerIndex = idx;
  localStorage.setItem('pao_my_player', String(idx));
  const player = state && state.players && state.players[idx];
  if (player) maybeShowBackstory(player.character);
}

function clearMyPlayerSlot() {
  myPlayerIndex = null;
  localStorage.removeItem('pao_my_player');
}

// ===== HELPERS =====

function getCharacter(player) {
  return CHARACTERS.find(c => c.id === player.character) || CHARACTERS[0];
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildDeck(familyMode) {
  let pool = cards.map(c => c.number);
  if (familyMode) {
    pool = pool.filter(n => !FAMILY_REMOVED_TITLES.includes(cardByNumber(n).title));
  }
  return shuffle(pool);
}

function ensureDeck() {
  if (state.deck.length === 0) {
    state.deck = shuffle(state.discard);
    state.discard = [];
  }
}

function getCardPrompts(cardNumber, venue, familyMode) {
  return prompts
    .filter(p => p.card_number === cardNumber && p.venue === venue && (!familyMode || p.family_safe))
    .sort((a, b) => a.position - b.position);
}

function getNextPrompt(player, venue, familyMode) {
  const list = getCardPrompts(player.card_number, venue, familyMode);
  const used = (player.used && player.used[venue]) || [];
  return list.find(p => !used.includes(p.position)) || null;
}

function markPromptUsed(player, venue, position) {
  if (!player.used[venue]) player.used[venue] = [];
  if (!player.used[venue].includes(position)) player.used[venue].push(position);
}

function venueMatchCards(player) {
  const ch = getCharacter(player);
  return player.hand.filter(n => cardByNumber(n).venue === ch.venue);
}

// Build the full Pool. There are only 8 token designs, so when the Pool is
// larger than that the designs repeat — each physical token still gets a
// unique id so it can be tracked, renamed and returned individually.
function buildPool() {
  const out = [];
  for (let i = 0; i < RULES_CONFIG.tokensInPool; i++) {
    const design = PROP_TOKENS[i % PROP_TOKENS.length];
    const copy = Math.floor(i / PROP_TOKENS.length);
    out.push({
      ...design,
      id: `${design.number}-${copy}`,
      name: copy === 0 ? design.name : `${design.name} (${copy + 1})`,
    });
  }
  return out;
}

// Venue keys were renamed for the RSL compliance fix (§1.1). Saved games and
// live Supabase sessions still carry the old keys, so translate on load.
const LEGACY_VENUE_KEYS = { rsl: 'the_club', comedy_club: 'comedy_lounge' };

function migrateVenueKeys() {
  if (!state || !Array.isArray(state.players)) return;
  state.players.forEach(p => {
    if (!p.used) return;
    Object.entries(LEGACY_VENUE_KEYS).forEach(([oldKey, newKey]) => {
      if (p.used[oldKey] === undefined) return;
      p.used[newKey] = [...new Set([...(p.used[newKey] || []), ...p.used[oldKey]])];
      delete p.used[oldKey];
    });
  });
}

// Migrate a state object saved before the Pool existed.
function ensurePool() {
  if (Array.isArray(state.pool)) return;
  const held = new Set();
  state.players.forEach(p => (p.tokens || []).forEach(t => held.add(t.id ?? `${t.number}-0`)));
  state.pool = buildPool().filter(t => !held.has(t.id));
}

function poolIsEmpty() {
  ensurePool();
  return state.pool.length === 0;
}

// §1.2 — the ONLY way a player gains a token. Draws from the Pool, never from
// another player. Returns null when the Pool is exhausted (§1.9, 8 players).
function awardToken(player) {
  ensurePool();
  if (state.pool.length === 0) return null;
  const token = state.pool.shift();
  player.tokens.push(token);
  return token;
}

// Return a token to the Pool — referee correction only, never a steal.
function returnTokenToPool(player, tokenIndex) {
  const idx = tokenIndex != null ? tokenIndex : player.tokens.length - 1;
  const [token] = player.tokens.splice(idx, 1);
  if (!token) return;
  ensurePool();
  state.pool.push(token);
  state.pool.sort((a, b) => String(a.id).localeCompare(String(b.id), undefined, { numeric: true }));
}

function hasWon(player) {
  return player.tokens.length >= tokenGoal();
}

// ===== TOAST =====

let toastTimer = null;

function showToast(message) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.classList.add('visible');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('visible'), 3200);
}

function showPoolEmptyNotice() {
  showToast('🪙 The Pool is empty — no tokens can be taken. Cash a pair or win with what you hold.');
}

// Shows the shared supply on every in-game screen (§1.3 — the Pool is public).
// §3 — while the experimental win condition is active the player must be able
// to see, at any point in the game, that they are not on the confirmed rules.
function renderUnverifiedBanner() {
  if (!state || !state.players || state.players.length === 0) return;
  ['turn-screen', 'draw-screen', 'spectate-screen'].forEach(id => {
    const screen = document.getElementById(id);
    if (!screen) return;
    let bar = screen.querySelector('.unverified-banner');
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'unverified-banner';
      const anchor = screen.querySelector('.pool-bar') || screen.firstElementChild;
      if (anchor && anchor.nextSibling) screen.insertBefore(bar, anchor.nextSibling);
      else screen.appendChild(bar);
    }
    bar.textContent = `⚠️ Fast game — win at ${RULES_CONFIG.fastGameTokens} tokens. Unverified ruleset.`;
    bar.classList.toggle('hidden', !state.fastGameUnverified);
  });
}

function renderPoolBar() {
  if (!state || !state.players || state.players.length === 0) return;
  ensurePool();
  renderUnverifiedBanner();
  const screens = ['turn-screen', 'draw-screen', 'spectate-screen'];
  screens.forEach(id => {
    const screen = document.getElementById(id);
    if (!screen) return;
    let bar = screen.querySelector('.pool-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'pool-bar';
      const anchor = screen.querySelector('.token-bar') || screen.firstElementChild;
      if (anchor && anchor.nextSibling) screen.insertBefore(bar, anchor.nextSibling);
      else screen.appendChild(bar);
    }
    const n = state.pool.length;
    bar.classList.toggle('empty', n === 0);
    bar.innerHTML = n === 0
      ? '🪙 <span class="pool-count">Pool empty</span> — no tokens can be taken'
      : `🪙 Pool: <span class="pool-count">${n}</span> / ${RULES_CONFIG.tokensInPool} Prop Tokens left`;
  });
}

// "Nev — The Heckled Stand-up" style label from the character card art.
function characterFullName(ch) {
  return ch.personalName ? `${ch.personalName} — ${ch.archetype}` : ch.archetype;
}

function characterLabel(ch) {
  return ch.personalName ? `${ch.name} (${ch.personalName})` : ch.name;
}

function animalName(id) {
  const c = CHARACTERS.find(x => x.id === id);
  return c ? c.name : id.charAt(0).toUpperCase() + id.slice(1);
}

// ===== TIMER =====

function stopTimer() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  timerRunning = false;
}

function startTimer(seconds) {
  stopTimer();
  timerRemaining = seconds;
  timerRunning = true;
  updateTimerDisplay();
  timerInterval = setInterval(() => {
    timerRemaining--;
    updateTimerDisplay();
    if (timerRemaining <= 0) {
      stopTimer();
      const btn = document.getElementById('timer-btn');
      const display = document.getElementById('timer-display');
      if (btn) { btn.textContent = "Time's up!"; btn.classList.remove('running'); }
      if (display) display.classList.add('warning');
    }
  }, 1000);
}

function updateTimerDisplay() {
  const display = document.getElementById('timer-display');
  const btn = document.getElementById('timer-btn');
  if (!display) return;
  const m = Math.floor(timerRemaining / 60);
  const s = Math.max(0, timerRemaining % 60);
  display.textContent = m > 0 ? `${m}:${String(s).padStart(2,'0')}` : `0:${String(s).padStart(2,'0')}`;
  display.classList.toggle('warning', timerRemaining <= 5 && timerRunning);
  if (btn) {
    btn.textContent = timerRunning ? 'Stop' : 'Start Timer';
    btn.classList.toggle('running', timerRunning);
  }
}

// ===== NAVIGATION =====

function showPhase(phase) {
  ['setup','turn','draw','verdict','win','join','spectate','sim'].forEach(p => {
    document.getElementById(`${p}-screen`).classList.toggle('hidden', phase !== p);
  });
  document.body.dataset.phase = phase;
  // The "← Site" link would sit on top of the in-game back button, so it is
  // only offered on the screens that have no back button of their own.
  const siteLink = document.getElementById('site-back-link');
  if (siteLink) siteLink.classList.toggle('hidden', !['setup','join','win'].includes(phase));
  closeGameMenu();
}

// Central routing: always call this after state changes (locally or from realtime)
function renderCurrentPhase() {
  // Guard: if player slot is stale (player count changed), clear it
  if (myPlayerIndex !== null && state.players.length > 0 && myPlayerIndex >= state.players.length) {
    clearMyPlayerSlot();
  }

  renderPoolBar();

  if (state.phase === 'win') {
    const winner = state.players.find(p => p.tokens.length >= tokenGoal());
    if (winner) {
      document.getElementById('win-message').textContent =
        `${winner.name || `Player ${state.players.indexOf(winner) + 1}`} collected ${tokenGoal()} Prop Tokens and wins.`;
    }
    showPhase('win');
    return;
  }

  if (state.phase === 'setup') {
    clearMyPlayerSlot();
    showPhase('setup');
    renderSetup();
    return;
  }

  // Game in progress — need to know who I am
  if (myPlayerIndex === null) {
    showPhase('join');
    renderJoin();
    return;
  }

  if (myPlayerIndex === state.currentPlayerIndex) {
    // It's my turn
    stopTimer();
    switch (state.phase) {
      case 'turn':    showPhase('turn');    renderTurn();    break;
      case 'draw':    showPhase('draw');    renderDraw();    break;
      case 'verdict': showPhase('verdict'); renderVerdict(); break;
      default:        showPhase('turn');    renderTurn();    break;
    }
  } else {
    // Someone else's turn — spectate
    showPhase('spectate');
    renderSpectate();
  }
}

function goToSetup() {
  stopTimer();
  state.phase = 'setup';
  save();
  renderCurrentPhase();
}

function goToTurn() {
  stopTimer();
  state.phase = 'turn';
  state.drawnCard = null;
  state.drawnPromptPos = null;
  state.pendingOutcome = null;
  save();
  renderCurrentPhase();
}

function goToDraw() {
  state.phase = 'draw';
  save();
  renderCurrentPhase();
}

function goToVerdict() {
  stopTimer();
  state.phase = 'verdict';
  save();
  renderCurrentPhase();
}

function goToWin(winnerIndex) {
  stopTimer();
  state.phase = 'win';
  save();
  renderCurrentPhase();
}

function advancePlayer() {
  // Any unresolved interrupts belong to the turn that just ended.
  state.interruptStack = [];
  state.drawnThisTurn = false;
  state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
}

// ===== RENDER: SETUP =====

function renderSetup() {
  document.querySelectorAll('.count-btn').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.count) === state.numPlayers);
  });
  document.getElementById('setup-family-mode').checked = state.familyMode;
  document.getElementById('setup-tutorial-mode').checked = !!state.tutorialMode;
  document.getElementById('setup-fast-game').checked = !!state.fastGameUnverified;

  const container = document.getElementById('player-rows');
  container.innerHTML = '';

  const assignedChars = [];
  for (let i = 0; i < state.numPlayers; i++) {
    const existing = state.players[i] || {};
    const row = document.createElement('div');
    row.className = 'player-row';

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.placeholder = `Player ${i+1}`;
    nameInput.value = existing.name || '';
    nameInput.dataset.playerIndex = i;
    nameInput.className = 'player-name-input';

    const charSelect = document.createElement('select');
    charSelect.dataset.playerIndex = i;
    charSelect.className = 'char-select';
    CHARACTERS.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = `${characterLabel(c)} — ${VENUES[c.venue].icon}`;
      if (existing.character === c.id) opt.selected = true;
      charSelect.appendChild(opt);
    });
    if (!existing.character) {
      const unused = CHARACTERS.find(c => !assignedChars.includes(c.id));
      if (unused) charSelect.value = unused.id;
    }
    assignedChars.push(charSelect.value);

    const cardSelect = document.createElement('select');
    cardSelect.dataset.playerIndex = i;
    cardSelect.className = 'card-select';
    for (let c = 1; c <= 16; c++) {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = `Prompt Card ${c}`;
      if ((existing.card_number || (i + 1)) === c) opt.selected = true;
      cardSelect.appendChild(opt);
    }

    const charPreview = document.createElement('div');
    charPreview.className = 'char-preview-img';
    const getCharImg = (charId) => {
      const c = CHARACTERS.find(x => x.id === charId);
      return c ? `url('assets/characters/${c.img}.png')` : '';
    };
    charPreview.style.backgroundImage = getCharImg(charSelect.value);
    charSelect.addEventListener('change', () => {
      charPreview.style.backgroundImage = getCharImg(charSelect.value);
    });

    row.appendChild(charPreview);
    row.appendChild(nameInput);
    row.appendChild(charSelect);
    row.appendChild(cardSelect);
    container.appendChild(row);
  }
}

// ===== RENDER: JOIN =====

function showJoinScreen() {
  showPhase('join');
  renderJoin();
}

function renderJoin() {
  const isSwitching = myPlayerIndex !== null;
  document.getElementById('join-subtitle').textContent = isSwitching
    ? 'Switch to a different player'
    : 'Game in progress — who are you?';

  const backRow = document.getElementById('join-back-row');
  const backBtn = document.getElementById('join-back-btn');
  if (isSwitching) {
    const me = state.players[myPlayerIndex];
    backBtn.textContent = `← Stay as ${me?.name || `Player ${myPlayerIndex + 1}`}`;
    backRow.classList.remove('hidden');
  } else {
    backRow.classList.add('hidden');
  }

  const list = document.getElementById('join-player-list');
  list.innerHTML = '';

  state.players.forEach((player, idx) => {
    const ch = getCharacter(player);
    const venue = VENUES[ch.venue];

    const card = document.createElement('button');
    card.className = 'join-player-card';

    const img = document.createElement('div');
    img.className = 'join-char-img';
    img.style.backgroundImage = `url('assets/characters/${ch.img}.png')`;

    const info = document.createElement('div');
    info.className = 'join-player-info';

    const name = document.createElement('div');
    name.className = 'join-player-name';
    name.textContent = player.name || `Player ${idx + 1}`;

    const meta = document.createElement('div');
    meta.className = 'join-player-meta';
    meta.textContent = `${characterLabel(ch)} · ${venue.icon} ${venue.name}`;

    const stats = document.createElement('div');
    stats.className = 'join-player-stats';
    stats.textContent = `🪙 ${player.tokens.length} token${player.tokens.length !== 1 ? 's' : ''} · ${player.hand.length} card${player.hand.length !== 1 ? 's' : ''}`;

    if (idx === state.currentPlayerIndex) {
      const turn = document.createElement('div');
      turn.className = 'join-player-turn';
      turn.textContent = '← their turn';
      info.appendChild(turn);
    }
    if (idx === myPlayerIndex) {
      card.classList.add('active');
    }

    info.appendChild(name);
    info.appendChild(meta);
    info.appendChild(stats);
    card.appendChild(img);
    card.appendChild(info);

    card.addEventListener('click', () => {
      claimPlayerSlot(idx);
      renderCurrentPhase();
    });

    list.appendChild(card);
  });
}

// ===== RENDER: SPECTATE =====

function renderSpectate() {
  const activePlayer = state.players[state.currentPlayerIndex];
  if (!activePlayer) return;
  const ch = getCharacter(activePlayer);
  const venue = VENUES[ch.venue];

  document.getElementById('spectate-active-char').style.backgroundImage =
    `url('assets/characters/${ch.img}.png')`;
  document.getElementById('spectate-active-name').textContent =
    activePlayer.name || `Player ${state.currentPlayerIndex + 1}`;
  document.getElementById('spectate-active-meta').textContent =
    `${characterLabel(ch)} · ${venue.icon} ${venue.name}`;

  const phaseLabels = {
    turn:    'Deciding what to do…',
    draw:    state.drawnCard ? `Performing: ${cardByNumber(state.drawnCard)?.title}` : 'Drawing a card…',
    verdict: 'Collecting reward…',
  };
  document.getElementById('spectate-phase-label').textContent =
    phaseLabels[state.phase] || '';

  // Drawn card preview
  const drawnWrap = document.getElementById('spectate-drawn-wrap');
  if (state.drawnCard && (state.phase === 'draw' || state.phase === 'verdict')) {
    const card = cardByNumber(state.drawnCard);
    document.getElementById('spectate-drawn-card').style.backgroundImage =
      `url('assets/venues/${state.drawnCard}.png')`;
    document.getElementById('spectate-drawn-title').textContent =
      `${card.title} · ${animalName(card.animal)}`;
    drawnWrap.classList.remove('hidden');
  } else {
    drawnWrap.classList.add('hidden');
  }

  // My tokens
  const me = myPlayerIndex !== null ? state.players[myPlayerIndex] : null;
  const tokenBar = document.getElementById('spectate-token-bar');
  tokenBar.innerHTML = '';
  if (me) {
    const label = document.createElement('div');
    label.className = 'token-bar-label';
    label.textContent = `🪙 ${me.tokens.length} / ${tokenGoal()}`;
    tokenBar.appendChild(label);
    const chips = document.createElement('div');
    chips.className = 'token-chips';
    if (me.tokens.length === 0) {
      const empty = document.createElement('span');
      empty.className = 'token-chip empty';
      empty.textContent = 'no tokens yet';
      chips.appendChild(empty);
    } else {
      me.tokens.forEach((t, ti) => {
        chips.appendChild(buildTokenChip(t, () => renameToken(myPlayerIndex, ti)));
      });
    }
    tokenBar.appendChild(chips);
  }

  // My hand
  const grid = document.getElementById('spectate-hand-grid');
  grid.innerHTML = '';
  const myHand = me ? me.hand : [];
  myHand.forEach(n => grid.appendChild(buildHandCard(n)));
  document.getElementById('spectate-hand-empty').classList.toggle('hidden', myHand.length > 0);

  maybeShowTutorial('first_spectate');
  maybeShowMidgameTip();
}

// ===== RENDER: TURN =====

function renderTurn() {
  const player = state.players[state.currentPlayerIndex];
  if (!player) return;
  const ch = getCharacter(player);
  const venue = VENUES[ch.venue];

  document.getElementById('turn-player-name').textContent = player.name || `Player ${state.currentPlayerIndex + 1}`;
  document.getElementById('turn-player-character').textContent = characterLabel(ch);
  document.getElementById('turn-player-venue').textContent = `${venue.icon} ${venue.name}`;
  document.getElementById('turn-family-mode').checked = state.familyMode;

  const charCard = document.getElementById('turn-char-card');
  charCard.style.backgroundImage = `url('assets/characters/${ch.img}.png')`;

  const bar = document.getElementById('turn-token-bar');
  bar.innerHTML = '';
  const label = document.createElement('div');
  label.className = 'token-bar-label';
  label.textContent = `🪙 ${player.tokens.length} / ${tokenGoal()}`;
  bar.appendChild(label);
  const chips = document.createElement('div');
  chips.className = 'token-chips';
  if (player.tokens.length === 0) {
    const empty = document.createElement('span');
    empty.className = 'token-chip empty';
    empty.textContent = 'no tokens yet';
    chips.appendChild(empty);
  } else {
    player.tokens.forEach((t, ti) => {
      chips.appendChild(buildTokenChip(t, () => renameToken(state.currentPlayerIndex, ti)));
    });
  }
  bar.appendChild(chips);

  const grid = document.getElementById('turn-hand-grid');
  grid.innerHTML = '';
  player.hand.forEach(n => grid.appendChild(buildHandCard(n)));
  document.getElementById('turn-hand-empty').classList.toggle('hidden', player.hand.length > 0);

  document.getElementById('cash-pair-btn').classList.toggle('hidden', venueMatchCards(player).length < 2);

  maybeShowTutorial('first_turn');
  maybeShowMidgameTip();
}

function addTypeBadge(el, card) {
  const badge = document.createElement('span');
  const interrupt = card.timing.startsWith('interrupt');
  badge.className = 'card-type-badge ' + (interrupt ? 'interrupt' : 'your_turn');
  badge.textContent = interrupt ? '🛡️' : '⚡';
  badge.title = card.timing_label;
  el.appendChild(badge);
}

function buildHandCard(cardNumber) {
  const card = cardByNumber(cardNumber);
  const el = document.createElement('button');
  el.className = 'hand-card';
  el.style.backgroundImage = `url('assets/venues/${cardNumber}.png')`;
  addTypeBadge(el, card);
  const label = document.createElement('span');
  label.className = 'hand-card-label';
  label.textContent = card.title;
  el.appendChild(label);
  el.addEventListener('click', () => openCardSheet(cardNumber, 'hand'));
  return el;
}

// ===== RENDER: DRAW / PERFORM =====

function renderDraw() {
  const player = state.players[state.currentPlayerIndex];
  const card = cardByNumber(state.drawnCard);
  if (!player || !card) return;
  const venue = VENUES[card.venue];

  const header = document.getElementById('draw-header');
  header.className = `draw-header ${venue.cssClass}`;
  document.getElementById('draw-venue-label').textContent = `${venue.icon} ${venue.name}`;

  document.getElementById('drawn-card').style.backgroundImage = `url('assets/venues/${card.number}.png')`;
  document.getElementById('drawn-card-title').textContent = card.title;
  document.getElementById('drawn-card-animal').textContent =
    `🐾 ${animalName(card.animal)} · ${venue.icon} ${venue.name}`;
  document.getElementById('drawn-card-power').textContent = card.power_text;

  const prompt = getNextPrompt(player, card.venue, state.familyMode);
  state.drawnPromptPos = prompt ? prompt.position : null;

  document.getElementById('perform-cardno').textContent = `Prompt Card #${player.card_number}`;
  const promptText = document.getElementById('draw-prompt-text');
  const successBlock = document.getElementById('draw-success-block');
  const timerBlock = document.getElementById('timer-block');

  stopTimer();
  if (prompt) {
    promptText.textContent = prompt.text;
    promptText.classList.remove('muted');

    if (prompt.timed && prompt.duration_seconds) {
      timerBlock.classList.remove('hidden');
      timerRemaining = prompt.duration_seconds;
      updateTimerDisplay();
    } else {
      timerBlock.classList.add('hidden');
    }

    const sc = SUCCESS_DISPLAY[prompt.success_condition] || SUCCESS_DISPLAY.vote;
    successBlock.classList.remove('hidden');
    document.getElementById('success-icon').textContent = sc.icon;
    document.getElementById('success-label').textContent = sc.label;
    document.getElementById('success-text').textContent = prompt.success_text || '';
  } else {
    promptText.textContent = `You've used every ${venue.name} prompt on your card — improvise one!`;
    promptText.classList.add('muted');
    timerBlock.classList.add('hidden');
    successBlock.classList.add('hidden');
  }

  maybeShowTutorial('first_draw');
}

// ===== RENDER: VERDICT =====

const OUTCOME_INFO = {
  animal: {
    icon: '🐾',
    title: 'Animal Affinity!',
    msg: (card, ch) => `The ${animalName(card.animal)} on the card matches your character — take a Prop Token.`,
  },
  venue: {
    icon: '✅',
    title: 'Venue Match!',
    msg: (card, ch) => `Same venue as your character — keep the card face-up. Two matching cards can be cashed for a token.`,
  },
  power: {
    icon: '🃏',
    title: 'Keep the Card',
    msg: (card, ch) => `No match, but it's yours to keep for its printed power.`,
  },
};

function renderVerdict() {
  const card = cardByNumber(state.drawnCard);
  const player = state.players[state.currentPlayerIndex];
  const ch = getCharacter(player);
  const info = OUTCOME_INFO[state.pendingOutcome] || OUTCOME_INFO.power;

  document.getElementById('verdict-icon').textContent = info.icon;
  document.getElementById('verdict-title').textContent = info.title;
  document.getElementById('verdict-message').textContent = info.msg(card, ch);
  document.getElementById('verdict-card').style.backgroundImage = `url('assets/venues/${card.number}.png')`;
  document.getElementById('verdict-override').classList.add('hidden');

  if (['animal','venue','power'].includes(state.pendingOutcome)) {
    maybeShowTutorial(`first_verdict_${state.pendingOutcome}`);
  }
}

// ===== RENDER: POSSESSIONS OVERLAY =====

function renderPossessions() {
  const body = document.getElementById('possessions-body');
  body.innerHTML = '';

  state.players.forEach((player, idx) => {
    const ch = getCharacter(player);
    const venue = VENUES[ch.venue];

    const section = document.createElement('div');
    section.className = 'poss-player' + (idx === state.currentPlayerIndex ? ' current' : '');

    const head = document.createElement('div');
    head.className = 'poss-head';
    head.innerHTML = `
      <div class="poss-name">${escapeHtml(player.name || `Player ${idx+1}`)}</div>
      <div class="poss-meta">${characterLabel(ch)} · ${venue.icon} ${venue.name}</div>`;
    section.appendChild(head);

    const tokRow = document.createElement('div');
    tokRow.className = 'poss-tokens';
    const tokLabel = document.createElement('div');
    tokLabel.className = 'poss-subtitle';
    tokLabel.textContent = `Prop Tokens (${player.tokens.length}/${tokenGoal()})`;
    tokRow.appendChild(tokLabel);

    const tokControls = document.createElement('div');
    tokControls.className = 'poss-token-controls';
    const minus = document.createElement('button');
    minus.className = 'token-btn';
    minus.textContent = '−';
    minus.addEventListener('click', () => adjustToken(idx, -1));
    const plus = document.createElement('button');
    plus.className = 'token-btn';
    plus.textContent = '+';
    plus.addEventListener('click', () => adjustToken(idx, +1));
    const chipWrap = document.createElement('div');
    chipWrap.className = 'token-chips';
    if (player.tokens.length === 0) {
      const e = document.createElement('span');
      e.className = 'token-chip empty';
      e.textContent = 'none';
      chipWrap.appendChild(e);
    } else {
      player.tokens.forEach((t, ti) => {
        chipWrap.appendChild(buildTokenChip(t, () => renameToken(idx, ti)));
      });
    }
    tokControls.appendChild(minus);
    tokControls.appendChild(chipWrap);
    tokControls.appendChild(plus);
    tokRow.appendChild(tokControls);
    section.appendChild(tokRow);

    const handLabel = document.createElement('div');
    handLabel.className = 'poss-subtitle';
    handLabel.textContent = `Power Cards (${player.hand.length})`;
    section.appendChild(handLabel);

    const hand = document.createElement('div');
    hand.className = 'poss-hand';
    if (player.hand.length === 0) {
      const e = document.createElement('span');
      e.className = 'poss-hand-empty';
      e.textContent = 'empty hand';
      hand.appendChild(e);
    } else {
      player.hand.forEach(n => {
        const c = cardByNumber(n);
        const card = document.createElement('button');
        card.className = 'poss-card';
        card.style.backgroundImage = `url('assets/venues/${n}.png')`;
        card.title = c.title;
        card.addEventListener('click', () => openCardSheet(n, 'poss', idx));
        addTypeBadge(card, c);
        const lbl = document.createElement('span');
        lbl.className = 'hand-card-label';
        lbl.textContent = c.title;
        card.appendChild(lbl);
        hand.appendChild(card);
      });
    }
    section.appendChild(hand);
    body.appendChild(section);
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

// ===== RENDER: CARD SHEET =====

let sheetContext = null;

function openCardSheet(cardNumber, source, playerIndex) {
  const card = cardByNumber(cardNumber);
  sheetContext = { cardNumber, source, playerIndex: playerIndex ?? state.currentPlayerIndex };

  document.getElementById('card-sheet-title').textContent = card.title;
  document.getElementById('card-sheet-img').style.backgroundImage = `url('assets/venues/${cardNumber}.png')`;
  document.getElementById('card-sheet-animal').textContent = animalName(card.animal);
  document.getElementById('card-sheet-power').textContent = card.power_text;

  const typeEl = document.getElementById('card-sheet-type');
  const interrupt = card.timing.startsWith('interrupt');
  typeEl.className = 'sheet-type ' + (interrupt ? 'interrupt' : 'your_turn');
  typeEl.textContent = (interrupt ? '🛡️ ' : '⚡ ') + card.timing_label;

  // §1.4 Step 0 — Intermission is a HARD window. Once the card is flipped the
  // window is closed and the power cannot be played at all this turn.
  const blocked = intermissionWindowClosed(card);
  const noteEl = document.getElementById('card-sheet-timing-note');
  if (blocked) {
    noteEl.textContent = '⛔ Window closed — the active player has already drawn. Intermission must be declared before the draw.';
    noteEl.classList.remove('hidden');
  } else if (card.title === 'Mime Time') {
    noteEl.textContent = '♿ Accessibility: "whispers only" may be used instead of full silence.';
    noteEl.classList.remove('hidden');
  } else {
    noteEl.textContent = '';
    noteEl.classList.add('hidden');
  }

  // MINI-CANON §5.5 — no affinity bonus text exists.
  document.getElementById('card-sheet-affinity').classList.add('hidden');

  const actions = document.getElementById('card-sheet-actions');
  actions.innerHTML = '';
  const useBtn = document.createElement('button');
  useBtn.className = 'btn-primary';
  useBtn.textContent = '🎭 Play Power & Discard';
  useBtn.disabled = blocked;
  if (blocked) useBtn.classList.add('disabled');
  useBtn.addEventListener('click', () => {
    if (intermissionWindowClosed(card)) {
      showToast('⛔ Intermission must be declared before the draw. Window closed.');
      return;
    }
    playPower(sheetContext.playerIndex, cardNumber);
  });
  actions.appendChild(useBtn);

  document.getElementById('card-sheet').classList.remove('hidden');

  if (source === 'hand') maybeShowTutorial('first_hand_card');
}

function closeCardSheet() {
  document.getElementById('card-sheet').classList.add('hidden');
  sheetContext = null;
}

// ===== INTERRUPT STACK (§1.7) =====
//
// Powers are resolved physically at the table; the app's job is to enforce
// *timing* and show the table the correct resolution order. The stack is LIFO
// — last played is resolved first — and chains are legal, so Clap Back can
// reverse a Stage Hook and the original player may then Standing Ovation the
// reversed Stage Hook.

const COUNTER_TITLES = ['Standing Ovation', 'Clap Back'];

// §1.4 Step 0 — hard window. Closed the instant the card is flipped, and it
// stays closed for the rest of the turn. Note this deliberately survives the
// draw screen's "← Back" undo: physically the card has been flipped, and
// backing out is an app convenience with no equivalent at the table.
function intermissionWindowClosed(card) {
  return card.title === 'Intermission' && !!state.drawnThisTurn;
}

function stack() {
  if (!Array.isArray(state.interruptStack)) state.interruptStack = [];
  return state.interruptStack;
}

// Clockwise priority from the active player — §1.7 "simultaneous interrupts
// resolve clockwise from the active player".
function clockwiseRank(playerIndex) {
  const n = state.players.length;
  return (playerIndex - state.currentPlayerIndex + n) % n;
}

function playPower(playerIndex, cardNumber) {
  const card = cardByNumber(cardNumber);
  if (!card) return;

  if (intermissionWindowClosed(card)) {
    showToast('⛔ Intermission must be declared before the draw. Window closed.');
    return;
  }

  const player = state.players[playerIndex];
  const i = player.hand.indexOf(cardNumber);
  if (i !== -1) {
    player.hand.splice(i, 1);
    state.discard.push(cardNumber);
  }

  if (state.currentTurn) {
    state.currentTurn.powerCardsPlayed.push({
      playerIndex,
      playerName: player.name || `Player ${playerIndex + 1}`,
      cardNumber,
      title: card.title,
    });
  }

  // A counter lands on top of the existing stack; anything else opens a new
  // stack entry. Either way the newest entry resolves first.
  stack().push({
    cardNumber,
    title: card.title,
    playerIndex,
    playerName: player.name || `Player ${playerIndex + 1}`,
    isCounter: COUNTER_TITLES.includes(card.title),
    rank: clockwiseRank(playerIndex),
    at: new Date().toISOString(),
  });

  closeCardSheet();
  save();
  renderCurrentPhase();
  renderInterruptStack();
  if (!document.getElementById('possessions-overlay').classList.contains('hidden')) renderPossessions();
}

// Resolve the top of the stack (LIFO). The table performs the physical effect;
// this pops the entry and reveals the next one down.
function resolveTopOfStack() {
  const s = stack();
  if (s.length === 0) return;
  s.pop();
  save();
  renderInterruptStack();
  renderCurrentPhase();
}

function clearInterruptStack() {
  state.interruptStack = [];
  save();
  renderInterruptStack();
}

function renderInterruptStack() {
  const s = stack();
  let el = document.getElementById('interrupt-stack');
  if (!el) {
    el = document.createElement('div');
    el.id = 'interrupt-stack';
    document.body.appendChild(el);
  }
  if (s.length === 0) { el.classList.add('hidden'); el.innerHTML = ''; return; }

  el.classList.remove('hidden');
  el.innerHTML = '';

  const head = document.createElement('div');
  head.className = 'istack-head';
  head.textContent = `🛡️ Interrupt stack — resolve top first (${s.length})`;
  el.appendChild(head);

  // Newest first — that IS the resolution order.
  s.slice().reverse().forEach((entry, i) => {
    const row = document.createElement('div');
    row.className = 'istack-row' + (i === 0 ? ' top' : '');
    const label = document.createElement('span');
    label.textContent = `${i === 0 ? '▶ ' : ''}${entry.title} — ${entry.playerName}`;
    row.appendChild(label);
    if (i === 0) {
      const btn = document.createElement('button');
      btn.className = 'istack-resolve';
      btn.textContent = 'Resolved';
      btn.addEventListener('click', resolveTopOfStack);
      row.appendChild(btn);
    }
    el.appendChild(row);
  });

  const clear = document.createElement('button');
  clear.className = 'istack-clear';
  clear.textContent = 'Clear all';
  clear.addEventListener('click', clearInterruptStack);
  el.appendChild(clear);
}

// ===== ACTIONS =====

function doDraw() {
  ensureDeck();
  if (state.deck.length === 0) return;
  state.drawnCard = state.deck.pop();
  state.drawnThisTurn = true;  // §1.4 Step 0 — Intermission window now closed

  const player = state.players[state.currentPlayerIndex];
  const card = cardByNumber(state.drawnCard);
  state.turnNumber = (state.turnNumber || 0) + 1;
  state.currentTurn = {
    type: 'draw',
    turnNumber: state.turnNumber,
    playerIndex: state.currentPlayerIndex,
    playerName: player.name || `Player ${state.currentPlayerIndex + 1}`,
    character: player.character,
    venue: card.venue,
    cardNumber: card.number,
    cardTitle: card.title,
    cardAnimal: card.animal,
    powerCardsPlayed: [],
    outcome: null,
    timestamp: new Date().toISOString(),
  };

  goToDraw();
}

function doFail() {
  if (state.drawnCard != null) state.discard.push(state.drawnCard);

  if (state.currentTurn) {
    state.currentTurn.outcome = 'fail';
    if (!state.turnLog) state.turnLog = [];
    state.turnLog.push(state.currentTurn);
    state.currentTurn = null;
  }

  stopTimer();
  advancePlayer();
  goToTurn();
}

function doSuccess() {
  const player = state.players[state.currentPlayerIndex];
  const card = cardByNumber(state.drawnCard);
  const ch = getCharacter(player);

  if (state.drawnPromptPos != null) markPromptUsed(player, card.venue, state.drawnPromptPos);

  if (card.animal === ch.id) state.pendingOutcome = 'animal';
  else if (card.venue === ch.venue) state.pendingOutcome = 'venue';
  else state.pendingOutcome = 'power';

  goToVerdict();
}

function applyOutcome(outcome) {
  const player = state.players[state.currentPlayerIndex];
  const card = cardByNumber(state.drawnCard);

  if (outcome === 'animal') {
    // §1.6A — mandatory token, card to discard. If the Pool is empty no token
    // can be taken by any route (§1.2); the card is kept instead of lost.
    if (awardToken(player)) {
      state.discard.push(card.number);
    } else {
      showPoolEmptyNotice();
      player.hand.push(card.number);
      outcome = 'power';
    }
  } else {
    player.hand.push(card.number);
  }

  if (state.currentTurn) {
    state.currentTurn.outcome = outcome;
    if (!state.turnLog) state.turnLog = [];
    state.turnLog.push(state.currentTurn);
    state.currentTurn = null;
  }

  const winner = state.currentPlayerIndex;
  state.drawnCard = null;
  state.drawnPromptPos = null;
  state.pendingOutcome = null;

  if (hasWon(player)) { goToWin(winner); return; }
  advancePlayer();
  goToTurn();
}

function doCashPair() {
  const player = state.players[state.currentPlayerIndex];
  const matches = venueMatchCards(player);
  if (matches.length < 2) return;
  // §1.2 — no token can be taken by any route while the Pool is empty.
  // Don't consume the pair for nothing.
  if (poolIsEmpty()) { showPoolEmptyNotice(); return; }
  const toDiscard = matches.slice(0, 2);
  toDiscard.forEach(n => {
    const i = player.hand.indexOf(n);
    if (i !== -1) player.hand.splice(i, 1);
    state.discard.push(n);
  });
  awardToken(player);

  if (!state.turnLog) state.turnLog = [];
  state.turnLog.push({
    type: 'cash_pair',
    turnNumber: state.turnNumber || 0,
    playerIndex: state.currentPlayerIndex,
    playerName: player.name || `Player ${state.currentPlayerIndex + 1}`,
    character: player.character,
    cardsDiscarded: toDiscard,
    outcome: 'token',
    powerCardsPlayed: [],
    timestamp: new Date().toISOString(),
  });

  if (hasWon(player)) { save(); goToWin(state.currentPlayerIndex); return; }
  save();
  renderCurrentPhase();
}

function adjustToken(playerIndex, delta) {
  const player = state.players[playerIndex];
  if (delta > 0) {
    if (!awardToken(player)) { showPoolEmptyNotice(); return; }
    if (hasWon(player)) {
      save();
      document.getElementById('possessions-overlay').classList.add('hidden');
      goToWin(playerIndex);
      return;
    }
  } else if (player.tokens.length > 0) {
    returnTokenToPool(player);
  }
  save();
  renderPossessions();
  renderCurrentPhase();
}

function renameToken(playerIndex, tokenIndex) {
  const player = state.players[playerIndex];
  const current = player.tokens[tokenIndex];
  if (!current) return;
  const name = window.prompt('Token name:', current.name);
  if (name === null) return;
  current.name = name.trim() || current.name;
  save();
  renderPossessions();
  renderCurrentPhase();
}

function openPossessions() {
  renderPossessions();
  document.getElementById('possessions-overlay').classList.remove('hidden');
}

// ===== EVENT WIRING =====

function wireSetup() {
  document.getElementById('player-count-selector').addEventListener('click', e => {
    const btn = e.target.closest('.count-btn');
    if (!btn) return;
    state.numPlayers = parseInt(btn.dataset.count);
    renderSetup();
  });

  document.getElementById('setup-family-mode').addEventListener('change', e => {
    state.familyMode = e.target.checked;
  });

  document.getElementById('setup-tutorial-mode').addEventListener('change', e => {
    state.tutorialMode = e.target.checked;
    if (e.target.checked) {
      resetTutorialSeen();
      showTutorialPages([...INTRO_STEPS]);
    }
  });

  document.getElementById('setup-fast-game').addEventListener('change', e => {
    state.fastGameUnverified = e.target.checked;
    if (e.target.checked) {
      showToast(`⚠️ Fast game: win at ${RULES_CONFIG.fastGameTokens} tokens. This is NOT the confirmed ruleset and has never been play-tested.`);
    }
    renderCurrentPhase();
  });

  document.getElementById('simulate-btn').addEventListener('click', showSimScreen);

  document.getElementById('start-game-btn').addEventListener('click', () => {
    const players = [];
    for (let i = 0; i < state.numPlayers; i++) {
      const nameEl = document.querySelector(`.player-name-input[data-player-index="${i}"]`);
      const charEl = document.querySelector(`.char-select[data-player-index="${i}"]`);
      const cardEl = document.querySelector(`.card-select[data-player-index="${i}"]`);
      players.push({
        name: nameEl ? nameEl.value.trim() : '',
        character: charEl ? charEl.value : 'kookaburra',
        card_number: cardEl ? parseInt(cardEl.value) : (i + 1),
        tokens: [],
        hand: [],
        used: {comedy_lounge:[], the_club:[], royal_show:[], school_play:[]},
      });
    }
    state.players = players;
    state.currentPlayerIndex = 0;
    state.deck = buildDeck(state.familyMode);
    state.discard = [];
    if (state.tutorialMode) resetTutorialSeen();
    claimPlayerSlot(0); // host becomes player 1
    goToTurn();
  });
}

function wireTurn() {
  document.getElementById('draw-btn').addEventListener('click', doDraw);
  document.getElementById('cash-pair-btn').addEventListener('click', doCashPair);
  document.getElementById('turn-allplayers-btn').addEventListener('click', openPossessions);

  document.getElementById('turn-family-mode').addEventListener('change', e => {
    state.familyMode = e.target.checked;
    renderCurrentPhase();
    save();
  });

  document.getElementById('save-game-btn').addEventListener('click', openSaveModal);
  document.getElementById('log-btn').addEventListener('click', openLogModal);
  document.getElementById('switch-player-btn').addEventListener('click', showJoinScreen);

  document.getElementById('reset-btn').addEventListener('click', () => {
    if (confirm('Reset the whole game? This clears all hands, tokens and progress.')) {
      clearMyPlayerSlot();
      state = defaultState();
      save();
      renderCurrentPhase();
    }
  });
}

function wireDraw() {
  document.getElementById('draw-back-btn').addEventListener('click', () => {
    if (state.drawnCard != null) { state.deck.push(state.drawnCard); state.drawnCard = null; }
    goToTurn();
  });
  document.getElementById('draw-allplayers-btn').addEventListener('click', openPossessions);
  document.getElementById('fail-btn').addEventListener('click', doFail);
  document.getElementById('success-btn').addEventListener('click', doSuccess);

  document.getElementById('timer-btn').addEventListener('click', () => {
    if (timerRunning) {
      stopTimer();
      updateTimerDisplay();
    } else {
      const player = state.players[state.currentPlayerIndex];
      const card = cardByNumber(state.drawnCard);
      const prompt = card ? getNextPrompt(player, card.venue, state.familyMode) : null;
      const dur = prompt && prompt.duration_seconds ? prompt.duration_seconds : 30;
      startTimer(timerRemaining > 0 ? timerRemaining : dur);
    }
  });
}

function wireVerdict() {
  document.getElementById('verdict-allplayers-btn').addEventListener('click', openPossessions);
  document.getElementById('verdict-continue-btn').addEventListener('click', () => {
    applyOutcome(state.pendingOutcome);
  });
  document.getElementById('verdict-change-btn').addEventListener('click', () => {
    document.getElementById('verdict-override').classList.toggle('hidden');
  });
  document.getElementById('verdict-override').addEventListener('click', e => {
    const btn = e.target.closest('.override-btn');
    if (!btn) return;
    applyOutcome(btn.dataset.outcome);
  });
}

function wireWin() {
  document.getElementById('win-newgame-btn').addEventListener('click', () => {
    const keep = state.players.map(p => ({
      name: p.name, character: p.character, card_number: p.card_number,
    }));
    state = defaultState();
    state.numPlayers = keep.length;
    state.players = keep.map(p => ({
      ...p, tokens: [], hand: [], used: {comedy_lounge:[], the_club:[], royal_show:[], school_play:[]},
    }));
    // Keep myPlayerIndex — same player in new game
    save();
    renderCurrentPhase();
  });
}

function wirePossessions() {
  document.getElementById('possessions-close').addEventListener('click', () => {
    document.getElementById('possessions-overlay').classList.add('hidden');
  });
  document.getElementById('possessions-backdrop').addEventListener('click', () => {
    document.getElementById('possessions-overlay').classList.add('hidden');
  });
}

function wireCardSheet() {
  document.getElementById('card-sheet-close').addEventListener('click', closeCardSheet);
  document.getElementById('card-sheet-backdrop').addEventListener('click', closeCardSheet);
}

function wireJoin() {
  document.getElementById('join-back-btn').addEventListener('click', renderCurrentPhase);
}

function wireSpectate() {
  document.getElementById('spectate-allplayers-btn').addEventListener('click', openPossessions);
  document.getElementById('spectate-switch-btn').addEventListener('click', showJoinScreen);
}

// ===== TUTORIAL MODE =====

let tutorialQueue = [];      // queue of page-arrays awaiting display
let tutorialPages = [];      // pages of the currently open sequence
let tutorialPageIndex = 0;

function tutorialSeen() {
  try { return JSON.parse(localStorage.getItem('pao_tutorial_seen')) || []; }
  catch { return []; }
}

function markTutorialSeen(stepId) {
  const seen = tutorialSeen();
  if (!seen.includes(stepId)) {
    seen.push(stepId);
    localStorage.setItem('pao_tutorial_seen', JSON.stringify(seen));
  }
}

function resetTutorialSeen() {
  localStorage.removeItem('pao_tutorial_seen');
}

function backstoryPage(charId) {
  const bs = CHARACTER_BACKSTORIES[charId];
  const ch = CHARACTERS.find(c => c.id === charId);
  if (!bs || !ch) return null;
  return {
    portrait: ch.img,
    title: `${ch.name} — ${characterFullName(ch)}`,
    body: [bs.story],
    strategy: bs.strategy,
  };
}

function tutorialOverlayOpen() {
  return !document.getElementById('tutorial-overlay').classList.contains('hidden');
}

function showTutorialPages(pages) {
  if (!pages || pages.length === 0) return;
  if (tutorialOverlayOpen()) {
    tutorialQueue.push(pages);
    return;
  }
  tutorialPages = pages;
  tutorialPageIndex = 0;
  renderTutorialPage();
  document.getElementById('tutorial-overlay').classList.remove('hidden');
}

function renderTutorialPage() {
  const page = tutorialPages[tutorialPageIndex];
  if (!page) return;

  const portrait = document.getElementById('tutorial-portrait');
  const icon = document.getElementById('tutorial-icon');
  if (page.portrait) {
    portrait.style.backgroundImage = `url('assets/characters/${page.portrait}.png')`;
    portrait.classList.remove('hidden');
    icon.classList.add('hidden');
  } else {
    portrait.classList.add('hidden');
    icon.classList.remove('hidden');
    icon.textContent = page.icon || '🎓';
  }

  document.getElementById('tutorial-title').textContent = page.title;

  const text = document.getElementById('tutorial-text');
  text.innerHTML = '';
  (page.body || []).forEach(para => {
    const p = document.createElement('p');
    p.textContent = para;
    text.appendChild(p);
  });
  if (page.strategy) {
    const s = document.createElement('div');
    s.className = 'tut-strategy';
    s.textContent = `💡 ${page.strategy}`;
    text.appendChild(s);
  }

  const dots = document.getElementById('tutorial-dots');
  dots.innerHTML = '';
  if (tutorialPages.length > 1) {
    tutorialPages.forEach((_, i) => {
      const d = document.createElement('span');
      d.className = 'tut-dot' + (i === tutorialPageIndex ? ' active' : '');
      dots.appendChild(d);
    });
  }

  const last = tutorialPageIndex >= tutorialPages.length - 1;
  document.getElementById('tutorial-next-btn').textContent = last ? 'Got it' : 'Next →';
}

function tutorialAdvance() {
  if (tutorialPageIndex < tutorialPages.length - 1) {
    tutorialPageIndex++;
    renderTutorialPage();
    return;
  }
  // Sequence done — show next queued sequence, or close
  if (tutorialQueue.length > 0) {
    tutorialPages = tutorialQueue.shift();
    tutorialPageIndex = 0;
    renderTutorialPage();
    return;
  }
  document.getElementById('tutorial-overlay').classList.add('hidden');
}

function tutorialDismissAll() {
  tutorialQueue = [];
  document.getElementById('tutorial-overlay').classList.add('hidden');
}

// One-shot contextual tip: shows once per device, only in tutorial mode.
function maybeShowTutorial(stepId) {
  if (!state || !state.tutorialMode) return;
  if (tutorialSeen().includes(stepId)) return;
  const tip = PHASE_TIPS[stepId];
  if (!tip) return;
  markTutorialSeen(stepId);
  showTutorialPages([tip]);
}

// Character backstory: shows once per character per device.
function maybeShowBackstory(charId) {
  if (!state || !state.tutorialMode) return;
  const stepId = `backstory_${charId}`;
  if (tutorialSeen().includes(stepId)) return;
  const page = backstoryPage(charId);
  if (!page) return;
  markTutorialSeen(stepId);
  showTutorialPages([page]);
}

// Once anyone reaches 2 tokens, surface the endgame strategy tip.
function maybeShowMidgameTip() {
  if (!state || !state.tutorialMode || !state.players) return;
  if (state.players.some(p => p.tokens.length >= 2)) {
    maybeShowTutorial('strategy_midgame');
  }
}

function wireTutorial() {
  document.getElementById('tutorial-next-btn').addEventListener('click', tutorialAdvance);
  document.getElementById('tutorial-close').addEventListener('click', tutorialDismissAll);
  document.getElementById('tutorial-backdrop').addEventListener('click', tutorialDismissAll);
}

// ===== GAME MENU =====

function openGameMenu() {
  const panel = document.getElementById('game-menu-panel');
  const btn = document.getElementById('game-menu-btn');
  const inGame = state.phase !== 'setup' && state.players && state.players.length > 0;
  document.getElementById('gm-allplayers').classList.toggle('hidden', !inGame);
  document.getElementById('gm-switch').classList.toggle('hidden', !inGame);
  document.getElementById('gm-save').classList.toggle('hidden', !inGame);
  document.getElementById('gm-log').classList.toggle('hidden', !inGame);
  panel.classList.remove('hidden');
  btn.classList.add('open');
}

function closeGameMenu() {
  const panel = document.getElementById('game-menu-panel');
  const btn = document.getElementById('game-menu-btn');
  if (panel) panel.classList.add('hidden');
  if (btn) btn.classList.remove('open');
}

function wireGameMenu() {
  document.getElementById('game-menu-btn').addEventListener('click', e => {
    e.stopPropagation();
    const open = !document.getElementById('game-menu-panel').classList.contains('hidden');
    if (open) closeGameMenu(); else openGameMenu();
  });

  document.getElementById('gm-allplayers').addEventListener('click', () => {
    closeGameMenu(); openPossessions();
  });
  document.getElementById('gm-switch').addEventListener('click', () => {
    closeGameMenu(); showJoinScreen();
  });
  document.getElementById('gm-save').addEventListener('click', () => {
    closeGameMenu(); openSaveModal();
  });
  document.getElementById('gm-log').addEventListener('click', () => {
    closeGameMenu(); openLogModal();
  });
  document.getElementById('gm-tutorial').addEventListener('click', () => {
    closeGameMenu();
    const pages = [...INTRO_STEPS];
    if (state.players && state.players.length > 0 && myPlayerIndex !== null) {
      const me = state.players[myPlayerIndex];
      const bs = me && backstoryPage(me.character);
      if (bs) pages.push(bs);
    }
    showTutorialPages(pages);
  });
  document.getElementById('gm-reset').addEventListener('click', () => {
    closeGameMenu();
    if (confirm('Reset the whole game? This clears all hands, tokens and progress.')) {
      clearMyPlayerSlot();
      state = defaultState();
      save();
      renderCurrentPhase();
    }
  });

  document.addEventListener('click', e => {
    const wrap = document.getElementById('game-menu-wrap');
    if (wrap && !wrap.contains(e.target)) closeGameMenu();
  });
}

// ===== SAVE GAME =====

async function openSaveModal() {
  document.getElementById('save-modal').classList.remove('hidden');
  const defaultName = `Turn ${state.turnNumber || 0} — ${new Date().toLocaleDateString()}`;
  document.getElementById('save-name-input').value = defaultName;
  await renderSaves();
}

function closeSaveModal() {
  document.getElementById('save-modal').classList.add('hidden');
}

async function renderSaves() {
  const list = document.getElementById('saves-list');
  list.innerHTML = '<div class="saves-empty">Loading…</div>';
  try {
    const { data } = await supabase
      .from('game_saves')
      .select('id, name, created_at, state')
      .eq('session_id', SESSION_ID)
      .order('created_at', { ascending: false })
      .limit(20);

    if (!data || data.length === 0) {
      list.innerHTML = '<div class="saves-empty">No saves yet.</div>';
      return;
    }
    list.innerHTML = '';
    data.forEach(savedGame => {
      const item = document.createElement('div');
      item.className = 'save-item';

      const info = document.createElement('div');
      info.className = 'save-item-info';
      const nm = document.createElement('div');
      nm.className = 'save-item-name';
      nm.textContent = savedGame.name;
      const meta = document.createElement('div');
      meta.className = 'save-item-meta';
      const d = new Date(savedGame.created_at);
      const players = savedGame.state?.players || [];
      const tokens = players.map(p => p.tokens?.length || 0).join(', ');
      meta.textContent = `${d.toLocaleDateString()} ${d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})} — ${players.length} players · tokens [${tokens}]`;
      info.append(nm, meta);

      const btns = document.createElement('div');
      btns.className = 'save-item-btns';

      const restoreBtn = document.createElement('button');
      restoreBtn.className = 'btn-save-action';
      restoreBtn.textContent = '↩ Restore';
      restoreBtn.addEventListener('click', () => {
        if (confirm(`Restore "${savedGame.name}"? Current game will be replaced.`)) {
          state = savedGame.state;
          if (myPlayerIndex !== null && state.players.length > 0 && myPlayerIndex >= state.players.length) {
            clearMyPlayerSlot();
          }
          save();
          closeSaveModal();
          renderCurrentPhase();
        }
      });

      const delBtn = document.createElement('button');
      delBtn.className = 'btn-save-action delete';
      delBtn.textContent = '✕';
      delBtn.addEventListener('click', async () => {
        await supabase.from('game_saves').delete().eq('id', savedGame.id);
        renderSaves();
      });

      btns.append(restoreBtn, delBtn);
      item.append(info, btns);
      list.appendChild(item);
    });
  } catch(e) {
    list.innerHTML = '<div class="saves-empty">Could not load saves.</div>';
  }
}

async function saveCurrentGame(name) {
  const btn = document.getElementById('save-confirm-btn');
  btn.disabled = true;
  btn.textContent = 'Saving…';
  try {
    await supabase.from('game_saves').insert({
      session_id: SESSION_ID,
      name: name || 'Quick Save',
      state: state,
    });
    await renderSaves();
  } catch(e) {
    console.error('Save failed:', e);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save';
  }
}

function wireSaveModal() {
  document.getElementById('save-modal-close').addEventListener('click', closeSaveModal);
  document.getElementById('save-modal-backdrop').addEventListener('click', closeSaveModal);
  document.getElementById('save-confirm-btn').addEventListener('click', () => {
    const name = document.getElementById('save-name-input').value.trim() || 'Quick Save';
    saveCurrentGame(name);
  });
}

// ===== GAME LOG =====

function openLogModal() {
  renderLog();
  document.getElementById('log-modal').classList.remove('hidden');
}

function closeLogModal() {
  document.getElementById('log-modal').classList.add('hidden');
}

function renderLog() {
  const body = document.getElementById('log-body');
  body.innerHTML = '';
  const log = state.turnLog || [];
  if (log.length === 0) {
    body.innerHTML = '<div class="saves-empty">No turns yet.</div>';
    return;
  }

  const OUTCOME_LABELS = {
    animal: '🐾 Token', venue: '✅ Keep', power: '🃏 Keep', fail: '✗ Fail',
  };

  [...log].reverse().forEach(entry => {
    const el = document.createElement('div');
    el.className = 'log-entry';

    const head = document.createElement('div');
    head.className = 'log-entry-head';

    const num = document.createElement('span');
    num.className = 'log-turn-num';
    num.textContent = `T${entry.turnNumber}`;

    const pname = document.createElement('span');
    pname.className = 'log-player-name';
    pname.textContent = entry.playerName || `Player ${entry.playerIndex + 1}`;

    const badge = document.createElement('span');
    if (entry.type === 'cash_pair') {
      badge.className = 'log-outcome-badge cash_pair';
      badge.textContent = '🔁 Cash Pair → Token';
    } else {
      badge.className = `log-outcome-badge ${entry.outcome}`;
      badge.textContent = OUTCOME_LABELS[entry.outcome] || entry.outcome;
    }

    head.append(num, pname, badge);
    el.appendChild(head);

    if (entry.type === 'draw') {
      const venue = VENUES[entry.venue];
      const detail = document.createElement('div');
      detail.className = 'log-entry-detail';
      detail.textContent = `${entry.cardTitle} · ${animalName(entry.cardAnimal)} · ${venue ? venue.icon + ' ' + venue.name : entry.venue}`;
      el.appendChild(detail);
    }

    if (entry.powerCardsPlayed && entry.powerCardsPlayed.length > 0) {
      const powers = document.createElement('div');
      powers.className = 'log-entry-powers';
      powers.textContent = '⚡ ' + entry.powerCardsPlayed.map(p => `${p.title} (${p.playerName})`).join(', ');
      el.appendChild(powers);
    }

    body.appendChild(el);
  });
}

function wireLogModal() {
  document.getElementById('log-modal-close').addEventListener('click', closeLogModal);
  document.getElementById('log-modal-backdrop').addEventListener('click', closeLogModal);
}

// ===== SIMULATION =====

const DEFAULT_SIM_CONFIG = {
  numPlayers: 4,
  simCount: 500,
  familyMode: false,
  successRates: { comedy_lounge: 0.65, the_club: 0.65, royal_show: 0.65, school_play: 0.65 },
  powerPlay: {
    'The Ad-Lib': 0.75, 'Warm-Up Act': 0.5, 'Standing Ovation': 0.6,
    'Prop Master': 0.4, 'Improviser': 0.6, 'Heckler': 0.5,
    'Pie In The Face': 0.35, 'Stage Hook': 0.4, 'Intermission': 0.45,
    'Clap Back': 0.5, 'Mime Time': 0.5, 'Stage Left Stage Right': 0.2, 'Giggle Box': 0.45,
  },
  situational: { offVenue: 1.3, sameVenue: 0.7, leading: 0.75, losing: 1.4, opponentNearWin: 2.5 },
};

let simConfig = JSON.parse(JSON.stringify(DEFAULT_SIM_CONFIG));

function showSimScreen() {
  showPhase('sim');
  renderSimScreen();
}

function renderSimScreen() {
  document.querySelectorAll('#sim-player-count .count-btn').forEach(b =>
    b.classList.toggle('active', parseInt(b.dataset.count) === simConfig.numPlayers));
  document.querySelectorAll('#sim-count-sel .count-btn').forEach(b =>
    b.classList.toggle('active', parseInt(b.dataset.count) === simConfig.simCount));
  document.getElementById('sim-family-mode').checked = simConfig.familyMode;

  const successGrp = document.getElementById('sim-success-sliders');
  if (!successGrp.children.length) {
    [
      { id: 'comedy_lounge', icon: '🎤', name: 'Comedy Lounge' },
      { id: 'the_club',         icon: '🎵', name: 'The Club' },
      { id: 'royal_show',  icon: '🎪', name: 'Royal Show' },
      { id: 'school_play', icon: '🎭', name: 'School Play' },
    ].forEach(v => successGrp.appendChild(buildSliderRow(
      `succ-${v.id}`, `${v.icon} ${v.name}`, 0, 100, 5,
      Math.round(simConfig.successRates[v.id] * 100),
      val => { simConfig.successRates[v.id] = val / 100; }, '%'
    )));
  }

  const powerGrp = document.getElementById('sim-power-sliders');
  if (!powerGrp.children.length) {
    [
      'The Ad-Lib','Warm-Up Act','Standing Ovation','Prop Master','Improviser',
      'Heckler','Pie In The Face','Stage Hook','Intermission','Clap Back',
      'Mime Time','Stage Left Stage Right','Giggle Box',
    ].forEach(title => powerGrp.appendChild(buildSliderRow(
      `power-${title}`, title, 0, 100, 5,
      Math.round((simConfig.powerPlay[title] || 0) * 100),
      val => { simConfig.powerPlay[title] = val / 100; }, '%'
    )));
  }

  const sitGrp = document.getElementById('sim-sit-sliders');
  if (!sitGrp.children.length) {
    [
      { id: 'offVenue',        label: 'Off-venue draw' },
      { id: 'sameVenue',       label: 'Same-venue draw' },
      { id: 'leading',         label: 'When leading' },
      { id: 'losing',          label: 'When losing' },
      { id: 'opponentNearWin', label: 'Opponent near win' },
    ].forEach(s => {
      const initVal = Math.round(simConfig.situational[s.id] * 10);
      sitGrp.appendChild(buildSliderRow(
        `sit-${s.id}`, s.label, 0, 50, 1, initVal,
        val => { simConfig.situational[s.id] = val / 10; },
        '×', v => (v / 10).toFixed(1) + '×'
      ));
    });
  }
}

function buildSliderRow(id, label, min, max, step, initVal, onChange, unit, displayFn) {
  const row = document.createElement('div');
  row.className = 'sim-slider-row';

  const lbl = document.createElement('label');
  lbl.className = 'sim-slider-label';
  lbl.htmlFor = id;
  lbl.textContent = label;

  const valEl = document.createElement('span');
  valEl.className = 'sim-slider-val';
  valEl.textContent = displayFn ? displayFn(initVal) : (initVal + unit);

  const input = document.createElement('input');
  input.type = 'range';
  input.id = id;
  input.min = min;
  input.max = max;
  input.step = step;
  input.value = initVal;
  input.className = 'sim-range';
  input.addEventListener('input', () => {
    const v = parseInt(input.value);
    valEl.textContent = displayFn ? displayFn(v) : (v + unit);
    onChange(v);
  });

  row.append(lbl, valEl, input);
  return row;
}

function runSimAndShow() {
  const btn = document.getElementById('sim-run-btn');
  btn.disabled = true;
  btn.textContent = 'Running…';
  setTimeout(() => {
    try {
      const results = simRun(simConfig);
      renderSimResults(results);
      document.getElementById('sim-results').classList.remove('hidden');
      document.getElementById('sim-results').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } finally {
      btn.disabled = false;
      btn.textContent = '🎲 Run Simulation';
    }
  }, 20);
}

function renderSimResults(results) {
  const el = document.getElementById('sim-results');
  el.innerHTML = '';

  const { simCount, wins, turnCounts, totalTokenSources, totalPowerPlayed } = results;
  const sorted = turnCounts.slice().sort((a, b) => a - b);
  const avg = sorted.reduce((s, n) => s + n, 0) / sorted.length;
  const median = sorted[Math.floor(sorted.length / 2)];

  function section(labelText) {
    const s = document.createElement('div');
    s.className = 'sim-section';
    if (labelText) {
      const h = document.createElement('div');
      h.className = 'form-label';
      h.textContent = labelText;
      s.appendChild(h);
    }
    el.appendChild(s);
    return s;
  }

  function statRow(label, val, parent) {
    const r = document.createElement('div');
    r.className = 'sim-stat-row';
    r.innerHTML = `<span>${escapeHtml(label)}</span><span class="sim-stat-val">${escapeHtml(String(val))}</span>`;
    parent.appendChild(r);
  }

  function barRow(label, pct, parent) {
    const r = document.createElement('div');
    r.className = 'sim-bar-row';
    r.innerHTML = `<span class="sim-bar-label">${escapeHtml(label)}</span><div class="sim-bar-track"><div class="sim-bar-fill" style="width:${pct}%"></div></div><span class="sim-bar-pct">${pct}%</span>`;
    parent.appendChild(r);
  }

  const s1 = section(`Results — ${simCount.toLocaleString()} games`);
  statRow('Average turns to win', avg.toFixed(1), s1);
  statRow('Median turns', String(median), s1);
  statRow('Range', `${sorted[0]} – ${sorted[sorted.length - 1]}`, s1);

  const s2 = section('Win Rates by Position');
  wins.forEach((count, i) => {
    const pct = ((count / simCount) * 100).toFixed(1);
    const ch = CHARACTERS[i % CHARACTERS.length];
    barRow(ch.name, pct, s2);
  });

  const totalTokens = Object.values(totalTokenSources).reduce((s, n) => s + n, 0) || 1;
  const TOKEN_LABELS = {
    animal: '🐾 Animal affinity', venuePair: '✅ Venue pair',
    improviser: '⚡ Improviser', propMaster: '🎭 Prop Master',
  };
  const s3 = section('Token Sources');
  Object.entries(totalTokenSources).sort((a, b) => b[1] - a[1]).forEach(([key, count]) => {
    const pct = ((count / totalTokens) * 100).toFixed(1);
    barRow(TOKEN_LABELS[key] || key, pct, s3);
  });

  const s4 = section('Power Cards Played (per game avg)');
  Object.entries(totalPowerPlayed).sort((a, b) => b[1] - a[1]).forEach(([title, count]) => {
    statRow(title, (count / simCount).toFixed(2) + '×', s4);
  });
}

function wireSimScreen() {
  document.getElementById('sim-back-btn').addEventListener('click', () => {
    showPhase('setup');
    renderSetup();
  });
  document.getElementById('sim-player-count').addEventListener('click', e => {
    const btn = e.target.closest('.count-btn');
    if (!btn) return;
    simConfig.numPlayers = parseInt(btn.dataset.count);
    document.querySelectorAll('#sim-player-count .count-btn').forEach(b =>
      b.classList.toggle('active', parseInt(b.dataset.count) === simConfig.numPlayers));
  });
  document.getElementById('sim-count-sel').addEventListener('click', e => {
    const btn = e.target.closest('.count-btn');
    if (!btn) return;
    simConfig.simCount = parseInt(btn.dataset.count);
    document.querySelectorAll('#sim-count-sel .count-btn').forEach(b =>
      b.classList.toggle('active', parseInt(b.dataset.count) === simConfig.simCount));
  });
  document.getElementById('sim-family-mode').addEventListener('change', e => {
    simConfig.familyMode = e.target.checked;
  });
  document.getElementById('sim-run-btn').addEventListener('click', runSimAndShow);
}

// ===== SIMULATION ENGINE =====

function simBuildDeck(familyMode) {
  let pool = cards.map(c => c.number);
  if (familyMode) pool = pool.filter(n => !FAMILY_REMOVED_TITLES.includes(cardByNumber(n).title));
  return shuffle(pool);
}

function simEnsureDeck(deck, discard) {
  if (deck.length === 0) {
    const refill = shuffle(discard.splice(0));
    deck.push(...refill);
  }
}

function simCardValue(card, player) {
  if (!card) return 0;
  if (card.animal === player.character) return 3;
  if (card.venue === player.venue) return 2;
  return 1;
}

function simGetSituation(players, idx, drawnVenue) {
  const player = players[idx];
  const toks = players.map(p => p.tokens);
  const maxT = Math.max(...toks);
  const minT = Math.min(...toks);
  return {
    isLeading: player.tokens === maxT && maxT > minT,
    isLosing:  player.tokens === minT && maxT > minT,
    opponentNearWin: players.some((p, i) => i !== idx && p.tokens >= tokenGoal(players.length) - 1),
    offVenue:  drawnVenue ? drawnVenue !== player.venue : false,
    sameVenue: drawnVenue ? drawnVenue === player.venue : false,
  };
}

function simShouldPlay(title, cfg, sit, isYourTurn) {
  let p = cfg.powerPlay[title] ?? 0;
  if (p <= 0) return false;
  if (isYourTurn) {
    if (sit.offVenue)  p *= cfg.situational.offVenue;
    if (sit.sameVenue) p *= cfg.situational.sameVenue;
  }
  if (sit.isLeading)       p *= cfg.situational.leading;
  if (sit.isLosing)        p *= cfg.situational.losing;
  if (sit.opponentNearWin) p *= cfg.situational.opponentNearWin;
  return Math.random() < Math.min(1, p);
}

function simRemoveCard(hand, title) {
  const idx = hand.findIndex(n => { const c = cardByNumber(n); return c && c.title === title; });
  if (idx === -1) return null;
  return hand.splice(idx, 1)[0];
}

function simHasCard(hand, title) {
  return hand.some(n => { const c = cardByNumber(n); return c && c.title === title; });
}

// Mirrors awardToken() — the simulated Pool is finite, so an 8-player table
// can exhaust it exactly as the physical game would (§1.9).
function simAwardToken(player, source, tokenSources, pool) {
  if (pool && pool.count <= 0) {
    tokenSources.poolEmpty = (tokenSources.poolEmpty || 0) + 1;
    return false;
  }
  if (pool) pool.count--;
  player.tokens++;
  tokenSources[source] = (tokenSources[source] || 0) + 1;
  return true;
}

function simPerformTurn(cardNum, player, players, deck, discard, cfg, tokenSources, powerPlayed, pool, depth) {
  if ((depth || 0) > 2) { discard.push(cardNum); return; }

  const card = cardByNumber(cardNum);
  if (!card) return;

  function track(title) { powerPlayed[title] = (powerPlayed[title] || 0) + 1; }

  // MIME TIME / GIGGLE BOX → silence → auto-fail
  let silenced = false;
  outer: for (const opp of players) {
    if (opp.idx === player.idx) continue;
    for (const title of ['Mime Time', 'Giggle Box']) {
      if (simHasCard(opp.hand, title) &&
          simShouldPlay(title, cfg, simGetSituation(players, opp.idx, null), false)) {
        const c = simRemoveCard(opp.hand, title);
        if (c) discard.push(c);
        track(title);
        silenced = true;
        break outer;
      }
    }
  }

  let success = !silenced && Math.random() < (cfg.successRates[card.venue] || 0.65);

  if (!success) {
    // THE AD-LIB: retry once on fail
    if (!silenced && simHasCard(player.hand, 'The Ad-Lib')) {
      const sit = simGetSituation(players, player.idx, card.venue);
      if (simShouldPlay('The Ad-Lib', cfg, sit, true)) {
        const ac = simRemoveCard(player.hand, 'The Ad-Lib');
        if (ac) discard.push(ac);
        discard.push(cardNum);
        track('The Ad-Lib');
        simEnsureDeck(deck, discard);
        if (deck.length > 0) simPerformTurn(deck.pop(), player, players, deck, discard, cfg, tokenSources, powerPlayed, pool, (depth || 0) + 1);
        return;
      }
    }
    discard.push(cardNum);
    return;
  }

  // HECKLER: force re-perform
  for (const opp of players) {
    if (opp.idx === player.idx) continue;
    if (simHasCard(opp.hand, 'Heckler') &&
        simShouldPlay('Heckler', cfg, simGetSituation(players, opp.idx, null), false)) {
      let countered = false;
      for (const ct of ['Standing Ovation', 'Clap Back']) {
        if (simHasCard(player.hand, ct) && Math.random() < (cfg.powerPlay[ct] || 0)) {
          const cc = simRemoveCard(player.hand, ct);
          if (cc) discard.push(cc);
          track(ct);
          countered = true;
          break;
        }
      }
      if (!countered) {
        const hc = simRemoveCard(opp.hand, 'Heckler');
        if (hc) discard.push(hc);
        track('Heckler');
        success = Math.random() < (cfg.successRates[card.venue] || 0.65);
      }
      break;
    }
  }

  if (!success) { discard.push(cardNum); return; }

  // OUTCOME
  let outcome = card.animal === player.character ? 'animal' : (card.venue === player.venue ? 'venue' : 'power');

  if (outcome === 'animal') {
    simAwardToken(player, 'animal', tokenSources, pool);
    discard.push(cardNum);
  } else if (outcome === 'venue') {
    // IMPROVISER: convert venue match to token
    if (simHasCard(player.hand, 'Improviser')) {
      const sit = simGetSituation(players, player.idx, card.venue);
      if (simShouldPlay('Improviser', cfg, sit, true)) {
        const ic = simRemoveCard(player.hand, 'Improviser');
        if (ic) discard.push(ic);
        track('Improviser');
        simAwardToken(player, 'improviser', tokenSources, pool);
        discard.push(cardNum);
        return;
      }
    }
    player.hand.push(cardNum);
    // Cash pair check
    const matches = player.hand.filter(n => { const c = cardByNumber(n); return c && c.venue === player.venue; });
    // §1.2 — an empty Pool blocks every token route. Don't burn the pair.
    if (matches.length >= 2 && (!pool || pool.count > 0)) {
      matches.slice(0, 2).forEach(n => {
        const i = player.hand.indexOf(n);
        if (i !== -1) player.hand.splice(i, 1);
        discard.push(n);
      });
      simAwardToken(player, 'venuePair', tokenSources, pool);
    }
  } else {
    player.hand.push(cardNum);
  }
}

function simRunGame(cfg) {
  const numP = Math.min(cfg.numPlayers, CHARACTERS.length);
  const players = CHARACTERS.slice(0, numP).map((ch, i) => ({
    idx: i, character: ch.id, venue: ch.venue, tokens: 0, hand: [],
  }));
  const deck = simBuildDeck(cfg.familyMode);
  const discard = [];
  const tokenSources = {};
  const powerPlayed = {};
  // §1.9 — finite Pool. At 8 players an 8-token Pool can plausibly empty.
  const pool = { count: RULES_CONFIG.tokensInPool };
  let current = 0;

  function track(t) { powerPlayed[t] = (powerPlayed[t] || 0) + 1; }

  for (let turn = 0; turn < 600; turn++) {
    const player = players[current];
    const sit0 = simGetSituation(players, current, null);

    // INTERMISSION
    let skipped = false;
    for (const opp of players) {
      if (opp.idx === current) continue;
      if (simHasCard(opp.hand, 'Intermission') &&
          simShouldPlay('Intermission', cfg, simGetSituation(players, opp.idx, null), false)) {
        const ic = simRemoveCard(opp.hand, 'Intermission');
        if (ic) discard.push(ic);
        track('Intermission');
        skipped = true;
        break;
      }
    }

    if (!skipped) {
      // PROP MASTER
      let propMastered = false;
      if (simHasCard(player.hand, 'Prop Master') && simShouldPlay('Prop Master', cfg, sit0, true)) {
        const pc = simRemoveCard(player.hand, 'Prop Master');
        if (pc) discard.push(pc);
        track('Prop Master');
        simAwardToken(player, 'propMaster', tokenSources, pool);
        propMastered = true;
      }

      if (!propMastered) {
        // WARM-UP ACT
        let usedWarmUp = false;
        if (simHasCard(player.hand, 'Warm-Up Act') && simShouldPlay('Warm-Up Act', cfg, sit0, true)) {
          const wc = simRemoveCard(player.hand, 'Warm-Up Act');
          if (wc) discard.push(wc);
          track('Warm-Up Act');
          simEnsureDeck(deck, discard);
          const c1 = deck.length > 0 ? deck.pop() : null;
          simEnsureDeck(deck, discard);
          const c2 = deck.length > 0 ? deck.pop() : null;
          if (c1 && c2) {
            const v1 = simCardValue(cardByNumber(c1), player);
            const v2 = simCardValue(cardByNumber(c2), player);
            const [kept, ret] = v1 >= v2 ? [c1, c2] : [c2, c1];
            deck.unshift(ret);
            simPerformTurn(kept, player, players, deck, discard, cfg, tokenSources, powerPlayed, pool, 0);
          } else if (c1) {
            simPerformTurn(c1, player, players, deck, discard, cfg, tokenSources, powerPlayed, pool, 0);
          }
          usedWarmUp = true;
        }

        if (!usedWarmUp) {
          simEnsureDeck(deck, discard);
          if (deck.length === 0) break;
          simPerformTurn(deck.pop(), player, players, deck, discard, cfg, tokenSources, powerPlayed, pool, 0);
        }
      }

      // POST-TURN: Stage Hook
      if (simHasCard(player.hand, 'Stage Hook') &&
          simShouldPlay('Stage Hook', cfg, simGetSituation(players, current, null), true)) {
        const target = players.filter(p => p.idx !== current && p.hand.length > 0)
          .sort((a, b) => b.tokens - a.tokens)[0];
        if (target) {
          const sc = simRemoveCard(player.hand, 'Stage Hook');
          if (sc) discard.push(sc);
          track('Stage Hook');
          let bestV = -1, bestI = -1;
          target.hand.forEach((n, i) => { const v = simCardValue(cardByNumber(n), target); if (v > bestV) { bestV = v; bestI = i; } });
          if (bestI !== -1) discard.push(target.hand.splice(bestI, 1)[0]);
        }
      }

      // POST-TURN: Pie In The Face
      if (simHasCard(player.hand, 'Pie In The Face') &&
          simShouldPlay('Pie In The Face', cfg, simGetSituation(players, current, null), true)) {
        const target = players.filter(p => p.idx !== current && p.hand.length > 0)
          .sort((a, b) => b.tokens - a.tokens)[0];
        if (target) {
          const pc = simRemoveCard(player.hand, 'Pie In The Face');
          if (pc) discard.push(pc);
          track('Pie In The Face');
          let bestV = -1, bestI = -1;
          target.hand.forEach((n, i) => { const v = simCardValue(cardByNumber(n), player); if (v > bestV) { bestV = v; bestI = i; } });
          if (bestI !== -1) player.hand.push(target.hand.splice(bestI, 1)[0]);
        }
      }

      // POST-TURN: Stage Left Stage Right
      if (simHasCard(player.hand, 'Stage Left Stage Right') &&
          simShouldPlay('Stage Left Stage Right', cfg, simGetSituation(players, current, null), true)) {
        const slc = simRemoveCard(player.hand, 'Stage Left Stage Right');
        if (slc) discard.push(slc);
        track('Stage Left Stage Right');
        // Each player passes their least-valuable card to the left
        const passed = players.map(p => {
          if (p.hand.length === 0) return null;
          let worstV = Infinity, worstI = -1;
          p.hand.forEach((n, i) => { const v = simCardValue(cardByNumber(n), p); if (v < worstV) { worstV = v; worstI = i; } });
          return worstI !== -1 ? p.hand.splice(worstI, 1)[0] : null;
        });
        players.forEach((p, i) => { const r = passed[(i - 1 + players.length) % players.length]; if (r != null) p.hand.push(r); });
      }
    }

    if (player.tokens >= tokenGoal(numP)) {
      return { winner: current, turns: turn + 1, tokenSources, powerPlayed };
    }
    current = (current + 1) % numP;
  }

  // Safety fallback
  const best = players.reduce((a, b) => b.tokens > a.tokens ? b : a, players[0]);
  return { winner: best.idx, turns: 600, tokenSources, powerPlayed };
}

function simRun(cfg) {
  const results = {
    simCount: cfg.simCount,
    wins: new Array(cfg.numPlayers).fill(0),
    turnCounts: [],
    totalTokenSources: {},
    totalPowerPlayed: {},
  };
  for (let i = 0; i < cfg.simCount; i++) {
    const game = simRunGame(cfg);
    if (game.winner >= 0 && game.winner < cfg.numPlayers) results.wins[game.winner]++;
    results.turnCounts.push(game.turns);
    Object.entries(game.tokenSources).forEach(([k, v]) => {
      results.totalTokenSources[k] = (results.totalTokenSources[k] || 0) + v;
    });
    Object.entries(game.powerPlayed).forEach(([k, v]) => {
      results.totalPowerPlayed[k] = (results.totalPowerPlayed[k] || 0) + v;
    });
  }
  return results;
}

// ===== INIT =====

// OPEN-5 / OPEN-7 — push the two renameable terms into the DOM so a change to
// GAME_TITLE or PERSONAL_CARD_LABEL propagates everywhere.
function applyNamingConstants() {
  document.querySelectorAll('[data-game-title]').forEach(el => {
    el.textContent = GAME_TITLE;
  });
  const titleEl = document.querySelector('title[data-game-title-suffix]');
  if (titleEl) titleEl.textContent = GAME_TITLE + titleEl.dataset.gameTitleSuffix;
  document.querySelectorAll('[data-personal-card-label]').forEach(el => {
    el.textContent = PERSONAL_CARD_LABEL;
  });
  document.querySelectorAll('[data-personal-card-label-plural]').forEach(el => {
    el.textContent = PERSONAL_CARD_LABEL_PLURAL;
  });
}

async function init() {
  loadMyPlayerIndex();
  applyNamingConstants();

  wireSetup();
  wireTurn();
  wireDraw();
  wireVerdict();
  wireWin();
  wirePossessions();
  wireCardSheet();
  wireJoin();
  wireSpectate();
  wireGameMenu();
  wireTutorial();
  wireSaveModal();
  wireLogModal();
  wireSimScreen();

  await load();
  subscribeRealtime();
  renderCurrentPhase();
}

init();
