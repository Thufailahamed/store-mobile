import React from "react";
import { Text, type TextProps, type TextStyle } from "react-native";
import { textStyles } from "@/lib/theme/text-styles";
import { typography } from "@/lib/theme/tokens";

type Size = keyof typeof typography.fontSizes;

export function Display({
  size = "3xl",
  italic = false,
  style,
  ...props
}: TextProps & { size?: Size; italic?: boolean }) {
  return <Text style={[textStyles.display(size, italic), style]} {...props} />;
}

export function Label({ style, ...props }: TextProps) {
  return <Text style={[textStyles.label(), style]} {...props} />;
}

export function Body({
  size = "base",
  muted = false,
  style,
  ...props
}: TextProps & { size?: Size; muted?: boolean }) {
  const base = muted ? textStyles.muted(size) : textStyles.body(size);
  return <Text style={[base, style]} {...props} />;
}

export function Price({ size = "lg", style, ...props }: TextProps & { size?: Size }) {
  return <Text style={[textStyles.price(size), style]} {...props} />;
}

export function MonoLabel({ style, ...props }: TextProps) {
  return <Text style={[textStyles.label(), style]} {...props} />;
}
