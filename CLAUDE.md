# CLAUDE.md: luciole-website

This one repo holds several separate projects. Work out which one you are in before changing anything.

## Path map

| Path | Project | Vault home (Drive, Obsidian) |
|---|---|---|
| `fashion-house/` | THE FASHION HOUSE(TM) board game, electronic (React/Vite) | `10_Projects/08_Fashion_House_Game` |
| `website/` | Fashion House marketing and pre-order **website** (single HTML file) | `10_Projects/08_Fashion_House_Game` |
| `game/`, `PROMPTS-EXPORT.*` | Wise Crackers and Galahs, electronic (still branded "Pull Another One") | `10_Projects/05_Board_Game` |
| `index.html` (root) | Luciole Designs "Coming Soon" page | `20_Areas/01_Luciole_Designs` |
| `.github/workflows/deploy-fashion-house.yml` | GitHub Pages deploy for `fashion-house/` | `08_Fashion_House_Game` |

Fashion House and Wise Crackers are different games. Keep them separate in code, notes and Supabase tables.
Textiles (`04_Fashion`) and the physical Wise Crackers game are not in this repo.

## Session start

1. Read `AGENTS.md`, `_status.md`, `_decisions.md` in the vault home above, via the Google Drive connector. The vault wins over anything in this repo or an old Claude Project.
2. Check live state: `git log` and branches, Cloudflare Pages deploys (one project per folder, each deploys from `main`), Supabase project `luciole-designs`. Do not trust summaries.
3. Do not open the credential notes in `20_Areas/03_Technical_Infrastructure`.

## Session end

The Drive connector cannot edit file contents. Leave a dated note in `00_Inbox` named
`<area>-code-session-update-DD-MM-YYYY.md` (e.g. `fashion-house-code-session-update-30-09-2026.md`), listing what changed, what is live, and open issues.

## Hard rules

1. Cloudflare Pages builds from `main` only. Work on a branch, and merge to `main` only when Carl says so. Folder and output-directory names are case-sensitive (`website`, not `Website`).
2. Fashion House multiplayer uses table `fashion_house_sessions` in Supabase project `luciole-designs`, which is shared with the agent system and dashboard. Do not touch other tables there. `game/` points at a different project (`carl-health`, paused); do not "fix" this without asking.
3. Never write keys, tokens or service-role secrets into code, notes or commits. Anon keys already in the repo are not to be copied elsewhere.
4. Any use of the old names "Pull Another One" or "Heckle & Howl" goes on the issue register in the vault, not silently renamed. The current name is "Wise Crackers and Galahs" (exact spelling to be confirmed by Carl).
5. Verify before reporting "live" or "working": pages.dev is not reachable from the cloud sandbox, so say so rather than guess.
