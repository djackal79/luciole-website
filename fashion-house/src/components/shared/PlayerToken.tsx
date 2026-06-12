import { motion } from 'framer-motion';
import type { Player } from '../../types/game';

const roleIcons: Record<string, string> = {
  Designer: '✂',
  Stylist: '◈',
  Buyer: '◎',
  Entrepreneur: '♛',
};

interface PlayerTokenProps {
  player: Player;
  size?: 'sm' | 'md' | 'lg';
  showName?: boolean;
  isActive?: boolean;
}

export default function PlayerToken({ player, size = 'md', showName = false, isActive = false }: PlayerTokenProps) {
  const sizes = { sm: 'w-6 h-6 text-xs', md: 'w-10 h-10 text-base', lg: 'w-14 h-14 text-xl' };

  return (
    <motion.div
      className="flex flex-col items-center gap-1"
      animate={isActive ? { scale: [1, 1.1, 1] } : {}}
      transition={{ repeat: Infinity, duration: 2 }}
    >
      <div
        className={`${sizes[size]} rounded-full flex items-center justify-center border-2 font-serif shadow-md`}
        style={{ backgroundColor: player.color, borderColor: isActive ? '#C9A84C' : 'transparent' }}
      >
        <span>{roleIcons[player.role]}</span>
      </div>
      {showName && (
        <span className="text-[9px] font-sans tracking-widest uppercase text-mink truncate max-w-[60px] text-center">
          {player.name}
        </span>
      )}
    </motion.div>
  );
}
