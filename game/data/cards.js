// The 52 Performance Cards (the main deck).
// Cards 1-13 = Comedy Club, 14-26 = RSL, 27-39 = Royal Show, 40-52 = School Play.
// Each venue group has the same 13 power "types" in the same order, but the
// animal printed on each card varies (this drives the Animal Affinity check).

const TITLES = [
  'The Ad-Lib', 'Warm-Up Act', 'Standing Ovation', 'Prop Master', 'Improviser',
  'Heckler', 'Pie In The Face', 'Stage Hook', 'Intermission', 'Clap Back',
  'Mime Time', 'Stage Left Stage Right', 'Giggle Box',
];

const POWER = {
  'The Ad-Lib':            "Bombed it? Chuck it. Draw another.",
  'Warm-Up Act':          "Draw 2 Script Cards. Perform one, bury the other face-down.",
  'Standing Ovation':     "Block a steal. The crowd won't allow it.",
  'Prop Master':          "Grab any token from the pool. No performance needed.",
  'Improviser':           "Performed an off-suit prompt? Discard this to claim a Prop Token instead.",
  'Heckler':              "Make 'em do it again — or they get nothing.",
  'Pie In The Face':      "Pinch any Power Card from any player. Fair dinkum.",
  'Stage Hook':           "Drag one of their Power Cards offstage. Gone.",
  'Intermission':         "Their turn? Not anymore. Skip 'em.",
  'Clap Back':            "When targeted by an attack card, discard this to send the effect back at them.",
  'Mime Time':            "Zip it. No words this turn — verbal prompt means instant fail.",
  'Stage Left Stage Right':"Everyone passes one Power Card left. Ready, set, go.",
  'Giggle Box':           "Stare 'em down. Smile or laugh and they bomb it.",
};

const AFFINITY = {
  'The Ad-Lib':            "Kookaburra? You choose — coin or Power Card on the new draw.",
  'Warm-Up Act':          "",
  'Standing Ovation':     "Platypus? Block the steal AND draw a bonus Script Card.",
  'Prop Master':          "",
  'Improviser':           "Galah? Take the coin AND keep this card. Both. Somehow.",
  'Heckler':              "Magpie? If they fail, swoop a Power Card from them too.",
  'Pie In The Face':      "Emu? Steal it AND fire its effect immediately. Chaos.",
  'Stage Hook':           "",
  'Intermission':         "",
  'Clap Back':            "",
  'Mime Time':            "Echidna? You also pick which suit they must attempt. Prickly.",
  'Stage Left Stage Right':"Quokka? You call it — pass left or right. Your chaos.",
  'Giggle Box':           "Cockatoo? If they crack, steal their turn's reward too.",
};

// Whether a card's power is played on your own turn (proactive) or in
// response to another player's action (reactive).
const POWER_TYPE = {
  'The Ad-Lib':            'proactive',
  'Warm-Up Act':          'proactive',
  'Standing Ovation':     'reactive',
  'Prop Master':          'proactive',
  'Improviser':           'proactive',
  'Heckler':              'reactive',
  'Pie In The Face':      'proactive',
  'Stage Hook':           'proactive',
  'Intermission':         'proactive',
  'Clap Back':            'reactive',
  'Mime Time':            'reactive',
  'Stage Left Stage Right':'proactive',
  'Giggle Box':           'reactive',
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
  if (n <= 13) return 'comedy_club';
  if (n <= 26) return 'rsl';
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
    affinity_text: AFFINITY[title],
    power_type: POWER_TYPE[title],
  });
}

// Cards removed in Family Mode (per the v0.5 rules).
export const FAMILY_REMOVED_TITLES = ['Heckler', 'Mime Time'];

export function cardByNumber(n) {
  return cards.find(c => c.number === n) || null;
}
