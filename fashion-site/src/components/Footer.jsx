import { Link } from 'react-router-dom';
import Value, { Draft } from './Draft.jsx';
import site from '../data/site.json';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="shell footer__inner">
        {/* "Australia" is confirmed (AUD pricing, GST, domestic production routes).
            The city and registered address are not — see PLACEHOLDERS.md. */}
        <p className="footer__legal">
          {site.line} · <Value value={site.market} />
        </p>
        <nav className="nav" aria-label="Legal">
          <Link to="/privacy">Privacy</Link>
          <Link to="/returns">Returns &amp; Refunds</Link>
        </nav>
        <p className="footer__legal">
          {/* Trading name, ABN and registered entity are all unconfirmed. */}
          <Draft compact>Trading name &amp; ABN</Draft>
        </p>
      </div>
    </footer>
  );
}
