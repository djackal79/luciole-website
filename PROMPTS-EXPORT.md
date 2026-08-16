# Pull Another One — Full Prompt Export

Generated 2026-08-16 from `game/data/prompts.js` on branch `claude/board-game-website-gsvngy`.

**This export exists to resolve a conflict.** MINI-CANON §8 states that only Prompt Cards 1–4 are drafted and that cards 5–16 do not exist. The repository contains **fully authored text for all 16 cards**. Nothing here was written or filled in by me — every line below is what is already committed. Please confirm which source is current.

## Summary

| Metric | Value |
|---|---|
| Total prompts in repo | **256** |
| Prompt Cards | 16 (1–16) |
| Per card | 16 (4 per venue) |
| Canon target | 192 (16 cards × 12, 3 per venue) |
| Surplus vs canon | **64** prompts |
| Empty / missing text | 0 |
| Exact duplicates | 0 |
| Over 78 chars | **249** of 256 (97%) |
| Length min / median / max | 59 / 136 / 208 |
| Position 4 (OVER-COUNT) | 64 |
| Timed prompts | 160 |
| Not family-safe | 38 |
| Condition differs from venue default | 35 |

### Success conditions

| Condition | Count |
|---|---|
| 🗳️ Vote | 83 |
| ✅ Objective | 97 |
| 👤 Named judge | 76 |

### Flag key

- `OVER-LENGTH(n)` — text exceeds the 78-character print limit; n is the actual length
- `OVER-COUNT` — a 4th prompt in a venue, where canon allows 3
- `COND-OVERRIDE` — success condition differs from this venue's default (legal per §6, listed so it is visible)
- `DUPLICATE`, `MISSING`, `NO-CONDITION` — none present in this data

**ID scheme:** `P{card}-{venue}-{position}`. Venue codes are `CL` Comedy Lounge, `TC` The Club, `RS` Royal Show, `SP` School Play. Note `TC` replaces the old `RSL` code, which is retired under §1.1.

---

## Prompt Card 1

16 prompts — Comedy Lounge 4 · The Club 4 · The Royal Show 4 · The School Play 4

### Comedy Lounge

**P01-CL-1** · difficulty 1 · 🗳️ Vote · 103 chars · `OVER-LENGTH(103)`

> Tell a joke about the person to your left. Must have a setup and a punchline. Does not have to be good.

*Success:* At least half the table laughs, groans, or boos appreciatively.

**P01-CL-2** · difficulty 2 · 🗳️ Vote · 82 chars · `OVER-LENGTH(82)`

> Tell a knock-knock joke — made up on the spot. No classics. No "interrupting cow."

*Success:* Punchline lands — groan, laugh, or eye-roll accepted. Silence is a fail.

**P01-CL-3** · difficulty 2 · 🗳️ Vote · 136 chars · `OVER-LENGTH(136)`

> Deliver this setup deadpan, pause three seconds, then give your punchline: "I told my family I wanted to be a comedian for Christmas..."

*Success:* Majority decides if the punchline was worth the wait.

**P01-CL-4** · difficulty 3 · 🗳️ Vote · 140 chars · `OVER-LENGTH(140)` `OVER-COUNT`

> Roast the player to your right in exactly three sentences. Must be affectionate. Third sentence must be a compliment disguised as an insult.

*Success:* The roasted player casts the deciding vote.

### The Club

**P01-TC-1** · difficulty 1 · ✅ Objective · 125 chars · `OVER-LENGTH(125)`

> Sing "Happy Birthday" — replace "Happy Birthday" with "Merry Christmas" and the name with the player to your left. Full song.

*Success:* All four lines delivered without stopping. Key irrelevant.

**P01-TC-2** · difficulty 2 · ✅ Objective · 156 chars · `OVER-LENGTH(156)`

> Improvise a four-line rhyming poem about what's on the Christmas table right now. Lines 1 & 3 rhyme. Lines 2 & 4 rhyme. 30 seconds to compose, then perform.

*Success:* Four lines delivered, two rhyme pairs land. Near-rhymes accepted.

**P01-TC-3** · difficulty 2 · ✅ Objective · 141 chars · `OVER-LENGTH(141)`

> Someone names any Australian animal. Sing a jingle — at least three lines — advertising that animal as a Christmas gift. Your choice of tune.

*Success:* Three lines completed, tune maintained, animal mentioned at least twice.

**P01-TC-4** · difficulty 3 · ✅ Objective · 156 chars · `OVER-LENGTH(156)` `OVER-COUNT`

> Player to your left gives you a word. Perform an improvised rap — at least six lines — ending with a rhyme on that word. No pause longer than three seconds.

*Success:* Six lines delivered, final rhyme lands, no stop longer than three seconds.

### The Royal Show

**P01-RS-1** · difficulty 1 · ✅ Objective · 127 chars · ⏱ 20s · `OVER-LENGTH(127)`

> Mime unwrapping a Christmas present. The gift inside is the most disappointing thing imaginable. React accordingly. 20 seconds.

*Success:* Table identifies both the unwrapping and the disappointment without being told. No words.

**P01-RS-2** · difficulty 2 · ✅ Objective · 148 chars · ⏱ 15s · `OVER-LENGTH(148)`

> Perform a 15-second acceptance speech for "Best Performer at the Royal Show" — mime holding a trophy the entire time, getting progressively heavier.

*Success:* Trophy mime maintained throughout, weight progression visible.

**P01-RS-3** · difficulty 2 · 👤 Named judge · 82 chars · `OVER-LENGTH(82)` `COND-OVERRIDE`

> Mime a galah who has just been told it cannot have a cracker. No words, no sounds.

*Success:* Named judge confirms emotion and animal are both readable.

**P01-RS-4** · difficulty 3 · ✅ Objective · 177 chars · ⏱ 30s · `OVER-LENGTH(177)` `OVER-COUNT`

> Mime a 30-second sideshow spruiker's pitch for the most useless product you can think of. Demonstrate the product, show its key feature, indicate the price. No words. No sounds.

*Success:* Table identifies the product and at least one feature without being told.

### The School Play

**P01-SP-1** · difficulty 1 · 👤 Named judge · 166 chars · `OVER-LENGTH(166)`

> Deliver this line in the most dramatic accent you can manage — announce your accent first: "I'm afraid the turkey is going to be at least another forty-five minutes."

*Success:* Named judge confirms accent is recognisable and drama is committed.

**P01-SP-2** · difficulty 2 · 👤 Named judge · 188 chars · ⏱ 20s · `OVER-LENGTH(188)`

> Perform a 20-second scene: you are a first-time actor who has just forgotten all their lines at the school play. Stay in character. Scene ends when you "remember" your line and deliver it.

*Success:* Named judge confirms character held and ending landed.

**P01-SP-3** · difficulty 2 · 👤 Named judge · 174 chars · `OVER-LENGTH(174)`

> Player to your right gives you an emotion. Player to your left gives you a location. Deliver this line combining both — one attempt only: "I can't believe it's come to this."

*Success:* Named judge confirms both emotion and location are readable.

**P01-SP-4** · difficulty 3 · 👤 Named judge · 194 chars · ⏱ 30s · `OVER-LENGTH(194)` `OVER-COUNT`

> Perform a 30-second scene: you are an extremely pretentious theatre director giving notes to the table after watching their "performance." Give specific feedback to at least two players by name.

*Success:* Named judge confirms pretension is sustained and two players were addressed.

---

## Prompt Card 2

16 prompts — Comedy Lounge 4 · The Club 4 · The Royal Show 4 · The School Play 4

### Comedy Lounge

**P02-CL-1** · difficulty 1 · 🗳️ Vote · 90 chars · `OVER-LENGTH(90)`

> Point at any player. Tell a one-liner about their outfit right now. Must have a punchline.

*Success:* The targeted player confirms it landed — laugh, groan, or eye-roll counts.

**P02-CL-2** · difficulty 2 · 🗳️ Vote · 145 chars · ⏱ 60s · `OVER-LENGTH(145)`

> Choose any player. Do a one-minute stand-up bit as if they are the subject — their habits, their quirks, their Christmas behaviour. Keep it warm.

*Success:* The targeted player must be recognisable. Majority decides.

**P02-CL-3** · difficulty 2 · 🗳️ Vote · 134 chars · `OVER-LENGTH(134)`

> Tell a two-sentence joke that begins: "The thing about [player to your right] is..." Setup in sentence one, punchline in sentence two.

*Success:* Majority decides if the punchline landed.

**P02-CL-4** · difficulty 3 · 🗳️ Vote · 177 chars · ⏱ 45s · ⚠️ not family-safe · `OVER-LENGTH(177)` `OVER-COUNT`

> Deliver a full 45-second comedy eulogy for the player to your left — as if they have just retired from Christmas dinners forever. Affectionate. At least two specific "memories."

*Success:* The eulogised player casts the deciding vote.

### The Club

**P02-TC-1** · difficulty 1 · ✅ Objective · 128 chars · `OVER-LENGTH(128)`

> Sing the first verse of "We Wish You a Merry Christmas" — but replace "we" with the name of the player to your right throughout.

*Success:* Full verse completed, name substituted correctly every time.

**P02-TC-2** · difficulty 2 · ✅ Objective · 100 chars · `OVER-LENGTH(100)`

> Player to your left hums any tune. You must sing four lines of improvised lyrics over it. Any topic.

*Success:* Four lines delivered over the tune without stopping.

**P02-TC-3** · difficulty 2 · ✅ Objective · 171 chars · `OVER-LENGTH(171)`

> Compose and perform a four-line birthday song for any player at the table — even if it's not their birthday. Must include their name and one specific true fact about them.

*Success:* Name used, fact included, four lines completed.

**P02-TC-4** · difficulty 3 · 🗳️ Vote · 149 chars · ⏱ 30s · `OVER-LENGTH(149)` `OVER-COUNT` `COND-OVERRIDE`

> Perform a 30-second musical argument — sung, not spoken — with the player to your right. You start. They may respond. You must resolve it in harmony.

*Success:* Majority decides if the argument was musical and the resolution landed.

### The Royal Show

**P02-RS-1** · difficulty 1 · ✅ Objective · 120 chars · ⏱ 15s · `OVER-LENGTH(120)`

> Mime taking a photo of the player to your left as if they are the most fascinating thing you have ever seen. 15 seconds.

*Success:* Camera action and fascination both readable without words.

**P02-RS-2** · difficulty 2 · ✅ Objective · 158 chars · ⏱ 20s · `OVER-LENGTH(158)`

> Mime teaching the player to your right how to do something they obviously already know how to do — very slowly and very condescendingly. 20 seconds. No words.

*Success:* Activity and condescension both readable.

**P02-RS-3** · difficulty 2 · 👤 Named judge · 139 chars · ⏱ 20s · `OVER-LENGTH(139)` `COND-OVERRIDE`

> Mime a talent show audition in which you are desperately trying to impress the player to your left, who is the judge. 20 seconds. No words.

*Success:* The judge confirms they felt the desperation.

