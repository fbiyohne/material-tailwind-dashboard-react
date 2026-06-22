import { fonts } from '../tokens/fonts';
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
    bg: '#0A0816',
    surface: '#211A3A',
    surfaceElevated: '#2F2552',
    border: '#3F3366',
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
    display: {
      fontFamily: fonts.nunitoExtraBold,
      fontSize: 31,
      fontWeight: 'normal',
      letterSpacing: -0.2,
    },
    title: {
      fontFamily: fonts.nunitoExtraBold,
      fontSize: 23,
      fontWeight: 'normal',
      letterSpacing: -0.1,
    },
    heading: {
      fontFamily: fonts.nunitoBold,
      fontSize: 18,
      fontWeight: 'normal',
    },
    body: { fontFamily: fonts.nunitoMedium, fontSize: 15, fontWeight: 'normal' },
    caption: {
      fontFamily: fonts.nunitoBold,
      fontSize: 12,
      fontWeight: 'normal',
      letterSpacing: 0.2,
    },
    mono: { fontFamily: fonts.jetMonoMedium, fontSize: 13, fontWeight: 'normal' },
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
