# Design derivation — Nocturnal Series

Working notes. Carl asked for the reasoning to be visible, not just the output.
This is the record of what was considered and what was rejected, so Pris can
argue with the reasoning rather than just the result.

## Source material: Actias luna, material properties

Five properties, and what each one offers a website. Listed with the ones I
rejected, because the rejections are the substance of the decision.

**1. Pale green wings.** The colour is the moth's most recognisable fact, and it
is unusual: a chalky, cold, desaturated green — closer to lichen or oxidised
copper than to anything in the fashion-site default palette. Taken as the
site's ground rather than as an accent, it does a lot of work for free.
**Used.** It is the ground.

**2. Trailing hindwing tails.** Long ribbon-like streamers off the hindwing.
Worth knowing that they are not decorative: they spin in flight and scatter bat
echolocation, so they are a defence mechanism that happens to be beautiful.
That is a good description of what a garment detail should be, and it argues
for a site where the ornament is structural.
**Used.** The one recurring graphic device is a hairline that descends from
each section marker and fades out — a trailing tail. It is also the column
rule, so it is load-bearing rather than applied.

**3. Adult lifespan of about a week; no functioning mouthparts.** The adult
cannot eat. It emerges, it mates, it dies. Scarcity is not a marketing posture
for this animal, it is anatomy.
**Used, and it is the strongest reading.** It also happens to match the
business: the ops database carries `is_one_off` and `edition_size` columns on
products, and the live production routes are all small-batch or one-off. So
"finite by nature" is the honest organising idea for this label, not a
borrowed luxury-scarcity trope. The site is structured around the line being
finite rather than around it being luxurious.

**4. Drawn to light (positive phototaxis).** The obvious move, and the one I
deliberately did not take. Glow effects, dark ground, a luminous focal point —
that is the *lighting* site's territory (see Checkpoint 4), and building both
in the same environment would have made them converge. Rejected on those
grounds, not on aesthetic ones.
**Rejected.** No glows, no bloom, no light-source metaphor anywhere.

**5. Eyespots and large wingspan.** Would push toward a big symmetrical
centred hero mark. Reads as heraldry or as a cosmetics brand.
**Rejected.** Nothing centred and symmetrical above the fold.

## Where that landed, and the one real tension

The tension worth naming: a luna moth is a *pale thing seen against darkness*.
The instinctive translation is a dark website. I went the other way — pale,
cold, chalky ground with near-black ink — for two reasons. First, the
convergence problem in property 4. Second, "nocturnal fashion site = dark
website" is itself a default, just a different one from cream-and-terracotta;
the moth is the pale thing, not the night.

So the nocturnal read has to come from **palette temperature and typographic
restraint** rather than from darkness. That is a harder brief and it is the
part most likely to be wrong. **This is the first thing Pris should overrule
if it does not land** — it is a genuine fork, not a detail.

## Palette

| Token | Value | Reasoning |
|---|---|---|
| `--ground` | `#E6E9DF` | Moth wing-scale. Cool and chalky. Explicitly not cream — it reads green-grey, not beige. |
| `--ground-deep` | `#DADFCD` | Sectioning only. |
| `--ink` | `#16190F` | Near-black carrying a green cast, so the darkest value still belongs to the same world. |
| `--ink-soft` | `#4C523F` | Secondary text. |
| `--luna` | `#93B45C` | The wing green at full strength. Used sparingly and structurally — rules, markers, focus states. Never as a fill. |
| `--draft` | `#8B3FA8` | **Not a brand colour.** Deliberately alien to the palette so unapproved copy can never be mistaken for approved copy. It should look wrong. |

## Typography

System stacks, no webfonts. Two reasons: no external requests (Lighthouse
target, and the site must stay self-contained), and the typeface is genuinely
Pris's call — picking one here would be exactly the kind of voice decision the
brief reserves.

Character comes from scale, tracking and rhythm rather than from typeface
novelty. **Flagged as a placeholder decision** in PLACEHOLDERS.md.

## What is deliberately absent

- No photography of any kind. `images: []` in the catalogue, and the product
  card renders an explicit empty plate rather than a grey box that reads as a
  broken image.
- No illustration of a moth. The graphic device is two abstract hairline arcs;
  it is not a depiction of the animal or of the garment, and it is never
  presented as either.
- No numbers anywhere that could be read as a price, a size or a measurement.
