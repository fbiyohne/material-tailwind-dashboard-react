import { create } from 'zustand';
import { getParentalPinHash, setParentalPinHash } from '@/data/kv/settings';
import { hashPin } from '@/lib/pin';

/**
 * Parental control state.
 *
 * `hasPin` reflects whether a PIN is configured; `unlocked` is session-scoped —
 * it grants access to locked categories and adult content until the app is
 * relaunched (it resets to false on every cold start, never persisted).
 */
interface ParentalState {
  hasPin: boolean;
  unlocked: boolean;
  hydrate: () => void;
  setPin: (pin: string) => Promise<void>;
  removePin: () => void;
  verify: (pin: string) => Promise<boolean>;
  lock: () => void;
}

export const useParentalStore = create<ParentalState>((set) => ({
  hasPin: false,
  unlocked: false,

  hydrate: () => {
    try {
      set({ hasPin: getParentalPinHash() !== null });
    } catch {
      // settings not ready yet
    }
  },

  setPin: async (pin) => {
    const hash = await hashPin(pin);
    setParentalPinHash(hash);
    set({ hasPin: true, unlocked: true });
  },

  removePin: () => {
    setParentalPinHash(null);
    set({ hasPin: false, unlocked: true });
  },

  verify: async (pin) => {
    const stored = getParentalPinHash();
    const ok = stored != null && stored === (await hashPin(pin));
    if (ok) set({ unlocked: true });
    return ok;
  },

  lock: () => set({ unlocked: false }),
}));
