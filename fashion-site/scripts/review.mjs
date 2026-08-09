/**
 * Visual + responsive review harness.
 *
 * Captures the site at desktop and mobile widths, and asserts the things that are
 * easy to assume and wrong about: horizontal overflow at 375px, missing sections,
 * and any placeholder that lost its draft styling.
 *
 *   node scripts/review.mjs [baseUrl] [outDir]
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.argv[2] || 'http://127.0.0.1:5180';
const OUT = process.argv[3] || 'review';

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'mobile', width: 375, height: 812, isMobile: true, deviceScaleFactor: 2 },
];

const ROUTES = [
  { path: '/', name: 'home' },
  { path: '/product/nocturnal-series-v-neck', name: 'product' },
  { path: '/privacy', name: 'privacy' },
  { path: '/returns', name: 'returns' },
];

const REQUIRED_SECTIONS = ['#the-line', '#provenance', '#about', '#enquiry'];

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium' });
const findings = [];
const consoleErrors = [];

for (const vp of VIEWPORTS) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.deviceScaleFactor || 1,
  });
  const page = await context.newPage();
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(`[${vp.name}] ${m.text()}`); });
  page.on('pageerror', (e) => consoleErrors.push(`[${vp.name}] pageerror: ${e.message}`));

  for (const route of ROUTES) {
    await page.goto(`${BASE}${route.path}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(250);

    await page.screenshot({ path: `${OUT}/${route.name}-${vp.name}.png`, fullPage: true });

    // Horizontal overflow — the thing you cannot check by assuming.
    const overflow = await page.evaluate(() => {
      const de = document.documentElement;
      const offenders = [];
      if (de.scrollWidth > de.clientWidth) {
        for (const el of document.querySelectorAll('body *')) {
          const r = el.getBoundingClientRect();
          if (r.right > de.clientWidth + 1 || r.left < -1) {
            offenders.push(`${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ')[0]} right=${Math.round(r.right)}`);
          }
        }
      }
      return { scrollWidth: de.scrollWidth, clientWidth: de.clientWidth, offenders: offenders.slice(0, 6) };
    });
    if (overflow.scrollWidth > overflow.clientWidth) {
      findings.push(`OVERFLOW ${route.name}@${vp.name}: ${overflow.scrollWidth}px > ${overflow.clientWidth}px :: ${overflow.offenders.join(' | ')}`);
    }

    if (route.path === '/') {
      const missing = await page.evaluate((sel) => sel.filter((s) => !document.querySelector(s)), REQUIRED_SECTIONS);
      if (missing.length) findings.push(`MISSING SECTIONS @${vp.name}: ${missing.join(', ')}`);
    }

    // Any placeholder rendered without the draft treatment is a discipline failure.
    const bare = await page.evaluate(() => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const out = [];
      let n;
      while ((n = walker.nextNode())) {
        if (/\{\{|\}\}/.test(n.textContent) && !n.parentElement?.closest('[data-placeholder]')) {
          out.push(n.textContent.trim().slice(0, 60));
        }
      }
      return out;
    });
    if (bare.length) findings.push(`UNSTYLED PLACEHOLDER ${route.name}@${vp.name}: ${bare.join(' | ')}`);
  }
  await context.close();
}

// Draft-styling contrast + count on the home page, for the self-critique write-up.
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await ctx.newPage();
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
const stats = await page.evaluate(() => ({
  drafts: document.querySelectorAll('[data-placeholder]').length,
  jsonLd: [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => s.textContent),
  bodyBg: getComputedStyle(document.body).backgroundColor,
  images: document.querySelectorAll('img').length,
}));
await ctx.close();
await browser.close();

console.log('--- screenshots written to', OUT);
console.log('--- drafts on home page:', stats.drafts);
console.log('--- <img> elements on home page:', stats.images, '(expected 0 — no photography)');
console.log('--- body background:', stats.bodyBg);
console.log('--- JSON-LD blocks:', stats.jsonLd.length ? stats.jsonLd : '(none emitted)');
console.log('--- console errors:', consoleErrors.length ? consoleErrors : 'none');
console.log(findings.length ? '\nFINDINGS:\n' + findings.map((f) => '  ✗ ' + f).join('\n') : '\nFINDINGS: none');
process.exit(findings.length ? 1 : 0);
