import { prompts } from './data/prompts.js';

// ===== CONSTANTS =====

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
  comedy_club:  {name:'The Comedy Club', icon:'🎤', cssClass:'comedy',    imgStart:1,  imgCount:13},
  rsl:          {name:'The RSL',         icon:'🎵', cssClass:'rsl',        imgStart:14, imgCount:13},
  royal_show:   {name:'The Royal Show',  icon:'🎪', cssClass:'royal_show', imgStart:27, imgCount:13},
  school_play:  {name:'The School Play', icon:'🎭', cssClass:'school_play',imgStart:40, imgCount:13},
};

const VENUE_KEYS = ['comedy_club','rsl','royal_show','school_play'];

const PERFORMANCE_CARDS = [
  'Ad-Lib', 'Warm-Up Act', 'Standing Ovation', 'Prop Master', 'Improvisor',
  'Heckler', 'Pie in the Face', 'Stage Hook', 'Intermission', 'Clap Back',
  'Mime Time', 'Stage Left Stage Right', 'Giggle Box',
];

const SUCCESS_DISPLAY = {
  vote:        {icon:'🗳️', label:'Majority vote'},
  objective:   {icon:'✅', label:'Objective'},
  named_judge: {icon:'👤', label:'Named judge — player to left'},
};

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
    selectedVenue: null,
    selectedCardName: null,
    selectedCardImg: null,
    currentPromptKey: null,
    familyMode: false,
  };
}

function save() {
  try { localStorage.setItem('pao_v1', JSON.stringify(state)); } catch(e) {}
}

function load() {
  try {
    const raw = localStorage.getItem('pao_v1');
    if (raw) { state = JSON.parse(raw); return; }
  } catch(e) {}
  state = defaultState();
}

// ===== PROMPT HELPERS =====

function getCardPrompts(cardNumber, venue, familyMode) {
  return prompts
    .filter(p => p.card_number === cardNumber && p.venue === venue && (!familyMode || p.family_safe))
    .sort((a, b) => a.position - b.position);
}

function getUsedPositions(player, venue) {
  return player.used[venue] || [];
}

function getNextPrompt(player, familyMode) {
  const venue = state.selectedVenue;
  const card = getCardPrompts(player.card_number, venue, familyMode);
  const used = getUsedPositions(player, venue);
  return card.find(p => !used.includes(p.position)) || null;
}

function markUsed(player, venue, position) {
  if (!player.used[venue]) player.used[venue] = [];
  if (!player.used[venue].includes(position)) {
    player.used[venue].push(position);
  }
}

function isVenueExhausted(player, venue, familyMode) {
  const card = getCardPrompts(player.card_number, venue, familyMode);
  const used = getUsedPositions(player, venue);
  return card.length > 0 && card.every(p => used.includes(p.position));
}

function venueProgress(player, venue, familyMode) {
  const card = getCardPrompts(player.card_number, venue, familyMode);
  const used = getUsedPositions(player, venue);
  const usedCount = card.filter(p => used.includes(p.position)).length;
  return {used: usedCount, total: card.length};
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
      if (btn) { btn.textContent = 'Time\'s up!'; btn.classList.remove('running'); }
      if (display) display.classList.add('warning');
    }
  }, 1000);
}

function updateTimerDisplay() {
  const display = document.getElementById('timer-display');
  const btn = document.getElementById('timer-btn');
  if (!display) return;
  const m = Math.floor(timerRemaining / 60);
  const s = timerRemaining % 60;
  display.textContent = m > 0 ? `${m}:${String(s).padStart(2,'0')}` : `0:${String(Math.max(0,s)).padStart(2,'0')}`;
  if (timerRemaining <= 5 && timerRunning) display.classList.add('warning');
  else display.classList.remove('warning');
  if (btn) {
    btn.textContent = timerRunning ? 'Stop' : 'Start Timer';
    btn.classList.toggle('running', timerRunning);
  }
}

// ===== RENDER SETUP =====

