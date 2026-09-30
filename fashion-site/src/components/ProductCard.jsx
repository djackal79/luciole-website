import { Link } from 'react-router-dom';
import Value from './Draft.jsx';
import { hasImages } from '../lib/placeholder.js';
import site from '../data/site.json';

/**
 * Reads entirely from products.json. No product detail is hardcoded here —
 * the only literal strings are UI chrome.
 */
export default function ProductCard({ product }) {
  return (
    <article>
      <Link to={`/product/${product.handle}`} className="card">
        {hasImages(product) ? (
          <img
            className="card__image"
            src={product.images[0].src}
            alt={product.images[0].alt ?? ''}
            loading="lazy"
          />
        ) : (
          /* Deliberately not a grey box: a grey box reads as a broken image and
             invites someone to "fix" it with a stock shot. */
          <div className="card__plate" role="img" aria-label={site.labels.noImagery.join(' ')}>
            {site.labels.noImagery.map((line) => <span key={line}>{line}</span>)}
          </div>
        )}

        <div>
          <h3 className="card__title">
            <Value value={product.title} />
          </h3>
          <div className="card__meta">
            <span className="card__price">
              <Value value={product.price} compact />
            </span>
            <span className="status-pill">
              {product.available ? site.labels.available : site.labels.unavailable}
            </span>
          </div>
        </div>
      </Link>

      {product.tags?.length > 0 && (
        <ul className="tag-row" style={{ marginTop: '0.75rem' }}>
          {product.tags.map((tag) => (
            <li key={tag} className="tag">{tag}</li>
          ))}
        </ul>
      )}
    </article>
  );
}
