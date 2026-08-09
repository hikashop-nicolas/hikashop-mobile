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

Release keystores live in `~/.keys`, one per app, outside every repository, mirrored to the
Dropbox backup; see the README there. Create this app's key once:

```sh
~/.keys/new-keystore.sh hikashop com.hikashop.app
```

That prompts for the passwords through keytool, writes the base64 form for the
`ANDROID_KEYSTORE_BASE64` CI secret, and copies both to the backup. Record the passwords in
KeePass. Losing the file means the app can no longer be updated on Play under the same identity,
unless Play App Signing is on, in which case this is only the upload key and support can reset it.

Then build with `tools/android-release.sh`. It prompts for the passwords, so they stay in the
terminal: never in a file, never in an argument, never in the shell history. It keeps the version
code next to the keystore and increments it per build, because Play rejects an upload whose
version code it has already seen, and it verifies the signature on the finished APK rather than
assuming the config was picked up.

To drive the build yourself instead:

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
