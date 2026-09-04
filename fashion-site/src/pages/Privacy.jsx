import { Link } from 'react-router-dom';
import { Draft } from '../components/Draft.jsx';
import { useDocumentHead } from '../lib/seo.js';
import site from '../data/site.json';

/* Stub only. Legal content is not drafted here — see PLACEHOLDERS.md.
   The headings are structure, not claims. */
const SECTIONS = [
  'What we collect',
  'Why we collect it',
  'How enquiry data is stored',
  'Who it is shared with',
  'How long it is kept',
  'Your rights and how to make a request',
  'Cookies and analytics',
  'Contact',
];

export default function Privacy() {
  useDocumentHead({ title: `Privacy — ${site.line}`, description: '', path: '/privacy' });

  return (
    <section className="shell doc">
      <Link to="/" className="back-link">← Home</Link>
      <h1 className="h-section" style={{ marginTop: '1.5rem' }}>Privacy</h1>
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
