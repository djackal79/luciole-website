import { Draft } from '../components/Draft.jsx';
import { Marker } from './TheLine.jsx';

export default function About() {
  return (
    <section className="shell section" id="about" aria-labelledby="about-title">
      <Marker label="03 / About" />
      <h2 className="h-section" id="about-title">About the Label</h2>

      <div style={{ marginTop: '1.25rem', display: 'grid', gap: '1rem' }}>
        <Draft block>Opening paragraph — who the label is</Draft>
        <Draft block>Second paragraph — what the Nocturnal Series is and why the moth</Draft>
        <Draft block>Closing line</Draft>
      </div>
    </section>
  );
}