**P02-RS-4** · difficulty 3 · ✅ Objective · 150 chars · ⏱ 30s · `OVER-LENGTH(150)` `OVER-COUNT`

> Mime an entire argument — with a full beginning, escalation, and resolution — directed at the player across from you. No words, no sounds. 30 seconds.

*Success:* Table identifies the argument, escalation, and resolution without being told.

### The School Play

**P02-SP-1** · difficulty 1 · 👤 Named judge · 132 chars · `OVER-LENGTH(132)`

> Deliver this line to the player to your left, in a dramatic accent of your choice: "I always knew it would come to this between us."

*Success:* Named judge confirms accent held and drama committed.

**P02-SP-2** · difficulty 2 · 👤 Named judge · 166 chars · ⏱ 20s · `OVER-LENGTH(166)`

> Player to your right gives you one word. Deliver a 20-second dramatic monologue to the player to your left using that word as the theme. Stay in character throughout.

*Success:* Named judge confirms monologue and character both held.

**P02-SP-3** · difficulty 2 · 👤 Named judge · 171 chars · ⏱ 20s · `OVER-LENGTH(171)`

> Perform a 20-second scene in which you are meeting the player to your right for the very first time — but you are absolutely certain you have met before. They may respond.

*Success:* Named judge confirms commitment to the mistaken identity.

**P02-SP-4** · difficulty 3 · 👤 Named judge · 163 chars · ⏱ 40s · ⚠️ not family-safe · `OVER-LENGTH(163)` `OVER-COUNT`

> Perform a 40-second farewell speech to the player across from you — in character as a Shakespearean villain who has just lost everything. Name them at least twice.

*Success:* Named judge confirms character, commitment, and both name uses.

---

## Prompt Card 3

16 prompts — Comedy Lounge 4 · The Club 4 · The Royal Show 4 · The School Play 4

### Comedy Lounge

**P03-CL-1** · difficulty 1 · 🗳️ Vote · 122 chars · `OVER-LENGTH(122)`

> Tell a Christmas cracker joke — but it must be one you have made up right now. Not a real one. Not a good one. Just yours.

*Success:* Groan, laugh, or pained silence all count. Blank stares do not.

**P03-CL-2** · difficulty 2 · 🗳️ Vote · 153 chars · `OVER-LENGTH(153)`

> Go around the table. Each player gives you one word. Use all of them in a single joke. Setup and punchline. You have 30 seconds to compose, then deliver.

*Success:* All words used. Punchline attempted. Majority decides.

**P03-CL-3** · difficulty 2 · 🗳️ Vote · 158 chars · ⏱ 30s · `OVER-LENGTH(158)`

> Deliver a 30-second stand-up bit about this specific Christmas dinner — what's on the table, who's here, what's already gone wrong. At least two observations.

*Success:* Two recognisable observations land. Majority decides.

**P03-CL-4** · difficulty 3 · 🗳️ Vote · 185 chars · ⏱ 45s · `OVER-LENGTH(185)` `OVER-COUNT`

> Perform a 45-second crowd work set. Address at least three players by name with a specific observation about each. No prepared material — everything must be about this table, right now.

*Success:* Three players addressed, three observations recognisable. Majority decides.

### The Club

**P03-TC-1** · difficulty 1 · ✅ Objective · 81 chars · `OVER-LENGTH(81)`

> Lead the whole table in one verse of "Jingle Bells." You conduct. Everyone sings.

*Success:* Full verse completed with the table. You must conduct throughout.

**P03-TC-2** · difficulty 2 · ✅ Objective · 143 chars · `OVER-LENGTH(143)`

> Compose and perform a four-line rhyming toast to the table. Must mention Christmas, must end with something to drink to. 30 seconds to compose.

*Success:* Four lines, rhyme pairs land, toast delivered.

**P03-TC-3** · difficulty 2 · ✅ Objective · 135 chars · ⏱ 20s · `OVER-LENGTH(135)`

> Perform a 20-second jingle advertising this exact gathering — who's here, what you're eating, why it's unmissable. Your choice of tune.

*Success:* Gathering described, tune maintained, 20 seconds reached.

**P03-TC-4** · difficulty 3 · 🗳️ Vote · 150 chars · ⏱ 60s · `OVER-LENGTH(150)` `OVER-COUNT` `COND-OVERRIDE`

> Teach the table a round — at least two parts — of any song, real or invented. Table must be able to join in. 60 seconds total including teaching time.

*Success:* At least half the table joins in. Majority decides if it worked.

### The Royal Show

**P03-RS-1** · difficulty 1 · ✅ Objective · 135 chars · ⏱ 15s · `OVER-LENGTH(135)`

> Mime that you have just discovered something extraordinary under the table. React. Show the table what it is without words. 15 seconds.

*Success:* Table identifies the discovery and the reaction without being told.

**P03-RS-2** · difficulty 2 · ✅ Objective · 132 chars · ⏱ 20s · `OVER-LENGTH(132)`

> Mime a sideshow game that the whole table can play simultaneously — set it up, demonstrate it, invite them in. No words. 20 seconds.

*Success:* Game is identifiable, invitation is clear, majority attempt to play.

**P03-RS-3** · difficulty 2 · ✅ Objective · 116 chars · ⏱ 20s · `OVER-LENGTH(116)`

> Mime conducting the table as an orchestra. Each player is a different instrument — assign them silently. 20 seconds.

*Success:* Each player receives an instrument assignment. Conducting is sustained.

**P03-RS-4** · difficulty 3 · ✅ Objective · 163 chars · ⏱ 30s · `OVER-LENGTH(163)` `OVER-COUNT`

> Perform a 30-second mime in which you are a TV chef presenting this exact Christmas meal to a live studio audience — the table. No words. React to their responses.

*Success:* Meal, chef character, and audience interaction all readable.

### The School Play

**P03-SP-1** · difficulty 1 · 👤 Named judge · 188 chars · `OVER-LENGTH(188)`

> Deliver this line to the whole table as if making a major announcement at a school assembly: "I have something very important to tell you all." Then pause. Then improvise the announcement.

*Success:* Named judge confirms announcement was committed and delivered in character.

**P03-SP-2** · difficulty 2 · 👤 Named judge · 170 chars · ⏱ 20s · `OVER-LENGTH(170)`

> Perform a 20-second scene: you are the narrator of a nature documentary, and the table is the wildlife. Describe what you observe. At least two players must be mentioned.

*Success:* Named judge confirms narrator character held and two players described.

**P03-SP-3** · difficulty 2 · 👤 Named judge · 171 chars · `OVER-LENGTH(171)`

> Player to your left names an emotion. Deliver the following line to the whole table expressing that emotion completely: "Right. Who's ready for dessert?" One attempt only.

*Success:* Named judge confirms emotion is readable and commitment is total.

**P03-SP-4** · difficulty 3 · 👤 Named judge · 205 chars · ⏱ 40s · `OVER-LENGTH(205)` `OVER-COUNT`

> Perform a 40-second scene: you are a motivational speaker addressing the table at a corporate retreat. This Christmas dinner is the team-building exercise. At least three players must be addressed by name.

*Success:* Named judge confirms character, commitment, and three name uses.

---

## Prompt Card 4

16 prompts — Comedy Lounge 4 · The Club 4 · The Royal Show 4 · The School Play 4

### Comedy Lounge

**P04-CL-1** · difficulty 1 · 🗳️ Vote · 107 chars · `OVER-LENGTH(107)`

> Tell a joke with a deliberately terrible pun as the punchline. Announce the pun proudly. Own it completely.

*Success:* Majority confirms the pun was truly terrible and fully committed to.

**P04-CL-2** · difficulty 2 · 🗳️ Vote · 160 chars · `OVER-LENGTH(160)`

> Set up a joke. Deliver the setup. Then give the wrong punchline — deliberately. Then give the right one. The wrong punchline must be funnier than the right one.

*Success:* Majority decides if the wrong punchline was funnier.

**P04-CL-3** · difficulty 2 · 🗳️ Vote · 171 chars · `OVER-LENGTH(171)`

> Tell a joke so slowly that the table thinks you have forgotten it. You have not forgotten it. Maintain total confidence throughout. Deliver the punchline at your own pace.

*Success:* Majority decides if the slow delivery made it funnier or just uncomfortable.

**P04-CL-4** · difficulty 3 · 🗳️ Vote · 168 chars · ⏱ 30s · `OVER-LENGTH(168)` `OVER-COUNT`

> Perform a 30-second "anti-joke" — set up a classic joke structure, then give a completely literal, humourless answer. Then explain, earnestly, why it is actually funny.

*Success:* Majority decides if the commitment to the bit landed.

### The Club

**P04-TC-1** · difficulty 1 · ✅ Objective · 69 chars

> Sing any Christmas song — but swap every noun for the word "cracker."

*Success:* At least one full verse completed, every noun replaced.

**P04-TC-2** · difficulty 2 · ✅ Objective · 133 chars · `OVER-LENGTH(133)`

> Perform a four-line rhyme in which every line ends with a word that almost rhymes but doesn't quite. Commit fully to the near-rhymes.

*Success:* Four lines completed, near-rhymes confirmed as near but not exact.

**P04-TC-3** · difficulty 2 · ✅ Objective · 135 chars · `OVER-LENGTH(135)`

> Perform a jingle for a product that does not exist — but make it sound completely plausible. At least three lines. Your choice of tune.

*Success:* Product described, jingle completed, tune maintained.

**P04-TC-4** · difficulty 3 · 🗳️ Vote · 140 chars · ⏱ 30s · `OVER-LENGTH(140)` `OVER-COUNT` `COND-OVERRIDE`

> Perform a 30-second song in which you gradually reveal, line by line, an increasingly unlikely Christmas confession. Must build to a finale.

*Success:* Majority decides if the build and reveal landed.

### The Royal Show

**P04-RS-1** · difficulty 1 · ✅ Objective · 112 chars · ⏱ 15s · `OVER-LENGTH(112)`

> Mime performing a magic trick — set it up, perform it, react to the result. The trick must go wrong. 15 seconds.

*Success:* Setup, attempt, and failure all readable. No words.

**P04-RS-2** · difficulty 2 · ✅ Objective · 131 chars · ⏱ 20s · `OVER-LENGTH(131)`

> Mime attempting to pick a pocket — from someone sitting across the table, without them noticing — very badly. 20 seconds. No words.

*Success:* Attempt and failure both readable. Target confirms they "didn't notice."

**P04-RS-3** · difficulty 2 · 👤 Named judge · 147 chars · ⏱ 20s · `OVER-LENGTH(147)` `COND-OVERRIDE`

> Mime that you have something hidden under the table — build the anticipation — then reveal it. React to the table's reaction. No words. 20 seconds.

*Success:* Named judge confirms anticipation built and reveal committed.

**P04-RS-4** · difficulty 3 · ✅ Objective · 178 chars · ⏱ 30s · `OVER-LENGTH(178)` `OVER-COUNT`

> Perform a 30-second mime of a sideshow escape act — you are tied up, you escape, you take a bow. Must include a moment where it looks like you won't make it. No words, no sounds.

