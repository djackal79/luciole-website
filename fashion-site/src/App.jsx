import { Routes, Route } from 'react-router-dom';
import Masthead from './components/Masthead.jsx';
import Footer from './components/Footer.jsx';
import Home from './pages/Home.jsx';
import Product from './pages/Product.jsx';
import Privacy from './pages/Privacy.jsx';
import Returns from './pages/Returns.jsx';
import NotFound from './pages/NotFound.jsx';

export default function App() {
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <Masthead />
      <main id="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/product/:handle" element={<Product />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/returns" element={<Returns />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </>
  );
}
