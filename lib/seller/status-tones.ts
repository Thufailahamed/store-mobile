import { colors } from "@/lib/theme/tokens";

/** Shared order-status palette for home, list, and detail. */
export const ORDER_STATUS_TONE: Record<string, { bg: string; text: string }> = {
  pending: { bg: "rgba(200,164,74,0.18)", text: "#8a6a2a" },
  confirmed: { bg: "rgba(83,94,44,0.12)", text: colors.olive[800] },
  processing: { bg: "rgba(83,94,44,0.16)", text: colors.olive[900] },
  shipped: { bg: "rgba(184,92,58,0.12)", text: colors.accent2.rust },
  out_for_delivery: { bg: "rgba(184,92,58,0.14)", text: colors.accent2.rust },
  delivered: { bg: "rgba(83,94,44,0.14)", text: colors.olive[800] },
  cancelled: { bg: colors.light.muted, text: colors.light.mutedForeground },
  returned: { bg: "rgba(184,92,58,0.12)", text: colors.accent2.rust },
  refunded: { bg: "rgba(184,92,58,0.12)", text: colors.accent2.rust },
  failed_attempt: { bg: "rgba(184,92,58,0.12)", text: colors.accent2.rust },
};

export function orderStatusTone(status: string | null | undefined) {
  const key = String(status ?? "pending").toLowerCase();
  return ORDER_STATUS_TONE[key] ?? ORDER_STATUS_TONE.pending;
}
