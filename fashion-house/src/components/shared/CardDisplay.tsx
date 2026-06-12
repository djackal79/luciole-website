import { motion } from 'framer-motion';
import type { GameCard } from '../../types/game';

const deckColors: Record<string, { bg: string; border: string; label: string }> = {
  Inspiration: { bg: 'from-blush to-cream', border: 'border-blush', label: 'INSPIRATION' },
  Fabric: { bg: 'from-champagne to-cream', border: 'border-champagne', label: 'FABRIC' },
  Trend: { bg: 'from-gold/20 to-cream', border: 'border-gold/40', label: 'TREND' },
  Event: { bg: 'from-mink/10 to-cream', border: 'border-mink/30', label: 'EVENT' },
  Celebrity: { bg: 'from-gold/30 to-champagne', border: 'border-gold', label: 'CELEBRITY' },
  Buyer: { bg: 'from-cream to-pearl', border: 'border-mink/20', label: 'BUYER' },
};

interface CardDisplayProps {
  card: GameCard;
  size?: 'sm' | 'md' | 'lg';
  animate?: boolean;
}

export default function CardDisplay({ card, size = 'md', animate = true }: CardDisplayProps) {
  const theme = deckColors[card.deck] ?? deckColors.Inspiration;
  const sizes = {
    sm: 'w-32 h-48',
    md: 'w-48 h-72',
    lg: 'w-64 h-96',
  };

  const Wrapper = animate ? motion.div : 'div';
  const wrapperProps = animate
    ? {
        initial: { rotateY: -90, opacity: 0 },
        animate: { rotateY: 0, opacity: 1 },
        transition: { type: 'spring', stiffness: 200, damping: 20 },
      }
    : {};

  return (
    <Wrapper
      {...(wrapperProps as any)}
      className={`${sizes[size]} bg-gradient-to-b ${theme.bg} border ${theme.border} flex flex-col p-4 shadow-card relative overflow-hidden`}
    >
      {/* Corner monogram */}
      <div className="absolute top-2 left-2 text-gold/30 font-serif text-xs tracking-widest">FH</div>
      <div className="absolute top-2 right-2 text-gold/30 font-serif text-xs tracking-widest">™</div>

      {/* Deck label */}
      <div className="text-center mb-2">
        <span className="section-label text-[9px]">{theme.label}</span>
      </div>

      {/* Gold divider */}
      <div className="h-px bg-gold/40 mb-3" />

      {/* Icon */}
      <div className="text-center text-3xl my-2">{card.icon}</div>

      {/* Title */}
      <h3 className={`font-display text-obsidian text-center leading-tight mb-1 ${size === 'sm' ? 'text-xs' : 'text-sm'}`}>
        {card.title}
      </h3>

      <p className={`text-mink text-center font-sans italic ${size === 'sm' ? 'text-[9px]' : 'text-[10px]'}`}>
        {card.description}
      </p>

      {/* Gold divider */}
      <div className="h-px bg-gold/40 my-2" />

      {/* Effect */}
      <p className={`text-charcoal text-center font-sans leading-tight mt-auto ${size === 'sm' ? 'text-[8px]' : 'text-[10px]'}`}>
        {card.effect}
      </p>

      {/* Value badge */}
      {card.value > 0 && (
        <div className="absolute bottom-3 right-3 w-5 h-5 bg-gold rounded-full flex items-center justify-center">
          <span className="text-[8px] font-bold text-obsidian">{card.value}</span>
        </div>
      )}
    </Wrapper>
  );
}
