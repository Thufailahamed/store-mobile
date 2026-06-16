#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export GRADLE_USER_HOME="${GRADLE_USER_HOME:-$HOME/.gradle}"
export JAVA_HOME="${JAVA_HOME:-$(/usr/libexec/java_home -v 17)}"

# Drop stale native/CMake caches (e.g. after sandbox builds with temp Gradle paths).
rm -rf \
  "$ROOT/android/app/.cxx" \
  "$ROOT/android/app/build" \
  "$ROOT/android/.gradle"

# Embed brand fonts in the Android APK so release builds match iOS typography.
FONTS_DIR="$ROOT/android/app/src/main/assets/fonts"
mkdir -p "$FONTS_DIR"
cp "$ROOT/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf" "$FONTS_DIR/"
cp "$ROOT/node_modules/@expo-google-fonts/manrope/400Regular/Manrope_400Regular.ttf" "$FONTS_DIR/"
cp "$ROOT/node_modules/@expo-google-fonts/manrope/500Medium/Manrope_500Medium.ttf" "$FONTS_DIR/"
cp "$ROOT/node_modules/@expo-google-fonts/manrope/600SemiBold/Manrope_600SemiBold.ttf" "$FONTS_DIR/"
cp "$ROOT/node_modules/@expo-google-fonts/manrope/700Bold/Manrope_700Bold.ttf" "$FONTS_DIR/"
cp "$ROOT/node_modules/@expo-google-fonts/fraunces/400Regular/Fraunces_400Regular.ttf" "$FONTS_DIR/"
cp "$ROOT/node_modules/@expo-google-fonts/fraunces/400Regular_Italic/Fraunces_400Regular_Italic.ttf" "$FONTS_DIR/"
cp "$ROOT/node_modules/@expo-google-fonts/fraunces/600SemiBold/Fraunces_600SemiBold.ttf" "$FONTS_DIR/"
cp "$ROOT/node_modules/@expo-google-fonts/jetbrains-mono/400Regular/JetBrainsMono_400Regular.ttf" "$FONTS_DIR/"
cp "$ROOT/node_modules/@expo-google-fonts/jetbrains-mono/500Medium/JetBrainsMono_500Medium.ttf" "$FONTS_DIR/"
cp "$ROOT/node_modules/@expo-google-fonts/jetbrains-mono/600SemiBold/JetBrainsMono_600SemiBold.ttf" "$FONTS_DIR/"

cd "$ROOT/android"
./gradlew clean assembleRelease

echo ""
echo "APK: $ROOT/android/app/build/outputs/apk/release/app-release.apk"
