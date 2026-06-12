/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#F5F0E8',
        champagne: '#F7E7CE',
        blush: '#E8D5D0',
        gold: '#C9A84C',
        'gold-light': '#E8C96A',
        'gold-dark': '#9A7A2E',
        obsidian: '#0A0A0A',
        charcoal: '#1C1C1C',
        mink: '#6B5B4E',
        pearl: '#FAF8F5',
      },
      fontFamily: {
        serif: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        sans: ['"Jost"', 'system-ui', 'sans-serif'],
        display: ['"Playfair Display"', 'Georgia', 'serif'],
      },
      backgroundImage: {
        'gold-gradient': 'linear-gradient(135deg, #C9A84C 0%, #E8C96A 50%, #9A7A2E 100%)',
        'cream-gradient': 'linear-gradient(180deg, #FAF8F5 0%, #F5F0E8 100%)',
        'dark-gradient': 'linear-gradient(180deg, #0A0A0A 0%, #1C1C1C 100%)',
      },
      boxShadow: {
        'gold': '0 0 30px rgba(201,168,76,0.3)',
        'luxury': '0 20px 60px rgba(0,0,0,0.15)',
        'card': '0 8px 32px rgba(0,0,0,0.12)',
      },
      animation: {
        'shimmer': 'shimmer 2s linear infinite',
        'float': 'float 3s ease-in-out infinite',
        'dice-spin': 'diceSpin 0.6s ease-out',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition: '200% center' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        diceSpin: {
          '0%': { transform: 'rotateX(0deg) rotateY(0deg)' },
          '50%': { transform: 'rotateX(180deg) rotateY(180deg)' },
          '100%': { transform: 'rotateX(360deg) rotateY(360deg)' },
        },
      },
    },
  },
  plugins: [],
}
