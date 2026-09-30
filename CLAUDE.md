# luciole-website: read this first

This repo holds several unrelated projects. Work out which one you are in before changing anything. If the task doesn't match a row below, stop and ask.

## What lives here

| Path | What it is | Vault home |
|---|---|---|
| `index.html` (root) | Luciole Designs "coming soon" page. The hub at luciole-website.pages.dev deploys from here | `20_Areas/01_Luciole_Designs` |
| `fashion-site/` | Nocturnal Series site draft (Vite + React). Lives on branch `claude/brief-3-fashion-site-code-ykvbcw`, PR #2. Not on `main` until merged | `20_Areas/01_Luciole_Designs` (site), `10_Projects/04_Fashion` (garment) |
| `game/` | "Pull Another One" party game | `10_Projects/05_Board_Game` |
| `fashion-house/`, `website/` | "The Fashion House" board game and its marketing page. Deploys via `.github/workflows/deploy-fashion-house.yml` | `10_Projects/05_Board_Game` |
| `golf-sim/` | Golf simulator backend. Lives on branch `claude/golf-simulator-backend-9a46d5`. Unrelated to Luciole. It should have its own repo | `10_Projects/01_Golf_Sim` |

Deploy target for the fashion site is a separate repo, `djackal79/fashion` (a Cloudflare Worker). Develop here, never there.

## Session start (do this before any work)

1. Check the Obsidian vault through the Google Drive connector. Read `AGENTS.md` and `_status.md` in the vault home for your task (table above). Vault wins over anything in this repo if they disagree. Say so when they do.
2. Verify live state before reporting it. Query Supabase, load the deployed URL, check n8n execution history. Never report status from an AI summary or an earlier chat.
3. Don't read the credential notes in `20_Areas/03_Technical_Infrastructure/` (`Tokens`, `HA tokens`, `N8N variables`, `Telegram Bots`) unless Carl names the note in the current message. Never put a secret in a file, commit or chat.

## Session end (do this before saying you're done)

Write back what changed. The Drive connector can create files but cannot edit file contents, so until that changes, leave a dated note in `00_Inbox/` named `<area>-code-session-update-DD-MM-YYYY.md` with ready-to-paste blocks for `_status.md` and `_decisions.md`. State what was verified and how.

## Luciole rules that apply to any code here

- Extend existing infrastructure. Use the existing Supabase project, dashboard and Cloudflare deployments. Don't create a new Supabase or Cloudflare project without an explicit decision from Carl.
- Supabase project `arlwezgblzgktpqrorpj` auto-pauses when idle (it has paused twice). If tools time out, check `get_project` status before assuming anything else is broken.
- n8n is self-hosted (n8n.lucioledesigns.com). Use `$env.`, never `$vars`.
- Apply migrations directly through the Supabase MCP and confirm with a select. Check RLS and policies before building any dashboard read (see vault `learning-supabase-rls-dashboard-reads.md`).
- Don't add tables that weren't asked for. Ask first.

## fashion-site/ rules

- **Invent nothing.** No prices, sizing, sourcing, materials, certifications, testimonials, stock photography or generated garment images. Anything unconfirmed is a `{{ }}` placeholder and renders in the violet draft style. A plausible-looking stand-in is worse than a visible gap.
- **Provenance stays empty.** Origin, mill and certification claims are legally actionable. The India production route is parked and certification checks are pending. Populate only from documents Carl can produce.
- **Pris signs off voice and visual direction** before anything is called done. Present the site as a draft.
- **Open conflict: brand identity.** The vault decides the main site uses the Atelier identity (`refs/ref-brand-atelier.md`). This draft uses a cool green palette derived from Luna moth biology, and neither Atelier nor Nocturne matches it. Don't polish the current look until Carl decides which identity applies.
- The site must stay visually distinct from the lighting site.
- All product data comes from `src/data/products.json` and `src/data/site.json`. No facts written inline in components.

## Session naming

Name sessions `<Area> · <MODE> · <topic>`, where MODE is BUILD, PLAN, REVIEW or RESEARCH. Example: `Luciole · BUILD · Nocturnal site + design-prompts`.
