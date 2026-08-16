// The 52 Power Cards (the main deck).
// Cards 1-13 = Comedy Lounge, 14-26 = The Club, 27-39 = Royal Show, 40-52 = School Play.
// Each venue group has the same 13 power "types" in the same order, but the
// animal printed on each card varies (this drives the Animal Affinity check).

const TITLES = [
  'The Ad-Lib', 'Warm-Up Act', 'Standing Ovation', 'Prop Master', 'Improviser',
  'Heckler', 'Pie In The Face', 'Stage Hook', 'Intermission', 'Clap Back',
  'Mime Time', 'Stage Left Stage Right', 'Giggle Box',
];

// MINI-CANON §5.5 — card text is final. Every power's full printed text is
// the single sentence below. There is deliberately no secondary per-character
// affinity bonus; the AFFINITY map that used to live here was never part of
// the ruleset and has been deleted.
const POWER = {
  'The Ad-Lib':            "Ignore a failure. Draw a new Power Card and perform that venue's prompt instead.",
  'Warm-Up Act':           "Draw 2 instead of 1. Choose which venue to perform. Other card to bottom of deck.",
  'Standing Ovation':      "Cancel a power targeting you or your held cards. No effect.",
  'Prop Master':           "Take 1 token from the Pool without performing. Replaces draw + performance entirely.",
  'Improviser':            "Count a success as on-venue even when it isn't. Discard this, take a token.",
  'Heckler':               "Opponent who just succeeded must perform a second same-venue prompt before collecting. Fail = nothing.",
  'Pie In The Face':       "Take any 1 held card from any other player.",
  'Stage Hook':            "Force any other player to discard 1 held card, your choice which.",
  'Intermission':          "Skip an opponent's entire turn.",
  'Clap Back':             "Reverse a power targeting you back onto whoever played it.",
  'Mime Time':             "Silence an opponent for their prompt. Verbal prompt = auto-fail.",
  'Stage Left Stage Right':"Every player passes 1 held card left, simultaneously, including you.",
  'Giggle Box':            "Opponent must hold eye contact throughout. Smile/laugh/look away = auto-fail.",
};

const TIMING = {
  'The Ad-Lib':            'your_turn_on_fail',
  'Warm-Up Act':           'your_turn_start',
  'Standing Ovation':      'interrupt_when_targeted',
  'Prop Master':           'your_turn_instead_of_draw',
  'Improviser':            'your_turn_on_success',
  'Heckler':               'interrupt_on_opponent_success',
  'Pie In The Face':       'your_turn_any_time',
  'Stage Hook':            'your_turn_any_time',
  'Intermission':          'interrupt_before_opponent_draws',
  'Clap Back':             'interrupt_when_targeted',
  'Mime Time':             'interrupt_before_opponent_performs',
  'Stage Left Stage Right':'your_turn_any_time',
  'Giggle Box':            'interrupt_before_opponent_performs',
};

const TIMING_LABEL = {
  'The Ad-Lib':            'Play on your turn when you fail',
  'Warm-Up Act':           'Play at the start of your turn',
  'Standing Ovation':      'Play when you are targeted by a power',
  'Prop Master':           'Play on your turn instead of drawing',
  'Improviser':            'Play immediately after a successful performance',
  'Heckler':               'Play when an opponent succeeds — before they collect',
  'Pie In The Face':       'Play on your turn',
  'Stage Hook':            'Play on your turn',
  'Intermission':          'Play before an opponent draws — skips their turn',
  'Clap Back':             'Play when you are targeted — reverses the effect',
  'Mime Time':             'Play before an opponent performs — silences them',
  'Stage Left Stage Right':'Play on your turn — affects all players',
  'Giggle Box':            'Play before an opponent performs — eye contact rule',
};

const FAMILY_SAFE = {
  'The Ad-Lib':            true,
  'Warm-Up Act':           true,
  'Standing Ovation':      true,
  'Prop Master':           true,
  'Improviser':            true,
  'Heckler':               false,
  'Pie In The Face':       true,
  'Stage Hook':            true,
  'Intermission':          true,
  'Clap Back':             true,
  'Mime Time':             true,
  'Stage Left Stage Right':true,
  'Giggle Box':            true,
};

// Each card type always has the same animal regardless of venue.
// 13 types × 4 venues = 52 cards; each animal appears exactly 4 times.
const TITLE_ANIMALS = {
  'The Ad-Lib':             'kookaburra',
  'Warm-Up Act':            'bilby',
  'Standing Ovation':       'platypus',
  'Prop Master':            'numbat',
  'Improviser':             'galah',
  'Heckler':                'magpie',
  'Pie In The Face':        'emu',
  'Stage Hook':             'dingo',
  'Intermission':           'koala',
  'Clap Back':              'lyrebird',
  'Mime Time':              'echidna',
  'Stage Left Stage Right': 'quokka',
  'Giggle Box':             'cockatoo',
};

function venueOf(n) {
  if (n <= 13) return 'comedy_lounge';
  if (n <= 26) return 'the_club';
  if (n <= 39) return 'royal_show';
  return 'school_play';
}

export const cards = [];
for (let n = 1; n <= 52; n++) {
  const title = TITLES[(n - 1) % 13];
  cards.push({
    number: n,
    title,
    venue: venueOf(n),
    animal: TITLE_ANIMALS[title],
    power_text: POWER[title],
    timing: TIMING[title],
    timing_label: TIMING_LABEL[title],
    family_safe: FAMILY_SAFE[title],
  });
}

// Cards removed in Family Mode.
export const FAMILY_REMOVED_TITLES = ['Heckler'];

export function cardByNumber(n) {
  return cards.find(c => c.number === n) || null;
}
