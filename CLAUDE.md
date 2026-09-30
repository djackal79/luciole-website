# CLAUDE.md — luciole-website

This repo holds SEVERAL projects. Identify which one you are in before you change anything.

## Path → project → vault home

Vault = Obsidian vault in Google Drive (PARA layout). Vault wins over this repo.

| Path | Project | Vault home |
|---|---|---|
| `game/`, `PROMPTS-EXPORT.*`, root `index.html` | Wise Crackers board game | `10_Projects/05_Board_Game` |
| `fashion-house/`, `website/` | Fashion House marketing site | `10_Projects/04_Fashion` |
| `fashion-site/` (only on the PR #2 branch) | Nocturnal Series fashion site | `20_Areas/01_Luciole Designs` |
| Separate repo `djackal79/luciole-designs` | lucioledesigns.com (Astro, Cloudflare Pages) | `20_Areas/01_Luciole Designs` |

The Luciole Designs site is NOT built from this repo. `main` in `luciole-designs`
auto-deploys to production; other branches get preview deployments.

## Session start

1. Read `AGENTS.md`, `_status.md`, `_decisions.md` in the vault home for the path you are touching (Drive connector).
2. `_status.md` is dated and may be stale. Verify live state (git branches and PRs, Cloudflare Pages, Supabase, the deployed site) before relying on it.
3. If a live system can't be reached, say so. Don't fill the gap from memory or summaries.
4. If vault and repo disagree, the vault wins. Report the disagreement.

## Session end

The Drive connector can create files but not edit file contents. Leave a dated note in the vault `00_Inbox/` named
`<area>-code-session-update-DD-MM-YYYY.md`, e.g. `luciole-designs-code-session-update-30-09-2026.md`. Cover what changed, branches and PRs, open questions, and any vault files that need updating.

## Hard rules

1. Never push to `main`. Work on a branch and open a PR only when asked. Production promotion needs explicit sign-off.
2. No secrets in commits or chat. Never open the credential notes in `20_Areas/03_Technical_Infrastructure/`.
3. Pris signs off brand and visual work before it counts as done. "Ember Hour" is a placeholder name until then.
4. Keep the worlds separate: Atelier, Nocturne and Maison are distinct brands. Don't merge palettes, or reuse "Nocturne" for an Atelier offering.
5. No CNC, 3D-printing or fabrication-service copy. Decor is premium smart-home design. Board game, book and CNC work are out of scope for Luciole Designs.