*Success:* Table identifies setup, near-failure moment, escape, and bow.

### The School Play

**P04-SP-1** · difficulty 1 · 👤 Named judge · 157 chars · `OVER-LENGTH(157)`

> Deliver this line completely straight, as if it is the most normal thing in the world: "I've been living under the table for three weeks and nobody noticed."

*Success:* Named judge confirms straight delivery — no smiling, no irony.

**P04-SP-2** · difficulty 2 · 👤 Named judge · 146 chars · ⏱ 20s · `OVER-LENGTH(146)`

> Perform a 20-second scene: you are an actor in a play who knows they are in a play and keeps breaking the fourth wall — but the character doesn't.

*Success:* Named judge confirms both layers — character and meta-awareness — are readable.

**P04-SP-3** · difficulty 2 · 👤 Named judge · 140 chars · ⏱ 20s · `OVER-LENGTH(140)`

> Deliver a 20-second confession — in a dramatic accent — for something minor that happened at this dinner tonight. Treat it as a major crime.

*Success:* Named judge confirms accent held and gravity committed.

**P04-SP-4** · difficulty 3 · 👤 Named judge · 176 chars · ⏱ 40s · `OVER-LENGTH(176)` `OVER-COUNT`

> Perform a 40-second scene: you are a stage magician's assistant who is tired of being sawn in half and has decided to make a stand. Mid-performance. In front of a packed house.

*Success:* Named judge confirms character, situation, and emotional commitment all held.

---

## Prompt Card 5

16 prompts — Comedy Lounge 4 · The Club 4 · The Royal Show 4 · The School Play 4

### Comedy Lounge

**P05-CL-1** · difficulty 1 · 🗳️ Vote · 94 chars · `OVER-LENGTH(94)`

> Tell a joke about a Christmas tradition you personally find ridiculous. Must have a punchline.

*Success:* Majority confirms the punchline landed and the tradition is recognisable.

**P05-CL-2** · difficulty 2 · 🗳️ Vote · 143 chars · ⏱ 20s · `OVER-LENGTH(143)`

> Deliver a 20-second stand-up bit defending one genuinely terrible Christmas food as if it is a national treasure. Absolute conviction required.

*Success:* Majority confirms conviction was total and argument was at least half-believable.

**P05-CL-3** · difficulty 2 · 🗳️ Vote · 97 chars · `OVER-LENGTH(97)`

> Tell a joke about Santa Claus that has never been told before. You have 20 seconds to compose it.

*Success:* Majority confirms it is not a known joke. Punchline must land.

**P05-CL-4** · difficulty 3 · 🗳️ Vote · 177 chars · ⏱ 45s · `OVER-LENGTH(177)` `OVER-COUNT`

> Perform a 45-second stand-up bit about the specific horrors of Christmas shopping. Must include a specific product, a specific shop, and a punchline that lands on the last line.

*Success:* Product and shop named, punchline on the last line, majority decides.

### The Club

**P05-TC-1** · difficulty 1 · ✅ Objective · 159 chars · `OVER-LENGTH(159)`

> Sing "Rudolph the Red-Nosed Reindeer" — but Rudolph has been replaced by an Australian animal of the table's choosing. Substitute the animal's name throughout.

*Success:* Full verse completed, animal substituted correctly every time.

**P05-TC-2** · difficulty 2 · ✅ Objective · 132 chars · `OVER-LENGTH(132)`

> Improvise a four-line carol about the worst possible Christmas present. Lines 1 & 3 rhyme. Lines 2 & 4 rhyme. 30 seconds to compose.

*Success:* Four lines completed, rhyme pairs land, present is genuinely terrible.

**P05-TC-3** · difficulty 2 · ✅ Objective · 155 chars · ⏱ 20s · `OVER-LENGTH(155)`

> Perform a 20-second jingle for Christmas crackers — as if they are a new product that has never existed before and you are selling them for the first time.

*Success:* Jingle completed, product described, 20 seconds reached.

**P05-TC-4** · difficulty 3 · ✅ Objective · 180 chars · ⏱ 30s · `OVER-LENGTH(180)` `OVER-COUNT`

> Perform a 30-second Christmas rap. Must include: one family member, one food on the table, one complaint about the weather, and a closing rhyme. No pause longer than three seconds.

*Success:* All four elements included, final rhyme lands, no long pauses.

### The Royal Show

**P05-RS-1** · difficulty 1 · ✅ Objective · 139 chars · ⏱ 15s · `OVER-LENGTH(139)`

> Mime pulling a Christmas cracker with someone who is pulling too hard. Mime the snap, the contents flying out, the paper crown. 15 seconds.

*Success:* All three stages readable without words.

**P05-RS-2** · difficulty 2 · ✅ Objective · 147 chars · ⏱ 20s · `OVER-LENGTH(147)`

> Mime assembling a piece of flat-pack furniture on Christmas morning — instructions in hand, confidence eroding progressively. 20 seconds. No words.

*Success:* Assembly attempt, confusion, and eroding confidence all readable.

**P05-RS-3** · difficulty 2 · 👤 Named judge · 100 chars · ⏱ 20s · `OVER-LENGTH(100)` `COND-OVERRIDE`

> Mime being a Christmas turkey who has just realised what day it is. 20 seconds. No words, no sounds.

*Success:* Named judge confirms the realisation moment is clear and committed.

**P05-RS-4** · difficulty 3 · ✅ Objective · 169 chars · ⏱ 30s · `OVER-LENGTH(169)` `OVER-COUNT`

> Mime a 30-second scene in which you are Santa Claus, stuck in a chimney, attempting to free yourself with dignity intact before the family wakes up. No words, no sounds.

*Success:* Situation, struggle, dignity, and resolution all readable.

### The School Play

**P05-SP-1** · difficulty 1 · 👤 Named judge · 140 chars · `OVER-LENGTH(140)`

> Deliver this line in a strong Australian accent, as if it is the most devastating news you have ever received: "They've sold out of prawns."

*Success:* Named judge confirms accent and devastation both committed.

**P05-SP-2** · difficulty 2 · 👤 Named judge · 125 chars · ⏱ 20s · `OVER-LENGTH(125)`

> Perform a 20-second scene: you are the Ghost of Christmas Present, and this dinner table is your evidence. Present your case.

*Success:* Named judge confirms character held and case presented.

**P05-SP-3** · difficulty 2 · 👤 Named judge · 140 chars · ⏱ 20s · `OVER-LENGTH(140)`

> Perform a 20-second scene: you are a very small child on Christmas morning who has just found out that Santa is not real. This is the scene.

*Success:* Named judge confirms age, emotion, and moment are all readable.

**P05-SP-4** · difficulty 3 · 👤 Named judge · 156 chars · ⏱ 40s · `OVER-LENGTH(156)` `OVER-COUNT`

> Perform a 40-second dramatic reading of a Christmas cracker joke — as if it is Hamlet's soliloquy. Minimum two costume adjustments using items on the table.

*Success:* Named judge confirms Shakespearean gravity maintained and two adjustments made.

---

## Prompt Card 6

16 prompts — Comedy Lounge 4 · The Club 4 · The Royal Show 4 · The School Play 4

### Comedy Lounge

**P06-CL-1** · difficulty 1 · 🗳️ Vote · 139 chars · `OVER-LENGTH(139)`

> Tell a two-sentence story about something that definitely did not happen to you this year. Must have a beginning and an end. Must be funny.

*Success:* Majority confirms two sentences, ending, and at least a smile.

**P06-CL-2** · difficulty 2 · 🗳️ Vote · 127 chars · ⏱ 20s · `OVER-LENGTH(127)`

> Tell a 20-second story that begins: "So this one time at a Christmas party..." It must escalate. It must end badly for someone.

*Success:* Escalation confirmed, ending confirmed, majority decides if it landed.

**P06-CL-3** · difficulty 2 · 🗳️ Vote · 174 chars · ⏱ 30s · `OVER-LENGTH(174)`

> Tell a joke in the style of a long, rambling story that seems to be going nowhere — and then arrives at a punchline so precise the table can't believe it. 30 seconds maximum.

*Success:* Majority decides if the punchline justified the journey.

**P06-CL-4** · difficulty 3 · 🗳️ Vote · 141 chars · ⏱ 45s · ⚠️ not family-safe · `OVER-LENGTH(141)` `OVER-COUNT`

> Perform a 45-second comedic TED Talk on a topic of your choice. Must have a title, a thesis, and a call to action. Deadpan delivery required.

*Success:* Title stated, thesis argued, call to action delivered, majority decides.

### The Club

**P06-TC-1** · difficulty 1 · ✅ Objective · 109 chars · `OVER-LENGTH(109)`

> Sing a four-line ballad about something that went wrong today. Any tune. Must end on a high note — literally.

*Success:* Four lines, today referenced, high note attempted on final line.

**P06-TC-2** · difficulty 2 · ✅ Objective · 110 chars · `OVER-LENGTH(110)`

> Perform a sea shanty — at least four lines — about the journey to this Christmas dinner. Include one hardship.

*Success:* Four lines, journey referenced, hardship included, shanty rhythm maintained.

**P06-TC-3** · difficulty 2 · ✅ Objective · 122 chars · `OVER-LENGTH(122)`

> Improvise a country song about a pet — real or imaginary — who ruined Christmas. Four lines minimum. Your choice of twang.

*Success:* Four lines, pet named, ruin described, country affect maintained.

**P06-TC-4** · difficulty 3 · 🗳️ Vote · 129 chars · ⏱ 30s · `OVER-LENGTH(129)` `OVER-COUNT` `COND-OVERRIDE`

> Perform a 30-second opera about something trivial that happened in the last hour. Sung throughout. Must include a dramatic death.

*Success:* Event identifiable, death performed, sung throughout, majority decides.

### The Royal Show

**P06-RS-1** · difficulty 1 · ✅ Objective · 121 chars · ⏱ 20s · `OVER-LENGTH(121)`

> Mime telling a story — with a beginning, middle, and end — entirely in gestures. 20 seconds. The story must have a twist.

*Success:* Three stages and twist all readable. No words.

**P06-RS-2** · difficulty 2 · ✅ Objective · 126 chars · ⏱ 20s · `OVER-LENGTH(126)`

> Mime a person discovering they have superpowers for the first time — right here, at the Christmas table. 20 seconds. No words.

*Success:* Discovery, power, and reaction all readable.

**P06-RS-3** · difficulty 2 · 👤 Named judge · 117 chars · ⏱ 25s · `OVER-LENGTH(117)` `COND-OVERRIDE`

> Mime a silent film — hero, villain, chase, resolution — in 25 seconds. Must involve at least one item from the table.

*Success:* Named judge confirms all four story elements and table item use.

**P06-RS-4** · difficulty 3 · ✅ Objective · 155 chars · ⏱ 35s · `OVER-LENGTH(155)` `OVER-COUNT`

> Perform a 35-second mime of a nature documentary moment — predator, prey, chase, outcome — at the Christmas table. You play all roles. No words, no sounds.

