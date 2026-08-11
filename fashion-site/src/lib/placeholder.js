/**
 * Placeholder discipline.
 *
 * The brief's hard rule: invent nothing. Every unconfirmed value in the catalogue
 * is written as `{{ SOMETHING — Owner }}`. This module is what stops those values
 * from ever being mistaken for approved copy: the `{{ }}` marker itself drives a
 * deliberately non-brand visual treatment (see .draft in global.css).
 *
 * Consequence worth keeping: if someone pastes real copy in without removing the
 * braces it still renders as draft, and if someone removes the braces the draft
 * styling disappears. The marker and the treatment cannot drift apart.
 */

const MARKER = /^\s*\{\{([\s\S]*)\}\}\s*$/;

export function isPlaceholder(value) {
  return typeof value === 'string' && MARKER.test(value);
}

/** Strips the braces for display; the draft styling supplies the "this is unapproved" signal. */
export function placeholderLabel(value) {
  const match = typeof value === 'string' ? value.match(MARKER) : null;
  return match ? match[1].trim() : '';
}

/** True when a whole record has no confirmed imagery to show. */
export function hasImages(product) {
  return Array.isArray(product.images) && product.images.length > 0;
}
