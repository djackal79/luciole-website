// Prompt loading for the CANON v2.1 packet model (CN-5.27 / CN-6.1b / CN-4.20a).
//
// REAL CONTENT IN USE — 256 authored prompts, regrouped from the previous
// 16-card corpus. Two mechanical repairs were applied on import, both
// recovered from the archive in `prompts.js`, nothing authored:
//   * 168 em dashes had been double-encoded (U+00E2 U+0080 U+0094) and were
//     round-tripped back to U+2014.
//   * 8 rows had copied the old `success_text` column instead of `text`; the
//     original prompt was restored for each from the archived corpus.
// The CSV also carries three provenance columns beyond the canonical schema —
// packet_number, source_old_card, source_old_position. The loader ignores
// them; they are kept so any row can be traced back to its origin.
//
// STRUCTURE
//   32 single-venue Prompt Cards, 8 per venue, 8 prompts each = 256.
//   Cards  1–8  Comedy Lounge
//   Cards  9–16 The Club
//   Cards 17–24 The Royal Show
//   Cards 25–32 The School Play
//
//   A packet is 5 cards: 1 Character Card + 4 Prompt Cards, one per venue.
//   Packets are fixed, not random. Packet N pairs with Character N in the
//   CHARACTERS array order (Kookaburra = 1 … Platypus = 8) and holds
//   prompt cards N, N+8, N+16 and N+24.
//
// The old 16-card × 4-venue data still sits in `prompts.js`. It is no longer
// read by anything — kept only so the previously authored corpus is not lost.
// PROMPTS-EXPORT.md / .csv in the repo root archive it in full.

export const VENUE_ORDER = ['comedy_lounge', 'the_club', 'royal_show', 'school_play'];

export const PACKET_COUNT = 8;
export const CARDS_PER_VENUE = 8;
export const PROMPTS_PER_CARD = 8;

// Packet N -> the single-venue Prompt Card serving that venue.
export function packetCardFor(packetNumber, venue) {
  const vi = VENUE_ORDER.indexOf(venue);
  if (vi === -1) return null;
  return vi * CARDS_PER_VENUE + packetNumber;
}

// Minimal RFC-4180-ish parser: handles quoted fields and embedded commas,
// which prompt text will certainly contain.
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
      continue;
    }
    if (c === '"') { inQuotes = true; continue; }
    if (c === ',') { row.push(field); field = ''; continue; }
    if (c === '\r') continue;
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
    field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.length > 1 || (r.length === 1 && r[0].trim() !== ''));
}

export async function loadPrompts(url = 'data/prompts_v2.csv') {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load prompts: ${res.status}`);
  const rows = parseCsv(await res.text());
  const header = rows.shift().map(h => h.trim());

  const idx = name => header.indexOf(name);
  const iCard = idx('packet_card_number');
  const iVenue = idx('venue');
  const iPos = idx('position');
  const iText = idx('text');
  const iTimed = idx('timed');
  const iDur = idx('duration_seconds');

  if ([iCard, iVenue, iPos, iText].some(i => i === -1)) {
    throw new Error('prompts CSV is missing a required column');
  }

  return rows.map(r => ({
    packet_card_number: parseInt(r[iCard], 10),
    venue: (r[iVenue] || '').trim(),
    position: parseInt(r[iPos], 10),
    text: r[iText] || '',
    // `timed` and `duration_seconds` drive the countdown timer and are the
    // only two optional fields that survived from the old schema.
    timed: String(r[iTimed]).trim().toLowerCase() === 'true',
    duration_seconds: r[iDur] && String(r[iDur]).trim() !== '' ? parseInt(r[iDur], 10) : null,
  })).filter(p => Number.isFinite(p.packet_card_number) && p.venue && Number.isFinite(p.position));
}
