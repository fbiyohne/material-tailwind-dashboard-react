import { createContext, useContext, type ReactNode } from 'react';
import { useThemeStore } from '@/state/themeStore';
import type { Theme } from './tokens/contract';
import { defaultTheme, themes } from './themes';

/**
 * Theme context. Provides the active Theme to the whole tree; switching is just
 * updating the theme store, which re-renders every consumer of useTheme().
 */
const ThemeContext = createContext<Theme>(defaultTheme);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const themeName = useThemeStore((s) => s.themeName);
  const theme = themes[themeName] ?? defaultTheme;
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

/** Access the active theme. Components must style from this, never from literals. */
export function useTheme(): Theme {
  return useContext(ThemeContext);
}