*Success:* Predator, prey, chase, and outcome all readable. Roles are distinct.

### The School Play

**P06-SP-1** · difficulty 1 · 👤 Named judge · 127 chars · `OVER-LENGTH(127)`

> Deliver this line as the opening of a dramatic story — then improvise the next sentence: "Nobody expected it to end like this."

*Success:* Named judge confirms dramatic opening and second sentence committed.

**P06-SP-2** · difficulty 2 · 👤 Named judge · 160 chars · ⏱ 20s · `OVER-LENGTH(160)`

> Perform a 20-second scene: you are a character in a soap opera who has just discovered a terrible secret about someone at this table. You cannot say what it is.

*Success:* Named judge confirms secret-keeping, drama, and character held.

**P06-SP-3** · difficulty 2 · 👤 Named judge · 154 chars · ⏱ 20s · `OVER-LENGTH(154)`

> Player to your left gives you a genre (horror, romance, Western, etc.). Perform a 20-second scene from a film in that genre — set at this Christmas table.

*Success:* Named judge confirms genre, setting, and character all committed.

**P06-SP-4** · difficulty 3 · 👤 Named judge · 165 chars · ⏱ 40s · ⚠️ not family-safe · `OVER-LENGTH(165)` `OVER-COUNT`

> Perform a 40-second dramatic monologue as the last surviving member of a civilisation explaining to future generations what Christmas dinner was. Treat it as sacred.

*Success:* Named judge confirms gravity, detail, and character held throughout.

---

## Prompt Card 7

16 prompts — Comedy Lounge 4 · The Club 4 · The Royal Show 4 · The School Play 4

### Comedy Lounge

**P07-CL-1** · difficulty 1 · 🗳️ Vote · 132 chars · `OVER-LENGTH(132)`

> Do your best impression of any animal at the table — the characters on the game cards, not the players. One sentence in their voice.

*Success:* Majority identifies the animal.

**P07-CL-2** · difficulty 2 · 🗳️ Vote · 138 chars · `OVER-LENGTH(138)`

> Do an impression of any well-known Australian — politician, sportsperson, TV personality — telling a Christmas joke. Must be recognisable.

*Success:* Majority identifies the person. Joke has a punchline.

**P07-CL-3** · difficulty 2 · 🗳️ Vote · 121 chars · `OVER-LENGTH(121)`

> Deliver this line as three different people in quick succession — announce each one: "Well. That could have gone better."

*Success:* Three distinct voices. Majority identifies at least two.

**P07-CL-4** · difficulty 3 · 🗳️ Vote · 179 chars · ⏱ 30s · `OVER-LENGTH(179)` `OVER-COUNT`

> Perform a 30-second stand-up set entirely in the voice of a well-known Australian you have not done before. Majority must identify them within the first 10 seconds or you restart.

*Success:* Identified within 10 seconds. Set runs 30 seconds. Majority decides.

### The Club

**P07-TC-1** · difficulty 1 · ✅ Objective · 91 chars · `OVER-LENGTH(91)`

> Sing one verse of any song — in the singing style of any animal. Announce the animal first.

*Success:* Full verse, animal style maintained throughout.

**P07-TC-2** · difficulty 2 · ✅ Objective · 107 chars · `OVER-LENGTH(107)`

> Sing "Waltzing Matilda" in the style of a genre that has never been used for it before. Announce the genre.

*Success:* Full first verse, genre announced, style maintained.

**P07-TC-3** · difficulty 2 · 🗳️ Vote · 119 chars · `OVER-LENGTH(119)` `COND-OVERRIDE`

> Perform a four-line song in the voice of any well-known Australian, singing about their own fame. Must be recognisable.

*Success:* Majority identifies the person. Four lines completed.

**P07-TC-4** · difficulty 3 · ✅ Objective · 127 chars · ⏱ 30s · `OVER-LENGTH(127)` `OVER-COUNT`

> Perform a 30-second duet — alone. Two distinct voices, two distinct parts, at least one moment of harmony. Your choice of song.

*Success:* Two voices distinct, both parts delivered, harmony attempted.

### The Royal Show

**P07-RS-1** · difficulty 1 · ✅ Objective · 115 chars · ⏱ 15s · `OVER-LENGTH(115)`

> Mime the physical mannerisms of any player at the table — without using their name or pointing at them. 15 seconds.

*Success:* Majority identifies the player without prompting.

**P07-RS-2** · difficulty 2 · ✅ Objective · 120 chars · ⏱ 20s · `OVER-LENGTH(120)`

> Mime being a specific animal — not a human — attempting to sit at a Christmas dinner table and eat politely. 20 seconds.

*Success:* Animal and the struggle for politeness both readable. No words.

**P07-RS-3** · difficulty 2 · 👤 Named judge · 76 chars · ⏱ 20s · `COND-OVERRIDE`

> Mime the walk of three different people — announce each one — in 20 seconds.

*Success:* Named judge confirms three distinct walks.

**P07-RS-4** · difficulty 3 · ✅ Objective · 200 chars · ⏱ 30s · `OVER-LENGTH(200)` `OVER-COUNT`

> Perform a 30-second physical transformation — mime changing from one animal into a completely different animal, mid-scene. The table must identify both animals without being told. No words, no sounds.

*Success:* Both animals identified by majority. Transformation has a clear midpoint.

### The School Play

**P07-SP-1** · difficulty 1 · 👤 Named judge · 105 chars · `OVER-LENGTH(105)`

> Deliver this line in the voice of someone much older than you: "In my day, Christmas was very different."

*Success:* Named judge confirms age is readable and character committed.

**P07-SP-2** · difficulty 2 · 👤 Named judge · 155 chars · ⏱ 20s · `OVER-LENGTH(155)`

> Perform a 20-second scene as any well-known Australian — in character — reacting to this Christmas dinner for the first time. Stay in character throughout.

*Success:* Named judge identifies the person and confirms character held.

**P07-SP-3** · difficulty 2 · 👤 Named judge · 154 chars · ⏱ 20s · `OVER-LENGTH(154)`

> Player to your right names a famous person. Perform a 20-second scene as that person, in their accent, discovering they've been given a Christmas cracker.

*Success:* Named judge confirms accent, character, and moment all committed.

**P07-SP-4** · difficulty 3 · 👤 Named judge · 181 chars · ⏱ 40s · `OVER-LENGTH(181)` `OVER-COUNT`

> Perform a 40-second scene as two characters in rapid alternation — you play both, switching every few lines. Characters must be clearly distinct in voice, physicality, and attitude.

*Success:* Named judge confirms both characters distinct and switches clear.

---

## Prompt Card 8

16 prompts — Comedy Lounge 4 · The Club 4 · The Royal Show 4 · The School Play 4

### Comedy Lounge

**P08-CL-1** · difficulty 1 · 🗳️ Vote · 78 chars

> Ask the table for a topic. Tell a joke about it. You have 20 seconds to think.

*Success:* Punchline lands. Majority decides.

**P08-CL-2** · difficulty 2 · 🗳️ Vote · 104 chars · `OVER-LENGTH(104)`

> Each player gives you one word. Tell a single joke that uses every word. You have 30 seconds to compose.

*Success:* All words used. Punchline attempted. Majority decides.

**P08-CL-3** · difficulty 2 · 🗳️ Vote · 125 chars · `OVER-LENGTH(125)`

> Player to your left gives you a punchline. You must construct the setup to make it work. 30 seconds to compose, then deliver.

*Success:* Setup makes the punchline land. Majority decides.

**P08-CL-4** · difficulty 3 · 🗳️ Vote · 148 chars · ⏱ 30s · `OVER-LENGTH(148)` `OVER-COUNT`

> The table gives you: a person, a place, and a problem. Perform a 30-second stand-up bit incorporating all three. Punchline must land on the problem.

*Success:* All three elements used. Problem is the punchline. Majority decides.

### The Club

**P08-TC-1** · difficulty 1 · ✅ Objective · 87 chars · `OVER-LENGTH(87)`

> Player to your right names a colour. Sing a four-line song about that colour. Any tune.

*Success:* Colour mentioned at least twice. Four lines completed.

**P08-TC-2** · difficulty 2 · ✅ Objective · 111 chars · `OVER-LENGTH(111)`

> Each player shouts out one random word. Weave all of them into a four-line rhyming song. 30 seconds to compose.

*Success:* All words used. Four lines. Rhyme pairs land.

**P08-TC-3** · difficulty 2 · ✅ Objective · 106 chars · `OVER-LENGTH(106)`

> Player to your left gives you a tune by humming it. You sing four lines of new, improvised lyrics over it.

*Success:* Four lines delivered. Tune followed.

**P08-TC-4** · difficulty 3 · ✅ Objective · 164 chars · `OVER-LENGTH(164)` `OVER-COUNT`

> The table votes on a song. You perform it — but every noun is replaced with a noun shouted by the player to your right, live, as you sing. No stopping to negotiate.

*Success:* Song performed, substitutions accepted in real time, no full stops.

### The Royal Show

**P08-RS-1** · difficulty 1 · ✅ Objective · 100 chars · ⏱ 15s · `OVER-LENGTH(100)`

> Player to your right mimes an action. You copy it — but bigger. Then bigger again. 15 seconds total.

*Success:* Original action readable. Two escalations visible.

**P08-RS-2** · difficulty 2 · ✅ Objective · 106 chars · ⏱ 20s · `OVER-LENGTH(106)`

> Player to your left gives you a prop — any object on the table. Mime a 20-second act using only that prop.

*Success:* Prop used throughout. Act has a beginning and end. No words.

**P08-RS-3** · difficulty 2 · 👤 Named judge · 142 chars · ⏱ 20s · `OVER-LENGTH(142)` `COND-OVERRIDE`

> The table nominates a volunteer. You mime directing that player through a task they cannot see you describing. 20 seconds. No words or sounds.

*Success:* Named judge confirms task was communicated clearly.

**P08-RS-4** · difficulty 3 · ✅ Objective · 141 chars · ⏱ 30s · `OVER-LENGTH(141)` `OVER-COUNT`

> Each player mimes one movement — go around the table quickly. You must chain all movements into a 30-second continuous performance. No words.

*Success:* All movements incorporated. Performance is continuous.

### The School Play

**P08-SP-1** · difficulty 1 · 👤 Named judge · 139 chars · `OVER-LENGTH(139)`

> Player to your left gives you an emotion. Deliver this line with that emotion completely: "Could someone pass the gravy?" One attempt only.

*Success:* Named judge confirms emotion readable and committed.

**P08-SP-2** · difficulty 2 · 👤 Named judge · 128 chars · ⏱ 20s · `OVER-LENGTH(128)`

> Player to your right gives you an accent. Player to your left gives you an occupation. Perform a 20-second scene combining both.

*Success:* Named judge confirms both accent and occupation readable.

**P08-SP-3** · difficulty 2 · 👤 Named judge · 118 chars · ⏱ 20s · `OVER-LENGTH(118)`

