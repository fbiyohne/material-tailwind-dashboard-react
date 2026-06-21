import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { createMMKV, type MMKV } from 'react-native-mmkv';

/**
 * Encrypted local storage for secrets (provider credentials) and settings.
 *
 * MMKV encrypts its file with an AES key, but that key must itself be protected:
 * we generate it once and store it in the device Keychain (iOS) / Keystore
 * (Android) via expo-secure-store. Credentials therefore never touch disk in
 * clear text and never leave the device except to the user's own provider.
 */

const KEY_ALIAS = 'creatic.mmkv.key';

let credentialsStore: MMKV | null = null;
let settingsStore: MMKV | null = null;

async function getOrCreateEncryptionKey(): Promise<string> {
  const existing = await SecureStore.getItemAsync(KEY_ALIAS);
  if (existing) return existing;
  // 16 random bytes → 32 hex chars → a 32-byte key string for AES-256.
  const bytes = await Crypto.getRandomBytesAsync(16);
  const key = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  await SecureStore.setItemAsync(KEY_ALIAS, key, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  return key;
}

/** Must be awaited once at app start before any store getter is used. */
export async function initSecureStores(): Promise<void> {
  if (credentialsStore && settingsStore) return;
  const encryptionKey = await getOrCreateEncryptionKey();
  credentialsStore = createMMKV({
    id: 'creatic-credentials',
    encryptionKey,
    encryptionType: 'AES-256',
  });
  settingsStore = createMMKV({
    id: 'creatic-settings',
    encryptionKey,
    encryptionType: 'AES-256',
  });
}

function requireStore(store: MMKV | null): MMKV {
  if (!store) {
    throw new Error('Secure stores not initialized — call initSecureStores() first');
  }
  return store;
}

export function getCredentialsStore(): MMKV {
  return requireStore(credentialsStore);
}

export function getSettingsStore(): MMKV {
  return requireStore(settingsStore);
}
