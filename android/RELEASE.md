# Building and signing the Android app

The web bundle and the Android app come from one codebase: `npm run build` produces `dist/`,
`npx cap sync android` copies it into the Android project, then Gradle packages it.

## Prerequisites

- A JDK 21. Android Studio bundles one, so no separate install is needed:
  `export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"`
- The Android SDK: `export ANDROID_HOME="$HOME/Library/Android/sdk"`

## Debug build (sideload, no signing)

```sh
npm run build && npx cap sync android
cd android && ./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

## Signed release (APK to sideload, AAB for Play)

Signing is driven entirely by environment variables, so no keystore or password is ever
committed. With none of them set, `assembleRelease` simply produces an unsigned build.

Create the keystore once and keep it somewhere safe and backed up. Losing it means you can no
longer update the app on Play under the same identity:

```sh
keytool -genkeypair -v -keystore hikashop-release.keystore \
  -alias hikashop -keyalg RSA -keysize 2048 -validity 10000
```

Then build:

```sh
export ANDROID_KEYSTORE_FILE=/absolute/path/to/hikashop-release.keystore
export ANDROID_KEYSTORE_PASSWORD=...   # prompted for at creation time
export ANDROID_KEY_ALIAS=hikashop
export ANDROID_KEY_PASSWORD=...
export APP_VERSION_CODE=2              # must increase with every Play upload

npm run build && npx cap sync android
cd android && ./gradlew assembleRelease bundleRelease
```

Outputs:

- `app/build/outputs/apk/release/app-release.apk` — sideloading and direct distribution
- `app/build/outputs/bundle/release/app-release.aab` — what the Play Console accepts

## CI

`.github/workflows/ci.yml` runs the same steps. Set these repository secrets to get signed
artifacts; without them the workflow falls back to a debug APK so it never breaks:

| Secret | Value |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | `base64 -i hikashop-release.keystore` |
| `ANDROID_KEYSTORE_PASSWORD` | the store password |
| `ANDROID_KEY_ALIAS` | e.g. `hikashop` |
| `ANDROID_KEY_PASSWORD` | the key password |

`versionCode` comes from the CI run number, so every upload is unique and increasing;
`versionName` is set in `app/build.gradle`.

## Notes

- `applicationId` is `com.hikashop.app`.
- The status bar inset is handled natively (`fitsSystemWindows` on the activity layout plus a
  matching `statusBarColor`), because Android 15+ draws edge to edge and the WebView does not
  otherwise receive the insets that `env(safe-area-inset-top)` reports.
- Device tokens are kept in the platform keystore on device; see `src/app/secure-store.ts`.
