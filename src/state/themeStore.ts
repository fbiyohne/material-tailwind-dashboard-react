import { create } from 'zustand';
import { getThemeName, setThemeName } from '@/data/kv/settings';
import type { ThemeName } from '@/ui/tokens/contract';
import { isThemeName } from '@/ui/themes';

/**
 * Active theme selection, persisted to the (encrypted) settings store.
 * `hydrate()` runs once after secure stores are ready; `setTheme()` persists.
 */
interface ThemeState {
  themeName: ThemeName;
  hydrate: () => void;
  setTheme: (name: ThemeName) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  themeName: 'editorial',
  hydrate: () => {
    try {
      const stored = getThemeName();
      if (isThemeName(stored)) set({ themeName: stored });
    } catch {
      // settings not ready — keep default
    }
  },
  setTheme: (name) => {
    setThemeName(name);
    set({ themeName: name });
  },
}));
