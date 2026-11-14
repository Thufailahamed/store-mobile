/**
 * Runway design language — seller posts.
 *
 * Instagram-style: warm white screens, rounded cards and media, pill
 * controls, soft shadows, one warm accent. Rounded everywhere; the ink is
 * reserved for primary actions and selection.
 */
export const P = {
  ink: "#111114",
  inkSoft: "#3a3a40",
  inkDeep: "#0c0c0e",
  body: "#4b4b52",
  mute: "#8a8a92",
  faint: "#c4c4ca",
  paper: "#f7f5ef",
  card: "#ffffff",
  warm: "#ecebe7",
  warmer: "#e2e0da",
  blush: "#fbeee6",
  track: "#ebeae5",
  border: "rgba(17,17,20,0.07)",
  borderStrong: "rgba(17,17,20,0.14)",
  terracotta: "#c0562f",
  terracottaDeep: "#8f3b1d",
  rose: "#c0562f",
  coral: "#ff6a45",
  coralDeep: "#e24e2a",
  lime: "#d6f76a",
  limeDeep: "#3f4d0a",
  dashed: "#d6d3ca",
  champagne: "#c9a57a",
  champagneSoft: "#f3e7d4",
  kicker: "#8a8a92",
  switchOff: "#dcdcd6",
  success: "#2f8f5b",
  dark: ["#2a231d", "#111114"] as const,
} as const;

/** Corner radii, in dp. */
export const RADIUS = {
  media: 20,
  card: 22,
  sheet: 28,
  chip: 14,
  pill: 999,
} as const;

/** Soft elevation for floating cards. */
export const SHADOW = {
  shadowColor: "#000000",
  shadowOpacity: 0.07,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 6 },
  elevation: 3,
} as const;

/** Warm gradient for story rings and the featured frame. */
export const RUNWAY_GRADIENT = ["#f4d35e", "#ff6a45"] as const;

/** Typographic voices: display serif, mono kickers, sans body. */
export const KICKER = { letterSpacing: 2.4, fontSize: 10.5 } as const;
