import { getSettingsStore } from './secureStorage';

/**
 * App settings (encrypted, since the parental PIN hash lives here too).
 * Plain typed accessors over MMKV — no secrets beyond the PIN hash.
 */

const KEYS = {
  activeProfileId: 'settings:activeProfileId',
  locale: 'settings:locale',
  themeName: 'settings:themeName',
  parentalPinHash: 'settings:parentalPinHash',
  tmdbApiKey: 'settings:tmdbApiKey',
  hasAcceptedDisclaimer: 'settings:hasAcceptedDisclaimer',
} as const;

export function getActiveProfileId(): string | null {
  return getSettingsStore().getString(KEYS.activeProfileId) ?? null;
}

export function setActiveProfileId(profileId: string | null): void {
  const store = getSettingsStore();
  if (profileId == null) store.remove(KEYS.activeProfileId);
  else store.set(KEYS.activeProfileId, profileId);
}

export function getLocale(): string | null {
  return getSettingsStore().getString(KEYS.locale) ?? null;
}

export function setLocale(locale: string): void {
  getSettingsStore().set(KEYS.locale, locale);
}

export function getThemeName(): string | null {
  return getSettingsStore().getString(KEYS.themeName) ?? null;
}

export function setThemeName(name: string): void {
  getSettingsStore().set(KEYS.themeName, name);
}

export function getTmdbApiKey(): string | null {
  return getSettingsStore().getString(KEYS.tmdbApiKey) ?? null;
}

export function setTmdbApiKey(key: string | null): void {
  const store = getSettingsStore();
  if (key == null || key.length === 0) store.remove(KEYS.tmdbApiKey);
  else store.set(KEYS.tmdbApiKey, key);
}

export function getParentalPinHash(): string | null {
  return getSettingsStore().getString(KEYS.parentalPinHash) ?? null;
}

export function setParentalPinHash(hash: string | null): void {
  const store = getSettingsStore();
  if (hash == null) store.remove(KEYS.parentalPinHash);
  else store.set(KEYS.parentalPinHash, hash);
}

export function hasAcceptedDisclaimer(): boolean {
  return getSettingsStore().getBoolean(KEYS.hasAcceptedDisclaimer) ?? false;
}

export function setAcceptedDisclaimer(accepted: boolean): void {
  getSettingsStore().set(KEYS.hasAcceptedDisclaimer, accepted);
}
