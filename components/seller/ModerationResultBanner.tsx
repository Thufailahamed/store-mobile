import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@/components/ui/Icon";
import { radii } from "@/lib/theme/tokens";

export type ModerationReason = {
  rule_id: string;
  message: string;
  weight: number;
  blocking: boolean;
};

export type ModerationResult = {
  auto_approved: boolean;
  score: number;
  threshold: number;
  flagged: boolean;
  reasons: ModerationReason[];
} | null;

type Tone = "emerald" | "amber" | "rose" | "violet" | "neutral";

const TONE_BG: Record<Tone, { bg: string; ring: string; text: string; icon: string }> = {
  emerald: { bg: "#ecfdf5", ring: "#a7f3d0", text: "#047857", icon: "#059669" },
  amber:   { bg: "#fffbeb", ring: "#fde68a", text: "#b45309", icon: "#d97706" },
  rose:    { bg: "#fff1f2", ring: "#fecdd3", text: "#be123c", icon: "#e11d48" },
  violet:  { bg: "#f5f3ff", ring: "#ddd6fe", text: "#6d28d9", icon: "#7c3aed" },
  neutral: { bg: "#f5f5f4", ring: "#e7e5e4", text: "#57534e", icon: "#78716c" },
};

function pickTone(m: NonNullable<ModerationResult>): Tone {
  if ((m.reasons ?? []).some((r) => r.blocking)) return "violet";
  if (m.auto_approved) return m.score >= Math.max(1, Math.floor(m.threshold * 0.6)) ? "amber" : "emerald";
  return "rose";
}

function titleFor(m: NonNullable<ModerationResult>, isNew: boolean): string {
  if (m.auto_approved) return isNew ? "Auto-approved" : "Auto-approved — saved";
  if ((m.reasons ?? []).some((r) => r.blocking)) return "Will be blocked";
  return "Pending admin review";
}

function iconName(m: NonNullable<ModerationResult>): keyof typeof Ionicons.glyphMap {
  if ((m.reasons ?? []).some((r) => r.blocking)) return "close-circle";
  if (m.auto_approved) return "shield-checkmark";
  return "alert-circle";
}

/**
 * ModerationResultBanner — shown above the product screen after a save
 * call returns a moderation envelope. Mirrors the web banner's color +
 * reason-chip pattern but collapses to a single line on narrow viewports.
 */
export function ModerationResultBanner({
  result,
  isNew,
}: {
  result: ModerationResult;
  isNew: boolean;
}) {
  if (!result) return null;
  const tone = pickTone(result);
  const name = iconName(result);
  const t = TONE_BG[tone];
  const top = (result.reasons ?? []).slice(0, 3);
  return (
    <View
      style={[
        styles.wrap,
        { backgroundColor: t.bg, borderColor: t.ring },
      ]}
    >
      <View style={styles.header}>
        <Ionicons name={name} size={18} color={t.icon} />
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={[styles.title, { color: t.text }]}>{titleFor(result, isNew)}</Text>
          <Text style={[styles.score, { color: t.text }]}>
            score {result.score} / {result.threshold}
            {result.auto_approved ? " · live now" : " · needs review"}
          </Text>
        </View>
      </View>
      {top.length > 0 ? (
        <View style={styles.chips}>
          {top.map((r, i) => (
            <View
              key={`${r.rule_id}-${i}`}
              style={[
                styles.chip,
                {
                  backgroundColor: r.blocking ? "#ede9fe" : "#ffffff",
                  borderColor: r.blocking ? "#c4b5fd" : t.ring,
                },
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: r.blocking ? "#6d28d9" : t.text },
                ]}
                numberOfLines={1}
              >
                {r.message}
              </Text>
            </View>
          ))}
          {(result.reasons?.length ?? 0) > top.length ? (
            <Text style={[styles.chip, styles.more, { color: t.text }]}>
              +{result.reasons!.length - top.length} more
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: 12,
    gap: 8,
    marginBottom: 12,
  },
  header: { flexDirection: "row", alignItems: "flex-start" },
  title: { fontSize: 14, fontWeight: "600" },
  score: { fontSize: 12, marginTop: 1 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: { fontSize: 11, fontWeight: "500" },
  more: {
    backgroundColor: "transparent",
    borderWidth: 0,
    fontSize: 11,
    paddingHorizontal: 4,
  },
});