import { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import Value, { Draft } from '../components/Draft.jsx';
import EnquirySection from '../sections/Enquiry.jsx';
import { Marker } from '../sections/TheLine.jsx';
import { hasImages } from '../lib/placeholder.js';
import { useDocumentHead, useJsonLd } from '../lib/seo.js';
import catalogue from '../data/products.json';
import site from '../data/site.json';

/* Module-level so the identity is stable across renders. */
const PRODUCT_REQUIRED = ['name'];

export default function Product() {
  const { handle } = useParams();
  const product = catalogue.products.find((p) => p.handle === handle);

  if (!product) return <NotInCatalogue />;

  return <ProductView product={product} />;
}

function ProductView({ product }) {
  useDocumentHead({
    title: `${product.title} — ${site.line}`,
    description: site.seo.description,
    path: `/product/${product.handle}`,
  });

  /* Only confirmed fields. No `offers` block: price is unconfirmed, and
     emitting availability without a price would imply a purchasable product.
     Placeholders are stripped before this reaches the page. */
  const productLd = useMemo(() => ({
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    category: site.seo.productCategory,
    keywords: product.tags?.join(', '),
    description: product.description,
  }), [product]);

  useJsonLd('ld-product', productLd, PRODUCT_REQUIRED);

  return (
    <article className="shell section">
      <Marker label="Product" />
      <Link to="/#the-line" className="back-link">← The Line</Link>

      <h1 className="h-section" style={{ marginTop: '1.5rem' }}>
        <Value value={product.title} />
      </h1>

      <div style={{ marginTop: '2rem', display: 'grid', gap: 'clamp(2rem, 5vw, 3.5rem)' }}>
        {hasImages(product) ? (
          <img src={product.images[0].src} alt={product.images[0].alt ?? ''} />
        ) : (
          <div className="card__plate" style={{ maxWidth: '28rem' }} role="img" aria-label={site.labels.noImagery.join(' ')}>
            {site.labels.noImagery.map((line) => <span key={line}>{line}</span>)}
          </div>
        )}

        <div>
          <div className="prose">
            <Value value={product.description} block />
          </div>

          <dl className="fact-list" style={{ marginTop: '2rem' }}>
            <Row k="Price">
              <Value value={product.price} /> <span className="card__price">{product.currency}</span>
            </Row>
            <Row k="Availability">{product.available ? site.labels.available : site.labels.unavailable}</Row>
            <Row k="Sizes">
              {product.variants.map((v) => (
                <div key={v.sku}><Value value={v.title} /></div>
              ))}
            </Row>
            <Row k="Composition"><Draft>Unverified — Carl</Draft></Row>
            <Row k="Care"><Draft>Unverified — Carl</Draft></Row>
          </dl>
        </div>
      </div>

      <EnquirySection productHandle={product.handle} />
    </article>
  );
}

function Row({ k, children }) {
  return (
    <div className="fact">
      <dt className="fact__key">{k}</dt>
      <dd style={{ margin: 0 }}>{children}</dd>
    </div>
  );
}

function NotInCatalogue() {
  useDocumentHead({ title: 'Not found', description: '', path: '/' });
  return (
    <section className="shell doc">
      <h1 className="h-section">Not in the catalogue</h1>
      <p className="prose">That product handle does not appear in the catalogue.</p>
      <Link to="/" className="back-link">← Home</Link>
    </section>
  );
}