function renderSetup() {
  const numPlayers = state.numPlayers;

  // Sync count buttons
  document.querySelectorAll('.count-btn').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.count) === numPlayers);
  });

  // Family mode
  document.getElementById('setup-family-mode').checked = state.familyMode;

  // Build player rows
  const container = document.getElementById('player-rows');
  container.innerHTML = '';

  for (let i = 0; i < numPlayers; i++) {
    const existing = state.players[i] || {};
    const row = document.createElement('div');
    row.className = 'player-row';

    // Name
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.placeholder = `Player ${i+1}`;
    nameInput.value = existing.name || '';
    nameInput.dataset.playerIndex = i;
    nameInput.className = 'player-name-input';

    // Character
    const charSelect = document.createElement('select');
    charSelect.dataset.playerIndex = i;
    charSelect.className = 'char-select';
    CHARACTERS.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = `${c.name} — ${c.archetype}`;
      if (existing.character === c.id) opt.selected = true;
      charSelect.appendChild(opt);
    });
    // Default: pick character not already used
    if (!existing.character) {
      const usedChars = state.players.slice(0, i).map(p => p && p.character);
      const unused = CHARACTERS.find(c => !usedChars.includes(c.id));
      if (unused) charSelect.value = unused.id;
    }

    // Card number
    const cardSelect = document.createElement('select');
    cardSelect.dataset.playerIndex = i;
    cardSelect.className = 'card-select';
    for (let c = 1; c <= 16; c++) {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = `Card ${c}`;
      if ((existing.card_number || (i + 1)) === c) opt.selected = true;
      cardSelect.appendChild(opt);
    }

    // Character card image preview (updates live on dropdown change)
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

// ===== RENDER GAME =====

function renderGame() {
  const player = state.players[state.currentPlayerIndex];
  if (!player) return;

  document.getElementById('current-player-name').textContent = player.name || `Player ${state.currentPlayerIndex + 1}`;
  const char = CHARACTERS.find(c => c.id === player.character);
  document.getElementById('current-player-character').textContent = char ? char.name : '';
  document.getElementById('current-player-card').textContent = `Card #${player.card_number}`;
  document.getElementById('token-count').textContent = player.tokens;
  document.getElementById('game-family-mode').checked = state.familyMode;

  // Character card image
  const charCard = document.getElementById('game-char-card');
  if (charCard) {
    const c = CHARACTERS.find(x => x.id === player.character);
    charCard.style.backgroundImage = c ? `url('assets/characters/${c.img}.jpg')` : '';
  }

  // Venue buttons progress
  VENUE_KEYS.forEach(venue => {
    const prog = venueProgress(player, venue, state.familyMode);
    const el = document.getElementById(`progress-${venue}`);
    if (el) {
      el.textContent = `${prog.used}/${prog.total}`;
      el.classList.toggle('done', prog.used === prog.total && prog.total > 0);
    }
    const btn = document.querySelector(`.venue-btn[data-venue="${venue}"]`);
    if (btn) {
      btn.classList.toggle('all-used', isVenueExhausted(player, venue, state.familyMode));
    }
  });
}

// ===== RENDER PROMPT =====

function renderPrompt() {
  const player = state.players[state.currentPlayerIndex];
  const venue = state.selectedVenue;
  if (!player || !venue) return;

  const prompt = getNextPrompt(player, state.familyMode);
  if (!prompt) return;

  const venueInfo = VENUES[venue];

  // Header
  const header = document.getElementById('prompt-header');
  header.className = `prompt-header ${venueInfo.cssClass}`;
  document.getElementById('prompt-venue-label').textContent = `${venueInfo.icon} ${venueInfo.name}`;

  // Venue (performance) card image — use the one already selected on card screen
  const venueCard = document.getElementById('prompt-venue-card');
  if (venueCard && state.selectedCardImg) {
    venueCard.style.backgroundImage = `url('assets/venues/${state.selectedCardImg}.jpg')`;
  }

  // Difficulty stars
  document.getElementById('difficulty-row').textContent = '⭐'.repeat(prompt.difficulty);

  // Text
  document.getElementById('prompt-text').textContent = prompt.text;

  // Timer
  stopTimer();
  const timerBlock = document.getElementById('timer-block');
  if (prompt.timed && prompt.duration_seconds) {
    timerBlock.classList.remove('hidden');
    timerRemaining = prompt.duration_seconds;
    updateTimerDisplay();
    document.getElementById('timer-btn').textContent = 'Start Timer';
    document.getElementById('timer-btn').classList.remove('running');
    document.getElementById('timer-display').classList.remove('warning');
  } else {
    timerBlock.classList.add('hidden');
  }

  // Success condition
  const sc = SUCCESS_DISPLAY[prompt.success_condition];
  document.getElementById('success-icon').textContent = sc.icon;
  document.getElementById('success-label').textContent = sc.label;
  document.getElementById('success-text').textContent = prompt.success_text;

  // Store current prompt ref
  state.currentPromptKey = `${prompt.card_number}-${prompt.venue}-${prompt.position}`;
}

// ===== RENDER CARD =====

