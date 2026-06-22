import { fonts } from '../tokens/fonts';
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
    bg: '#0C0B09',
    surface: '#1C1913',
    surfaceElevated: '#28241A',
    border: '#3D3729',
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
    display: {
      fontFamily: fonts.frauncesBold,
      fontSize: 36,
      fontWeight: 'normal',
      letterSpacing: -0.5,
    },
    title: {
      fontFamily: fonts.frauncesSemiBold,
      fontSize: 26,
      fontWeight: 'normal',
      letterSpacing: -0.3,
    },
    heading: {
      fontFamily: fonts.interSemiBold,
      fontSize: 18,
      fontWeight: 'normal',
      letterSpacing: -0.1,
    },
    body: { fontFamily: fonts.interRegular, fontSize: 15, fontWeight: 'normal' },
    caption: {
      fontFamily: fonts.interMedium,
      fontSize: 12,
      fontWeight: 'normal',
      letterSpacing: 0.4,
    },
    mono: { fontFamily: fonts.jetMonoMedium, fontSize: 13, fontWeight: 'normal' },
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
