import { type TextStyle } from "react-native";
import { colors, typography } from "./tokens";
import { fontFamilies } from "./fonts";

const c = colors.light;

export const textStyles = {
  display: (size: keyof typeof typography.fontSizes = "3xl", italic = false): TextStyle => ({
    fontFamily: italic ? fontFamilies.display.italic : fontFamilies.display.regular,
    fontSize: typography.fontSizes[size],
    color: c.foreground,
    letterSpacing: typography.letterSpacing.tighter,
    lineHeight: typography.fontSizes[size] * typography.lineHeights.tight,
  }),
  label: (color = c.primary): TextStyle => ({
    fontFamily: fontFamilies.mono.medium,
    fontSize: typography.fontSizes.xs,
    color,
    letterSpacing: typography.letterSpacing.editorial,
    textTransform: "uppercase",
  }),
  body: (size: keyof typeof typography.fontSizes = "base"): TextStyle => ({
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes[size],
    color: c.foreground,
    lineHeight: typography.fontSizes[size] * typography.lineHeights.normal,
  }),
  bodyMedium: (size: keyof typeof typography.fontSizes = "base"): TextStyle => ({
    fontFamily: fontFamilies.sans.medium,
    fontSize: typography.fontSizes[size],
    color: c.foreground,
    lineHeight: typography.fontSizes[size] * typography.lineHeights.normal,
  }),
  muted: (size: keyof typeof typography.fontSizes = "sm"): TextStyle => ({
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes[size],
    color: c.mutedForeground,
    lineHeight: typography.fontSizes[size] * typography.lineHeights.normal,
  }),
  price: (size: keyof typeof typography.fontSizes = "lg"): TextStyle => ({
    fontFamily: fontFamilies.display.semibold,
    fontSize: typography.fontSizes[size],
    color: c.foreground,
    letterSpacing: typography.letterSpacing.tight,
  }),
} as const;
