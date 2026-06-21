import { fontFamilies } from '../tokens/fonts';
import type { Theme } from '../tokens/contract';

/**
 * B — Control Room / HUD.
 * Broadcast-tech. Slate/teal with electric-mint accent, mono numerics, sharp
 * radii, fast mechanical motion, bright room-readable focus ring.
 */
export const controlRoomTheme: Theme = {
  name: 'controlRoom',
  label: 'Control Room',
  colors: {
    bg: '#0B1014',
    surface: '#0E1A20',
    surfaceElevated: '#12252E',
    border: '#1C3A44',
    text: '#E6F1F2',
    textMuted: '#7FA0A6',
    accent: '#2EE6C5',
    accentMuted: '#15806E',
    danger: '#FF5C7A',
    success: '#2EE6C5',
    focus: '#2EE6C5',
    live: '#2EE6C5',
    movies: '#4DA3FF',
    series: '#C58CFF',
  },
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
  radius: { sm: 3, md: 6, lg: 10, pill: 4 },
  typography: {
    display: { fontFamily: fontFamilies.sans, fontSize: 30, fontWeight: '800' },
    title: { fontFamily: fontFamilies.sans, fontSize: 22, fontWeight: '700' },
    heading: { fontFamily: fontFamilies.sans, fontSize: 18, fontWeight: '600' },
    body: { fontFamily: fontFamilies.sans, fontSize: 14, fontWeight: '400' },
    caption: {
      fontFamily: fontFamilies.mono,
      fontSize: 11,
      fontWeight: '500',
      letterSpacing: 0.5,
    },
    mono: { fontFamily: fontFamilies.mono, fontSize: 13, fontWeight: '600' },
  },
  shadow: {
    card: {
      shadowColor: '#000',
      shadowOpacity: 0.45,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },
    focus: {
      shadowColor: '#2EE6C5',
      shadowOpacity: 0.6,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 0 },
      elevation: 10,
    },
  },
  motion: { durationFast: 110, durationBase: 200, springy: false },
  focus: { ringWidth: 2.5, ringColor: '#2EE6C5', scale: 1.02 },
};
