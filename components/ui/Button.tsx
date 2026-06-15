import React from "react";
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  type TouchableOpacityProps,
  type ViewStyle,
  type TextStyle,
} from "react-native";
import { cn } from "@/lib/utils";
import { colors, radii, typography, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

type ButtonVariant = "default" | "brand" | "destructive" | "outline" | "ghost" | "link";
type ButtonSize = "sm" | "md" | "lg" | "icon";

interface ButtonProps extends TouchableOpacityProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  textStyle?: TextStyle | TextStyle[];
  children: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, { container: ViewStyle; text: TextStyle }> = {
  default: {
    container: { backgroundColor: colors.light.primary },
    text: { color: colors.light.primaryForeground },
  },
  brand: {
    container: {
      backgroundColor: colors.olive[700],
      ...shadows.glow,
    },
    text: { color: "#ffffff" },
  },
  destructive: {
    container: { backgroundColor: colors.light.destructive },
    text: { color: colors.light.destructiveForeground },
  },
  outline: {
    container: {
      backgroundColor: "transparent",
      borderWidth: 1,
      borderColor: colors.light.border,
    },
    text: { color: colors.light.foreground },
  },
  ghost: {
    container: { backgroundColor: "transparent" },
    text: { color: colors.light.foreground },
  },
  link: {
    container: { backgroundColor: "transparent" },
    text: { color: colors.light.primary, textDecorationLine: "underline" },
  },
};

const sizeStyles: Record<ButtonSize, { container: ViewStyle; text: TextStyle }> = {
  sm: {
    container: { height: 36, paddingHorizontal: 12, borderRadius: radii.md },
    text: { fontSize: typography.fontSizes.sm },
  },
  md: {
    container: { height: 44, paddingHorizontal: 20, borderRadius: radii.lg },
    text: { fontSize: typography.fontSizes.base },
  },
  lg: {
    container: { height: 52, paddingHorizontal: 28, borderRadius: radii.lg },
    text: { fontSize: typography.fontSizes.lg },
  },
  icon: {
    container: { height: 44, width: 44, borderRadius: radii.lg, paddingHorizontal: 0, justifyContent: "center", alignItems: "center" },
    text: { fontSize: typography.fontSizes.base },
  },
};

function wrapTextChildren(children: React.ReactNode, textStyle: TextStyle[]) {
  if (typeof children === "string" || typeof children === "number") {
    return <Text style={textStyle}>{String(children)}</Text>;
  }

  return React.Children.map(children, (child) => {
    if (typeof child === "string" || typeof child === "number") {
      return <Text style={textStyle}>{String(child)}</Text>;
    }
    return child;
  });
}

export function Button({
  variant = "default",
  size = "md",
  loading = false,
  disabled,
  style,
  textStyle,
  children,
  ...props
}: ButtonProps) {
  const v = variantStyles[variant];
  const s = sizeStyles[size];

  const mergedTextStyle = [
    styles.text,
    v.text,
    s.text,
    ...(Array.isArray(textStyle) ? textStyle : [textStyle]),
  ].filter(Boolean) as TextStyle[];

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      disabled={disabled || loading}
      style={[
        styles.base,
        v.container,
        s.container,
        (disabled || loading) && styles.disabled,
        style as ViewStyle,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator size="small" color={v.text.color} />
      ) : (
        wrapTextChildren(children, mergedTextStyle)
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  text: {
    fontFamily: fontFamilies.sans.semibold,
    fontWeight: typography.fontWeights.semibold,
    letterSpacing: typography.letterSpacing.wide,
    textTransform: "uppercase",
  },
  disabled: {
    opacity: 0.5,
  },
});
