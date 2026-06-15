import React from "react";
import { useColorScheme } from "react-native";
import { colors, type ThemeColors } from "./tokens";

type Theme = "light" | "dark" | "system";

export function useTheme(mode: Theme = "system"): {
  colors: ThemeColors;
  isDark: boolean;
} {
  const systemScheme = useColorScheme();
  const isDark =
    mode === "dark" || (mode === "system" && systemScheme === "dark");

  return {
    colors: (isDark ? colors.dark : colors.light) as ThemeColors,
    isDark,
  };
}
