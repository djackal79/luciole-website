import { Link } from 'react-router-dom';
import { useDocumentHead } from '../lib/seo.js';

export default function NotFound() {
  useDocumentHead({ title: 'Not found', description: '', path: '/' });
  return (
    <section className="shell doc">
      <h1 className="h-section">Not found</h1>
      <p className="prose">That page does not exist.</p>
      <Link to="/" className="back-link">← Home</Link>
    </section>
  );
}
