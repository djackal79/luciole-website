import { prompts } from './data/prompts.js';
import { cards, cardByNumber, FAMILY_REMOVED_TITLES } from './data/cards.js';

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
let timerInterval = null;
let timerRemaining = 0;
let timerRunning = false;

function defaultState() {
  return {
    phase: 'setup',
    numPlayers: 5,
    players: [],
    currentPlayerIndex: 0,
    deck: [],
    discard: [],
    drawnCard: null,        // card number currently in play this turn
    drawnPromptPos: null,   // position of the prompt being performed
    pendingOutcome: null,   // 'animal' | 'venue' | 'power'
    nextTokenIndex: 0,
    familyMode: false,
  };
}

function save() {
  try { localStorage.setItem('pao_v2', JSON.stringify(state)); } catch(e) {}
}

function load() {
  try {
    const raw = localStorage.getItem('pao_v2');
    if (raw) { state = JSON.parse(raw); return; }
  } catch(e) {}
  state = defaultState();
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
    // Reshuffle the discard pile into a fresh deck.
    state.deck = shuffle(state.discard);
    state.discard = [];
  }
}

// Prompt Card helpers (the player's personal script)
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

  // Token bar — progress toward 3
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

  // Hand grid
  const grid = document.getElementById('turn-hand-grid');
  grid.innerHTML = '';
  player.hand.forEach(n => grid.appendChild(buildHandCard(n)));
  document.getElementById('turn-hand-empty').classList.toggle('hidden', player.hand.length > 0);

  // Cash a pair availability
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

  // The prompt the performer must do (next unused on their card for this venue)
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

function animalName(id) {
  const c = CHARACTERS.find(x => x.id === id);
  return c ? c.name : id.charAt(0).toUpperCase() + id.slice(1);
}

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

    // Tokens row with +/- controls
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

    // Hand
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

let sheetContext = null; // {cardNumber, source:'hand'|'poss', playerIndex}

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
  renderTurn();
  if (!document.getElementById('possessions-overlay').classList.contains('hidden')) renderPossessions();
}

// ===== NAVIGATION =====

function showPhase(phase) {
  ['setup','turn','draw','verdict','win'].forEach(p => {
    document.getElementById(`${p}-screen`).classList.toggle('hidden', phase !== p);
  });
}

function goToSetup() {
  stopTimer();
  state.phase = 'setup';
  showPhase('setup');
  renderSetup();
  save();
}

function goToTurn() {
  stopTimer();
  state.phase = 'turn';
  state.drawnCard = null;
  state.drawnPromptPos = null;
  state.pendingOutcome = null;
  showPhase('turn');
  renderTurn();
  save();
}

function goToDraw() {
  state.phase = 'draw';
  showPhase('draw');
  renderDraw();
  save();
}

function goToVerdict() {
  stopTimer();
  state.phase = 'verdict';
  showPhase('verdict');
  renderVerdict();
  save();
}

function goToWin(winnerIndex) {
  stopTimer();
  state.phase = 'win';
  const p = state.players[winnerIndex];
  document.getElementById('win-message').textContent =
    `${p.name || `Player ${winnerIndex + 1}`} collected ${TOKEN_GOAL} Prop Tokens and wins.`;
  showPhase('win');
  save();
}

function advancePlayer() {
  state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
}

// ===== ACTIONS =====

function doDraw() {
  ensureDeck();
  if (state.deck.length === 0) return; // nothing to draw (shouldn't happen)
  state.drawnCard = state.deck.pop();
  goToDraw();
}

function doFail() {
  // Card goes to discard, turn ends.
  if (state.drawnCard != null) state.discard.push(state.drawnCard);
  stopTimer();
  advancePlayer();
  goToTurn();
}

function doSuccess() {
  const player = state.players[state.currentPlayerIndex];
  const card = cardByNumber(state.drawnCard);
  const ch = getCharacter(player);

  // Mark the performed prompt as used
  if (state.drawnPromptPos != null) markPromptUsed(player, card.venue, state.drawnPromptPos);

  // Resolve reward in order: Animal Affinity → Venue Match → No Match.
  // A character's animal is its id (e.g. 'kookaburra').
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
    state.discard.push(card.number); // cashed for a token, card leaves play
  } else {
    // venue or power: keep the card face-up in hand
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
  // Discard the two oldest venue-matching cards, gain a token.
  const toDiscard = matches.slice(0, 2);
  toDiscard.forEach(n => {
    const i = player.hand.indexOf(n);
    if (i !== -1) player.hand.splice(i, 1);
    state.discard.push(n);
  });
  awardToken(player);
  save();
  if (hasWon(player)) { goToWin(state.currentPlayerIndex); return; }
  renderTurn();
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
  if (state.phase === 'turn') renderTurn();
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
  if (state.phase === 'turn') renderTurn();
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
    goToTurn();
  });
}

function wireTurn() {
  document.getElementById('draw-btn').addEventListener('click', doDraw);
  document.getElementById('cash-pair-btn').addEventListener('click', doCashPair);
  document.getElementById('turn-allplayers-btn').addEventListener('click', openPossessions);

  document.getElementById('turn-family-mode').addEventListener('change', e => {
    state.familyMode = e.target.checked;
    renderTurn();
    save();
  });

  document.getElementById('reset-btn').addEventListener('click', () => {
    if (confirm('Reset the whole game? This clears all hands, tokens and progress.')) {
      state = defaultState();
      save();
      goToSetup();
    }
  });
}

function wireDraw() {
  document.getElementById('draw-back-btn').addEventListener('click', () => {
    // Cancel the draw — put card back on top of the deck, return to turn.
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
    save();
    goToSetup();
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

// ===== INIT =====

function init() {
  load();
  wireSetup();
  wireTurn();
  wireDraw();
  wireVerdict();
  wireWin();
  wirePossessions();
  wireCardSheet();

  switch (state.phase) {
    case 'turn':    showPhase('turn'); renderTurn(); break;
    case 'draw':    showPhase('draw'); renderDraw(); break;
    case 'verdict': showPhase('verdict'); renderVerdict(); break;
    case 'win':     showPhase('win'); break;
    default:        state.phase = 'setup'; showPhase('setup'); renderSetup();
  }
}

init();
