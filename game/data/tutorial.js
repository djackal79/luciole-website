// Tutorial Mode content — intro pages, character backstories, and contextual tips.
// All prose lives here; app.js decides when to show it.

export const INTRO_STEPS = [
  {
    icon: '🎄',
    title: 'Pull Another One',
    body: [
      "Christmas. Crackers. Terrible jokes. Now make it a blood sport.",
      "You're a washed-up Aussie animal performer — a heckled kookaburra, a woozy galah, a magpie with a tragic past — clawing your way back to the big time one dreadful gig at a time.",
      "First performer to reach the table's token target takes the final bow and wins — 3 Prop Tokens at 3–5 players, 2 at 6–8.",
    ],
  },
  {
    icon: '🎴',
    title: 'How You Win',
    body: [
      "On your turn, draw a Power Card. It names a venue — that's tonight's gig. Your Prompt Card tells you exactly what to perform. Do it. Out loud. In front of everyone.",
      "Nail it and you're rewarded:",
      "🐾 Animal Affinity — the card's animal matches YOUR character → instant Prop Token.",
      "🃏 No animal match — keep the card. A second card of the SAME NAME cashes the pair for a token.",
      "🃏 No match — keep the card anyway and use its printed power to sabotage everyone else.",
      "Fail, and you get nothing. The room will remember.",
    ],
  },
  {
    icon: '🎭',
    title: 'Before You Pick a Character',
    body: [
      "Every character has two things working for them:",
      "🏠 A home venue — the performance style they are best at. Venue does not affect pairing or tokens, only what you have to do on stage.",
      "🐾 An animal — exactly 4 cards in the deck carry your animal. Perform one successfully and it's an instant token.",
      "The four venues, and what they'll demand of you:",
      "🎤 The Comedy Lounge — tell jokes. Setup, punchline, deadpan.",
      "🎵 The Club — sing or rhyme. Lyrics, rhythm, improvised verse.",
      "🎪 The Royal Show — clown around. Mime, stunts, slapstick.",
      "🎭 The School Play — act. Accents, emotions, impressions.",
      "Choose the venue that suits your talents — or your total lack of shame.",
    ],
  },
];

export const CHARACTER_BACKSTORIES = {
  kookaburra: {
    title: 'The Heckled Stand-up',
    story: "Kooka laughs at his own material because, statistically, someone has to. Once the golden boy of the open-mic circuit, he's been booed off more stages than he's been booked on. But he keeps coming back — that unhinged cackle isn't joy, it's a survival mechanism. Deep down he knows one killer set could fix everything.",
    strategy: "Home venue: 🎤 Comedy Lounge — that is the performance style you get, nothing more. Pairs are NAME matches now, so collect duplicates of any card. Watch for the 4 kookaburra cards: perform one and it is an instant token.",
  },
  cockatoo: {
    title: 'The Bitter Satirist',
    story: "Once the sharpest political wit on breakfast radio, Cocky was cancelled after The Incident (never ask about The Incident). Now he screeches truth to power at anyone within earshot, whether they bought a ticket or not. His crest rises when he's about to say something career-ending. It rises a lot.",
    strategy: "Home venue: 🎤 Comedy Lounge — that is the performance style you get, nothing more. Pairs are NAME matches now, so collect duplicates of any card. Watch for the 4 cockatoo cards: perform one and it is an instant token.",
  },
  quokka: {
    title: 'The Sweaty Warm-up Act',
    story: "The happiest face in show business hides the deepest terror. Quokka has warmed up crowds for legends and been thanked by exactly none of them. Perpetually smiling, perpetually perspiring, she'd sell her own family for a headline slot. Tonight might finally be her night — if the flop sweat doesn't short out the microphone first.",
    strategy: "Home venue: 🎵 The Club — that is the performance style you get, nothing more. Pairs are NAME matches now, so collect duplicates of any card. Watch for the 4 quokka cards: perform one and it is an instant token.",
  },
  magpie: {
    title: 'The Tragic Songbird',
    story: "Maggie had a voice that could stop traffic — then she started swooping the traffic instead, and the bookings dried up. Every ballad she sings is about betrayal, usually by a former bandmate, occasionally by the concept of spring. Audiences weep. Whether it's the music or fear of being swooped remains an open question.",
    strategy: "Home venue: 🎵 The Club — that is the performance style you get, nothing more. Pairs are NAME matches now, so collect duplicates of any card. Watch for the 4 magpie cards: perform one and it is an instant token.",
  },
  emu: {
    title: 'The Chaotic Prop Comic',
    story: "Emu once lost a war against the Australian government and has been processing it through prop comedy ever since. No routine survives contact with Emu — juggling becomes destruction, magic becomes menace, a simple rubber chicken becomes a weapon of chaos. Venues book him because ticket sales spike. Insurance premiums also spike.",
    strategy: "Home venue: 🎪 The Royal Show — that is the performance style you get, nothing more. Pairs are NAME matches now, so collect duplicates of any card. Watch for the 4 emu cards: perform one and it is an instant token.",
  },
  galah: {
    title: 'The Woozy Clown',
    story: "Banned from three Royal Shows and legally required to stay 50 metres from a fourth, Galah is proof that talent and judgement are different things. Brilliant physical comedian, catastrophic decision-maker. He doesn't fall down drunk — he falls down professionally, and the crowd can never quite tell which. Neither can he.",
    strategy: "Home venue: 🎪 The Royal Show — that is the performance style you get, nothing more. Pairs are NAME matches now, so collect duplicates of any card. Watch for the 4 galah cards: perform one and it is an instant token.",
  },
  echidna: {
    title: 'The Pretentious Improviser',
    story: "Echidna doesn't do comedy, darling — she does *theatre*. Every 'yes, and' comes with a lecture on Meisner technique. She once did a four-hour one-woman show about a spike. Critics called it 'long'. Prickly about feedback, prickly in general, she's certain the mainstream will catch up to her genius eventually. It has not.",
    strategy: "Home venue: 🎭 School Play — that is the performance style you get, nothing more. Pairs are NAME matches now, so collect duplicates of any card. Watch for the 4 echidna cards: perform one and it is an instant token.",
  },
  platypus: {
    title: 'The Deadpan Magician',
    story: "Platypus has never smiled on stage. Or off it. Or possibly ever. His act — impossible tricks delivered with the enthusiasm of a tax audit — divides audiences into two camps: those who think he's a genius, and those who've checked if he's asleep. He is a mammal that lays eggs and detects electricity. The magic was never the act.",
    strategy: "Home venue: 🎭 School Play — that is the performance style you get, nothing more. Pairs are NAME matches now, so collect duplicates of any card. Watch for the 4 platypus cards: perform one and it is an instant token.",
  },
};

