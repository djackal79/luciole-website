import Hero from '../sections/Hero.jsx';
import TheLine from '../sections/TheLine.jsx';
import Provenance from '../sections/Provenance.jsx';
import About from '../sections/About.jsx';
import EnquirySection from '../sections/Enquiry.jsx';
import { useDocumentHead, useJsonLd, SITE_ORIGIN } from '../lib/seo.js';
import site from '../data/site.json';

/* site.labelName is a placeholder, so stripUnconfirmed() drops `name` — and with
   it the whole Organization block, since an Organization without a name is not
   worth publishing. That is the intended behaviour: no guessed trading name
   reaches structured data. It starts emitting the moment the name is confirmed. */
const ORGANIZATION = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: site.labelName,
  url: SITE_ORIGIN,
  address: {
    '@type': 'PostalAddress',
    addressCountry: site.seo.addressCountry,
  },
};

/* Module-level so the identity is stable across renders. */
const ORGANIZATION_REQUIRED = ['name'];

export default function Home() {
  useDocumentHead({
    title: site.line,
    description: site.seo.description,
    path: '/',
  });
  useJsonLd('ld-organization', ORGANIZATION, ORGANIZATION_REQUIRED);

  return (
    <>
      <Hero />
      <TheLine />
      <Provenance />
      <About />
      <EnquirySection />
    </>
  );
}
