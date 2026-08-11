import { useEffect } from 'react';
import { isPlaceholder } from './placeholder.js';

/**
 * Null until the real deployed origin is configured (VITE_SITE_ORIGIN). Deliberately
 * not defaulted to a placeholder domain — a stand-in origin would end up inside
 * canonical tags and JSON-LD, which is exactly the kind of invented value that must
 * never ship. Canonical/OG URLs are simply omitted until this is set.
 */
export const SITE_ORIGIN = import.meta.env.VITE_SITE_ORIGIN || null;

/**
 * Strips anything unconfirmed out of a structured-data object, recursively.
 *
 * This is the rule that matters: `{{ }}` placeholders must never reach JSON-LD.
 * Structured data is machine-read and syndicated, so a placeholder that leaks
 * here ends up in search results and is far harder to retract than on-page copy.
 * Keys whose values are placeholders are dropped entirely rather than emitted empty.
 */
export function stripUnconfirmed(input) {
  if (Array.isArray(input)) {
    const items = input.map(stripUnconfirmed).filter((v) => v !== undefined);
    return items.length ? items : undefined;
  }
  if (input && typeof input === 'object') {
    const out = {};
    for (const [key, value] of Object.entries(input)) {
      const cleaned = stripUnconfirmed(value);
      if (cleaned !== undefined) out[key] = cleaned;
    }
    // An object carrying nothing but its @type is not worth emitting.
    const meaningful = Object.keys(out).filter((k) => !k.startsWith('@'));
    return meaningful.length ? out : undefined;
  }
  if (isPlaceholder(input)) return undefined;
  if (input === null || input === '') return undefined;
  return input;
}

/** Sets title, description, canonical and OG/Twitter tags for the current route. */
export function useDocumentHead({ title, description, path }) {
  useEffect(() => {
    if (title) document.title = title;

    setMeta('name', 'description', description);
    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', description);
    setMeta('name', 'twitter:title', title);
    setMeta('name', 'twitter:description', description);

    // Canonical and og:url need a real origin. Omitted rather than guessed.
    if (SITE_ORIGIN) {
      const canonical = `${SITE_ORIGIN}${path || '/'}`;
      setMeta('property', 'og:url', canonical);
      setLink('canonical', canonical);
    }
  }, [title, description, path]);
}

/**
 * Injects a JSON-LD block, removing it on unmount.
 *
 * Emits nothing unless every key in `requiredKeys` survived the placeholder strip.
 * Without this guard a block can still publish once its identifying field has been
 * dropped — an Organization with a url and no name, for instance, which is worse
 * than emitting nothing at all.
 */
export function useJsonLd(id, data, requiredKeys = []) {
  useEffect(() => {
    const cleaned = stripUnconfirmed(data);
    if (!cleaned) return undefined;
    if (requiredKeys.some((key) => cleaned[key] === undefined)) return undefined;

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = id;
    script.textContent = JSON.stringify(cleaned);
    document.head.appendChild(script);
    return () => script.remove();
  }, [id, data, requiredKeys]);
}

function setMeta(attr, key, value) {
  if (!value) return;
  let tag = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attr, key);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', value);
}

function setLink(rel, href) {
  let tag = document.head.querySelector(`link[rel="${rel}"]`);
  if (!tag) {
    tag = document.createElement('link');
    tag.setAttribute('rel', rel);
    document.head.appendChild(tag);
  }
  tag.setAttribute('href', href);
}
