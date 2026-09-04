/**
 * POST /api/enquiry — receives the enquiry form and writes to Supabase.
 *
 * This file runs server-side on Cloudflare Pages. It is the ONLY place the
 * service-role key exists. It is never imported by anything under src/, so it
 * cannot end up in the client bundle.
 *
 * Required Pages environment variables:
 *   SUPABASE_URL               e.g. https://<ref>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY  service_role key — mark as Encrypted
 *   ENQUIRY_IP_SALT            any long random string; salts the IP hash
 * Optional:
 *   ENQUIRY_PROJECT_ID         uuid of the project row to attach enquiries to
 */

const WINDOW_MINUTES = 10;
const MAX_PER_WINDOW = 3;

const LIMITS = {
  name: 200,
  email: 320,
  message: 4000,
  product_handle: 200,
};

const ALLOWED_SOURCES = new Set(['general', 'wholesale', 'press']);

export async function onRequestPost(context) {
  const { request, env } = context;

  const missing = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'ENQUIRY_IP_SALT']
    .filter((key) => !env[key]);
  if (missing.length) {
    // Names only — never the values.
    console.error(`enquiry: missing environment variables: ${missing.join(', ')}`);
    return json({ error: 'Enquiries are not configured yet.' }, 503);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Malformed request.' }, 400);
  }

  // Honeypot. Answer 200 so a bot cannot tell it was caught, but write nothing.
  if (typeof body.company_website === 'string' && body.company_website.trim() !== '') {
    return json({ ok: true }, 200);
  }

  const name = clean(body.name, LIMITS.name);
  const email = clean(body.email, LIMITS.email);
  const message = clean(body.message, LIMITS.message);
  const productHandle = clean(body.product_handle, LIMITS.product_handle) || null;
  const source = ALLOWED_SOURCES.has(body.source) ? body.source : 'general';

  if (!name || !email || !message) {
    return json({ error: 'Name, email and message are all required.' }, 400);
  }
  if (!isEmail(email)) {
    return json({ error: 'That email address does not look right.' }, 400);
  }

  const ip = request.headers.get('CF-Connecting-IP') || '';
  const ipHash = ip ? await sha256(`${ip}:${env.ENQUIRY_IP_SALT}`) : null;

  const rest = new SupabaseRest(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  // Rate limit. Durable because it counts rows, not isolate-local memory —
  // a Cloudflare isolate can be recycled between two requests from the same client.
  if (ipHash) {
    const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();
    try {
      const recent = await rest.count('enquiries', `ip_hash=eq.${ipHash}&created_at=gte.${since}`);
      if (recent >= MAX_PER_WINDOW) {
        return json(
          { error: `Too many enquiries. Try again in ${WINDOW_MINUTES} minutes.` },
          429,
          { 'Retry-After': String(WINDOW_MINUTES * 60) }
        );
      }
    } catch (err) {
      // A failed rate-limit check must not block a genuine enquiry.
      console.error('enquiry: rate-limit check failed:', err.message);
    }
  }

  try {
    const row = await rest.insert('enquiries', {
      source,
      product_handle: productHandle,
      name,
      email,
      message,
      ip_hash: ipHash,
      project_id: env.ENQUIRY_PROJECT_ID || null,
    });
    return json({ ok: true, id: row?.id ?? null }, 201);
  } catch (err) {
    console.error('enquiry: insert failed:', err.message);
    return json({ error: 'Could not save your enquiry.' }, 502);
  }
}

/* Only onRequestPost is exported. Pages answers 405 for other methods by itself. */

/* ------------------------------------------------------------------ helpers */

class SupabaseRest {
  constructor(url, serviceRoleKey) {
    this.base = `${url.replace(/\/+$/, '')}/rest/v1`;
    // Held only in this server-side closure. Never returned, never logged.
    this.headers = {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    };
  }

  async count(table, query) {
    const response = await fetch(`${this.base}/${table}?select=id&${query}`, {
      headers: { ...this.headers, Prefer: 'count=exact', Range: '0-0' },
    });
    if (!response.ok) throw new Error(`count ${response.status}`);
    // content-range looks like "0-0/12"
    const total = (response.headers.get('content-range') || '').split('/')[1];
    return Number.parseInt(total, 10) || 0;
  }

  async insert(table, values) {
    const response = await fetch(`${this.base}/${table}`, {
      method: 'POST',
      headers: { ...this.headers, Prefer: 'return=representation' },
      body: JSON.stringify(values),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      // Truncated, and it is PostgREST's own message — it never contains the key.
      throw new Error(`insert ${response.status}: ${detail.slice(0, 200)}`);
    }
    const [row] = await response.json();
    return row;
  }
}

function clean(value, max) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

async function sha256(input) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function json(payload, status, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}
