# CLAUDE.md — luciole-website

Several unrelated projects share this repo. Work only in the directory your task names.
The Obsidian vault (Google Drive connector) is the source of truth. Where it disagrees with
the repo, the vault wins: say so.

## Path -> project -> vault home

| Path | Project | Vault home |
|---|---|---|
| `golf-sim/` | Golf Sim (golf simulator: Square/GSPro ingest, Kinovea, pose, dashboard) | `10_Projects/01_Golf Sim` |
| `game/`, `PROMPTS-EXPORT.*` | Pull Another One (Christmas cracker party game) | `10_Projects/05_Board Game 1` (probable) |
| `fashion-house/`, `website/`, `.github/workflows/deploy-fashion-house.yml` | THE FASHION HOUSE(TM) game + marketing site | `10_Projects/05_Board Game 1` (probable) |
| `index.html`, `README.md` | Luciole Designs "coming soon" page | `20_Areas/01_Luciole Designs` |

- "Probable" rows come from code and PR titles; `05_Board Game 1` has no standing files to confirm them.
- Not on `main`: PR #2 (`claude/brief-3-fashion-site-code-ykvbcw`, Nocturnal Series fashion site) -> `10_Projects/04_Fashion`.
- Not here: Paragolf (repo `djackal79/Paragolf`, vault `10_Projects/08_Paragolf`). Never mix it with Golf Sim.

## Session start

1. Vault: search Drive under `10_Projects/`. Folder names use spaces (`01_Golf Sim`); notes write `01_Golf_Sim`.
   Read AGENTS.md, _status.md, _decisions.md (created 30/09/2026 from the repo; re-verify anything volatile in `_status.md`).
   If one is missing, say so; don't invent it.
2. Live state, from the source and not from summaries: `git ls-remote --heads origin`,
   `git log --oneline origin/main..HEAD`, the decision table in `golf-sim/SSOT.md`, open PRs on GitHub.
3. Never open the credential notes in `20_Areas/03_Technical_Infrastructure`. Never copy a secret into a note, commit or chat.

## Session end

The Drive connector can't edit file contents. Leave a dated note in `00_Inbox` named
`golf-sim-code-session-update-DD-MM-YYYY.md` (frontmatter `type: note`, `project: 01_Golf_Sim`):
what changed, commit hashes, decisions, open questions. Prose dates are DD/MM/YYYY.

## Golf Sim: hard rules

1. All Golf Sim work lives under `golf-sim/`, on `claude/golf-simulator-backend-9a46d5`. Never push to `main`; no PR unless asked.
2. `golf-sim/CONTRACT.md` and `golf-sim/SSOT.md` are authoritative. Log each finding as a numbered D-entry in SSOT, and mark
   what is inference rather than diagnosis.
3. The bay's hardware beats any reference implementation (SSOT D23). Read primary source, not fetched summaries: two
   regressions came from summaries. Don't change framing or arming in `backend/gspro.py` without a bay log. Connect-time
   201 with `DistanceToTarget` + `Surface`, CRLF, is proven (D25); the post-shot re-arm is still unsolved (D26-D29).
4. A blank beats a wrong number: 3D metrics refuse without `IMPACT_MS` and calibration (D15, D16). Never publish an
   estimate as a measurement. Prove a new test by re-introducing the bug it guards.
5. Settings are `GOLFSIM_*` in `golf-sim/.env`, which is gitignored and never committed.

## Golf Sim: where to look

`golf-sim/RUNBOOK.md` (staged bring-up), `SSOT.md` (status + decisions D0-D29), `CONTRACT.md` (data contract),
`FRONTEND_BRIEF.md` and `DESIGN_BRIEF.md` (frontend), `HANDOVER.md`. Tests: `cd golf-sim && pytest -q`.
Volatile status belongs in the vault `_status.md`, not in this file.
