import type { Theme, ThemeName } from '../tokens/contract';
import { controlRoomTheme } from './controlRoom';
import { editorialTheme } from './editorial';
import { softDepthTheme } from './softDepth';

/** Registry of all selectable themes, keyed by name. */
export const themes: Record<ThemeName, Theme> = {
  editorial: editorialTheme,
  controlRoom: controlRoomTheme,
  softDepth: softDepthTheme,
};

/** Fallback used before the stored preference is hydrated. */
export const defaultTheme: Theme = editorialTheme;

export function isThemeName(value: string | null | undefined): value is ThemeName {
  return value === 'editorial' || value === 'controlRoom' || value === 'softDepth';
}

export { editorialTheme, controlRoomTheme, softDepthTheme };
