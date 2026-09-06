import { create } from 'zustand';

export type AppTheme = 'cyber' | 'boutique';

const STORAGE_THEME_KEY = 'golf_studio_theme';

function getInitialTheme(): AppTheme {
  try {
    const saved = localStorage.getItem(STORAGE_THEME_KEY);
    if (saved === 'boutique' || saved === 'cyber') {
      return saved;
    }
  } catch {
    // fallback
  }
  return 'cyber';
}

interface ThemeState {
  currentTheme: AppTheme;
  setTheme: (theme: AppTheme) => void;
  toggleTheme: () => void;
  getMotionDuration: (baseMs: number) => number;
}

export const useThemeStore = create<ThemeState>((set, get) => {
  const initial = getInitialTheme();
  
  // Set initial attribute on document
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', initial);
  }

  return {
    currentTheme: initial,
    setTheme: (theme: AppTheme) => {
      try {
        localStorage.setItem(STORAGE_THEME_KEY, theme);
      } catch {
        // Ignore storage errors
      }
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-theme', theme);
      }
      set({ currentTheme: theme });
    },
    toggleTheme: () => {
      const next = get().currentTheme === 'cyber' ? 'boutique' : 'cyber';
      get().setTheme(next);
    },
    getMotionDuration: (baseMs: number) => {
      const multiplier = get().currentTheme === 'boutique' ? 3.33 : 1.0;
      return Math.round(baseMs * multiplier);
    }
  };
});
