# Pull Another One — Game Mechanics (v0.5)

The Christmas cracker comedy party game. This app is the digital table:
it manages the 52-card Performance deck, each player's Prompt Card, their
hand of kept Power Cards, and their Prop Tokens.

## The Goal

Be the first to collect your table's token target: **3 Prop Tokens** at
3–5 players, **2** at 6–8.

## The 4 Venues

Every Power Card and every Character belongs to one venue. The venue
tells you what kind of performance is required:

| Venue | What you do |
|-------|-------------|
| 🎤 Comedy Lounge | Tell jokes — setup, punchline, deadpan delivery |
| 🎵 The Club | Sing or rhyme — lyrics, rhythm, improvised verse |
| 🎪 The Royal Show | Clown around — mime, physical stunts, slapstick |
| 🎭 The School Play | Act — accents, emotions, roleplay, impressions |

## Setup

Pick the number of players. Each player chooses a **Character** (which fixes
their animal and their home venue, the performance style they get) and a
**Prompt Card** (1–16, their personal
script). Player 1 starts.

## Your Turn

Power first, then cash, then draw. The draw is **last** — deliberately.

### Step 1 — Play a power (optional)
One card. Some powers carry their own printed timing that overrides this step.

### Step 2 — Cash any pairs
Two Power Cards of the same name. Discard both, take a Prop Token.

### Step 3 — Draw
Tap **Draw Power Card**. The app flips the top card face-up for everyone. It
shows a **venue**, an **animal** and a printed **power**.

**A card can never be cashed on the turn it is drawn.** Every card sits
face-up through a full round of everyone else's turns first. Two exceptions:
Animal Affinity pays immediately, and a card *acquired* rather than drawn
(Pie in the Face, Swoop) can be cashed the same turn.

### Step 4 — Perform
The card's venue sets the performance type. The app shows your next unused
prompt for that venue. Prompts are used in order.

**If you have a go, you succeed.** Quality is irrelevant. The only failure is
refusing or making no real attempt; ties go to the performer. If you genuinely
can't do a prompt, tap **pass & draw again** — no failure taken.

### Step 5 — Resolve

**Refused** → the card goes to the discard pile. Turn ends.

**Attempt made** → the app resolves your reward:

1. **🐾 Animal Affinity** — Does the animal on the card match your Character's
   animal? If yes: take a Prop Token. Turn ends.
2. **🃏 No animal match** — Keep the card face-up in front of you. It counts
   toward a pair and its printed power becomes available. Turn ends.

The app auto-detects the outcome from the card data. If the call is ever
wrong, tap **Wrong call? Change…** on the verdict screen to pick manually.

## Cashing a Pair

If you hold two Power Cards with the **same name**, the **Cash a Pair →
Token** button appears on your turn. It's a free action: discard both cards
and take a Prop Token. Venue is irrelevant — each card type appears four
times in the deck, once per venue, so a pair is a name match.

## Using Powers

Every Power Card in your hand has a printed power. Tap a card to read it
and tap **Play Power & Discard** to play it (the card moves to the discard
pile; players resolve the physical effect at the table). A card's printed
power is its full text — there is no separate per-character bonus effect.

## All Players Screen

The **All Players** button (top-right, available on every turn and draw
screen) opens a sheet showing every player's tokens and full hand. From here
you can also adjust tokens (+/−), rename a token, or discard any card — handy
for resolving steals, skips and other power effects.

## When the Deck Runs Out

The app automatically reshuffles the discard pile into a new deck and keeps
going.

## Winning

The moment a player reaches their table's token target, the game ends and that
player takes a bow.

