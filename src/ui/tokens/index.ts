/**
 * Design tokens — single source of truth for the visual language.
 *
 * ⚠️ PLACEHOLDER PALETTE. This is a neutral dark base so nothing is hardcoded in
 * components while the socle is built. The real, distinctive direction is chosen
 * deliberately (see brief §8): 2–3 conceptual directions will be presented and
 * one selected before any production UI is styled. When that happens, only this
 * file changes — components must consume tokens, never literals.
 */

export const colors = {
  bg: '#0B0B12',
  surface: '#15151F',
  surfaceElevated: '#1E1E2B',
  border: '#2A2A3A',
  text: '#F5F5FA',
  textMuted: '#9A9AB0',
  accent: '#6C5CE7',
  accentMuted: '#4A3FB0',
  danger: '#E45858',
  success: '#3BC97E',
  /** Focus ring — critical for TV/D-pad. */
  focus: '#9D8CFF',
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  pill: 999,
} as const;

export const typography = {
  title: { fontSize: 28, fontWeight: '700' },
  heading: { fontSize: 20, fontWeight: '600' },
  body: { fontSize: 15, fontWeight: '400' },
  caption: { fontSize: 12, fontWeight: '400' },
} as const;

export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
} as const;

export const tokens = { colors, space, radius, typography, shadow } as const;
export type Tokens = typeof tokens;
