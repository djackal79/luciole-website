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
  'The Ad-Lib':            "When you fail a prompt, discard this card to ignore the failure. Draw a new Performance Card and perform the new venue prompt instead.",
  'Warm-Up Act':           "At the start of your turn, discard this card to draw 2 Performance Cards instead of 1. Choose which venue to perform. Place the other face-down at the bottom of the deck.",
  'Standing Ovation':      "When another player attempts to use a card power that targets you or your held cards, discard this card to cancel that power completely. It has no effect.",
  'Prop Master':           "On your turn, discard this card to take 1 Prop Token from the Pool without performing. This replaces your normal draw and perform step entirely.",
  'Improviser':            "After you successfully perform a prompt, discard this card to count that performance as matching your venue — even if it does not. Earn a Prop Token from the Pool instead of keeping the card.",
  'Heckler':               "When another player successfully completes a prompt, discard this card before they collect their reward. They must immediately perform a second prompt for the same venue. If they succeed, they collect their reward as normal. If they fail, they get nothing.",
  'Pie In The Face':       "On your turn, discard this card to take any 1 Performance Card currently held by any other player and add it to your own held cards. You may use its power as normal.",
  'Stage Hook':            "On your turn, discard this card to force any other player to discard 1 of their held Performance Cards. You choose which card they lose. It goes to the discard pile.",
  'Intermission':          "On any other player's turn, before they draw, discard this card to skip their entire turn. They draw nothing and perform nothing. Play passes to the next player.",
  'Clap Back':             "When another player plays a card power that targets you, discard this card to reverse it. The power now targets the player who played it instead of you.",
  'Mime Time':             "On any other player's turn, before they perform, discard this card to silence them for that prompt. They may not speak. If their prompt requires speaking, they automatically fail.",
  'Stage Left Stage Right':"On your turn, discard this card to force every player to pass 1 of their held Performance Cards to the player on their left simultaneously. All players must pass — including you.",
  'Giggle Box':            "On any other player's turn, before they perform, discard this card. That player must maintain eye contact with you for the entire duration of their prompt. If they smile, laugh, or look away, they automatically fail.",
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
