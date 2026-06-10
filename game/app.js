import { prompts } from './data/prompts.js';
import { cards, cardByNumber, FAMILY_REMOVED_TITLES } from './data/cards.js';
import { supabase, SESSION_ID } from './supabase.js';

// ===== CONSTANTS =====

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

const CHARACTERS = [
  {id:'kookaburra', name:'Kookaburra', archetype:'The Heckled Stand-up',      venue:'comedy_club', img:'1'},
  {id:'cockatoo',   name:'Cockatoo',   archetype:'The Bitter Satirist',        venue:'comedy_club', img:'2'},
  {id:'quokka',     name:'Quokka',     archetype:'The Sweaty Warm-up Act',     venue:'rsl',         img:'3'},
  {id:'magpie',     name:'Magpie',     archetype:'The Tragic Songbird',        venue:'rsl',         img:'4'},
  {id:'emu',        name:'Emu',        archetype:'The Chaotic Prop Comic',     venue:'royal_show',  img:'5'},
  {id:'galah',      name:'Galah',      archetype:'The Drunken Clown',          venue:'royal_show',  img:'6'},
  {id:'echidna',    name:'Echidna',    archetype:'The Pretentious Improviser', venue:'school_play', img:'7'},
  {id:'platypus',   name:'Platypus',   archetype:'The Deadpan Magician',       venue:'school_play', img:'8'},
];

const VENUES = {
  comedy_club: {name:'The Comedy Club', icon:'🎤', cssClass:'comedy',     act:'Tell jokes'},
  rsl:         {name:'The RSL',         icon:'🎵', cssClass:'rsl',         act:'Sing or rhyme'},
  royal_show:  {name:'The Royal Show',  icon:'🎪', cssClass:'royal_show',  act:'Clown around'},
  school_play: {name:'The School Play', icon:'🎭', cssClass:'school_play', act:'Act'},
};

const SUCCESS_DISPLAY = {
  vote:        {icon:'🗳️', label:'Majority vote'},
  objective:   {icon:'✅', label:'Objective — the table can see it'},
  named_judge: {icon:'👤', label:'Judge — player to your left decides'},
};

const TOKEN_GOAL = 3;

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
    nextTokenIndex: 0,
    familyMode: false,
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
    if (data?.state) { state = data.state; return; }
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

function awardToken(player) {
  const idx = (state.nextTokenIndex || 0) % PROP_TOKENS.length;
  state.nextTokenIndex = idx + 1;
  player.tokens.push({ ...PROP_TOKENS[idx] });
}

function hasWon(player) {
  return player.tokens.length >= TOKEN_GOAL;
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
  ['setup','turn','draw','verdict','win','join','spectate'].forEach(p => {
    document.getElementById(`${p}-screen`).classList.toggle('hidden', phase !== p);
  });
}

// Central routing: always call this after state changes (locally or from realtime)
function renderCurrentPhase() {
  // Guard: if player slot is stale (player count changed), clear it
  if (myPlayerIndex !== null && state.players.length > 0 && myPlayerIndex >= state.players.length) {
    clearMyPlayerSlot();
  }

  if (state.phase === 'win') {
    const winner = state.players.find(p => p.tokens.length >= TOKEN_GOAL);
    if (winner) {
      document.getElementById('win-message').textContent =
        `${winner.name || `Player ${state.players.indexOf(winner) + 1}`} collected ${TOKEN_GOAL} Prop Tokens and wins.`;
    }
    showPhase('win');
    return;
  }

  if (state.phase === 'setup') {
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
  state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
}

// ===== RENDER: SETUP =====

function renderSetup() {
  document.querySelectorAll('.count-btn').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.count) === state.numPlayers);
  });
  document.getElementById('setup-family-mode').checked = state.familyMode;

  const container = document.getElementById('player-rows');
  container.innerHTML = '';

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
      opt.textContent = `${c.name} — ${VENUES[c.venue].icon}`;
      if (existing.character === c.id) opt.selected = true;
      charSelect.appendChild(opt);
    });
    if (!existing.character) {
      const usedChars = state.players.slice(0, i).map(p => p && p.character);
      const unused = CHARACTERS.find(c => !usedChars.includes(c.id));
      if (unused) charSelect.value = unused.id;
    }

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
      return c ? `url('assets/characters/${c.img}.jpg')` : '';
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

