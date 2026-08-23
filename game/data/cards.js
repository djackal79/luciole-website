// The 52 Power Cards (the main deck).
// Cards 1-13 = Comedy Lounge, 14-26 = The Club, 27-39 = Royal Show, 40-52 = School Play.
// Each venue group carries the same 13 power types in the same order; the
// animal printed on each card drives the Animal Affinity check.
//
// CANON v1.7 §4 — Ad-Lib, Improviser and Heckler are retired. They are
// replaced by Second Crack, Wild Act and Swoop respectively. Prop Master keeps
// its name but regained its cost clause.

const TITLES = [
  'Second Crack', 'Warm-Up Act', 'Standing Ovation', 'Prop Master', 'Wild Act',
  'Swoop', 'Pie In The Face', 'Stage Hook', 'Intermission', 'Clap Back',
  'Mime Time', 'Stage Left Stage Right', 'Giggle Box',
];

// §4 — printed card text, verbatim. Discard-on-activation is universal to all
// 13 powers and lives in the rulebook, not on the individual cards.
const POWER = {
  'Second Crack':          "Don't fancy that one? Bin it and draw again.",
  'Warm-Up Act':           "Draw two Power Cards. Perform one, bury the other.",
  'Standing Ovation':      "Someone targets you? The crowd won't have it. Cancel it cold.",
  'Prop Master':           "Skip your turn. Take a token from the pool.",
  'Wild Act':              "Pairs with anything. Cash it with any card you're holding.",
  'Swoop':                 "Nick the top card off the discard pile. Yours now.",
  'Pie In The Face':       "Pinch any Power Card from any player. Fair dinkum.",
  'Stage Hook':            "Drag one of their Power Cards offstage. Gone.",
  'Intermission':          "Their turn? Not anymore. Skip 'em.",
  'Clap Back':             "Targeted? Send it straight back at them.",
  'Mime Time':             "Zip it. No words — a verbal prompt is an instant fail.",
  'Stage Left Stage Right':"Everyone passes one Power Card left. Ready, set, go.",
  'Giggle Box':            "Stare 'em down. Smile or laugh and they bomb it.",
};

const TIMING = {
  'Second Crack':          'your_turn_instead_of_performing',
  'Warm-Up Act':           'your_turn_start',
  'Standing Ovation':      'interrupt_when_targeted',
  'Prop Master':           'your_turn_instead_of_draw',
  'Wild Act':              'your_turn_on_cash',
  'Swoop':                 'your_turn_any_time',
  'Pie In The Face':       'your_turn_any_time',
  'Stage Hook':            'your_turn_any_time',
  'Intermission':          'interrupt_before_opponent_draws',
  'Clap Back':             'interrupt_when_targeted',
  'Mime Time':             'interrupt_before_opponent_performs',
  'Stage Left Stage Right':'your_turn_any_time',
  'Giggle Box':            'interrupt_before_opponent_performs',
};

const TIMING_LABEL = {
  'Second Crack':          'Play instead of performing — bin the card and draw again',
  'Warm-Up Act':           'Play at the start of your turn',
  'Standing Ovation':      'Play when you are targeted by a power',
  'Prop Master':           'Play instead of your turn — skip it, take a token',
  'Wild Act':              'Play when cashing — pairs with any card you hold',
  'Swoop':                 'Play on your turn — take the top of the discard pile',
  'Pie In The Face':       'Play on your turn',
  'Stage Hook':            'Play on your turn',
  'Intermission':          'Play before an opponent draws — skips their turn',
  'Clap Back':             'Play when you are targeted — reverses the effect',
  'Mime Time':             'Play before an opponent performs — silences them',
  'Stage Left Stage Right':'Play on your turn — affects all players',
  'Giggle Box':            'Play before an opponent performs — eye contact rule',
};

// §1 — Wild Act counts as any card type when cashing a pair.
export const WILDCARD_TITLE = 'Wild Act';

// Each card type always has the same animal regardless of venue.
// 13 types × 4 venues = 52 cards; each animal appears exactly 4 times.
const TITLE_ANIMALS = {
  'Second Crack':           'kookaburra',
  'Warm-Up Act':            'bilby',
  'Standing Ovation':       'platypus',
  'Prop Master':            'numbat',
  'Wild Act':               'galah',
  'Swoop':                  'magpie',
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
  });
}

export function cardByNumber(n) {
  return cards.find(c => c.number === n) || null;
}
