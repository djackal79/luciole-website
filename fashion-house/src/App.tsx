import { AnimatePresence, motion } from 'framer-motion';
import { useGameStore } from './store/gameStore';
import LandingScreen from './components/LandingScreen';
import SetupScreen from './components/SetupScreen';
import GameBoard from './components/GameBoard';
import CardDrawScreen from './components/CardDrawScreen';
import CollectionBuilder from './components/CollectionBuilder';
import FashionWeekScreen from './components/FashionWeekScreen';
import BrandDashboard from './components/BrandDashboard';
import GalleryScreen from './components/GalleryScreen';
import InstructionsScreen from './components/InstructionsScreen';

const pageTransition = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.35 },
};

export default function App() {
  const { screen } = useGameStore();

  return (
    <AnimatePresence mode="wait">
      <motion.div key={screen} {...pageTransition} className="min-h-screen">
        {screen === 'landing' && <LandingScreen />}
        {screen === 'setup' && <SetupScreen />}
        {screen === 'board' && <GameBoard />}
        {screen === 'card-draw' && <CardDrawScreen />}
        {screen === 'collection-builder' && <CollectionBuilder />}
        {screen === 'fashion-week' && <FashionWeekScreen />}
        {screen === 'brand-dashboard' && <BrandDashboard />}
        {screen === 'gallery' && <GalleryScreen />}
        {screen === 'instructions' && <InstructionsScreen />}
      </motion.div>
    </AnimatePresence>
  );
}
