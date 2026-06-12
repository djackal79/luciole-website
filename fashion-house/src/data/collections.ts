import type { Silhouette, Fabric, Style } from '../types/game';

export const SILHOUETTES: Silhouette[] = [
  { id: 's1', name: 'Slip Dress', icon: '👗', creativityBonus: 2 },
  { id: 's2', name: 'Evening Gown', icon: '✨', creativityBonus: 5 },
  { id: 's3', name: 'Tailored Suit', icon: '🧥', creativityBonus: 3 },
  { id: 's4', name: 'Resort Dress', icon: '🌴', creativityBonus: 2 },
  { id: 's5', name: 'Statement Piece', icon: '💎', creativityBonus: 4 },
];

export const FABRICS: Fabric[] = [
  { id: 'f1', name: 'Silk Satin', icon: '✦', qualityRating: 5, cost: 15 },
  { id: 'f2', name: 'Lace', icon: '🕸', qualityRating: 4, cost: 12 },
  { id: 'f3', name: 'Crepe', icon: '〰', qualityRating: 3, cost: 8 },
  { id: 'f4', name: 'Linen', icon: '🌾', qualityRating: 2, cost: 5 },
  { id: 'f5', name: 'Velvet', icon: '◉', qualityRating: 4, cost: 12 },
  { id: 'f6', name: 'Organza', icon: '○', qualityRating: 3, cost: 10 },
];

export const STYLES: Style[] = [
  { id: 'st1', name: 'Parisian Chic', icon: '🗼', trendBonus: 3 },
  { id: 'st2', name: 'Coastal Luxe', icon: '🌊', trendBonus: 2 },
  { id: 'st3', name: 'Quiet Luxury', icon: '○', trendBonus: 4 },
  { id: 'st4', name: 'Modern Romance', icon: '🌸', trendBonus: 2 },
  { id: 'st5', name: 'Studio 54 Glamour', icon: '🪩', trendBonus: 3 },
];

export function scoreCollection(
  silhouette: Silhouette,
  fabric: Fabric,
  style: Style
): number {
  const base = silhouette.creativityBonus + fabric.qualityRating + style.trendBonus;
  const synergy =
    (silhouette.name === 'Evening Gown' && fabric.name === 'Silk Satin') ||
    (silhouette.name === 'Resort Dress' && style.name === 'Coastal Luxe') ||
    (silhouette.name === 'Tailored Suit' && style.name === 'Quiet Luxury') ||
    (silhouette.name === 'Statement Piece' && style.name === 'Studio 54 Glamour')
      ? 3
      : 0;
  return base + synergy;
}
