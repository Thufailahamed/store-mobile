import React, { useState } from "react";
import { View, Text, Switch, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { Ionicons } from "@/components/ui/Icon";
import { updateSellerStore } from "@/lib/api";
import { colors, radii } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import type { Store } from "@/lib/types";

const WINDOWS = [7, 14, 30, 45, 60];

/**
 * Returns policy (0357). Saves on change through PATCH /api/seller/store.
 * Off = final sale: PDP shows "No returns" and return requests are refused.
 */
export function ReturnsSettingsCard({ store, onSaved }: { store: Store; onSaved: (next: Store) => void }) {
  const [saving, setSaving] = useState(false);
  const accepts = store.accepts_returns !== false;
  const windowDays = store.return_window_days ?? 30;

  const save = async (patch: Partial<Store>) => {
    setSaving(true);
    const res = await updateSellerStore(store.id, patch);
    setSaving(false);
    if (!res.ok) {
      Alert.alert("Couldn’t save returns policy", res.error);
      return;
    }
    onSaved({ ...store, ...res.data, ...patch });
  };

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={[styles.icon, !accepts && styles.iconOff]}>
          <Ionicons
            name={accepts ? "return-down-back-outline" : "ban-outline"}
            size={17}
            color={accepts ? colors.olive[800] : colors.accent2.rust}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Accept returns</Text>
          <Text style={styles.sub}>
            {accepts
              ? `Shoppers see “${windowDays}-day returns”.`
              : "Final sale — shoppers see “No returns”."}
          </Text>
        </View>
        {saving ? (
          <ActivityIndicator color={colors.olive[700]} />
        ) : (
          <Switch
            value={accepts}
            onValueChange={(v) => void save({ accepts_returns: v })}
            trackColor={{ true: colors.olive[700], false: "rgba(22,23,15,0.18)" }}
            thumbColor={colors.paper.cream}
            accessibilityLabel="Accept returns"
          />
        )}
      </View>

      {accepts && (
        <View style={styles.windows}>
          <Text style={styles.kicker}>Return window</Text>
          <View style={styles.segment}>
            {WINDOWS.map((d) => {
              const active = d === windowDays;
              return (
                <TouchableOpacity
                  key={d}
                  disabled={saving || active}
                  onPress={() => void save({ return_window_days: d })}
                  style={[styles.chip, active && styles.chipActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${d} day return window`}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{d}</Text>
                  <Text style={[styles.chipUnit, active && styles.chipTextActive]}>days</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, gap: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.paper.cream,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  iconOff: { backgroundColor: "rgba(184,92,58,0.06)", borderColor: "rgba(184,92,58,0.2)" },
  title: { fontFamily: fontFamilies.sans.semibold, fontSize: 14, color: colors.olive[950] },
  sub: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: colors.ink.mute, marginTop: 2 },
  windows: { gap: 10 },
  kicker: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: colors.olive[700],
  },
  segment: {
    flexDirection: "row",
    padding: 3,
    gap: 3,
    borderRadius: radii.full,
    backgroundColor: colors.paper.cream,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.1)",
  },
  chip: {
    flex: 1,
    height: 44,
    borderRadius: radii.full,
    alignItems: "center",
    justifyContent: "center",
  },
  chipActive: { backgroundColor: colors.olive[950] },
  chipText: { fontFamily: fontFamilies.display.semibold, fontSize: 15, lineHeight: 18, color: colors.olive[900] },
  chipUnit: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 8,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.ink.mute,
  },
  chipTextActive: { color: colors.paper.cream },
});
