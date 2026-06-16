#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APK="$ROOT/android/app/build/outputs/apk/release/app-release.apk"
ADB="${ANDROID_HOME:-$HOME/Library/Android/sdk}/platform-tools/adb"

if [[ ! -x "$ADB" ]]; then
  echo "adb not found at: $ADB"
  echo "Install Android SDK Platform-Tools or set ANDROID_HOME."
  exit 1
fi

if [[ ! -f "$APK" ]]; then
  echo "Release APK not found. Build first:"
  echo "  npm run android:apk"
  exit 1
fi

echo "Connected devices:"
"$ADB" devices -l
echo ""
echo "Installing $APK"
"$ADB" install -r "$APK"
echo "Done."
