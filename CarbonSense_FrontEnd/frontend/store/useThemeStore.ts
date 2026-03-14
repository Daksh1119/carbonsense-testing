import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

type Theme = 'light' | 'dark' | 'system';

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

/**
 * Theme Store
 * Manages application theme state
 * Will be expanded in Phase 5 with next-themes integration
 */
export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'dark',

      setTheme: (theme) =>
        set({
          theme,
        }),
    }),
    {
      name: 'carbonsense-theme-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
