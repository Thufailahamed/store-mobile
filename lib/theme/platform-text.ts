import { StyleSheet, Platform, type TextStyle, type StyleProp } from "react-native";

/**
 * On Android, setting fontWeight alongside a custom fontFamily makes React Native
 * fall back to Roboto instead of Manrope/Fraunces/JetBrains Mono.
 */
export function androidSafeTextStyle(style?: StyleProp<TextStyle>): TextStyle {
  const flat = StyleSheet.flatten(style) ?? {};
  if (Platform.OS !== "android") return flat;
  if (!flat.fontFamily) {
    return { includeFontPadding: false, ...flat };
  }
  const { fontWeight: _fontWeight, ...rest } = flat;
  return { includeFontPadding: false, ...rest };
}
