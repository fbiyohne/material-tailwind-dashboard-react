import type { ProviderConfig } from '@/domain/provider-config';
import { getCredentialsStore } from './secureStorage';

/** Encrypted CRUD for provider credentials, keyed by profile id. */

const key = (profileId: string) => `cred:${profileId}`;

export function saveCredentials(profileId: string, config: ProviderConfig): void {
  getCredentialsStore().set(key(profileId), JSON.stringify(config));
}

export function loadCredentials(profileId: string): ProviderConfig | null {
  const raw = getCredentialsStore().getString(key(profileId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ProviderConfig;
  } catch {
    return null;
  }
}

export function deleteCredentials(profileId: string): void {
  getCredentialsStore().remove(key(profileId));
}
