/**
 * Bundled brand fonts (loaded once at app start via `@expo-google-fonts/*`).
 *
 * Each value is the exact font-family name registered by expo-font for a single
 * weight (the weight is baked into the file, so type tokens set `fontWeight:
 * 'normal'` and let the family carry the weight — avoids synthetic bolding).
 *
 * Themes reference these keys, so swapping a brand font is a one-line change here.
 * The matching weights are loaded in `src/app/_layout.tsx`.
 */
export const fonts = {
  // Inter — clean grotesque UI sans (body/labels across themes)
  interRegular: 'Inter_400Regular',
  interMedium: 'Inter_500Medium',
  interSemiBold: 'Inter_600SemiBold',
  interBold: 'Inter_700Bold',

  // Fraunces — refined optical serif display (Éditorial headings)
  frauncesSemiBold: 'Fraunces_600SemiBold',
  frauncesBold: 'Fraunces_700Bold',

  // Space Grotesk — technical geometric sans (Control Room headings)
  spaceGroteskMedium: 'SpaceGrotesk_500Medium',
  spaceGroteskBold: 'SpaceGrotesk_700Bold',

  // JetBrains Mono — monospaced numerics (Control Room + mono token)
  jetMonoMedium: 'JetBrainsMono_500Medium',
  jetMonoSemiBold: 'JetBrainsMono_600SemiBold',

  // Nunito — rounded, friendly sans (Soft Depth)
  nunitoMedium: 'Nunito_500Medium',
  nunitoBold: 'Nunito_700Bold',
  nunitoExtraBold: 'Nunito_800ExtraBold',
} as const;
