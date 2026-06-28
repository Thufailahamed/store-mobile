import React from "react";
import { type TextProps } from "react-native";
import { AppText } from "./AppText";
import { textStyles } from "@/lib/theme/text-styles";
import { typography } from "@/lib/theme/tokens";

type Size = keyof typeof typography.fontSizes;

export function Display({
  size = "3xl",
  italic = false,
  style,
  ...props
}: TextProps & { size?: Size; italic?: boolean }) {
  return <AppText style={[textStyles.display(size, italic), style]} {...props} />;
}

export function Label({ style, ...props }: TextProps) {
  return <AppText style={[textStyles.label(), style]} {...props} />;
}

export function Body({
  size = "base",
  muted = false,
  italic = false,
  style,
  ...props
}: TextProps & { size?: Size; muted?: boolean; italic?: boolean }) {
  const base = muted ? textStyles.muted(size) : textStyles.body(size);
  const italicStyle = italic ? { fontStyle: "italic" as const } : null;
  return <AppText style={[base, italicStyle, style]} {...props} />;
}

export function Price({ size = "lg", style, ...props }: TextProps & { size?: Size }) {
  return <AppText style={[textStyles.price(size), style]} {...props} />;
}

export function MonoLabel({ style, ...props }: TextProps) {
  return <AppText style={[textStyles.label(), style]} {...props} />;
}