function renderCard() {
  const venue = state.selectedVenue;
  if (!venue) return;
  const venueInfo = VENUES[venue];

  const headerEl = document.querySelector('#card-screen .card-screen-header');
  if (headerEl) headerEl.className = `card-screen-header ${venueInfo.cssClass}`;
  document.getElementById('card-screen-venue').textContent = `${venueInfo.icon} ${venueInfo.name}`;

  const imgWrap = document.getElementById('card-screen-img');
  if (imgWrap && state.selectedCardImg) {
    imgWrap.style.backgroundImage = `url('assets/venues/${state.selectedCardImg}.jpg')`;
  }

  document.getElementById('card-screen-name').textContent = state.selectedCardName || '';
}

// ===== RENDER USED MODAL =====

function renderUsedModal() {
  const player = state.players[state.currentPlayerIndex];
  if (!player) return;

  const name = player.name || `Player ${state.currentPlayerIndex + 1}`;
  document.getElementById('modal-title').textContent = `${name} — Used Prompts`;

  const body = document.getElementById('modal-body');
  body.innerHTML = '';

  VENUE_KEYS.forEach(venue => {
    const venueInfo = VENUES[venue];
    const allPrompts = getCardPrompts(player.card_number, venue, false); // show all, not filtered
    const used = getUsedPositions(player, venue);

    const section = document.createElement('div');
    section.className = 'used-venue-section';

    const header = document.createElement('div');
    header.className = `used-venue-header ${venueInfo.cssClass}`;
    header.textContent = `${venueInfo.icon} ${venueInfo.name}`;
    section.appendChild(header);

    allPrompts.forEach(p => {
      const item = document.createElement('div');
      item.className = 'used-prompt-item' + (used.includes(p.position) ? ' used' : '');

      const pos = document.createElement('span');
      pos.className = 'prompt-pos';
      pos.textContent = `${'⭐'.repeat(p.difficulty)}`;

      const text = document.createElement('span');
      text.textContent = p.text.length > 80 ? p.text.slice(0, 80) + '…' : p.text;

      item.appendChild(pos);
      item.appendChild(text);
      section.appendChild(item);
    });

    body.appendChild(section);
  });
}

// ===== NAVIGATE =====

function showPhase(phase) {
  document.getElementById('setup-screen').classList.toggle('hidden', phase !== 'setup');
  document.getElementById('game-screen').classList.toggle('hidden', phase !== 'game');
  document.getElementById('card-screen').classList.toggle('hidden', phase !== 'card');
  document.getElementById('prompt-screen').classList.toggle('hidden', phase !== 'prompt');
  document.getElementById('exhausted-screen').classList.toggle('hidden', phase !== 'exhausted');
}

function goToGame() {
  stopTimer();
  state.phase = 'game';
  state.selectedVenue = null;
  state.currentPromptKey = null;
  showPhase('game');
  renderGame();
  save();
}

function goToSetup() {
  stopTimer();
  state.phase = 'setup';
  showPhase('setup');
  renderSetup();
  save();
}

function goToCard(venue) {
  const player = state.players[state.currentPlayerIndex];
  state.selectedVenue = venue;

  if (isVenueExhausted(player, venue, state.familyMode)) {
    const venueInfo = VENUES[venue];
    document.getElementById('exhausted-message').textContent =
      `All ${venueInfo.name} prompts on Card #${player.card_number} have been used.`;
    state.phase = 'exhausted';
    showPhase('exhausted');
    save();
    return;
  }

  const v = VENUES[venue];
  state.selectedCardImg = v.imgStart + Math.floor(Math.random() * v.imgCount);
  state.selectedCardName = PERFORMANCE_CARDS[Math.floor(Math.random() * PERFORMANCE_CARDS.length)];
  state.phase = 'card';
  showPhase('card');
  renderCard();
  save();
}

function goToPrompt() {
  state.phase = 'prompt';
  showPhase('prompt');
  renderPrompt();
  save();
}

function completePrompt() {
  const player = state.players[state.currentPlayerIndex];
  const venue = state.selectedVenue;
  const prompt = getNextPrompt(player, state.familyMode);
  if (prompt) markUsed(player, venue, prompt.position);
  stopTimer();
  state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
  goToGame();
}

// ===== EVENT WIRING =====

