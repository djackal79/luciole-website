import { useState } from 'react';
import { Draft } from '../components/Draft.jsx';
import { Marker } from './TheLine.jsx';

/* Set at build time (VITE_ENQUIRY_EMAIL) so the mailto fallback works without
   hardcoding an address that has not been confirmed. Safe to expose — it is a
   public contact address, not a secret. */
const FALLBACK_EMAIL = import.meta.env.VITE_ENQUIRY_EMAIL || '';

export default function Enquiry({ productHandle = null }) {
  const [state, setState] = useState('idle'); // idle | sending | sent | failed
  const [error, setError] = useState('');

  async function onSubmit(event) {
    event.preventDefault();
    if (state === 'sending') return;

    setState('sending');
    setError('');

    const form = new FormData(event.currentTarget);
    const payload = {
      name: form.get('name'),
      email: form.get('email'),
      message: form.get('message'),
      source: form.get('source'),
      product_handle: productHandle,
      // Honeypot. Real users never fill this; bots usually do.
      company_website: form.get('company_website'),
    };

    try {
      const response = await fetch('/api/enquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `Request failed (${response.status})`);
      }
      setState('sent');
    } catch (err) {
      setError(err.message);
      setState('failed');
    }
  }

  return (
    <section className="shell section" id="enquiry" aria-labelledby="enquiry-title">
      <Marker label="04 / Enquiry" />
      <h2 className="h-section" id="enquiry-title">Enquiry</h2>
      <div className="prose" style={{ marginTop: '1rem', marginBottom: '2rem' }}>
        <Draft block>Intro line for the enquiry form</Draft>
      </div>

      {state === 'sent' ? (
        <div className="notice notice--ok" role="status">
          <p>Your enquiry has been received.</p>
          <p><Draft block>Confirmation copy and expected reply time — Pris</Draft></p>
        </div>
      ) : (
        <>
          <form className="form" onSubmit={onSubmit} noValidate={false}>
            <div className="field">
              <label htmlFor="enq-name">Name</label>
              <input id="enq-name" name="name" type="text" required autoComplete="name" maxLength={200} />
            </div>

            <div className="field">
              <label htmlFor="enq-email">Email</label>
              <input id="enq-email" name="email" type="email" required autoComplete="email" maxLength={320} />
            </div>

            <div className="field">
              <label htmlFor="enq-source">Enquiry type</label>
              <select id="enq-source" name="source" defaultValue="general">
                <option value="general">General</option>
                <option value="wholesale">Wholesale / stockist</option>
                <option value="press">Press</option>
              </select>
            </div>

            <div className="field">
              <label htmlFor="enq-message">Message</label>
              <textarea id="enq-message" name="message" required maxLength={4000} />
            </div>

            {/* Honeypot — hidden off-screen, never announced, never focusable. */}
            <div className="field field--hp" aria-hidden="true">
              <label htmlFor="enq-company-website">Company website</label>
              <input id="enq-company-website" name="company_website" type="text" tabIndex={-1} autoComplete="off" />
            </div>

            <button className="btn" type="submit" disabled={state === 'sending'}>
              {state === 'sending' ? 'Sending' : 'Send enquiry'}
            </button>
          </form>

          {state === 'failed' && (
            <div className="notice notice--fail" role="alert" style={{ marginTop: '1.5rem' }}>
              {/* The server's message already ends in a full stop; don't add a second. */}
              <p>That did not send{error ? ` — ${error.replace(/\.$/, '')}` : ''}.</p>
              {FALLBACK_EMAIL ? (
                <p>
                  You can email us directly at{' '}
                  <a href={`mailto:${FALLBACK_EMAIL}?subject=${encodeURIComponent('Enquiry')}`}>
                    {FALLBACK_EMAIL}
                  </a>.
                </p>
              ) : (
                <p>
                  <Draft block>
                    Fallback enquiry address not configured — set VITE_ENQUIRY_EMAIL — Carl
                  </Draft>
                </p>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
