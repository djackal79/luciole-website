/**
 * Generates the OG image and sitemap.xml into public/.
 *
 * The OG image is drawn from the site's own palette and tail device — it is
 * generated here, not sourced. No photography, no garment imagery, and no text
 * beyond confirmed facts read from site.json.
 *
 * The sitemap needs a real origin. If VITE_SITE_ORIGIN is unset it is skipped
 * rather than written against a guessed domain.
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const site = JSON.parse(readFileSync(resolve(root, 'src/data/site.json'), 'utf8'));
const origin = process.env.VITE_SITE_ORIGIN || '';

/* ------------------------------------------------------------------ OG image */

const html = `<!doctype html><meta charset="utf-8">
<style>
  @page { margin: 0 }
  html,body { margin:0; padding:0 }
  body { width:1200px; height:630px; background:#e6e9df; color:#16190f;
         font-family: Georgia, 'Times New Roman', serif; position:relative; overflow:hidden; }
  .pad { position:absolute; inset:0; padding:82px 92px; display:flex; flex-direction:column; justify-content:space-between; }
  .eyebrow { font-family: ui-monospace, monospace; font-size:19px; letter-spacing:.22em;
             text-transform:uppercase; color:#4c523f; }
  h1 { margin:0; font-size:112px; line-height:.98; letter-spacing:-.02em; font-weight:400; }
  .facts { font-family: ui-monospace, monospace; font-size:19px; letter-spacing:.14em;
           text-transform:uppercase; color:#4c523f; display:flex; gap:44px; }
  svg { position:absolute; top:-40px; right:-60px; height:740px; width:420px; }
</style>
<body>
  <svg viewBox="0 0 240 620" fill="none" preserveAspectRatio="none">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#6d8c3c" stop-opacity="0"/>
      <stop offset="18%" stop-color="#6d8c3c" stop-opacity=".6"/>
      <stop offset="70%" stop-color="#6d8c3c" stop-opacity=".32"/>
      <stop offset="100%" stop-color="#6d8c3c" stop-opacity="0"/>
    </linearGradient></defs>
    <path d="M118 0 C 118 90, 150 170, 158 268 C 166 372, 128 470, 96 620" stroke="url(#g)" stroke-width="1.25"/>
    <path d="M118 0 C 118 96, 176 186, 196 292 C 214 392, 178 486, 158 620" stroke="url(#g)" stroke-width="1"/>
  </svg>
  <div class="pad">
    <p class="eyebrow">In development</p>
    <h1>${escapeHtml(site.line)}</h1>
    <p class="facts"><span>${escapeHtml(site.garment)}</span><span>${escapeHtml(site.motif)}</span></p>
  </div>
</body>`;

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html, { waitUntil: 'load' });
await page.screenshot({ path: resolve(root, 'public/og.png') });
await browser.close();
console.log('wrote public/og.png (1200x630)');

// The HTML head references /og.svg from the initial scaffold; keep only the PNG.
const staleSvg = resolve(root, 'public/og.svg');
if (existsSync(staleSvg)) rmSync(staleSvg);

/* ------------------------------------------------------------------- sitemap */

const ROUTES = ['/', `/product/${site.leadProductHandle}`, '/privacy', '/returns'];

if (!origin) {
  console.warn('VITE_SITE_ORIGIN not set — skipping sitemap.xml rather than writing a guessed domain.');
} else {
  const urls = ROUTES.map((p) => `  <url><loc>${origin}${p}</loc></url>`).join('\n');
  writeFileSync(
    resolve(root, 'public/sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
  );
  console.log(`wrote public/sitemap.xml (${ROUTES.length} routes)`);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
