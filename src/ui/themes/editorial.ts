import { fontFamilies } from '../tokens/fonts';
import type { Theme } from '../tokens/contract';

/**
 * A — Éditorial / Cinémathèque.
 * Calm, premium, magazine-like. Serif display + Inter, warm paper-black + amber,
 * refined small radii, slow confident motion, gentle focus lift.
 */
export const editorialTheme: Theme = {
  name: 'editorial',
  label: 'Éditorial',
  colors: {
    bg: '#0E0D0B',
    surface: '#17150F',
    surfaceElevated: '#211E16',
    border: '#332E22',
    text: '#F4EFE6',
    textMuted: '#B3A892',
    accent: '#E0A536',
    accentMuted: '#8A6620',
    danger: '#D5604A',
    success: '#6FAE6A',
    focus: '#F0C25A',
    live: '#E0A536',
    movies: '#C98A4B',
    series: '#B7894F',
  },
  space: { xs: 4, sm: 8, md: 14, lg: 20, xl: 28, xxl: 40 },
  radius: { sm: 4, md: 8, lg: 14, pill: 999 },
  typography: {
    display: { fontFamily: fontFamilies.serif, fontSize: 34, fontWeight: '700' },
    title: { fontFamily: fontFamilies.serif, fontSize: 26, fontWeight: '700' },
    heading: { fontFamily: fontFamilies.sans, fontSize: 19, fontWeight: '600' },
    body: { fontFamily: fontFamilies.sans, fontSize: 15, fontWeight: '400' },
    caption: {
      fontFamily: fontFamilies.sans,
      fontSize: 12,
      fontWeight: '400',
      letterSpacing: 0.3,
    },
    mono: { fontFamily: fontFamilies.mono, fontSize: 13, fontWeight: '400' },
  },
  shadow: {
    card: {
      shadowColor: '#000',
      shadowOpacity: 0.35,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 6,
    },
    focus: {
      shadowColor: '#F0C25A',
      shadowOpacity: 0.4,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 0 },
      elevation: 8,
    },
  },
  motion: { durationFast: 160, durationBase: 280, springy: false },
  focus: { ringWidth: 2, ringColor: '#F0C25A', scale: 1.04 },
};