> The table gives you a setting, a character, and a line of dialogue. Perform a 20-second scene incorporating all three.

*Success:* Named judge confirms all three elements used and character committed.

**P08-SP-4** · difficulty 3 · 👤 Named judge · 200 chars · `OVER-LENGTH(200)` `OVER-COUNT`

> Each player gives you one instruction for how to perform — louder, slower, angrier, etc. Deliver this speech incorporating all instructions simultaneously: "I would like to thank everyone for coming."

*Success:* Named judge confirms all instructions applied and speech completed.

---

## Prompt Card 9

16 prompts — Comedy Lounge 4 · The Club 4 · The Royal Show 4 · The School Play 4

### Comedy Lounge

**P09-CL-1** · difficulty 1 · ✅ Objective · 89 chars · ⏱ 30s · `OVER-LENGTH(89)` `COND-OVERRIDE`

> Tell three jokes in 30 seconds. They do not need to be good. They need to be three jokes.

*Success:* Three setups and three punchlines delivered in 30 seconds.

**P09-CL-2** · difficulty 2 · 🗳️ Vote · 85 chars · `OVER-LENGTH(85)`

> Tell a joke without using the words "the," "a," or "and." No pausing to self-correct.

*Success:* Forbidden words not used. Punchline lands. Majority decides.

**P09-CL-3** · difficulty 2 · 🗳️ Vote · 93 chars · ⏱ 20s · `OVER-LENGTH(93)`

> Deliver a 20-second comedy bit speaking only in questions. Every sentence must be a question.

*Success:* Every sentence is a question. Majority decides if it was funny.

**P09-CL-4** · difficulty 3 · 🗳️ Vote · 168 chars · ⏱ 45s · `OVER-LENGTH(168)` `OVER-COUNT`

> Perform a 45-second stand-up set in which every sentence must make the table laugh or groan before you can say the next one. If two sentences pass in silence, you fail.

*Success:* No two consecutive silent sentences. Majority decides on each.

### The Club

**P09-TC-1** · difficulty 1 · ✅ Objective · 94 chars · ⏱ 20s · `OVER-LENGTH(94)`

> Sing as many Christmas song titles as you can in 20 seconds — to any tune — without repeating.

*Success:* At least five titles. No repeats. Sung, not spoken.

**P09-TC-2** · difficulty 2 · ✅ Objective · 95 chars · ⏱ 20s · `OVER-LENGTH(95)`

> Improvise a four-line rhyming verse in under 20 seconds. No composing time — start immediately.

*Success:* Four lines. Rhyme pairs land. Delivered in under 20 seconds.

**P09-TC-3** · difficulty 2 · ✅ Objective · 117 chars · `OVER-LENGTH(117)`

> Sing any verse of any song — but every word must be replaced with the word "cracker." Tune maintained. No hesitation.

*Success:* Full verse, "cracker" only, tune maintained, no stops.

**P09-TC-4** · difficulty 3 · 🗳️ Vote · 113 chars · ⏱ 30s · `OVER-LENGTH(113)` `OVER-COUNT` `COND-OVERRIDE`

> Perform a 30-second song with no repeated words. Any song, any tune — but the moment you repeat a word, you fail.

*Success:* Majority tracks repeated words. 30 seconds reached. Majority decides.

### The Royal Show

**P09-RS-1** · difficulty 1 · ✅ Objective · 94 chars · ⏱ 15s · `OVER-LENGTH(94)`

> Mime five different emotions in 15 seconds — player to your left calls them out one at a time.

*Success:* Five distinct expressions. Named judge confirms each is readable.

**P09-RS-2** · difficulty 2 · ✅ Objective · 90 chars · ⏱ 15s · `OVER-LENGTH(90)`

> Mime building something — anything — in 15 seconds. Table must identify it. No extra time.

*Success:* Table identifies the object in under five seconds of viewing.

**P09-RS-3** · difficulty 2 · ✅ Objective · 140 chars · ⏱ 20s · `OVER-LENGTH(140)`

> Perform a 20-second mime in which you change your entire physicality — age, size, mood — every five seconds. Four distinct states. No words.

*Success:* Four distinct states. Transitions visible. No overlap.

**P09-RS-4** · difficulty 3 · ✅ Objective · 158 chars · ⏱ 20s · `OVER-LENGTH(158)` `OVER-COUNT`

> Perform a complete story — setup, conflict, resolution — in mime, in 20 seconds. No words, no sounds. Table must identify all three stages without being told.

*Success:* All three stages identified by majority.

### The School Play

**P09-SP-1** · difficulty 1 · 👤 Named judge · 111 chars · `OVER-LENGTH(111)`

> Deliver this line in three completely different accents, back to back, no pausing: "Merry Christmas, everyone."

*Success:* Named judge confirms three distinct accents, no pauses between.

**P09-SP-2** · difficulty 2 · 👤 Named judge · 103 chars · ⏱ 20s · `OVER-LENGTH(103)`

> Perform a 20-second scene speaking only in one-word sentences. Every sentence: one word. No exceptions.

*Success:* Named judge confirms one-word sentences throughout and scene committed.

**P09-SP-3** · difficulty 2 · 👤 Named judge · 138 chars · ⏱ 20s · `OVER-LENGTH(138)`

> Perform a 20-second dramatic monologue in which you must change emotion completely every five seconds. Four emotions, called by the table.

*Success:* Named judge confirms four distinct emotions and four transitions.

**P09-SP-4** · difficulty 3 · 👤 Named judge · 143 chars · ⏱ 30s · `OVER-LENGTH(143)` `OVER-COUNT`

> Perform a 30-second scene that begins in whispers and ends in full theatrical volume — linear escalation, no jumps. Scene content: your choice.

*Success:* Named judge confirms linear escalation and committed scene.

---

## Prompt Card 10

16 prompts — Comedy Lounge 4 · The Club 4 · The Royal Show 4 · The School Play 4

### Comedy Lounge

**P10-CL-1** · difficulty 1 · 🗳️ Vote · 99 chars · `OVER-LENGTH(99)`

> Tell a joke about something that has already happened at this table tonight. Must have a punchline.

*Success:* Event recognisable. Punchline lands. Majority decides.

**P10-CL-2** · difficulty 2 · 🗳️ Vote · 128 chars · ⏱ 20s · `OVER-LENGTH(128)`

> Reference the worst performance at this table so far tonight — kindly — in a 20-second stand-up bit. Must end with a compliment.

*Success:* Performance recognisable. Compliment lands. Majority decides.

**P10-CL-3** · difficulty 2 · 🗳️ Vote · 137 chars · ⏱ 20s · `OVER-LENGTH(137)`

> Deliver a 20-second "previously on" recap of this game so far — in the voice of a dramatic TV narrator. At least three events referenced.

*Success:* Three events confirmed by table. Drama committed. Majority decides.

**P10-CL-4** · difficulty 3 · 🗳️ Vote · 197 chars · ⏱ 40s · ⚠️ not family-safe · `OVER-LENGTH(197)` `OVER-COUNT`

> Perform a 40-second roast of the current leader — the player with the most tokens. Reference at least two specific things they have done in this game. Affectionate. Ends with genuine encouragement.

*Success:* Two game moments referenced, encouragement delivered, majority decides.

### The Club

**P10-TC-1** · difficulty 1 · ✅ Objective · 107 chars · `OVER-LENGTH(107)`

> Sing a four-line song about the first prompt anyone performed tonight. Must be recognisable as a reference.

*Success:* First prompt identifiable from lyrics. Four lines completed.

**P10-TC-2** · difficulty 2 · ✅ Objective · 118 chars · `OVER-LENGTH(118)`

> Perform a four-line rhyming verse summarising the game so far — one line per round if possible. 30 seconds to compose.

*Success:* Game events referenced, four lines, rhyme pairs land.

**P10-TC-3** · difficulty 2 · ✅ Objective · 104 chars · ⏱ 20s · `OVER-LENGTH(104)`

> Perform a jingle about the best moment of the evening so far. Must name the player involved. 20 seconds.

*Success:* Moment identifiable, player named, jingle completed.

**P10-TC-4** · difficulty 3 · 🗳️ Vote · 132 chars · ⏱ 30s · `OVER-LENGTH(132)` `OVER-COUNT` `COND-OVERRIDE`

> Perform a 30-second musical tribute to every player at the table — one line each, in order. Every line must rhyme with the previous.

*Success:* Every player gets a line. Chain rhyme maintained. Majority decides.

### The Royal Show

**P10-RS-1** · difficulty 1 · ✅ Objective · 68 chars · ⏱ 15s

> Mime re-enacting the funniest moment of the game so far. 15 seconds.

*Success:* Majority identifies the moment without being told.

**P10-RS-2** · difficulty 2 · ✅ Objective · 97 chars · ⏱ 20s · `OVER-LENGTH(97)`

> Mime re-enacting the worst performance of the game so far — affectionately. 20 seconds. No words.

*Success:* Majority identifies the performance. Affection readable.

**P10-RS-3** · difficulty 2 · 👤 Named judge · 95 chars · ⏱ 15s · `OVER-LENGTH(95)` `COND-OVERRIDE`

> Mime a highlight reel — three moments from the game, back to back, five seconds each. No words.

*Success:* Named judge confirms three distinct moments and transitions.

**P10-RS-4** · difficulty 3 · ✅ Objective · 162 chars · ⏱ 30s · `OVER-LENGTH(162)` `OVER-COUNT`

> Mime a slow-motion replay of the most dramatic moment of the game — with commentary from the table calling out what they're seeing. 30 seconds. No words from you.

*Success:* Table provides commentary. Moment identifiable. 30 seconds reached.

### The School Play

**P10-SP-1** · difficulty 1 · 👤 Named judge · 133 chars · `OVER-LENGTH(133)`

> Deliver this line as a callback to the first thing anyone said in this game: "And that, ladies and gentlemen, is where it all began."

*Success:* Named judge confirms callback is genuine and delivery committed.

**P10-SP-2** · difficulty 2 · 👤 Named judge · 148 chars · ⏱ 20s · `OVER-LENGTH(148)`

> Perform a 20-second scene: you are a documentarian interviewing the table about the events of tonight's game. At least two players asked a question.

*Success:* Named judge confirms documentarian character and two questions.

**P10-SP-3** · difficulty 2 · 👤 Named judge · 168 chars · ⏱ 20s · `OVER-LENGTH(168)`

> Perform a 20-second "director's commentary" on the best performance of the game so far — what worked, what didn't, what it meant. Stay in character as a pompous critic.

*Success:* Named judge confirms pomposity held and performance identified.

**P10-SP-4** · difficulty 3 · 👤 Named judge · 173 chars · ⏱ 40s · `OVER-LENGTH(173)` `OVER-COUNT`

> Perform a 40-second dramatic courtroom scene in which you prosecute the player to your left for their worst performance tonight. Call one witness. Evidence must be specific.

*Success:* Named judge confirms case built, witness called, evidence specific.

---

## Prompt Card 11

16 prompts — Comedy Lounge 4 · The Club 4 · The Royal Show 4 · The School Play 4

