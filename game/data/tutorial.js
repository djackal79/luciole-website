// Tutorial Mode content — intro pages, character backstories, and contextual tips.
// All prose lives here; app.js decides when to show it.

export const INTRO_STEPS = [
  {
    icon: '🎄',
    title: 'Pull Another One',
    body: [
      "Christmas. Crackers. Terrible jokes. Now make it a blood sport.",
      "You're a washed-up Aussie animal performer — a heckled kookaburra, a drunken galah, a magpie with a tragic past — clawing your way back to the big time one dreadful gig at a time.",
      "First performer to collect 3 Prop Tokens takes the final bow and wins.",
    ],
  },
  {
    icon: '🎴',
    title: 'How You Win',
    body: [
      "On your turn, draw a Power Card. It names a venue — that's tonight's gig. Your Prompt Card tells you exactly what to perform. Do it. Out loud. In front of everyone.",
      "Nail it and you're rewarded:",
      "🐾 Animal Affinity — the card's animal matches YOUR character → instant Prop Token.",
      "✅ Venue Match — the card's venue is your home turf → keep it. Two home-venue cards cash in for a token.",
      "🃏 No match — keep the card anyway and use its printed power to sabotage everyone else.",
      "Fail, and you get nothing. The room will remember.",
    ],
  },
  {
    icon: '🎭',
    title: 'Before You Pick a Character',
    body: [
      "Every character has two things working for them:",
      "🏠 A home venue — their strong suit. Cards from this venue pair up into tokens, so pick a venue you can actually perform.",
      "🐾 An animal — exactly 4 cards in the deck carry your animal. Perform one successfully and it's an instant token.",
      "The four venues, and what they'll demand of you:",
      "🎤 The Comedy Club — tell jokes. Setup, punchline, deadpan.",
      "🎵 The RSL — sing or rhyme. Lyrics, rhythm, improvised verse.",
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
    strategy: "Home venue: 🎤 The Comedy Club. Hoard Comedy Club cards for pairs, and watch for the 4 kookaburra cards — each one performed is an instant token.",
  },
  cockatoo: {
    title: 'The Bitter Satirist',
    story: "Once the sharpest political wit on breakfast radio, Cocky was cancelled after The Incident (never ask about The Incident). Now he screeches truth to power at anyone within earshot, whether they bought a ticket or not. His crest rises when he's about to say something career-ending. It rises a lot.",
    strategy: "Home venue: 🎤 The Comedy Club. Collect Comedy Club pairs, and hunt the 4 cockatoo cards for instant tokens.",
  },
  quokka: {
    title: 'The Sweaty Warm-up Act',
    story: "The happiest face in show business hides the deepest terror. Quokka has warmed up crowds for legends and been thanked by exactly none of them. Perpetually smiling, perpetually perspiring, she'd sell her own family for a headline slot. Tonight might finally be her night — if the flop sweat doesn't short out the microphone first.",
    strategy: "Home venue: 🎵 The RSL. Pair up RSL cards for tokens, and grab the 4 quokka cards for instant wins.",
  },
  magpie: {
    title: 'The Tragic Songbird',
    story: "Maggie had a voice that could stop traffic — then she started swooping the traffic instead, and the bookings dried up. Every ballad she sings is about betrayal, usually by a former bandmate, occasionally by the concept of spring. Audiences weep. Whether it's the music or fear of being swooped remains an open question.",
    strategy: "Home venue: 🎵 The RSL. Stack RSL cards into pairs, and the 4 magpie cards are instant tokens when performed.",
  },
  emu: {
    title: 'The Chaotic Prop Comic',
    story: "Emu once lost a war against the Australian government and has been processing it through prop comedy ever since. No routine survives contact with Emu — juggling becomes destruction, magic becomes menace, a simple rubber chicken becomes a weapon of chaos. Venues book him because ticket sales spike. Insurance premiums also spike.",
    strategy: "Home venue: 🎪 The Royal Show. Pair Royal Show cards for tokens, and seize the 4 emu cards for instant glory.",
  },
  galah: {
    title: 'The Drunken Clown',
    story: "Banned from three Royal Shows and legally required to stay 50 metres from a fourth, Galah is proof that talent and judgement are different things. Brilliant physical comedian, catastrophic decision-maker. He doesn't fall down drunk — he falls down professionally, and the crowd can never quite tell which. Neither can he.",
    strategy: "Home venue: 🎪 The Royal Show. Collect Royal Show pairs, and the 4 galah cards in the deck are instant tokens.",
  },
  echidna: {
    title: 'The Pretentious Improviser',
    story: "Echidna doesn't do comedy, darling — she does *theatre*. Every 'yes, and' comes with a lecture on Meisner technique. She once did a four-hour one-woman show about a spike. Critics called it 'long'. Prickly about feedback, prickly in general, she's certain the mainstream will catch up to her genius eventually. It has not.",
    strategy: "Home venue: 🎭 The School Play. Pair School Play cards for tokens, and perform the 4 echidna cards for instant tokens.",
  },
  platypus: {
    title: 'The Deadpan Magician',
    story: "Platypus has never smiled on stage. Or off it. Or possibly ever. His act — impossible tricks delivered with the enthusiasm of a tax audit — divides audiences into two camps: those who think he's a genius, and those who've checked if he's asleep. He is a mammal that lays eggs and detects electricity. The magic was never the act.",
    strategy: "Home venue: 🎭 The School Play. Stack School Play pairs, and the 4 platypus cards are instant tokens when performed.",
  },
};

export const PHASE_TIPS = {
  first_turn: {
    icon: '🎬',
    title: 'Your Turn',
    body: [
      "This is home base. Your Prop Tokens are up top — 3 wins the game.",
      "Your Hand shows the Power Cards you've kept. Tap any card to read its power and play it.",
      "When you're ready, hit Draw Power Card to take tonight's gig.",
      "Got two cards from your home venue? A Cash a Pair button will appear — trade them for a token without performing a thing.",
    ],
  },
  first_draw: {
    icon: '🎤',
    title: 'Showtime',
    body: [
      "The drawn card sets the venue — that's the style you must perform in. Your Prompt Card supplies the exact material.",
      "Every prompt has a success condition: 🗳️ the table votes, ✅ it's objectively checkable, or 👤 the player on your left is the judge.",
      "Some prompts are timed — start the timer and don't choke.",
      "Then be honest: ✓ Nailed It or ✗ Fail. Failing means no reward, and the card goes to the discard pile along with your dignity.",
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
    title: 'Venue Match!',
    body: [
      "You performed on home turf, so you keep the card face-up.",
      "Here's the play: two home-venue cards can be cashed in for a Prop Token on your turn — no performance required. Hoard them, and guard them: other players can steal or discard your cards with powers.",
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
      "🛡️ Interrupt cards fire right now: Intermission skips their whole turn, Mime Time silences their performance, Heckler forces them to do it all again, Giggle Box makes them hold eye contact with you.",
      "Watch the leader. The moment someone gets close to 3 tokens, it's everyone's job to ruin their night.",
    ],
  },
  strategy_midgame: {
    icon: '🎯',
    title: 'Someone Has 2 Tokens',
    body: [
      "One more token and they win. This is the moment interrupt cards exist for.",
      "Save Heckler and Intermission for the leader's turns. Use Stage Hook to strip their venue pairs before they cash them.",
      "And if the leader is you — expect the whole table to turn. Standing Ovation and Clap Back are your shields. Good luck.",
    ],
  },
};
