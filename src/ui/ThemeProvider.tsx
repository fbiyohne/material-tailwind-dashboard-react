import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useThemeStore } from '@/state/themeStore';
import { isTV } from '@/lib/tv';
import type { Theme } from './tokens/contract';
import { scaleThemeForTV } from './tokens/scaleTheme';
import { defaultTheme, themes } from './themes';

/**
 * Theme context. Provides the active Theme to the whole tree; switching is just
 * updating the theme store, which re-renders every consumer of useTheme(). On TV
 * the active theme is scaled up for distance viewing.
 */
const ThemeContext = createContext<Theme>(defaultTheme);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const themeName = useThemeStore((s) => s.themeName);
  const theme = useMemo(() => {
    const base = themes[themeName] ?? defaultTheme;
    return isTV ? scaleThemeForTV(base) : base;
  }, [themeName]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

/** Access the active theme. Components must style from this, never from literals. */
export function useTheme(): Theme {
  return useContext(ThemeContext);
}
