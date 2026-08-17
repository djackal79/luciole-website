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
their animal and home venue) and a **Prompt Card** (1–16, their personal
script). Player 1 starts.

## Your Turn

### Step 1 — Draw
Tap **Draw Power Card**. The app flips the top card of the deck
face-up for everyone to see. The card shows a **venue**, an **animal**, and
a printed **power**.

### Step 2 — Perform
The card's venue tells you which kind of performance to give. The app shows the next
unused prompt for that venue from your Prompt Card — perform it. Prompts are
used in order; no going back, no cherry-picking.

Your prompt tells you how you'll be judged:

| Icon | Meaning |
|------|---------|
| 🗳️ Vote | Majority of the table decides. Tie goes against you. |
| ✅ Objective | The table can see it happen or not. No vote needed. |
| 👤 Judge | The player to your left decides alone. |

### Step 3 — The Verdict

**Fail** → the card goes to the discard pile. Turn ends.

**Succeed** → the app resolves your reward in this order:

1. **🐾 Animal Affinity** — Does the animal on the card match your Character's
   animal? If yes: take a Prop Token. Turn ends.
2. **✅ Venue Match** — Does the card's venue match your Character's venue?
   If yes: keep the card face-up in your hand. Once you hold two cards
   matching your venue you can cash them for a Prop Token. Turn ends.
3. **🃏 No Match** — Keep the card face-up in your hand for its printed power.
   Turn ends.

The app auto-detects the outcome from the card data. If the call is ever
wrong, tap **Wrong call? Change…** on the verdict screen to pick manually.

## Cashing a Pair

If you hold two Power Cards that both match your Character's venue, the
**Cash a Pair → Token** button appears on your turn. It's a free action:
discard both cards and take a Prop Token.

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

## Family Mode

Removes the **Heckler** and **Mime Time** cards from the deck and hides
adult-themed prompts — for a gentler, mixed-age table.
