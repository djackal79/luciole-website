import { Draft } from '../components/Draft.jsx';
import { Marker } from './TheLine.jsx';

/**
 * PROVENANCE — STRUCTURE ONLY.
 *
 * This section carries no written claims of any kind. Origin, fibre, mill,
 * certification and labour-standards statements are legally actionable
 * representations under Australian Consumer Law (ss 18 and 29), and none of
 * them are currently verified: the project is mid-sourcing, the India
 * production route is parked, and the GOTS / OEKO-TEX verification task is
 * still pending.
 *
 * Do not populate any row here from a draft, an intention, or a supplier's
 * marketing copy. Populate only from documentation you can produce on request.
 */

const ROWS = [
  'Fibre',
  'Yarn & knit',
  'Mill',
  'Cut, make, trim',
  'Dye & finishing',
  'Certifications',
  'Country of origin',
  'Labour standards',
  'Audit & verification',
];

export default function Provenance() {
  return (
    <section className="shell section" id="provenance" aria-labelledby="provenance-title">
      <Marker label="02 / Provenance" />
      <h2 className="h-section" id="provenance-title">Provenance</h2>

      {/* The explanatory sentence is itself unapproved copy — whether the site
          says anything at all about why this is empty is Pris's call. */}
      <div className="provenance-note" style={{ marginTop: '1.25rem' }}>
        <Draft block>
          Optional note explaining why this section is empty — Pris to decide whether the site says anything here at all
        </Draft>
      </div>

      <dl className="fact-list">
        {ROWS.map((row) => (
          <div className="fact" key={row}>
            <dt className="fact__key">{row}</dt>
            <dd style={{ margin: 0 }}>
              <Draft>Unverified — Carl</Draft>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
