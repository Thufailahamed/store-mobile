import { colors, type ThemeColors } from "./tokens";

/** VESTARA is light-mode only. System dark theme is ignored. */
export function useTheme(): {
  colors: ThemeColors;
  isDark: boolean;
} {
  return {
    colors: colors.light as ThemeColors,
    isDark: false,
  };
}
