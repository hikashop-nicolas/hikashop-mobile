#!/usr/bin/env bash
# Builds a signed release APK + AAB.
#
# Passwords are read from the terminal and exported to Gradle for this run only. They are never
# written to a file, never passed as arguments (which would put them in the process list and the
# shell history), and never printed. They live in the KeePass database.
#
# The keystore is not created here: ~/.keys/new-keystore.sh owns that, and also writes the base64
# form for the CI secret and mirrors both to the Dropbox backup.
#
#   ~/.keys/new-keystore.sh hikashop com.hikashop.app   # once, if it does not exist yet
#   tools/android-release.sh                            # every build
set -euo pipefail

cd "$(dirname "$0")/.."

KEYSTORE="${ANDROID_KEYSTORE_FILE:-$HOME/.keys/hikashop-release.keystore}"
ALIAS="${ANDROID_KEY_ALIAS:-hikashop}"

: "${JAVA_HOME:=/Applications/Android Studio.app/Contents/jbr/Contents/Home}"
: "${ANDROID_HOME:=$HOME/Library/Android/sdk}"
export JAVA_HOME ANDROID_HOME

if [ ! -e "$KEYSTORE" ]; then
	echo "No keystore at $KEYSTORE." >&2
	echo "Create it with: ~/.keys/new-keystore.sh $ALIAS com.hikashop.app" >&2
	exit 1
fi

read -rsp "Keystore password: " ANDROID_KEYSTORE_PASSWORD; echo
read -rsp "Key password (empty if same): " ANDROID_KEY_PASSWORD; echo
[ -n "$ANDROID_KEY_PASSWORD" ] || ANDROID_KEY_PASSWORD="$ANDROID_KEYSTORE_PASSWORD"

# Play rejects an upload whose versionCode it has seen, so it has to climb. CI numbers its own
# builds by run number, so local ones sit in a band well above those to avoid ever claiming a
# number CI would later hand out. The counter lives next to the keystore, not in the repository.
LOCAL_BAND=1000000
COUNTER="$(dirname "$KEYSTORE")/hikashop-version-code"
if [ -z "${APP_VERSION_CODE:-}" ]; then
	APP_VERSION_CODE=$(( $(cat "$COUNTER" 2>/dev/null || echo $LOCAL_BAND) + 1 ))
fi

export ANDROID_KEYSTORE_FILE="$KEYSTORE" ANDROID_KEY_ALIAS="$ALIAS"
export ANDROID_KEYSTORE_PASSWORD ANDROID_KEY_PASSWORD APP_VERSION_CODE

echo "Building version code $APP_VERSION_CODE"
npm run build
npx cap sync android
(cd android && ./gradlew assembleRelease bundleRelease)

echo "$APP_VERSION_CODE" > "$COUNTER"

APK=android/app/build/outputs/apk/release/app-release.apk
AAB=android/app/build/outputs/bundle/release/app-release.aab

# Prove the outputs are actually signed rather than trusting that the config was picked up.
"$ANDROID_HOME"/build-tools/*/apksigner verify --print-certs "$APK" | head -4

echo
echo "APK (sideload): $APK"
echo "AAB (Play):     $AAB"
