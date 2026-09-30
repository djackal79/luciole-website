import { Link } from 'react-router-dom';
import { Draft } from '../components/Draft.jsx';
import { useDocumentHead } from '../lib/seo.js';
import site from '../data/site.json';

/* Stub only. Nothing here states a returns window, a condition or a remedy —
   those are enforceable representations and none are decided. */
const SECTIONS = [
  'Change of mind',
  'Faulty or not as described',
  'Australian Consumer Law guarantees',
  'How to start a return',
  'Return postage and who pays',
  'Refund method and timing',
  'Exchanges',
  'Contact',
];

export default function Returns() {
  useDocumentHead({ title: `Returns & Refunds — ${site.line}`, description: '', path: '/returns' });

  return (
    <section className="shell doc">
      <Link to="/" className="back-link">← Home</Link>
      <h1 className="h-section" style={{ marginTop: '1.5rem' }}>Returns &amp; Refunds</h1>
      <Draft block>This policy has not been written. Do not publish the site with this page live.</Draft>

      {SECTIONS.map((heading) => (
        <section key={heading}>
          <h2 className="fact__key" style={{ marginTop: '2.25rem' }}>{heading}</h2>
          <Draft block>Unwritten — Carl (legal)</Draft>
        </section>
      ))}
    </section>
  );
}