export const PHASE_TIPS = {
  first_turn: {
    icon: '🎬',
    title: 'Your Turn',
    body: [
      "This is home base. Your token target is up top. Turn order is power, then cash, then draw — the draw comes last on purpose.",
      "Your Hand shows the Power Cards you've kept. Tap any card to read its power and play it.",
      "When you're ready, hit Draw Power Card to take tonight's gig.",
      "Got two Power Cards with the SAME NAME? A Cash a Pair button will appear — trade them for a token without performing a thing.",
    ],
  },
  first_draw: {
    icon: '🎤',
    title: 'Showtime',
    body: [
      "The drawn card sets the venue — that's the style you must perform in. Your Prompt Card supplies the exact material.",
      "There is no scoring. Have a go in good faith and you succeed — however badly it goes. The only failure is refusing, and a tie goes to you.",
      "Some prompts are timed — start the timer and don't choke.",
      "Genuinely can't do it? Tap pass & draw again — new card, new prompt, no failure. That is a rule, not a favour.",
    ],
  },
  first_verdict_animal: {
    icon: '🐾',
    title: 'Animal Affinity!',
    body: [
      "The card's animal matches your character — that's the best outcome in the game. Instant Prop Token.",
      "There are only 4 cards with your animal in the whole deck, so every one you land is gold. Strategy: if you ever get a choice of cards, chase your animal.",
    ],
  },
  first_verdict_venue: {
    icon: '✅',
    title: 'Keep the Card',
    body: [
      "You made the attempt, so the card is yours — face-up in front of you.",
      "Here's the play: two cards of the SAME NAME cash in for a Prop Token on your turn — no performance required. Every card is face-up, so everyone can see what you need. Guard them: powers can steal or bin your cards.",
    ],
  },
  first_verdict_power: {
    icon: '🃏',
    title: 'Keep the Card',
    body: [
      "No match — but no loss either. The card joins your hand, and every card has a printed power.",
      "Powers are your sabotage arsenal: skip someone's turn, steal their cards, force them to re-perform. Tap any card in your hand to read what it does.",
    ],
  },
  first_hand_card: {
    icon: '⚡',
    title: 'Power Cards',
    body: [
      "Every card has a power, and the badge tells you when it fires:",
      "⚡ Your Turn powers play on your own turn — free tokens, extra draws, steals.",
      "🛡️ Interrupt powers fire on OTHER players' turns — skip them, silence them, cancel their rewards.",
      "Playing a power discards the card, so spend wisely. A card in hand is also a threat — sometimes the scariest power is the one you haven't used yet.",
    ],
  },
  first_spectate: {
    icon: '👀',
    title: 'Not Your Turn — Still Your Game',
    body: [
      "You're watching another player's turn, but you're not powerless.",
      "🛡️ Interrupt cards fire right now: Intermission skips their whole turn, Mime Time silences them, Giggle Box makes them hold eye contact with you. Mime Time and Giggle Box are the only clean fail states left — they judge a fact, not a performance.",
      "Watch the leader. The moment someone gets close to the token target, it's everyone's job to ruin their night.",
    ],
  },
  strategy_midgame: {
    icon: '🎯',
    title: 'Someone Is One Token Away',
    body: [
      "One more token and they win. This is the moment interrupt cards exist for.",
      "Save the interrupts for the leader's turns. Use Stage Hook to strip a card they are about to pair, or Pie in the Face to take it and cash it yourself.",
      "And if the leader is you — expect the whole table to turn. Standing Ovation and Clap Back are your shields. Good luck.",
    ],
  },
};
