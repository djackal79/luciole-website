import ProductCard from '../components/ProductCard.jsx';
import { Draft } from '../components/Draft.jsx';
import catalogue from '../data/products.json';

export default function TheLine() {
  return (
    <section className="shell section" id="the-line" aria-labelledby="the-line-title">
      <Marker label="01 / The Line" />
      <h2 className="h-section" id="the-line-title">The Line</h2>
      <div className="prose" style={{ marginTop: '1rem' }}>
        <Draft block>Section intro for The Line</Draft>
      </div>

      <div className="line-grid" style={{ marginTop: 'clamp(2rem, 5vw, 3rem)' }}>
        {catalogue.products.map((product) => (
          <ProductCard key={product.handle} product={product} />
        ))}
      </div>
    </section>
  );
}

export function Marker({ label }) {
  return (
    <div className="marker">
      <div className="marker__tail" aria-hidden="true" />
      <p className="marker__label">{label}</p>
    </div>
  );
}
