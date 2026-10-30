/**
 * Shared editorial pieces for the admin catalogue screens
 * (/(admin)/products and /(admin)/catalogue): ink/lime palette, status
 * tones, chips, search pill, empty state and the card surface.
 */
import React from "react";
import { View, Text, StyleSheet, Pressable, TextInput } from "react-native";
import { Ionicons } from "@/components/ui/Icon";
import { colors } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

export const INK = "#15160f";
export const LIME = "#c8e08a";
export const HAIRLINE = "rgba(22,23,15,0.07)";

export const STATUS_TONE: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  active: { bg: "#ecf6ec", text: "#2e5a27", dot: "#22a35a", label: "Live" },
  approved: { bg: "#ecf6ec", text: "#2e5a27", dot: "#22a35a", label: "Approved" },
  live: { bg: "#ecf6ec", text: "#2e5a27", dot: "#22a35a", label: "Live" },
  pending: { bg: "#fdf6e3", text: "#8a6116", dot: "#e0a526", label: "Pending" },
  draft: { bg: "#f1f1ec", text: "#5d6052", dot: "#9a9c8c", label: "Draft" },
  inactive: { bg: "#f1f1ec", text: "#5d6052", dot: "#9a9c8c", label: "Inactive" },
  off: { bg: "#f1f1ec", text: "#5d6052", dot: "#9a9c8c", label: "Off" },
  rejected: { bg: "#fdeeee", text: "#9f2a2a", dot: "#e05252", label: "Rejected" },
  archived: { bg: "#f3f1ec", text: "#77736a", dot: "#c9c4b6", label: "Archived" },
};

export const statusTone = (status?: string | null) =>
  STATUS_TONE[status ?? ""] ?? { ...STATUS_TONE.draft, label: status ? status.charAt(0).toUpperCase() + status.slice(1) : "—" };

/** Soft white surface with hairline border + long, faint shadow. */
export const cardSurface = {
  backgroundColor: "rgba(255,255,255,0.86)",
  borderWidth: 1,
  borderColor: HAIRLINE,
  shadowColor: INK,
  shadowOffset: { width: 0, height: 14 },
  shadowOpacity: 0.07,
  shadowRadius: 24,
  elevation: 3,
} as const;

export function StatusPill({ status }: { status?: string | null }) {
  const tone = statusTone(status);
  return (
    <View style={[kit.statusPill, { backgroundColor: tone.bg }]}>
      <View style={[kit.statusDot, { backgroundColor: tone.dot }]} />
      <Text style={[kit.statusText, { color: tone.text }]}>{tone.label}</Text>
    </View>
  );
}

export function SearchBar({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <View style={kit.search}>
      <Ionicons name="search-outline" size={17} color={colors.ink.mute} />
      <TextInput
        style={kit.searchInput}
        placeholder={placeholder}
        placeholderTextColor="rgba(101,104,77,0.6)"
        value={value}
        onChangeText={onChange}
        autoCapitalize="none"
        returnKeyType="search"
        selectionColor={colors.olive[600]}
      />
      {value.length > 0 && (
        <Pressable onPress={() => onChange("")} hitSlop={10} accessibilityLabel="Clear search">
          <Ionicons name="close-circle" size={17} color={colors.ink.mute} />
        </Pressable>
      )}
    </View>
  );
}

export function Chip({
  label,
  count,
  dot,
  icon,
  active,
  onPress,
}: {
  label: string;
  count?: number;
  dot?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[kit.chip, active && kit.chipActive]}>
      {dot && <View style={[kit.chipDot, { backgroundColor: dot }]} />}
      {icon && <Ionicons name={icon} size={13} color={active ? INK : colors.ink.mute} />}
      <Text style={[kit.chipText, active && kit.chipTextActive]}>{label}</Text>
      {count !== undefined && <Text style={[kit.chipCount, active && kit.chipCountActive]}>{count}</Text>}
    </Pressable>
  );
}

export function Empty({
  icon,
  title,
  body,
  actionLabel = "Clear filters",
  onReset,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  actionLabel?: string;
  onReset?: () => void;
}) {
  return (
    <View style={kit.empty}>
      <View style={kit.emptyIcon}>
        <Ionicons name={icon} size={24} color={colors.olive[700]} />
      </View>
      <Text style={kit.emptyTitle}>{title}</Text>
      <Text style={kit.emptyBody}>{body}</Text>
      {onReset && (
        <Pressable onPress={onReset} style={({ pressed }) => [kit.emptyBtn, pressed && kit.pressed]}>
          <Text style={kit.emptyBtnText}>{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

export function SectionCount({ children }: { children: React.ReactNode }) {
  return <Text style={kit.count}>{children}</Text>;
}

export const kit = StyleSheet.create({
  pressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },
  pressedCard: { transform: [{ scale: 0.985 }], opacity: 0.95 },

  statusPill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusText: { fontFamily: fontFamilies.sans.semibold, fontSize: 10.5 },

  search: {
    flexDirection: "row", alignItems: "center", gap: 10, height: 48, paddingHorizontal: 16, borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.9)", borderWidth: 1, borderColor: HAIRLINE, marginBottom: 10,
  },
  searchInput: { flex: 1, height: "100%", fontFamily: fontFamilies.sans.medium, fontSize: 14, color: INK },

  chip: {
    flexDirection: "row", alignItems: "center", gap: 6, height: 34, paddingHorizontal: 13, borderRadius: 999,
    borderWidth: 1, borderColor: "rgba(22,23,15,0.1)", backgroundColor: "rgba(255,255,255,0.6)",
  },
  chipActive: { backgroundColor: "#ffffff", borderColor: INK },
  chipDot: { width: 6, height: 6, borderRadius: 3 },
  chipText: { fontFamily: fontFamilies.sans.medium, fontSize: 12.5, color: colors.ink.mute },
  chipTextActive: { color: INK, fontFamily: fontFamilies.sans.semibold },
  chipCount: { fontFamily: fontFamilies.mono.regular, fontSize: 10, color: "rgba(22,23,15,0.35)" },
  chipCountActive: { color: colors.olive[700] },

  count: { fontFamily: fontFamilies.mono.medium, fontSize: 9.5, letterSpacing: 1.8, color: "rgba(22,23,15,0.4)", marginBottom: 10 },

  empty: { alignItems: "center", paddingVertical: 48, paddingHorizontal: 30 },
  emptyIcon: {
    width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center",
    backgroundColor: colors.olive[50], borderWidth: 1, borderColor: HAIRLINE, marginBottom: 14,
  },
  emptyTitle: { fontFamily: fontFamilies.display.regular, fontSize: 22, color: INK },
  emptyBody: { marginTop: 6, fontFamily: fontFamilies.sans.regular, fontSize: 13, lineHeight: 19, color: colors.ink.mute, textAlign: "center" },
  emptyBtn: { marginTop: 18, paddingHorizontal: 18, height: 40, justifyContent: "center", borderRadius: 999, backgroundColor: INK },
  emptyBtnText: { fontFamily: fontFamilies.sans.semibold, fontSize: 13, color: colors.paper.cream },
});
