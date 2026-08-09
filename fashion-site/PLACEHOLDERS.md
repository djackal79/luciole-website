# Placeholder register

Every `{{ }}` on the site, and who owns it. Nothing here has a stand-in value —
no example prices, no sample sizes, no draft legal text.

Anything wrapped in `{{ }}` renders in the draft treatment (off-palette violet,
monospace, dashed edge, "UNWRITTEN" tick). Removing the braces removes the
styling, so a placeholder cannot silently become approved copy.

**20 placeholders render on the home page.** All of the violet on screen is
draft state; it disappears entirely as these are filled.

---

## Carl's — commercial, legal, operational

| # | Placeholder | Where | Notes |
|---|---|---|---|
| 1 | `RRP AUD` | `products.json` → `price`, `variants[0].price` | Not set anywhere; `products.rrp_aud` is null in Supabase. |
| 2 | `SIZE RUN NOT CONFIRMED` | `products.json` → `variants[0].title` | `skus` table is empty. No size run exists yet. |
| 3 | `SKU` | `products.json` → `variants[0].sku` | Ditto. |
| 4 | `Unverified` ×9 | Provenance section | Fibre, Yarn & knit, Mill, Cut/make/trim, Dye & finishing, Certifications, Country of origin, Labour standards, Audit & verification. **See the sourcing note below — this is the highest-risk item on the site.** |
| 5 | `Unverified` ×2 | Product page | Composition, Care. |
| 6 | `Trading name & ABN` | Footer | No registered entity details confirmed. |
| 7 | `Unwritten — Carl (legal)` ×8 | `/privacy` | Not drafted. The page carries a "do not publish with this live" banner. |
| 8 | `Unwritten — Carl (legal)` ×8 | `/returns` | Ditto. Nothing states a returns window, condition or remedy. |
| 9 | Enquiry fallback address | `VITE_ENQUIRY_EMAIL` | Unset, so the failure path shows a draft placeholder instead of a mailto link. Set it and the fallback works. |
| 10 | Production origin | `VITE_SITE_ORIGIN` | Unset. While unset, canonical/`og:url` tags and `sitemap.xml` are **omitted rather than guessed**. |
| 11 | City / registered address | — | `Australia` is confirmed (AUD, GST, domestic production routes) and is on the site. Canberra is strongly implied by the ops data but is **not** stated anywhere. |

## Pris's — voice, copy, visual direction

| # | Placeholder | Where |
|---|---|---|
| 1 | `PRODUCT DESCRIPTION` | `products.json` → `description` |
| 2 | Hero headline | Hero |
| 3 | Hero standfirst | Hero |
| 4 | Section intro for The Line | The Line |
| 5 | Provenance explanatory note | Provenance — including whether the site says anything there at all |
| 6 | About the Label ×3 | Opening paragraph, second paragraph, closing line |
| 7 | Enquiry form intro | Enquiry |
| 8 | Confirmation copy and expected reply time | Enquiry success state |

Two further Pris decisions that are **not** marked with `{{ }}` because they are
design choices rather than missing text — both are argued in DESIGN-NOTES.md:

- **Typeface.** System stacks throughout. Deliberately not chosen here.
- **Light ground vs dark.** The site reads the moth as *the pale thing*, not as
  the night. This is the single biggest fork in the design and the first thing
  to overrule if it does not land.

## Shared — Carl and Pris

| Placeholder | Where |
|---|---|
| `LABEL NAME` | Masthead, and `Organization` JSON-LD |

The label's trading name is not confirmed anywhere I could verify. Because of
that, **no `Organization` JSON-LD is emitted at all** — the generator drops any
field that is a placeholder, and suppresses the whole block when `name` is
missing. It starts publishing the moment the name is set in `site.json`.

---

## Sourcing — a correction to the brief

The brief listed **"Indian mill sourcing"** as a known fact to seed the
catalogue with. The live ops database contradicts that, so it is a placeholder
on the site rather than a stated fact:

- `production_routes` → "India full-package — bulk" has status **`parked`**.
- The one India vetting task that ran returned *"unable to vet mills in Tirupur
  … I lack the initial list of candidate mills"*. The related discovery tasks
  are **cancelled**.
- "Verify GOTS / Oeko-Tex certifications and scan for labour dispute history"
  is still **pending**.
- The project sits at `phase_3_sourcing`, and the routes still being explored
  are Australian CMT, stock-fabric small batch, and low-MOQ Portugal/Italy.

A country-of-origin or certification claim on a public page is a representation
under Australian Consumer Law (ss 18 and 29), enforceable whether or not a sale
follows. On the current evidence "made in India" would not be substantiable, so
nothing about origin, fibre, mill or certification appears anywhere on the site.

**If Carl has supplier documentation that isn't in Supabase, this is a
five-minute fix** — fill the Provenance rows and it is done. Flagging it rather
than deciding it.

## Microcopy that is mine, not Pris's

Functional UI strings are written plainly rather than placeheld, or the site
would be unreviewable. They are still Pris's to change: "Send enquiry",
"Not yet for sale", "No approved photography yet", "Skip to content",
"Your enquiry has been received", "That did not send…", "You can email us
directly at…", and the section labels 01–04.

## Not verified in this session

- **No end-to-end run through the deployed Function.** The service-role key is
  not available in this environment, and the sandbox proxy blocks
  `*.supabase.co`, so the Function could not be run against the live project.
  What *was* verified is in the session report.
- **Masthead wraps to two rows at 375px** because the placeholder label chip is
  long. Expected to resolve once the real name lands; worth a re-check then.
