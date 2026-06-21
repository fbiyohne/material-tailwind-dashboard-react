import type { Theme, ThemeTypography, TypeToken } from './contract';

/**
 * Scale a theme for the "10-foot" TV experience: larger type, more generous
 * spacing, and a stronger focus affordance. Same visual language, different
 * grammar (touch vs focus-at-distance) — driven entirely from tokens so screens
 * don't branch on platform.
 */
const TYPE_SCALE = 1.25;
const SPACE_SCALE = 1.4;

const scaleType = (t: TypeToken): TypeToken => ({
  ...t,
  fontSize: Math.round(t.fontSize * TYPE_SCALE),
});

export function scaleThemeForTV(theme: Theme): Theme {
  const typography = {
    display: scaleType(theme.typography.display),
    title: scaleType(theme.typography.title),
    heading: scaleType(theme.typography.heading),
    body: scaleType(theme.typography.body),
    caption: scaleType(theme.typography.caption),
    mono: scaleType(theme.typography.mono),
  } satisfies ThemeTypography;

  const s = (n: number) => Math.round(n * SPACE_SCALE);

  return {
    ...theme,
    space: {
      xs: s(theme.space.xs),
      sm: s(theme.space.sm),
      md: s(theme.space.md),
      lg: s(theme.space.lg),
      xl: s(theme.space.xl),
      xxl: s(theme.space.xxl),
    },
    typography,
    focus: {
      ...theme.focus,
      ringWidth: theme.focus.ringWidth + 1,
      scale: Math.max(theme.focus.scale, 1.08),
    },
  };
}