### Comedy Lounge

**P11-CL-1** · difficulty 1 · 🗳️ Vote · 80 chars · `OVER-LENGTH(80)`

> Pick up any object on the table. Tell a joke where that object is the punchline.

*Success:* Object used in punchline. Majority confirms it landed.

**P11-CL-2** · difficulty 2 · 🗳️ Vote · 145 chars · ⏱ 20s · `OVER-LENGTH(145)`

> Hold up any object from the table. Deliver a 20-second infomercial for it as if it is the greatest invention of the century. Absolute conviction.

*Success:* Object held throughout. Conviction maintained. Majority decides.

**P11-CL-3** · difficulty 2 · 🗳️ Vote · 109 chars · ⏱ 20s · `OVER-LENGTH(109)`

> Pick any object from the table. It is now evidence in a criminal trial. Deliver a 20-second closing argument.

*Success:* Object is evidence. Argument is constructed. Majority decides.

**P11-CL-4** · difficulty 3 · 🗳️ Vote · 168 chars · ⏱ 30s · `OVER-LENGTH(168)` `OVER-COUNT`

> Pick any two objects from the table. Perform a 30-second stand-up bit in which these objects are the protagonist and antagonist of a story. Name them. Give them voices.

*Success:* Both objects have names and voices. Story has conflict. Majority decides.

### The Club

**P11-TC-1** · difficulty 1 · ✅ Objective · 78 chars

> Pick up any object from the table. Sing a four-line love song to it. Any tune.

*Success:* Object addressed directly. Four lines. Romantic intent clear.

**P11-TC-2** · difficulty 2 · ✅ Objective · 99 chars · `OVER-LENGTH(99)`

> Choose any object from the table. Perform a four-line rhyming eulogy for it as if it has just died.

*Success:* Object named. Four lines. Rhyme pairs land. Gravity maintained.

**P11-TC-3** · difficulty 2 · ✅ Objective · 106 chars · `OVER-LENGTH(106)`

> Pick any object from the table. Perform a four-line jingle revealing its dark secret. Must scan and rhyme.

*Success:* Object named, secret implied, rhyme pairs land, jingle completed.

**P11-TC-4** · difficulty 3 · 🗳️ Vote · 139 chars · ⏱ 30s · `OVER-LENGTH(139)` `OVER-COUNT` `COND-OVERRIDE`

> Pick any three objects from the table. Perform a 30-second song in which each object gets its own verse. Objects must be addressed by name.

*Success:* Three verses. Three objects named. Song structure maintained. Majority decides.

### The Royal Show

**P11-RS-1** · difficulty 1 · ✅ Objective · 101 chars · ⏱ 15s · `OVER-LENGTH(101)`

> Pick up any object from the table. Mime using it for something it was not designed to do. 15 seconds.

*Success:* Alternative use readable. No words.

**P11-RS-2** · difficulty 2 · ✅ Objective · 123 chars · ⏱ 20s · `OVER-LENGTH(123)`

> Pick any object from the table. Mime it as a dangerous weapon — with appropriate caution and respect. 20 seconds. No words.

*Success:* Weapon and caution both readable.

**P11-RS-3** · difficulty 2 · 👤 Named judge · 129 chars · ⏱ 20s · `OVER-LENGTH(129)` `COND-OVERRIDE`

> Pick any object from the table. Perform a 20-second mime in which this object is alive and trying to escape. No words, no sounds.

*Success:* Named judge confirms object's aliveness and escape attempt are readable.

**P11-RS-4** · difficulty 3 · ✅ Objective · 139 chars · ⏱ 30s · `OVER-LENGTH(139)` `OVER-COUNT`

> Pick any two objects from the table. Perform a 30-second mime in which they are in a relationship that has just ended. No words, no sounds.

*Success:* Both objects, relationship, and ending all readable without prompting.

### The School Play

**P11-SP-1** · difficulty 1 · 👤 Named judge · 125 chars · `OVER-LENGTH(125)`

> Pick up any object from the table. Deliver this line to it, in character: "I never thought it would come to this between us."

*Success:* Named judge confirms object addressed directly and emotion committed.

**P11-SP-2** · difficulty 2 · 👤 Named judge · 147 chars · ⏱ 20s · `OVER-LENGTH(147)`

> Choose any object from the table. Perform a 20-second scene in which this object is a character with feelings, and you must deliver bad news to it.

*Success:* Named judge confirms object's character and bad news scene committed.

**P11-SP-3** · difficulty 2 · 👤 Named judge · 136 chars · ⏱ 20s · `OVER-LENGTH(136)`

> Pick any object. It is a sacred artefact. Perform a 20-second scene in which you are an archaeologist discovering it for the first time.

*Success:* Named judge confirms discovery, reverence, and character all committed.

**P11-SP-4** · difficulty 3 · 👤 Named judge · 138 chars · ⏱ 40s · `OVER-LENGTH(138)` `OVER-COUNT`

> Pick any two objects. Cast them as the leads in a 40-second dramatic scene — give each a name, a voice, and a conflict. Perform all roles.

*Success:* Named judge confirms distinct names, voices, and conflict for both objects.

---

## Prompt Card 12

16 prompts — Comedy Lounge 4 · The Club 4 · The Royal Show 4 · The School Play 4

### Comedy Lounge

**P12-CL-1** · difficulty 1 · 🗳️ Vote · 113 chars · `OVER-LENGTH(113)`

> Tell a joke — but deliver the setup with complete devastation and the punchline with pure joy. Whiplash required.

*Success:* Emotional contrast readable. Punchline lands. Majority decides.

**P12-CL-2** · difficulty 2 · 🗳️ Vote · 107 chars · ⏱ 20s · `OVER-LENGTH(107)`

> Deliver a 20-second apology — for something you did not do — with absolute sincerity. No irony. No smiling.

*Success:* Sincerity maintained throughout. Majority confirms no irony detected.

**P12-CL-3** · difficulty 2 · 🗳️ Vote · 106 chars · `OVER-LENGTH(106)`

> Tell a joke about something genuinely sad — but make it funny. Respect the sadness. Find the funny anyway.

*Success:* Sadness acknowledged. Funny found. Majority decides.

**P12-CL-4** · difficulty 3 · 🗳️ Vote · 179 chars · ⏱ 40s · `OVER-LENGTH(179)` `OVER-COUNT`

> Perform a 40-second stand-up bit in which your emotional state changes completely every 10 seconds — joy, fury, grief, pride. The material stays the same; only your state changes.

*Success:* Four states confirmed by majority. Transitions visible. Material consistent.

### The Club

**P12-TC-1** · difficulty 1 · ✅ Objective · 77 chars

> Sing any happy song — with complete devastation. Tune correct. Emotion wrong.

*Success:* Song recognisable. Devastation maintained. Full verse completed.

**P12-TC-2** · difficulty 2 · ✅ Objective · 133 chars · `OVER-LENGTH(133)`

> Perform a four-line ballad about something trivial — a lost pen, a cold cup of tea — with the emotional weight of a national tragedy.

*Success:* Subject trivial. Emotion enormous. Four lines. Rhymes land.

**P12-TC-3** · difficulty 2 · ✅ Objective · 100 chars · `OVER-LENGTH(100)`

> Sing any song — but begin in a whisper and end at full operatic volume. Linear escalation. No jumps.

*Success:* Escalation linear. Both ends of the scale reached. Song identifiable.

**P12-TC-4** · difficulty 3 · 🗳️ Vote · 158 chars · ⏱ 30s · `OVER-LENGTH(158)` `OVER-COUNT` `COND-OVERRIDE`

> Perform a 30-second song that expresses two completely contradictory emotions simultaneously — joy and grief, pride and shame, love and fury. Sung throughout.

*Success:* Both emotions readable. Contradiction sustained. Majority decides.

### The Royal Show

**P12-RS-1** · difficulty 1 · ✅ Objective · 107 chars · ⏱ 15s · `OVER-LENGTH(107)`

> Mime receiving the best news of your life — then immediately receiving the worst. Back to back. 15 seconds.

*Success:* Both reactions readable and distinct. No words.

**P12-RS-2** · difficulty 2 · ✅ Objective · 101 chars · ⏱ 20s · `OVER-LENGTH(101)`

> Mime a person trying to hold in an enormous laugh in a very serious situation. 20 seconds. No sounds.

*Success:* Situation seriousness and suppressed laughter both readable.

**P12-RS-3** · difficulty 2 · 👤 Named judge · 140 chars · ⏱ 20s · `OVER-LENGTH(140)` `COND-OVERRIDE`

> Mime falling in love — over 20 seconds — with an inanimate object on the table. Full arc: noticing, interest, devotion. No words, no sounds.

*Success:* Named judge confirms all three stages of the arc.

**P12-RS-4** · difficulty 3 · ✅ Objective · 183 chars · ⏱ 30s · `OVER-LENGTH(183)` `OVER-COUNT`

> Perform a 30-second mime in which you experience five emotions in sequence — called by the table — and each one must be readable within three seconds of the call. No words, no sounds.

*Success:* All five emotions readable within three seconds each. Majority confirms.

### The School Play

**P12-SP-1** · difficulty 1 · 👤 Named judge · 97 chars · `OVER-LENGTH(97)`

> Deliver this line with absolute fury: "Would anyone like more potatoes?" No smiling. No breaking.

*Success:* Named judge confirms fury maintained and no break detected.

**P12-SP-2** · difficulty 2 · 👤 Named judge · 152 chars · ⏱ 20s · `OVER-LENGTH(152)`

> Perform a 20-second scene in which you are trying very hard to be calm — and failing. The subject: something minor, like a slightly uncomfortable chair.

*Success:* Named judge confirms escalation, subject, and failing calm.

**P12-SP-3** · difficulty 2 · 👤 Named judge · 125 chars · `OVER-LENGTH(125)`

> Player to your right names two contradictory emotions. Deliver this line expressing both simultaneously: "Well. Here we are."

*Success:* Named judge confirms both emotions readable in the one line.

**P12-SP-4** · difficulty 3 · 👤 Named judge · 175 chars · ⏱ 40s · `OVER-LENGTH(175)` `OVER-COUNT`

> Perform a 40-second scene in which your character begins completely composed and ends in total emotional collapse — over something increasingly trivial. Show the full journey.

*Success:* Named judge confirms journey, triviality, and collapse all committed.

---

## Prompt Card 13

16 prompts — Comedy Lounge 4 · The Club 4 · The Royal Show 4 · The School Play 4

### Comedy Lounge

**P13-CL-1** · difficulty 1 · 🗳️ Vote · 114 chars · `OVER-LENGTH(114)`

> Tell a joke about Australian summer Christmas — the heat, the flies, the barbie, the beach. Must have a punchline.

*Success:* Australian context clear. Punchline lands. Majority decides.

**P13-CL-2** · difficulty 2 · 🗳️ Vote · 141 chars · ⏱ 20s · `OVER-LENGTH(141)`

