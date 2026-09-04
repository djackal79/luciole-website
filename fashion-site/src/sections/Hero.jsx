import Value from '../components/Draft.jsx';
import { Draft } from '../components/Draft.jsx';
import site from '../data/site.json';
import catalogue from '../data/products.json';

/**
 * Hero. No photography, no illustration of the moth or the garment.
 * The only graphic is the trailing-tail device — see DESIGN-NOTES.md.
 *
 * Every fact shown here is read from a data file. Nothing factual is written
 * inline in this component — see the rule in src/data/site.json.
 */
export default function Hero() {
  const lead = catalogue.products.find((p) => p.handle === site.leadProductHandle);
  const availability = lead?.available ? site.labels.available : site.labels.unavailable;

  return (
    <section className="shell hero" aria-labelledby="hero-title">
      <Tails />
      <div className="hero__grid">
        <div>
          {/* The line name is confirmed, so it carries the hero and the h1 while the
              headline itself is unwritten. Without this the hero is nothing but a
              placeholder chip, and there is no design left to review. */}
          <p className="eyebrow">In development</p>
          <h1 className="h-display hero__title" id="hero-title">{site.line}</h1>
          <div className="hero__lede">
            <Draft block>Hero headline — the line that sits under the name</Draft>
            <Draft block>Hero standfirst — one or two lines beneath</Draft>
          </div>
        </div>

        <div className="hero__facts">
          <dl className="fact-list">
            <Fact k="Garment"><Value value={site.garment} /></Fact>
            <Fact k="Motif"><Value value={site.motif} /></Fact>
            <Fact k="Market"><Value value={site.market} /></Fact>
            <Fact k="Status">{availability}</Fact>
          </dl>
        </div>
      </div>
    </section>
  );
}

function Fact({ k, children }) {
  return (
    <div className="fact">
      <dt className="fact__key">{k}</dt>
      <dd className="fact__value" style={{ margin: 0 }}>{children}</dd>
    </div>
  );
}

/**
 * Two abstract hairline arcs echoing the hindwing streamers. Explicitly not a
 * depiction of the animal or the product — decorative, hidden from assistive tech.
 */
function Tails() {
  return (
    <div className="hero__tails" aria-hidden="true">
      {/* Paired streamers from a single origin, tapering as they trail — the pair
          and the common origin are what make it read as hindwing tails rather than
          as a stray curve. Fades out at both ends so it never becomes a hard shape. */}
      <svg viewBox="0 0 240 620" fill="none" preserveAspectRatio="none">
        <defs>
          <linearGradient id="tail-fade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--luna-deep)" stopOpacity="0" />
            <stop offset="18%" stopColor="var(--luna-deep)" stopOpacity="0.6" />
            <stop offset="70%" stopColor="var(--luna-deep)" stopOpacity="0.32" />
            <stop offset="100%" stopColor="var(--luna-deep)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M118 0 C 118 90, 150 170, 158 268 C 166 372, 128 470, 96 620"
          stroke="url(#tail-fade)"
          strokeWidth="1.25"
        />
        <path
          d="M118 0 C 118 96, 176 186, 196 292 C 214 392, 178 486, 158 620"
          stroke="url(#tail-fade)"
          strokeWidth="1"
        />
      </svg>
    </div>
  );
}
