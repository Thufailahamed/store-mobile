/**
 * LUXE Editorial Olive — Design Tokens
 * Translated from web's CSS variables + Tailwind config.
 */

export const colors = {
  // Light mode (default)
  light: {
    background: "#f5f4ef",
    foreground: "#16170f",
    card: "#faf8f1",
    cardForeground: "#16170f",
    popover: "#faf8f1",
    popoverForeground: "#16170f",
    primary: "#535e2c",
    primaryForeground: "#faf8f1",
    secondary: "#e5e5db",
    secondaryForeground: "#353c1f",
    muted: "#eaeade",
    mutedForeground: "#65684d",
    accent: "#d4d4b5",
    accentForeground: "#414a23",
    destructive: "#c0392b",
    destructiveForeground: "#faf8f1",
    border: "#c8c8b8",
    input: "#d4d4c8",
    ring: "#535e2c",
  },
  // Dark mode
  dark: {
    background: "#0d0e0a",
    foreground: "#f0eddf",
    card: "#141510",
    cardForeground: "#f0eddf",
    popover: "#12130e",
    popoverForeground: "#f0eddf",
    primary: "#97a85e",
    primaryForeground: "#161a0a",
    secondary: "#232420",
    secondaryForeground: "#f0eddf",
    muted: "#232420",
    mutedForeground: "#989880",
    accent: "#2e2f28",
    accentForeground: "#f0eddf",
    destructive: "#b33a2b",
    destructiveForeground: "#fafafa",
    border: "#2d2e26",
    input: "#2d2e26",
    ring: "#97a85e",
  },
  // Shared olive ramp
  olive: {
    50: "#f3f3ea",
    100: "#e6e6d0",
    200: "#cccca0",
    300: "#a8b06b",
    400: "#869149",
    500: "#6a7639",
    600: "#535e2c",
    700: "#414a23",
    800: "#353c1f",
    900: "#2c3119",
    950: "#161a0a",
  },
  // Named palette
  paper: { DEFAULT: "#f5f4ef", warm: "#efece2", cream: "#faf8f1" },
  ink: { DEFAULT: "#16170f", soft: "#2a2c1f", mute: "#65684d" },
  accent2: { rust: "#b85c3a", ochre: "#c8a44a" },
} as const;

export type ThemeColors = Record<keyof typeof colors.light, string>;

export const typography = {
  fontSizes: {
    xs: 11,
    sm: 13,
    base: 15,
    md: 16,
    lg: 18,
    xl: 20,
    "2xl": 24,
    "3xl": 30,
    "4xl": 36,
    "5xl": 48,
  },
  fontWeights: {
    light: "300" as const,
    regular: "400" as const,
    medium: "500" as const,
    semibold: "600" as const,
    bold: "700" as const,
    extrabold: "800" as const,
  },
  lineHeights: {
    tight: 1.1,
    snug: 1.25,
    normal: 1.5,
    relaxed: 1.65,
  },
  letterSpacing: {
    tighter: -0.03,
    tight: -0.02,
    normal: 0,
    wide: 0.06,
    wider: 0.12,
    widest: 0.18,
    editorial: 0.22,
  },
} as const;

export const spacing = {
  0: 0,
  0.5: 2,
  1: 4,
  1.5: 6,
  2: 8,
  2.5: 10,
  3: 12,
  3.5: 14,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  9: 36,
  10: 40,
  12: 48,
  14: 56,
  16: 64,
  20: 80,
  24: 96,
} as const;

export const radii = {
  none: 0,
  sm: 4,
  md: 6,
  DEFAULT: 8,
  lg: 10,
  xl: 14,
  "2xl": 18,
  "3xl": 22,
  full: 9999,
} as const;

export const shadows = {
  soft: {
    shadowColor: "#16170f",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  glow: {
    shadowColor: "#535e2c",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 6,
  },
  editorial: {
    shadowColor: "#16170f",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
} as const;
