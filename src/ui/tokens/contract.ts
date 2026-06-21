import type { TextStyle, ViewStyle } from 'react-native';

/**
 * The Theme contract — the shape every theme must fill.
 *
 * Components consume a `Theme` via `useTheme()` and NEVER reference literals.
 * Switching themes therefore re-skins the whole app: color, type, shape,
 * elevation, motion and (critically for TV) focus treatment all come from here.
 */

export type ThemeName = 'editorial' | 'controlRoom' | 'softDepth';

export const THEME_NAMES: readonly ThemeName[] = [
  'editorial',
  'controlRoom',
  'softDepth',
];

export interface ThemeColors {
  bg: string;
  surface: string;
  surfaceElevated: string;
  border: string;
  text: string;
  textMuted: string;
  accent: string;
  accentMuted: string;
  danger: string;
  success: string;
  /** Focus ring color — drives the TV/D-pad focus state. */
  focus: string;
  /** Per-content-kind hues (a strong system in Soft Depth, subtle elsewhere). */
  live: string;
  movies: string;
  series: string;
}

export interface TypeToken {
  fontFamily?: string;
  fontSize: number;
  fontWeight: TextStyle['fontWeight'];
  letterSpacing?: number;
}

export interface ThemeTypography {
  display: TypeToken;
  title: TypeToken;
  heading: TypeToken;
  body: TypeToken;
  caption: TypeToken;
  mono: TypeToken;
}

export interface ThemeSpace {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  xxl: number;
}

export interface ThemeRadius {
  sm: number;
  md: number;
  lg: number;
  pill: number;
}

export interface ThemeShadows {
  card: ViewStyle;
  focus: ViewStyle;
}

export interface ThemeMotion {
  durationFast: number;
  durationBase: number;
  /** Whether transitions should use spring physics vs timed easing. */
  springy: boolean;
}

export interface ThemeFocus {
  ringWidth: number;
  ringColor: string;
  /** Scale applied to a focused element (TV-at-distance affordance). */
  scale: number;
}

export interface Theme {
  name: ThemeName;
  label: string;
  colors: ThemeColors;
  space: ThemeSpace;
  radius: ThemeRadius;
  typography: ThemeTypography;
  shadow: ThemeShadows;
  motion: ThemeMotion;
  focus: ThemeFocus;
}
