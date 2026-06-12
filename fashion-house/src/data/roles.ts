import type { RoleData } from '../types/game';

export const ROLES: RoleData[] = [
  {
    role: 'Designer',
    description: 'A visionary creative who transforms ideas into iconic pieces.',
    ability: '+2 Creativity Points per Collection',
    abilityDetail: 'Your collections always gain +2 Prestige bonus at Fashion Week. Silk and Velvet fabrics cost you 2 less.',
    startingDollars: 30,
    startingPrestige: 5,
    icon: '✂',
    color: '#E8D5D0',
  },
  {
    role: 'Stylist',
    description: 'A master of aesthetics who brings visions to life through perfect curation.',
    ability: 'Trend Amplifier',
    abilityDetail: 'When a Trend Card matches your current Style, gain double the Prestige bonus. +500 Followers on every Fashion Shoot.',
    startingDollars: 25,
    startingPrestige: 8,
    icon: '◈',
    color: '#F7E7CE',
  },
  {
    role: 'Buyer',
    description: 'A sharp commercial mind who secures the most lucrative deals.',
    ability: 'Deal Closer',
    abilityDetail: 'Gain +10 Fashion Dollars on every Buyer Card. Boutiques earn 5 extra dollars per turn. Start with one Boutique.',
    startingDollars: 50,
    startingPrestige: 3,
    icon: '◎',
    color: '#F5F0E8',
  },
  {
    role: 'Entrepreneur',
    description: 'A bold visionary who builds empires from a single spark of ambition.',
    ability: 'Brand Builder',
    abilityDetail: 'Open Boutiques for 5 less Fashion Dollars. Celebrity Cards give you +2 extra Prestige. Start with extra Brand Prestige.',
    startingDollars: 35,
    startingPrestige: 10,
    icon: '♛',
    color: '#EDE8E0',
  },
];
