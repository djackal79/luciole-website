/**
 * Checkpoint 4: confirm this site does not visually converge with the lighting
 * site's direction (dark, atmospheric, gel-colour palette).
 *
 * The lighting site lives in this same repo at ../index.html, so the comparison
 * is against the real thing rather than a description of it.
 *
 *   node scripts/compare-lighting.mjs [fashionUrl]
 */
import { chromium } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FASHION = process.argv[2] || 'http://127.0.0.1:5192/';
const LIGHTING = `file://${resolve(root, '../index.html')}`;

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium' });

async function sample(url, name) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(200);
  await page.screenshot({ path: `review/compare-${name}.png` });

  const data = await page.evaluate(() => {
    const seen = new Map();
    for (const el of document.querySelectorAll('body, body *')) {
      const s = getComputedStyle(el);
      for (const prop of ['backgroundColor', 'color']) {
        const v = s[prop];
        if (!v || v === 'rgba(0, 0, 0, 0)') continue;
        seen.set(v, (seen.get(v) || 0) + 1);
      }
    }
    return {
      bg: getComputedStyle(document.body).backgroundColor,
      top: [...seen.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([c, n]) => `${c} ×${n}`),
    };
  });
  await page.close();
  return data;
}

const rgb = (s) => (s.match(/\d+/g) || []).slice(0, 3).map(Number);
const luminance = ([r, g, b]) => {
  const f = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const hue = ([r, g, b]) => {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (!d) return null;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return Math.round(((h * 60) + 360) % 360);
};

const fashion = await sample(FASHION, 'fashion');
const lighting = await sample(LIGHTING, 'lighting');
await browser.close();

for (const [name, d] of [['LIGHTING SITE (repo root index.html)', lighting], ['FASHION SITE (this build)', fashion]]) {
  const px = rgb(d.bg);
  console.log(`\n${name}`);
  console.log(`  body background : ${d.bg}`);
  console.log(`  ground luminance: ${luminance(px).toFixed(3)}  (${luminance(px) < 0.2 ? 'DARK' : 'LIGHT'} ground)`);
  console.log(`  ground hue      : ${hue(px) ?? 'neutral'}°`);
  console.log(`  most used colors: ${d.top.join(', ')}`);
}

const fl = luminance(rgb(fashion.bg));
const ll = luminance(rgb(lighting.bg));
console.log('\nVERDICT');
console.log(`  ground luminance differs by ${(Math.abs(fl - ll)).toFixed(3)} (${ll < 0.2 ? 'dark' : 'light'} vs ${fl < 0.2 ? 'dark' : 'light'})`);
console.log(`  ${(fl < 0.2) === (ll < 0.2) ? '✗ both sites share a ground value — CONVERGENCE RISK' : '✓ inverted ground values — no convergence on the primary axis'}`);
console.log('  screenshots: review/compare-lighting.png, review/compare-fashion.png');