function wireSetup() {
  // Count selector
  document.getElementById('player-count-selector').addEventListener('click', e => {
    const btn = e.target.closest('.count-btn');
    if (!btn) return;
    state.numPlayers = parseInt(btn.dataset.count);
    renderSetup();
  });

  // Family mode toggle (setup)
  document.getElementById('setup-family-mode').addEventListener('change', e => {
    state.familyMode = e.target.checked;
  });

  // Start game
  document.getElementById('start-game-btn').addEventListener('click', () => {
    // Read player data from DOM
    const players = [];
    for (let i = 0; i < state.numPlayers; i++) {
      const nameEl = document.querySelector(`.player-name-input[data-player-index="${i}"]`);
      const charEl = document.querySelector(`.char-select[data-player-index="${i}"]`);
      const cardEl = document.querySelector(`.card-select[data-player-index="${i}"]`);
      const existing = state.players[i] || {};
      players.push({
        name: nameEl ? nameEl.value.trim() : '',
        character: charEl ? charEl.value : 'kookaburra',
        card_number: cardEl ? parseInt(cardEl.value) : (i + 1),
        tokens: existing.tokens || 0,
        used: existing.used || {comedy_club:[], rsl:[], royal_show:[], school_play:[]},
      });
    }
    state.players = players;
    state.currentPlayerIndex = 0;
    goToGame();
  });
}

function wireGame() {
  // Venue buttons
  document.getElementById('venue-grid').addEventListener('click', e => {
    const btn = e.target.closest('.venue-btn');
    if (!btn) return;
    goToCard(btn.dataset.venue);
  });

  // Tokens
  document.getElementById('token-plus').addEventListener('click', () => {
    state.players[state.currentPlayerIndex].tokens++;
    document.getElementById('token-count').textContent = state.players[state.currentPlayerIndex].tokens;
    save();
  });

  document.getElementById('token-minus').addEventListener('click', () => {
    const p = state.players[state.currentPlayerIndex];
    if (p.tokens > 0) { p.tokens--; document.getElementById('token-count').textContent = p.tokens; save(); }
  });

  // Next player
  document.getElementById('next-player-btn').addEventListener('click', () => {
    state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
    renderGame();
    save();
  });

  // Used prompts modal
  document.getElementById('used-prompts-btn').addEventListener('click', () => {
    renderUsedModal();
    document.getElementById('used-modal').classList.remove('hidden');
  });

  // Family mode toggle (game)
  document.getElementById('game-family-mode').addEventListener('change', e => {
    state.familyMode = e.target.checked;
    renderGame();
    save();
  });

  // Reset
  document.getElementById('reset-btn').addEventListener('click', () => {
    if (confirm('Reset the whole game? This will clear all used prompts and tokens.')) {
      state = defaultState();
      save();
      goToSetup();
    }
  });
}

function wireCard() {
  document.getElementById('card-back-btn').addEventListener('click', goToGame);
  document.getElementById('show-prompt-btn').addEventListener('click', goToPrompt);
}

function wirePrompt() {
  // Back
  document.getElementById('back-btn').addEventListener('click', () => {
    stopTimer();
    goToGame();
  });

  // Pass / Fail (same mechanical outcome)
  document.getElementById('pass-btn').addEventListener('click', completePrompt);
  document.getElementById('fail-btn').addEventListener('click', completePrompt);

  // Timer
  document.getElementById('timer-btn').addEventListener('click', () => {
    if (timerRunning) {
      stopTimer();
      const btn = document.getElementById('timer-btn');
      btn.textContent = 'Start Timer';
      btn.classList.remove('running');
    } else {
      // Find current prompt duration
      const player = state.players[state.currentPlayerIndex];
      const prompt = getNextPrompt(player, state.familyMode);
      if (prompt && prompt.duration_seconds) {
        startTimer(timerRemaining > 0 ? timerRemaining : prompt.duration_seconds);
      }
    }
  });
}

function wireModal() {
  document.getElementById('modal-close').addEventListener('click', () => {
    document.getElementById('used-modal').classList.add('hidden');
  });
  document.getElementById('modal-backdrop').addEventListener('click', () => {
    document.getElementById('used-modal').classList.add('hidden');
  });
}

function wireExhausted() {
  document.getElementById('exhausted-back-btn').addEventListener('click', goToGame);
}

// ===== INIT =====

function init() {
  load();
  wireSetup();
  wireGame();
  wireCard();
  wirePrompt();
  wireModal();
  wireExhausted();

  // Restore to correct screen
  if (state.phase === 'game') {
    showPhase('game');
    renderGame();
  } else if (state.phase === 'card') {
    showPhase('card');
    renderCard();
  } else if (state.phase === 'prompt') {
    showPhase('prompt');
    renderPrompt();
  } else {
    state.phase = 'setup';
    showPhase('setup');
    renderSetup();
  }
}

init();
