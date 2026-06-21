import { fontFamilies } from '../tokens/fonts';
import type { Theme } from '../tokens/contract';

/**
 * C — Soft Depth / Tactile.
 * Thumb-first, fluid. Indigo→violet base with a strong per-kind hue system
 * (live=cyan, films=magenta, séries=lime), large radii, spring motion, glow focus.
 */
export const softDepthTheme: Theme = {
  name: 'softDepth',
  label: 'Soft Depth',
  colors: {
    bg: '#0E0B1A',
    surface: '#1B1530',
    surfaceElevated: '#271E45',
    border: '#352B57',
    text: '#F2EEFF',
    textMuted: '#A99FC8',
    accent: '#7C5CFF',
    accentMuted: '#4A38A8',
    danger: '#FF6B8A',
    success: '#57E08F',
    focus: '#9D8CFF',
    live: '#2FD9E6',
    movies: '#FF5CC8',
    series: '#B6E05A',
  },
  space: { xs: 4, sm: 10, md: 16, lg: 22, xl: 30, xxl: 44 },
  radius: { sm: 10, md: 16, lg: 24, pill: 999 },
  typography: {
    display: { fontFamily: fontFamilies.sans, fontSize: 30, fontWeight: '800' },
    title: { fontFamily: fontFamilies.sans, fontSize: 23, fontWeight: '700' },
    heading: { fontFamily: fontFamilies.sans, fontSize: 18, fontWeight: '700' },
    body: { fontFamily: fontFamilies.sans, fontSize: 15, fontWeight: '500' },
    caption: { fontFamily: fontFamilies.sans, fontSize: 12, fontWeight: '500' },
    mono: { fontFamily: fontFamilies.mono, fontSize: 13, fontWeight: '500' },
  },
  shadow: {
    card: {
      shadowColor: '#000',
      shadowOpacity: 0.4,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 12 },
      elevation: 8,
    },
    focus: {
      shadowColor: '#9D8CFF',
      shadowOpacity: 0.55,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 0 },
      elevation: 12,
    },
  },
  motion: { durationFast: 140, durationBase: 320, springy: true },
  focus: { ringWidth: 2, ringColor: '#9D8CFF', scale: 1.06 },
};
