/**
 * Drives the enquiry form in a real browser and checks the states that are easy
 * to claim and never actually look at: the failure path's mailto fallback, the
 * success state, and the honeypot being genuinely hidden from a real user.
 *
 * The /api/enquiry endpoint is intercepted, so this exercises the client's
 * handling of each response without needing the Function deployed.
 *
 *   node scripts/test-form-states.mjs [baseUrl]
 */
import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const BASE = process.argv[2] || 'http://127.0.0.1:5181';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium' });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();

async function fillAndSubmit() {
  await page.fill('#enq-name', 'Test Person');
  await page.fill('#enq-email', 'test@example.com');
  await page.fill('#enq-message', 'Checking the form states.');
  await page.click('button[type="submit"]');
}

/* ------------------------------------------------- honeypot is truly hidden */

await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });

const honeypot = page.locator('#enq-company-website');
assert.equal(await honeypot.count(), 1, 'honeypot field must exist');

/* Deliberately positioned off-canvas rather than display:none — a bot that skips
   display:none fields still fills this one, which is the entire point. So the
   check is "outside the viewport", not Playwright's isVisible(), which counts
   off-screen elements as visible. */
const box = await honeypot.boundingBox();
const viewport = page.viewportSize();
assert.ok(
  box && (box.x + box.width < 0 || box.x > viewport.width || box.y + box.height < 0),
  `honeypot must sit outside the viewport, got ${JSON.stringify(box)}`
);
assert.equal(await honeypot.getAttribute('tabindex'), '-1', 'honeypot must be unreachable by keyboard');
assert.equal(
  await page.locator('.field--hp').getAttribute('aria-hidden'),
  'true',
  'honeypot must be hidden from assistive tech'
);
console.log('  ✓ honeypot present, off-canvas, untabbable, aria-hidden');

/* ------------------------------------------------------ failure → fallback */

await page.route('**/api/enquiry', (route) =>
  route.fulfill({ status: 502, contentType: 'application/json', body: '{"error":"Could not save your enquiry."}' })
);

await fillAndSubmit();
await page.waitForSelector('.notice--fail', { timeout: 5000 });

const failText = await page.locator('.notice--fail').innerText();
assert.match(failText, /did not send/i, 'failure notice must say the send failed');

const mailto = page.locator('.notice--fail a[href^="mailto:"]');
const mailtoCount = await mailto.count();
if (mailtoCount === 1) {
  console.log(`  ✓ failure path shows mailto fallback → ${await mailto.getAttribute('href')}`);
} else {
  const draft = await page.locator('.notice--fail [data-placeholder]').count();
  assert.equal(draft, 1, 'with no address configured, the fallback must show a draft placeholder');
  console.log('  ✓ failure path shows draft placeholder (VITE_ENQUIRY_EMAIL not set at build time)');
}
await page.screenshot({ path: 'review/form-failure.png' });

/* -------------------------------------------------------------- success */

await page.unroute('**/api/enquiry');
await page.route('**/api/enquiry', (route) =>
  route.fulfill({ status: 201, contentType: 'application/json', body: '{"ok":true,"id":"row-uuid"}' })
);

await page.reload({ waitUntil: 'networkidle' });
await fillAndSubmit();
await page.waitForSelector('.notice--ok', { timeout: 5000 });
assert.equal(await page.locator('form').count(), 0, 'form should be replaced by the confirmation');
console.log('  ✓ success path replaces the form with a confirmation');
await page.screenshot({ path: 'review/form-success.png' });

/* --------------------------------------- the request the client actually sends */

let sent = null;
await page.unroute('**/api/enquiry');
await page.route('**/api/enquiry', (route) => {
  sent = JSON.parse(route.request().postData());
  return route.fulfill({ status: 201, contentType: 'application/json', body: '{"ok":true}' });
});

await page.goto(`${BASE}/product/nocturnal-series-v-neck`, { waitUntil: 'networkidle' });
await page.selectOption('#enq-source', 'wholesale');
await fillAndSubmit();
await page.waitForSelector('.notice--ok', { timeout: 5000 });

assert.equal(sent.source, 'wholesale');
assert.equal(sent.product_handle, 'nocturnal-series-v-neck', 'product page must attach its handle');
assert.equal(sent.company_website, '', 'honeypot must be sent empty by a real submission');
console.log('  ✓ product page attaches product_handle; source and empty honeypot sent correctly');

await browser.close();
console.log('\nall form-state tests passed');
