import { Platform } from 'react-native';

/**
 * Platform-safe font families.
 *
 * These map to system fonts so the themes work today with zero bundled assets.
 * Bundling brand fonts later (e.g. a real serif display for Editorial, SF Pro
 * Rounded for Soft Depth) is a one-line swap here — themes reference these keys.
 */
export const fontFamilies = {
  sans: undefined, // system default UI font
  serif: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
  mono: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
} as const;
