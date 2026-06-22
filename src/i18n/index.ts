import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocale } from '@/data/kv/settings';
import { en } from './locales/en';
import { fr } from './locales/fr';

/** i18n bootstrap. FR + EN from day one; defaults to the device language. */

function resolveLanguage(): string {
  // getLocale() reads the encrypted store; guard in case i18n inits first.
  try {
    const stored = getLocale();
    if (stored) return stored;
  } catch {
    // stores not ready yet — fall back to device language
  }
  const device = getLocales()[0]?.languageCode ?? 'en';
  return device === 'fr' ? 'fr' : 'en';
}

let initialized = false;

export function initI18n(): typeof i18n {
  if (initialized) return i18n;
  // eslint-disable-next-line import/no-named-as-default-member
  void i18n.use(initReactI18next).init({
    resources: {
      en: { translation: en },
      fr: { translation: fr },
    },
    lng: resolveLanguage(),
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    returnNull: false,
  });
  initialized = true;
  return i18n;
}

export default i18n;
