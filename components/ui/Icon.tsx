import React from "react";
import { Platform, type TextStyle } from "react-native";
import IoniconsRaw from "@expo/vector-icons/Ionicons";

/**
 * Android (RN 0.76 new architecture) sometimes resolves the Ionicons <Text>
 * glyph to a system font that has no glyph for outline variants
 * ("bag-outline", "notifications-outline", "heart-outline" etc).
 * Forcing `includeFontPadding: false` and a redundant `fontFamily` on the
 * icon's style fixes the visibility without affecting iOS, where the
 * auto-resolved name already matches. iOS path stays `undefined` -> no
 * visual change.
 */
const ANDROID_ICON_FONT_STYLE: TextStyle = {
  fontFamily: "Ionicons",
  includeFontPadding: false,
};

export type IonIconName = keyof typeof IoniconsRaw.glyphMap;

type IconProps = React.ComponentProps<typeof IoniconsRaw>;

type IoniconsComponent = ((props: IconProps) => React.ReactElement | null) & {
  font: typeof IoniconsRaw.font;
  glyphMap: typeof IoniconsRaw.glyphMap;
};

/**
 * Drop-in replacement for `<Ionicons>` that applies Android-only glyph
 * visibility tweaks without touching iOS. Re-exports the underlying
 * `font` and `glyphMap` so call sites that do
 * `useFonts({ ...Ionicons.font })` and `keyof typeof Ionicons.glyphMap`
 * keep working unchanged.
 */
function IoniconsImpl(props: IconProps) {
  const { style, ...rest } = props;
  const mergedStyle = Platform.select({
    android: [style, ANDROID_ICON_FONT_STYLE].filter(Boolean) as IconProps["style"],
    default: style,
  });
  return <IoniconsRaw {...rest} style={mergedStyle} />;
}

export const Ionicons = IoniconsImpl as IoniconsComponent;
(Ionicons as unknown as { font: typeof IoniconsRaw.font }).font = IoniconsRaw.font;
(Ionicons as unknown as { glyphMap: typeof IoniconsRaw.glyphMap }).glyphMap =
  IoniconsRaw.glyphMap;

export default Ionicons;
export const IoniconsFont = IoniconsRaw.font;
export const IoniconsGlyphMap = IoniconsRaw.glyphMap;