> Deliver a 20-second stand-up bit about any Australian animal — why it is ridiculous, dangerous, or both. Must have at least two observations.

*Success:* Two observations land. Animal identifiable. Majority decides.

**P13-CL-3** · difficulty 2 · 🗳️ Vote · 155 chars · `OVER-LENGTH(155)`

> Tell a joke that only makes sense if you grew up in Australia. If anyone at the table doesn't get it, explain it — the explanation becomes part of the bit.

*Success:* Joke attempted. Australian context real. Majority decides.

**P13-CL-4** · difficulty 3 · 🗳️ Vote · 184 chars · ⏱ 40s · `OVER-LENGTH(184)` `OVER-COUNT`

> Perform a 40-second stand-up bit about any Australian institution — the surf club, the Royal Show, Bunnings, the school play — as if explaining it to someone who has never heard of it.

*Success:* Institution named. Explanation given. Majority decides.

### The Club

**P13-TC-1** · difficulty 1 · ✅ Objective · 119 chars · `OVER-LENGTH(119)`

> Perform one verse of "Down Under" — but replace the original lyrics with lyrics about this Christmas dinner. Same tune.

*Success:* Tune maintained. Dinner referenced. Full verse completed.

**P13-TC-2** · difficulty 2 · ✅ Objective · 139 chars · `OVER-LENGTH(139)`

> Perform a four-line bush ballad about any Australian animal. Must have the rhythm and tone of a Banjo Paterson poem. 30 seconds to compose.

*Success:* Four lines. Ballad rhythm. Animal named.

**P13-TC-3** · difficulty 2 · ✅ Objective · 134 chars · `OVER-LENGTH(134)`

> Perform a four-line drinking song in which the chorus is any Australian slang phrase — used correctly. Your choice of phrase and tune.

*Success:* Slang phrase used correctly as a chorus. Four lines. Tune maintained.

**P13-TC-4** · difficulty 3 · 🗳️ Vote · 105 chars · ⏱ 30s · `OVER-LENGTH(105)` `OVER-COUNT` `COND-OVERRIDE`

> Perform a 30-second anthem for Australia's most underappreciated animal. Make the case. Sing it. Mean it.

*Success:* Animal named. Case made musically. Majority decides if it convinced them.

### The Royal Show

**P13-RS-1** · difficulty 1 · ✅ Objective · 92 chars · ⏱ 20s · `OVER-LENGTH(92)`

> Mime attending a Bunnings sausage sizzle — queue, order, sauce decision, eating. 20 seconds.

*Success:* All four stages readable. No words.

**P13-RS-2** · difficulty 2 · ✅ Objective · 97 chars · ⏱ 20s · `OVER-LENGTH(97)`

> Mime an Australian animal encountering a Christmas tree for the first time. 20 seconds. No words.

*Success:* Animal and reaction both readable.

**P13-RS-3** · difficulty 2 · 👤 Named judge · 115 chars · ⏱ 25s · `OVER-LENGTH(115)` `COND-OVERRIDE`

> Mime a cricket match — you play all roles: bowler, batter, fielder, and crowd — in 25 seconds. No words, no sounds.

*Success:* Named judge confirms all four roles distinct and game readable.

**P13-RS-4** · difficulty 3 · ✅ Objective · 168 chars · ⏱ 30s · `OVER-LENGTH(168)` `OVER-COUNT`

> Mime a 30-second scene at a Royal Show: you are competing in an event, something goes wrong, the crowd reacts, and you recover. You play all roles. No words, no sounds.

*Success:* Event, failure, crowd, and recovery all readable. Majority confirms.

### The School Play

**P13-SP-1** · difficulty 1 · 👤 Named judge · 110 chars · `OVER-LENGTH(110)`

> Deliver this line in a thick Australian accent, with full national pride: "Yeah, look, it's not for everyone."

*Success:* Named judge confirms accent authentic and pride committed.

**P13-SP-2** · difficulty 2 · 👤 Named judge · 128 chars · ⏱ 20s · `OVER-LENGTH(128)`

> Perform a 20-second scene: you are a tourist encountering an Australian animal for the first time. Animal of the table's choice.

*Success:* Named judge confirms tourist character, animal, and encounter committed.

**P13-SP-3** · difficulty 2 · 👤 Named judge · 148 chars · ⏱ 20s · `OVER-LENGTH(148)`

> Perform a 20-second scene: you are a tour guide explaining this Christmas dinner to an international visitor as if it is a sacred Australian ritual.

*Success:* Named judge confirms character, visitor acknowledged, and ritual gravity held.

**P13-SP-4** · difficulty 3 · 👤 Named judge · 152 chars · ⏱ 40s · ⚠️ not family-safe · `OVER-LENGTH(152)` `OVER-COUNT`

> Perform a 40-second dramatic monologue as any figure from Australian history — real or legendary — addressing this table as if it represents the nation.

*Success:* Named judge confirms figure identifiable, address committed, and gravitas sustained.

---

## Prompt Card 14

16 prompts — Comedy Lounge 4 · The Club 4 · The Royal Show 4 · The School Play 4

### Comedy Lounge

**P14-CL-1** · difficulty 1 · 🗳️ Vote · 147 chars · ⚠️ not family-safe · `OVER-LENGTH(147)`

> You and the player to your left each tell a one-liner on the same topic — table names the topic. The table votes for the funnier one. You go first.

*Success:* Table votes. Winner is the funnier one-liner.

**P14-CL-2** · difficulty 2 · 🗳️ Vote · 138 chars · ⏱ 30s · ⚠️ not family-safe · `OVER-LENGTH(138)`

> You and the player to your right have 30 seconds each to deliver a stand-up bit on the same subject. Table names the subject. Table votes.

*Success:* Both perform. Table votes on the better bit.

**P14-CL-3** · difficulty 2 · 🗳️ Vote · 171 chars · ⚠️ not family-safe · `OVER-LENGTH(171)`

> You and the player to your left alternate lines of a joke — you set up, they punch, you set up again, they punch again. Four lines total. Table votes on whether it worked.

*Success:* Four alternating lines. Majority decides if the structure produced something funny.

**P14-CL-4** · difficulty 3 · 🗳️ Vote · 162 chars · ⏱ 30s · ⚠️ not family-safe · `OVER-LENGTH(162)` `OVER-COUNT`

> Perform a 30-second roast battle with the player across from you. Alternating — you go first, then them. Two rounds each. Keep it warm. Table votes on the winner.

*Success:* Two rounds each. Table votes. Warmth maintained throughout.

### The Club

**P14-TC-1** · difficulty 1 · 🗳️ Vote · 143 chars · ⚠️ not family-safe · `OVER-LENGTH(143)` `COND-OVERRIDE`

> You and the player to your left each sing one line of the same song — simultaneously, in your own key. Table decides who stayed in tune better.

*Success:* Both sing simultaneously. Majority picks the more in-tune performer.

**P14-TC-2** · difficulty 2 · 🗳️ Vote · 142 chars · ⚠️ not family-safe · `OVER-LENGTH(142)` `COND-OVERRIDE`

> You and the player to your right both improvise a four-line rhyme on the same topic — table names it. 30 seconds each to compose. Table votes.

*Success:* Both perform. Majority votes on better rhyme.

**P14-TC-3** · difficulty 2 · 🗳️ Vote · 113 chars · ⏱ 20s · ⚠️ not family-safe · `OVER-LENGTH(113)` `COND-OVERRIDE`

> Perform a 20-second rap battle with the player to your left. Alternating two-line verses. You start. Table votes.

*Success:* Alternating verses. At least two rounds each. Majority votes.

**P14-TC-4** · difficulty 3 · 🗳️ Vote · 174 chars · ⏱ 30s · ⚠️ not family-safe · `OVER-LENGTH(174)` `OVER-COUNT` `COND-OVERRIDE`

> You and the player across from you perform a 30-second duet — but you have not agreed on the song. Begin simultaneously. Whoever adapts to the other's song wins. Table votes.

*Success:* Both begin. Adaptation confirmed. Majority votes on who adapted.

### The Royal Show

**P14-RS-1** · difficulty 1 · ✅ Objective · 122 chars · ⚠️ not family-safe · `OVER-LENGTH(122)`

> You and the player to your left both mime the same object simultaneously — table names it. Table votes on who was clearer.

*Success:* Both mime simultaneously. Majority votes on clarity.

**P14-RS-2** · difficulty 2 · 🗳️ Vote · 131 chars · ⏱ 15s · ⚠️ not family-safe · `OVER-LENGTH(131)` `COND-OVERRIDE`

> You and the player to your right have 15 seconds each to mime the same emotion — table names it. Table votes on who committed more.

*Success:* Both mime. Majority votes on commitment.

**P14-RS-3** · difficulty 2 · 👤 Named judge · 146 chars · ⏱ 20s · ⚠️ not family-safe · `OVER-LENGTH(146)` `COND-OVERRIDE`

> Mirror challenge: you mime any action, the player to your left must mirror it simultaneously. Hold for 20 seconds. Table votes on synchronisation.

*Success:* Named judge confirms synchronisation quality.

**P14-RS-4** · difficulty 3 · 🗳️ Vote · 183 chars · ⏱ 30s · ⚠️ not family-safe · `OVER-LENGTH(183)` `OVER-COUNT` `COND-OVERRIDE`

> You and the player across from you perform a 30-second mime scene together — no planning, no words. Establish a location, a conflict, a resolution. Table votes on who drove the scene.

*Success:* Scene has location, conflict, resolution. Majority votes on who led.

### The School Play

**P14-SP-1** · difficulty 1 · 👤 Named judge · 180 chars · ⚠️ not family-safe · `OVER-LENGTH(180)`

> You and the player to your left both deliver the same line in different accents — table names the line. Table votes on who committed more. "I had absolutely nothing to do with it."

*Success:* Named judge votes on commitment.

**P14-SP-2** · difficulty 2 · 🗳️ Vote · 170 chars · ⏱ 20s · ⚠️ not family-safe · `OVER-LENGTH(170)` `COND-OVERRIDE`

> Perform a 20-second improvised scene with the player to your right. Table gives you: a location and a problem. No planning. Table votes on who stayed in character better.

*Success:* Scene performed. Majority votes on character.

**P14-SP-3** · difficulty 2 · 👤 Named judge · 156 chars · ⏱ 15s · ⚠️ not family-safe · `OVER-LENGTH(156)`

> You and the player to your left both perform a 15-second dramatic reading of the same Christmas cracker joke. Table votes on the more committed performance.

*Success:* Named judge votes.

**P14-SP-4** · difficulty 3 · 🗳️ Vote · 158 chars · ⏱ 40s · ⚠️ not family-safe · `OVER-LENGTH(158)` `OVER-COUNT` `COND-OVERRIDE`

> Perform a 40-second two-person scene with the player across from you. One of you is telling the truth. One is lying. Table must guess who is who. No planning.

*Success:* Scene performed. Majority guesses. Neither player may confirm until guessed.

---

## Prompt Card 15

16 prompts — Comedy Lounge 4 · The Club 4 · The Royal Show 4 · The School Play 4

