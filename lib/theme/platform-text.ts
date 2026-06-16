import { Platform, StyleSheet, type TextStyle } from "react-native";

/**
 * On Android, setting fontWeight alongside a custom fontFamily makes React Native
 * fall back to Roboto instead of Manrope/Fraunces/JetBrains Mono.
 */
export function androidSafeTextStyle(style?: TextStyle | TextStyle[] | null): TextStyle {
  const flat = StyleSheet.flatten(style) ?? {};
  if (Platform.OS !== "android") return flat;
  if (!flat.fontFamily) {
    return { includeFontPadding: false, ...flat };
  }
  const { fontWeight: _fontWeight, ...rest } = flat;
  return { includeFontPadding: false, ...rest };
}
