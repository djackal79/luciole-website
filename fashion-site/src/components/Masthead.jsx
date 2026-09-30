import { Link, useLocation } from 'react-router-dom';
import Value from './Draft.jsx';
import site from '../data/site.json';

const LINKS = [
  { href: '/#the-line', label: 'The Line' },
  { href: '/#provenance', label: 'Provenance' },
  { href: '/#about', label: 'About' },
  { href: '/#enquiry', label: 'Enquire' },
];

export default function Masthead() {
  const { pathname } = useLocation();
  const onHome = pathname === '/';

  return (
    <header className="masthead">
      <div className="shell masthead__inner">
        {/* No aria-label here: an override would not match the visible text, which
            trips label-content-name-mismatch. The link's own text is its name. */}
        <Link to="/" className="masthead__mark">
          {/* The label's trading name is not confirmed. It stays a placeholder
              rather than borrowing a name from anywhere. */}
          <Value value={site.labelName} compact />
        </Link>
        <nav className="nav" aria-label="Primary">
          {LINKS.map(({ href, label }) => (
            <a key={href} href={onHome ? href.replace('/', '') : href}>{label}</a>
          ))}
        </nav>
      </div>
    </header>
  );
}