### Comedy Lounge

**P15-CL-1** · difficulty 1 · 🗳️ Vote · 82 chars · `OVER-LENGTH(82)`

> Tell a joke — but replace every verb with the word "cracker." Deliver it straight.

*Success:* Every verb replaced. Punchline attempted. Majority decides.

**P15-CL-2** · difficulty 2 · 🗳️ Vote · 111 chars · ⏱ 20s · `OVER-LENGTH(111)`

> Deliver a 20-second stand-up bit about a topic named by the player to your right — but speak only in questions.

*Success:* Topic addressed. Every sentence a question. Majority decides.

**P15-CL-3** · difficulty 2 · 🗳️ Vote · 135 chars · ⏱ 20s · `OVER-LENGTH(135)`

> Perform a 20-second stand-up bit — but every time someone at the table coughs, sneezes, or laughs, you must restart from the beginning.

*Success:* Interruptions restarted. Bit completed or 60 seconds elapsed. Majority decides.

**P15-CL-4** · difficulty 3 · 🗳️ Vote · 208 chars · `OVER-LENGTH(208)` `OVER-COUNT`

> Tell a joke — but the player to your left writes the punchline on a piece of paper before you start. You must construct a setup that makes their punchline work. You see the punchline only when you deliver it.

*Success:* Setup constructed. Punchline read cold. Majority decides if it landed.

### The Club

**P15-TC-1** · difficulty 1 · ✅ Objective · 59 chars

> Sing any song — but replace all vowels with the sound "ah."

*Success:* Full verse. All vowels replaced. Tune maintained.

**P15-TC-2** · difficulty 2 · ✅ Objective · 135 chars · `OVER-LENGTH(135)`

> Perform a four-line rhyme in which the last word of each line is provided by a different player, live, as you reach it. No preparation.

*Success:* Four lines. Four different players supply end words. Rhymes attempted.

**P15-TC-3** · difficulty 2 · ✅ Objective · 100 chars · ⏱ 20s · `OVER-LENGTH(100)`

> Sing a 20-second song about a topic named by the table — but you may only use words of one syllable.

*Success:* Topic addressed. Monosyllables only. 20 seconds reached.

**P15-TC-4** · difficulty 3 · 🗳️ Vote · 146 chars · ⏱ 30s · `OVER-LENGTH(146)` `OVER-COUNT` `COND-OVERRIDE`

> Perform a 30-second song in a made-up language. Must sound like a real language. Must have a chorus. Table votes on whether it sounded convincing.

*Success:* Made-up language sustained. Chorus present. Majority decides on convincingness.

### The Royal Show

**P15-RS-1** · difficulty 1 · ✅ Objective · 136 chars · ⏱ 15s · `OVER-LENGTH(136)`

> Mime being controlled by an invisible puppeteer for 15 seconds. Every movement is dictated by the player to your left, who calls it out.

*Success:* All called movements performed. Puppet physicality maintained.

**P15-RS-2** · difficulty 2 · ✅ Objective · 114 chars · ⏱ 20s · `OVER-LENGTH(114)`

> Mime in reverse — the table names an activity, you mime it backwards, from end to beginning. 20 seconds. No words.

*Success:* Activity identifiable in reverse. No words.

**P15-RS-3** · difficulty 2 · 👤 Named judge · 155 chars · ⏱ 20s · `OVER-LENGTH(155)` `COND-OVERRIDE`

> Perform a 20-second mime — but every five seconds, the player to your right calls a new location and you must instantly transport yourself there. No words.

*Success:* Named judge confirms four location transitions and immediate commitment.

**P15-RS-4** · difficulty 3 · ✅ Objective · 105 chars · ⏱ 30s · `OVER-LENGTH(105)` `OVER-COUNT`

> Perform a 30-second mime with your non-dominant hand only. Table names the activity. No words, no sounds.

*Success:* Activity identifiable. Non-dominant hand only. 30 seconds reached.

### The School Play

**P15-SP-1** · difficulty 1 · 👤 Named judge · 103 chars · `OVER-LENGTH(103)`

> Deliver this line — but speak every word in reverse order: "I have no idea what you are talking about."

*Success:* Named judge confirms reverse order and committed delivery.

**P15-SP-2** · difficulty 2 · 👤 Named judge · 108 chars · ⏱ 20s · `OVER-LENGTH(108)`

> Perform a 20-second scene — but you may only use the words "yes," "no," "but," and "really." No other words.

*Success:* Named judge confirms vocabulary restriction held and scene committed.

**P15-SP-3** · difficulty 2 · 👤 Named judge · 179 chars · ⏱ 20s · `OVER-LENGTH(179)`

> Perform a 20-second dramatic scene — but every time the player to your left claps once, you freeze. Every time they clap twice, you resume. Scene must still make sense at the end.

*Success:* Named judge confirms freezes, resumes, and scene coherence.

**P15-SP-4** · difficulty 3 · 👤 Named judge · 147 chars · ⏱ 40s · `OVER-LENGTH(147)` `OVER-COUNT`

> Perform a 40-second scene in which you play a character who is performing a character — two layers of performance, both distinct, neither breaking.

*Success:* Named judge confirms both layers distinct and neither layer breaks.

---

## Prompt Card 16

16 prompts — Comedy Lounge 4 · The Club 4 · The Royal Show 4 · The School Play 4

### Comedy Lounge

**P16-CL-1** · difficulty 1 · 🗳️ Vote · 97 chars · ⚠️ not family-safe · `OVER-LENGTH(97)`

> Tell the best joke you know. Not original — the best one you actually know. Deliver it perfectly.

*Success:* Delivery judged, not material. Majority decides on execution.

**P16-CL-2** · difficulty 2 · 🗳️ Vote · 167 chars · ⏱ 30s · ⚠️ not family-safe · `OVER-LENGTH(167)`

> Perform a 30-second stand-up bit about whatever the table agrees was the worst moment of the evening. Find the funny. The person most involved casts the deciding vote.

*Success:* Worst moment identified by table. Funny found. Involved player votes.

**P16-CL-3** · difficulty 2 · 🗳️ Vote · 144 chars · ⏱ 30s · ⚠️ not family-safe · `OVER-LENGTH(144)`

> Deliver a 30-second comedy eulogy for this game — it is ending, it gave everything, it will be missed. At least two specific moments referenced.

*Success:* Two moments referenced. Majority decides.

**P16-CL-4** · difficulty 3 · 🗳️ Vote · 188 chars · ⏱ 60s · ⚠️ not family-safe · `OVER-LENGTH(188)` `OVER-COUNT`

> Perform a 60-second closing set. Cover: one observation about the table, one callback to an earlier performance, one prediction for next Christmas, and a closing line that lands. No notes.

*Success:* All four elements present. Closing line confirmed by majority.

### The Club

**P16-TC-1** · difficulty 1 · ✅ Objective · 102 chars · ⚠️ not family-safe · `OVER-LENGTH(102)`

> Lead the table in one final chorus of any song everyone knows. You conduct. You start. Everyone joins.

*Success:* Song known by majority. Full chorus completed. Table joins in.

**P16-TC-2** · difficulty 2 · ✅ Objective · 156 chars · ⚠️ not family-safe · `OVER-LENGTH(156)`

> Compose and perform a four-line toast to this game and everyone who played it. Must rhyme. Must end with something worth drinking to. 30 seconds to compose.

*Success:* Four lines. Rhymes land. Toast delivered. Table drinks.

**P16-TC-3** · difficulty 2 · ✅ Objective · 113 chars · ⏱ 30s · ⚠️ not family-safe · `OVER-LENGTH(113)`

> Perform a 30-second ballad recapping the entire game — who played well, who suffered, who won. Name every player.

*Success:* Every player named. Game recapped. 30 seconds reached.

**P16-TC-4** · difficulty 3 · 🗳️ Vote · 166 chars · ⏱ 45s · ⚠️ not family-safe · `OVER-LENGTH(166)` `OVER-COUNT` `COND-OVERRIDE`

> Perform a 45-second original song — written and performed now — about this specific Christmas, this specific table, and why it will be remembered. Must have a chorus.

*Success:* Original song. Chorus present. This Christmas described. Majority decides.

### The Royal Show

**P16-RS-1** · difficulty 1 · ✅ Objective · 87 chars · ⏱ 15s · ⚠️ not family-safe · `OVER-LENGTH(87)`

> Take a final bow — mime receiving a standing ovation from a sold-out arena. 15 seconds.

*Success:* Ovation and scale of arena both readable. Bow committed.

**P16-RS-2** · difficulty 2 · ✅ Objective · 105 chars · ⏱ 20s · ⚠️ not family-safe · `OVER-LENGTH(105)`

> Mime a 20-second highlight reel of your own best performance of the night. You direct and star. No words.

*Success:* Performance identifiable. Direction and starring both readable.

**P16-RS-3** · difficulty 2 · 👤 Named judge · 115 chars · ⏱ 25s · ⚠️ not family-safe · `OVER-LENGTH(115)` `COND-OVERRIDE`

> Mime accepting a lifetime achievement award at the Royal Show — trophy, tears, crowd, speech. No words. 25 seconds.

*Success:* Named judge confirms all four elements present and committed.

**P16-RS-4** · difficulty 3 · ✅ Objective · 152 chars · ⏱ 35s · ⚠️ not family-safe · `OVER-LENGTH(152)` `OVER-COUNT`

> Perform a 35-second mime of the entire game — setup, performances, conflict, winner — compressed. Every player must be represented. No words, no sounds.

*Success:* Game arc readable. Every player represented. Majority confirms.

### The School Play

**P16-SP-1** · difficulty 1 · 👤 Named judge · 136 chars · ⚠️ not family-safe · `OVER-LENGTH(136)`

> Deliver the final line of the evening — whatever feels right — in the most dramatic accent you have. No prompt. Your words. Your moment.

*Success:* Named judge confirms accent held and moment committed.

**P16-SP-2** · difficulty 2 · 👤 Named judge · 159 chars · ⏱ 30s · ⚠️ not family-safe · `OVER-LENGTH(159)`

> Perform a 30-second curtain call speech — in character as your game Character — thanking the table for a magnificent performance. Stay in character throughout.

*Success:* Named judge confirms character held and every player thanked.

**P16-SP-3** · difficulty 2 · 👤 Named judge · 164 chars · ⏱ 30s · ⚠️ not family-safe · `OVER-LENGTH(164)`

> Perform a 30-second scene: you are the director of this evening, giving notes to the cast after the final performance. Specific feedback for at least three players.

*Success:* Named judge confirms director character, specificity, and three players addressed.

**P16-SP-4** · difficulty 3 · 👤 Named judge · 200 chars · ⏱ 60s · ⚠️ not family-safe · `OVER-LENGTH(200)` `OVER-COUNT`

> Perform a 60-second dramatic monologue as your game Character reflecting on what they have learned tonight. Must reference two real moments from the game. Must end with a line the table will remember.

*Success:* Named judge confirms character, two real references, and memorable closing line.

---
