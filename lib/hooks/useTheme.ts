import { useColorScheme } from "react-native";
import {
  colors,
  radii,
  spacing,
  shadows,
  typography,
  type ThemeColors,
} from "@/lib/theme/tokens";

/**
 * Resolves the active palette from the system colour scheme.
 * Returns the full design-token bundle (colours + radii + spacing + shadows + typography)
 * so consumers don't have to pick light/dark by hand.
 */
export function useTheme() {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const palette: ThemeColors = isDark ? colors.dark : colors.light;

  return {
    isDark,
    colors: palette,
    olive: colors.olive,
    accent2: colors.accent2,
    paper: colors.paper,
    ink: colors.ink,
    radii,
    spacing,
    shadows,
    typography,
  };
}

export type Theme = ReturnType<typeof useTheme>;
