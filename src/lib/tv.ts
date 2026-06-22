import { Platform } from 'react-native';

/**
 * TV helpers, isolated so the rest of the app stays platform-clean.
 *
 * NOTE on scope: react-native-tvos only replaces react-native at build time
 * (EXPO_TV=1). The core RN types we develop against don't declare TV-only APIs
 * like `hasTVPreferredFocus` or `useTVEventHandler`, so we keep the untyped
 * surface here. Capturing raw remote *number keys* is the known RNTV rough edge
 * (not delivered by useTVEventHandler); we ship an on-screen channel jump
 * instead, which works on both Apple TV and Android TV.
 */
export const isTV = Platform.isTV;

/**
 * Spread onto a Pressable to request initial D-pad focus on TV. Types as
 * `object` so the (TV-only) prop passes through at runtime without a TS error on
 * the mobile type surface.
 */
export function tvFocusProps(preferred?: boolean): object {
  return isTV && preferred ? { hasTVPreferredFocus: true } : {};
}
