# Nocturnal Series — site

Vite + React, deployed to Cloudflare Pages. Built in `fashion-site/` so it does
not disturb the existing Luciole Designs page or the game at the repo root.

**This is a draft awaiting review, not a launch candidate.** It is `noindex` and
`robots.txt` disallows everything. See PLACEHOLDERS.md before doing anything with it.

```bash
npm install
npm run dev        # dev server
npm run build      # generates the OG image + sitemap, then builds to dist/
npm run review     # screenshots + responsive/placeholder checks (needs the dev server running)
npm test           # enquiry Function logic + form states
```

## Where things live

| Path | What |
|---|---|
| `src/data/products.json` | Shopify-shaped catalogue. **The only place product data lives.** |
| `src/data/site.json` | Line-level confirmed facts and UI labels. No confirmed fact is written inline in a component. |
| `src/lib/placeholder.js` | Detects `{{ }}` and drives the draft styling. |
| `src/lib/seo.js` | Strips placeholders out of JSON-LD; suppresses blocks missing required fields. |
| `functions/api/enquiry.js` | Pages Function. The **only** place the service-role key exists. |
| `DESIGN-NOTES.md` | How the Luna moth properties became the design, including what was rejected. |
| `PLACEHOLDERS.md` | Every `{{ }}`, split by owner. |

## The rule

Invent nothing. Unconfirmed values are `{{ }}` and render in a deliberately
off-palette draft style so they can never be mistaken for approved copy. Do not
replace a placeholder with a plausible stand-in — a placeholder price is worse
than a visible gap, because it looks finished.

## Environment

Copy `.env.example` to `.env` for the client-side vars. Server-side secrets go
in the Cloudflare Pages dashboard, never in the repo. See PLACEHOLDERS.md #9–10
for what is still unset and what that currently suppresses.

## Deploy

```bash
npm run build
npx wrangler pages deploy dist
```

Before any public launch: set `VITE_SITE_ORIGIN`, remove the `noindex` meta tag
in `index.html`, and open up `public/robots.txt`. All three are deliberate steps.
