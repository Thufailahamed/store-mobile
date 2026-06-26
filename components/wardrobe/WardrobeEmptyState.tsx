import React from "react";
import { View, StyleSheet, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@/components/ui/Icon";
import { fontFamilies } from "@/lib/theme/fonts";
import { radii, spacing } from "@/lib/theme/tokens";

const INK = "#16170f";
const MUTED = "#6b6b6b";
const OLIVE = "#556b2f";

interface Props {
  onSync: () => void;
  onAdd: () => void;
  syncing: boolean;
}

export function WardrobeEmptyState({ onSync, onAdd, syncing }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.iconWrap}>
        <View style={styles.iconGlow} />
        <View style={styles.icon}>
          <Ionicons name="shirt-outline" size={36} color={OLIVE} />
        </View>
      </View>

      <Text style={styles.title}>
        Nothing in your closet yet.
      </Text>
      <Text style={styles.sub}>
        Items from delivered orders populate automatically. You can also add anything you own.
      </Text>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.cta, styles.ctaPrimary]}
          onPress={onSync}
          activeOpacity={0.85}
          disabled={syncing}
        >
          <Ionicons name="bag-outline" size={14} color="#fff" />
          <Text style={styles.ctaPrimaryText}>
            {syncing ? "Syncing…" : "Sync delivered orders"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.cta, styles.ctaSecondary]}
          onPress={onAdd}
          activeOpacity={0.85}
        >
          <Ionicons name="add-outline" size={14} color={INK} />
          <Text style={styles.ctaSecondaryText}>Add manually</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles: Record<string, any> = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing[5],
    paddingVertical: 40,
    alignItems: "center",
  },
  iconWrap: {
    width: 96,
    height: 96,
    alignItems: "center",
    justifyContent: "center",
  },
  iconGlow: {
    position: "absolute",
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "rgba(85,107,47,0.18)",
  },
  icon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "rgba(22,23,15,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 26,
    color: INK,
    textAlign: "center",
    marginTop: 18,
  },
  sub: {
    fontSize: 13,
    color: MUTED,
    textAlign: "center",
    marginTop: 8,
    fontFamily: fontFamilies.sans.regular,
    lineHeight: 19,
    maxWidth: 280,
  },
  actions: {
    marginTop: 20,
    gap: 10,
    width: "100%",
    maxWidth: 320,
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: radii.md,
  },
  ctaPrimary: {
    backgroundColor: OLIVE,
  },
  ctaPrimaryText: {
    color: "#fff",
    fontFamily: fontFamilies.sans.regular,
    fontWeight: "700",
    fontSize: 13,
  },
  ctaSecondary: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "rgba(22,23,15,0.15)",
  },
  ctaSecondaryText: {
    color: INK,
    fontFamily: fontFamilies.sans.regular,
    fontWeight: "600",
    fontSize: 13,
  },
});