function renderJoin() {
  const list = document.getElementById('join-player-list');
  list.innerHTML = '';

  state.players.forEach((player, idx) => {
    const ch = getCharacter(player);
    const venue = VENUES[ch.venue];

    const card = document.createElement('button');
    card.className = 'join-player-card';

    const img = document.createElement('div');
    img.className = 'join-char-img';
    img.style.backgroundImage = `url('assets/characters/${ch.img}.jpg')`;

    const info = document.createElement('div');
    info.className = 'join-player-info';

    const name = document.createElement('div');
    name.className = 'join-player-name';
    name.textContent = player.name || `Player ${idx + 1}`;

    const meta = document.createElement('div');
    meta.className = 'join-player-meta';
    meta.textContent = `${ch.name} · ${venue.icon} ${venue.name}`;

    const stats = document.createElement('div');
    stats.className = 'join-player-stats';
    stats.textContent = `🪙 ${player.tokens.length} token${player.tokens.length !== 1 ? 's' : ''} · ${player.hand.length} card${player.hand.length !== 1 ? 's' : ''}`;

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
    `url('assets/characters/${ch.img}.jpg')`;
  document.getElementById('spectate-active-name').textContent =
    activePlayer.name || `Player ${state.currentPlayerIndex + 1}`;
  document.getElementById('spectate-active-meta').textContent =
    `${ch.name} · ${venue.icon} ${venue.name}`;

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
      `url('assets/venues/${state.drawnCard}.jpg')`;
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
    label.textContent = `🪙 ${me.tokens.length} / ${TOKEN_GOAL}`;
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
}

// ===== RENDER: TURN =====

function renderTurn() {
  const player = state.players[state.currentPlayerIndex];
  if (!player) return;
  const ch = getCharacter(player);
  const venue = VENUES[ch.venue];

  document.getElementById('turn-player-name').textContent = player.name || `Player ${state.currentPlayerIndex + 1}`;
  document.getElementById('turn-player-character').textContent = ch.name;
  document.getElementById('turn-player-venue').textContent = `${venue.icon} ${venue.name}`;
  document.getElementById('turn-family-mode').checked = state.familyMode;

  const charCard = document.getElementById('turn-char-card');
  charCard.style.backgroundImage = `url('assets/characters/${ch.img}.jpg')`;

  const bar = document.getElementById('turn-token-bar');
  bar.innerHTML = '';
  const label = document.createElement('div');
  label.className = 'token-bar-label';
  label.textContent = `🪙 ${player.tokens.length} / ${TOKEN_GOAL}`;
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
  el.style.backgroundImage = `url('assets/venues/${cardNumber}.jpg')`;
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

  document.getElementById('drawn-card').style.backgroundImage = `url('assets/venues/${card.number}.jpg')`;
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
  document.getElementById('verdict-card').style.backgroundImage = `url('assets/venues/${card.number}.jpg')`;
  document.getElementById('verdict-override').classList.add('hidden');
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
      <div class="poss-meta">${ch.name} · ${venue.icon} ${venue.name}</div>`;
    section.appendChild(head);

    const tokRow = document.createElement('div');
    tokRow.className = 'poss-tokens';
    const tokLabel = document.createElement('div');
    tokLabel.className = 'poss-subtitle';
    tokLabel.textContent = `Prop Tokens (${player.tokens.length}/${TOKEN_GOAL})`;
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
    handLabel.textContent = `Performance Cards (${player.hand.length})`;
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
        card.style.backgroundImage = `url('assets/venues/${n}.jpg')`;
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
  document.getElementById('card-sheet-img').style.backgroundImage = `url('assets/venues/${cardNumber}.jpg')`;
  document.getElementById('card-sheet-animal').textContent = animalName(card.animal);
  document.getElementById('card-sheet-power').textContent = card.power_text;

  const typeEl = document.getElementById('card-sheet-type');
  const interrupt = card.timing.startsWith('interrupt');
  typeEl.className = 'sheet-type ' + (interrupt ? 'interrupt' : 'your_turn');
  typeEl.textContent = (interrupt ? '🛡️ ' : '⚡ ') + card.timing_label;

  const noteEl = document.getElementById('card-sheet-timing-note');
  if (card.title === 'Intermission' && state.drawnCard != null) {
    noteEl.textContent = '⚠️ Current player has already drawn — cannot be played this turn.';
    noteEl.classList.remove('hidden');
  } else {
    noteEl.textContent = '';
    noteEl.classList.add('hidden');
  }

  const aff = document.getElementById('card-sheet-affinity');
  aff.textContent = card.affinity_text || '';
  aff.classList.toggle('hidden', !card.affinity_text);

  const actions = document.getElementById('card-sheet-actions');
  actions.innerHTML = '';
  const useBtn = document.createElement('button');
  useBtn.className = 'btn-primary';
  useBtn.textContent = '🎭 Play Power & Discard';
  useBtn.addEventListener('click', () => discardFromHand(sheetContext.playerIndex, cardNumber));
  actions.appendChild(useBtn);

  document.getElementById('card-sheet').classList.remove('hidden');
}

function closeCardSheet() {
  document.getElementById('card-sheet').classList.add('hidden');
  sheetContext = null;
}

function discardFromHand(playerIndex, cardNumber) {
  const player = state.players[playerIndex];
  const i = player.hand.indexOf(cardNumber);
  if (i !== -1) {
    player.hand.splice(i, 1);
    state.discard.push(cardNumber);
  }
  closeCardSheet();
  save();
  renderCurrentPhase();
  if (!document.getElementById('possessions-overlay').classList.contains('hidden')) renderPossessions();
}

// ===== ACTIONS =====

function doDraw() {
  ensureDeck();
  if (state.deck.length === 0) return;
  state.drawnCard = state.deck.pop();
  goToDraw();
}

function doFail() {
  if (state.drawnCard != null) state.discard.push(state.drawnCard);
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
    awardToken(player);
    state.discard.push(card.number);
  } else {
    player.hand.push(card.number);
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
  const toDiscard = matches.slice(0, 2);
  toDiscard.forEach(n => {
    const i = player.hand.indexOf(n);
    if (i !== -1) player.hand.splice(i, 1);
    state.discard.push(n);
  });
  awardToken(player);
  if (hasWon(player)) { save(); goToWin(state.currentPlayerIndex); return; }
  save();
  renderCurrentPhase();
}

function adjustToken(playerIndex, delta) {
  const player = state.players[playerIndex];
  if (delta > 0) {
    awardToken(player);
    if (hasWon(player)) {
      save();
      document.getElementById('possessions-overlay').classList.add('hidden');
      goToWin(playerIndex);
      return;
    }
  } else if (player.tokens.length > 0) {
    player.tokens.pop();
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
        used: {comedy_club:[], rsl:[], royal_show:[], school_play:[]},
      });
    }
    state.players = players;
    state.currentPlayerIndex = 0;
    state.deck = buildDeck(state.familyMode);
    state.discard = [];
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
      ...p, tokens: [], hand: [], used: {comedy_club:[], rsl:[], royal_show:[], school_play:[]},
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
  // Join player cards are rendered dynamically in renderJoin(); no static wiring needed.
}

function wireSpectate() {
  document.getElementById('spectate-allplayers-btn').addEventListener('click', openPossessions);
}

// ===== INIT =====

async function init() {
  loadMyPlayerIndex();

  wireSetup();
  wireTurn();
  wireDraw();
  wireVerdict();
  wireWin();
  wirePossessions();
  wireCardSheet();
  wireJoin();
  wireSpectate();

  await load();
  subscribeRealtime();
  renderCurrentPhase();
}

init();
