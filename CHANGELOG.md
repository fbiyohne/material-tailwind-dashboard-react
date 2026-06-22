# Change Log

## [0.1.0] — Foundation (socle)

CreaticTV is born. This repository previously held an unrelated Vite web dashboard, which
has been removed and replaced with a from-scratch React Native + Expo IPTV client.

### Added

- Expo SDK 56 scaffold (React Native 0.85, React 19.2, New Architecture), TypeScript strict,
  ESLint (eslint-config-expo), Jest.
- App identity: `CreaticTV`, bundle id `com.creatic.creatictv`, iOS 16.4+ / Android 8+,
  cleartext traffic + ATS exception (IPTV streams are frequently HTTP), TV config plugin.
- **Provider abstraction** (`ContentProvider`) with two implementations: `XtreamProvider`
  (full `player_api.php` + short EPG + XMLTV + playback URLs) and `M3uProvider`
  (M3U/M3U8 parsing + group-title categories + separate XMLTV).
- **Parsers** for M3U and XMLTV, with unit tests.
- **Data layer**: op-sqlite + Drizzle schema, indexes, FTS5 search, chunked bulk-insert
  repositories, now/next EPG queries.
- **Encrypted storage**: MMKV with its AES-256 key sealed in the Keychain/Keystore via
  expo-secure-store; credentials never stored in clear text.
- **Sync orchestrator**: catalog import pipeline (provider → normalize → SQLite) with
  progress events and cancellation.
- Zustand session store, i18next (FR + EN), tokenized design-system placeholder.
- Mandatory client-only disclaimer surfaced in-app and in the README.

### Verified

- `tsc --noEmit`, `eslint`, and `jest` (14 tests) all pass.
