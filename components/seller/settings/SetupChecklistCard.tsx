import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, type IonIconName } from "@/components/ui/Icon";
import { colors, radii, shadows, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

const GOLD = colors.accent2.ochre;
const INK = colors.olive[950];
const BRASS = "#8A6A1C";

export interface SetupStep {
  key: string;
  label: string;
  icon: IonIconName;
  done: boolean;
  onPress: () => void;
}

/**
 * Maison readiness — one glance at what's still missing, each gap one tap
 * from its fix. Collapses to a single "all set" line once complete.
 */
export function SetupChecklistCard({ steps }: { steps: SetupStep[] }) {
  const done = steps.filter((s) => s.done).length;
  const total = steps.length;
  const pct = total ? Math.round((done / total) * 100) : 100;
  const pending = steps.filter((s) => !s.done);

  if (pending.length === 0) {
    return (
      <View style={[styles.card, styles.cardDone]}>
        <View style={styles.doneIcon}>
          <Ionicons name="sparkles" size={16} color={GOLD} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.doneTitle}>Your maison is fully set up</Text>
          <Text style={styles.doneSub}>Contact, pickup and payouts are all on file.</Text>
        </View>
      </View>
    );
  }

  return (
    <LinearGradient
      colors={["#FFFFFF", colors.paper.cream]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      <View style={styles.ring} />
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>Setup · {done} of {total}</Text>
          <Text style={styles.title}>
            {pending.length === 1 ? "One step to go" : `${pending.length} steps to go`}
          </Text>
        </View>
        <Text style={styles.pct}>
          {pct}
          <Text style={styles.pctSign}>%</Text>
        </Text>
      </View>

      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.max(pct, 4)}%` }]} />
      </View>

      <View style={styles.chips}>
        {pending.map((s) => (
          <TouchableOpacity
            key={s.key}
            style={styles.chip}
            onPress={s.onPress}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={`Add ${s.label.toLowerCase()}`}
          >
            <Ionicons name={s.icon} size={13} color={BRASS} />
            <Text style={styles.chipText}>{s.label}</Text>
            <Ionicons name="add" size={13} color={colors.ink.mute} />
          </TouchableOpacity>
        ))}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 26,
    padding: spacing[5],
    gap: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(200,164,74,0.35)",
    ...shadows.editorial,
  },
  ring: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    right: -90,
    top: -110,
    borderWidth: 1,
    borderColor: "rgba(200,164,74,0.22)",
  },
  head: { flexDirection: "row", alignItems: "flex-end", gap: 12 },
  kicker: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: colors.olive[700],
  },
  title: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 22,
    lineHeight: 28,
    color: INK,
    letterSpacing: -0.3,
    marginTop: 4,
  },
  pct: { fontFamily: fontFamilies.display.semibold, fontSize: 34, color: BRASS, letterSpacing: -1 },
  pctSign: { fontSize: 16 },
  track: { height: 4, borderRadius: 2, backgroundColor: colors.olive[100], overflow: "hidden" },
  fill: { height: "100%", borderRadius: 2, backgroundColor: GOLD },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: radii.full,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(200,164,74,0.45)",
  },
  chipText: { fontFamily: fontFamilies.sans.medium, fontSize: 12, color: INK },
  cardDone: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: spacing[4],
    backgroundColor: "#FFFFFF",
    borderColor: "rgba(200,164,74,0.22)",
  },
  doneIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "rgba(200,164,74,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  doneTitle: { fontFamily: fontFamilies.sans.semibold, fontSize: 14, color: INK },
  doneSub: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: colors.ink.mute, marginTop: 2 },
});
