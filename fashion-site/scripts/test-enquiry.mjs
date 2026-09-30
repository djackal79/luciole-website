/**
 * Tests the enquiry Function's logic by stubbing fetch and asserting the exact
 * request it builds — URL, headers and body — plus every rejection path.
 *
 * This does not replace an end-to-end run against the real service-role key;
 * see PLACEHOLDERS.md for what is still unverified.
 */
import { onRequestPost } from '../functions/api/enquiry.js';
import assert from 'node:assert/strict';

const ENV = {
  SUPABASE_URL: 'https://arlwezgblzgktpqrorpj.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key-not-real',
  ENQUIRY_IP_SALT: 'test-salt',
  ENQUIRY_PROJECT_ID: 'd369ed33-2d47-412b-b5bc-54ba1191e5b2',
};

const VALID = { name: 'Test Person', email: 'test@example.com', message: 'Hello.', source: 'wholesale' };

let calls = [];
const realFetch = globalThis.fetch;

function stubFetch({ countTotal = 0, insertStatus = 201 } = {}) {
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method || 'GET', headers: init.headers || {}, body: init.body });
    if (String(url).includes('select=id')) {
      return new Response('[]', { status: 200, headers: { 'content-range': `0-0/${countTotal}` } });
    }
    if (insertStatus >= 400) return new Response('{"message":"boom"}', { status: insertStatus });
    return new Response(JSON.stringify([{ id: 'row-uuid' }]), { status: 201 });
  };
}

function post(body, { ip = '203.0.113.7' } = {}) {
  return new Request('https://site.example/api/enquiry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
    body: JSON.stringify(body),
  });
}

const run = async (name, fn) => {
  calls = [];
  await fn();
  console.log(`  ✓ ${name}`);
};

console.log('enquiry Function');

await run('503 when env vars are missing, and the response names no values', async () => {
  stubFetch();
  const res = await onRequestPost({ request: post(VALID), env: {} });
  assert.equal(res.status, 503);
  const text = await res.text();
  assert.ok(!text.includes('service-role'));
  assert.equal(calls.length, 0);
});

await run('honeypot returns 200 and writes nothing', async () => {
  stubFetch();
  const res = await onRequestPost({ request: post({ ...VALID, company_website: 'http://spam.example' }), env: ENV });
  assert.equal(res.status, 200);
  assert.equal(calls.length, 0, 'honeypot must not reach the database');
});

await run('400 on missing fields', async () => {
  stubFetch();
  const res = await onRequestPost({ request: post({ name: 'A', email: '', message: '' }), env: ENV });
  assert.equal(res.status, 400);
  assert.equal(calls.length, 0);
});

await run('400 on malformed email', async () => {
  stubFetch();
  const res = await onRequestPost({ request: post({ ...VALID, email: 'not-an-email' }), env: ENV });
  assert.equal(res.status, 400);
});

await run('400 on malformed JSON', async () => {
  stubFetch();
  const request = new Request('https://site.example/api/enquiry', { method: 'POST', body: '{not json' });
  const res = await onRequestPost({ request, env: ENV });
  assert.equal(res.status, 400);
});

await run('429 once the window is full, with Retry-After', async () => {
  stubFetch({ countTotal: 3 });
  const res = await onRequestPost({ request: post(VALID), env: ENV });
  assert.equal(res.status, 429);
  assert.ok(res.headers.get('Retry-After'));
  assert.equal(calls.filter((c) => c.method === 'POST').length, 0, 'must not insert when rate limited');
});

await run('201 on the happy path, with the right PostgREST request', async () => {
  stubFetch({ countTotal: 0 });
  const res = await onRequestPost({ request: post(VALID), env: ENV });
  assert.equal(res.status, 201);

  const insert = calls.find((c) => c.method === 'POST');
  assert.ok(insert, 'expected an insert');
  assert.equal(insert.url, `${ENV.SUPABASE_URL}/rest/v1/enquiries`);
  assert.equal(insert.headers.apikey, ENV.SUPABASE_SERVICE_ROLE_KEY);
  assert.equal(insert.headers.Authorization, `Bearer ${ENV.SUPABASE_SERVICE_ROLE_KEY}`);

  const row = JSON.parse(insert.body);
  assert.equal(row.name, VALID.name);
  assert.equal(row.email, VALID.email);
  assert.equal(row.source, 'wholesale');
  assert.equal(row.project_id, ENV.ENQUIRY_PROJECT_ID);
  assert.match(row.ip_hash, /^[a-f0-9]{64}$/, 'ip_hash must be a SHA-256 hex digest');
  assert.ok(!JSON.stringify(row).includes('203.0.113.7'), 'raw IP must never be stored');
});

await run('unknown source values fall back to general', async () => {
  stubFetch();
  await onRequestPost({ request: post({ ...VALID, source: 'nonsense' }), env: ENV });
  assert.equal(JSON.parse(calls.find((c) => c.method === 'POST').body).source, 'general');
});

await run('over-long fields are truncated, not rejected', async () => {
  stubFetch();
  await onRequestPost({ request: post({ ...VALID, message: 'x'.repeat(9000) }), env: ENV });
  assert.equal(JSON.parse(calls.find((c) => c.method === 'POST').body).message.length, 4000);
});

await run('502 when the insert fails, and the key never leaks into the response', async () => {
  stubFetch({ insertStatus: 500 });
  const res = await onRequestPost({ request: post(VALID), env: ENV });
  assert.equal(res.status, 502);
  const text = await res.text();
  assert.ok(!text.includes(ENV.SUPABASE_SERVICE_ROLE_KEY), 'service-role key must not appear in any response body');
});

await run('a failing rate-limit check does not block a genuine enquiry', async () => {
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method || 'GET', headers: init.headers || {}, body: init.body });
    if (String(url).includes('select=id')) return new Response('nope', { status: 500 });
    return new Response(JSON.stringify([{ id: 'row-uuid' }]), { status: 201 });
  };
  const res = await onRequestPost({ request: post(VALID), env: ENV });
  assert.equal(res.status, 201);
});

globalThis.fetch = realFetch;
console.log('\nall enquiry Function tests passed');
