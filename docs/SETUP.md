# Developing CreaticTV locally (VS Code)

CreaticTV is a React Native + **Expo SDK 56** app. It uses native modules
(op-sqlite, MMKV, react-native-video), so **Expo Go does not work** — you build a
**dev client** once and iterate against it.

## 1. Prerequisites

| Tool | Why | Notes |
| --- | --- | --- |
| **Node 22 LTS** | JS runtime | `node -v` → 22.x (20+ accepted) |
| **Git** | source control | |
| **VS Code** | editor | install the recommended extensions when prompted |
| **Xcode** (macOS only) | iOS & Apple TV builds/simulators | App Store |
| **Android Studio** | Android & Android TV SDK + emulator | all platforms |
| **Watchman** (macOS, recommended) | Metro file watching | `brew install watchman` |

> ⚠️ **iOS only builds on macOS.** On Windows/Linux you can build **Android** only.

## 2. Clone & open

```bash
git clone https://github.com/fbiyohne/material-tailwind-dashboard-react.git creatictv
cd creatictv
git checkout claude/iptv-player-multiplatform-hhc5dm
code .
```

## 3. Install + generate native projects

```bash
npm run setup        # checks Node, npm install, then `expo prebuild`
```

`setup` runs `expo prebuild`, which generates the `ios/` and `android/` folders
(both are gitignored and regenerable — don't commit them).

## 4. Run

```bash
npm run android      # Android emulator or attached device
npm run ios          # macOS only

# TV variant (Android TV / Apple TV)
EXPO_TV=1 npx expo prebuild --clean
EXPO_TV=1 npm run android      # or: EXPO_TV=1 npm run ios
```

First launch shows the **disclaimer → onboarding**. Enter **your own** Xtream
Codes credentials (URL + username + password) or an M3U playlist URL (+ optional
XMLTV EPG URL). Nothing is bundled; the app is a player only.

## 5. Day-to-day

```bash
npm start            # Metro dev server (press a = Android, i = iOS)
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm test             # jest
```

When you change `app.json`, plugins, or add a native module:

```bash
npx expo prebuild --clean
```

## 6. Project layout

```
src/
  app/          Expo Router routes (screens)
  domain/       pure TS models
  providers/    ContentProvider abstraction + Xtream + M3U
  data/         SQLite (schema, db, repositories, FTS5) + encrypted MMKV
  sync/         catalog import orchestrator
  services/     on-device intelligence (dedup, health-check, TMDB, NL search) + cloud sync
  state/        Zustand stores
  ui/           theme system (3 themes) + components
  lib/          parsers (M3U, XMLTV), net, utils
  i18n/         FR + EN
```

## 7. Good to know

- **No backend.** The app is 100% client; there is nothing to run server-side.
- **Credentials** are encrypted on-device (Keychain/Keystore + MMKV) and only
  sent to your provider. Moving to a new device: re-enter them, or use
  **Settings → Sync** to import a backup.
- **VS Code** is preconfigured (`.vscode/`): format-on-save (Prettier) + ESLint
  autofix. Accept the recommended extensions prompt.
- Troubleshoot the native toolchain with `npx expo-doctor`.
