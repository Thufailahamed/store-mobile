import {
  colors,
  radii,
  spacing,
  shadows,
  typography,
  type ThemeColors,
} from "@/lib/theme/tokens";

/**
 * LUXE is light-mode only. System dark theme is ignored.
 */
export function useTheme() {
  const palette: ThemeColors = colors.light;

  return {
    isDark: false,
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
