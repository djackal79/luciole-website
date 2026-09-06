/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        sim: {
          bg: '#07090e',
          card: '#0c0f18',
          cardBorder: '#1c2233',
          cardBorderHover: '#2a344d',
          accentGreen: '#00f298',
          accentCyan: '#00d2ff',
          accentAmber: '#ffaa00',
          accentRose: '#ff3366',
          muted: '#808b9e',
        }
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['Outfit', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', '"Liberation Mono"', '"Courier New"', 'monospace'],
      },
    },
  },
  plugins: [],
}
