/**
 * Premium editorial pieces shared by admin list screens
 * (categories, banners, coupons, …): masthead with gold-ringed add
 * button, olive stat band, search field and segmented filter.
 */
import React from "react";
import { View, Text, Pressable, StyleSheet, TextInput, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@/components/ui/Icon";
import { colors, radii, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

export const GOLD = colors.accent2.ochre;
export const CREAM = colors.paper.cream;
export const RUST = colors.accent2.rust;
const FG = colors.light.foreground;
const MUTED = colors.light.mutedForeground;

export function AdminMasthead({
  eyebrow,
  title,
  italic,
  subtitle,
  onAdd,
}: {
  eyebrow: string;
  title: string;
  /** Optional second word rendered in Fraunces italic olive. */
  italic?: string;
  subtitle?: string;
  onAdd?: () => void;
}) {
  return (
    <View style={s.mast}>
      <View style={{ flex: 1 }}>
        <View style={s.eyebrowRow}>
          <View style={s.eyebrowRule} />
          <Text style={s.eyebrow}>{eyebrow.toUpperCase()}</Text>
        </View>
        <Text style={s.title}>
          {title}
          {italic ? <Text style={s.titleItalic}> {italic}</Text> : null}
        </Text>
        {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
      </View>
      {onAdd ? (
        <Pressable onPress={onAdd} hitSlop={6} style={({ pressed }) => [s.addShadow, pressed && s.pressed]} accessibilityLabel="Create new">
          <LinearGradient colors={["#e3c878", GOLD, "#9c7a2c"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.addRing}>
            <LinearGradient colors={["#3a4120", "#1c200f"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.addInner}>
              <Ionicons name="add" size={22} color={CREAM} />
            </LinearGradient>
          </LinearGradient>
        </Pressable>
      ) : null}
    </View>
  );
}

export function StatBand({ items }: { items: { label: string; value: string | number; accent?: boolean }[] }) {
  return (
    <LinearGradient colors={["#3a4120", colors.olive[900], "#1c200f"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.band}>
      <View pointerEvents="none" style={s.bandRing} />
      {items.map((it, i) => (
        <View key={it.label} style={[s.bandCell, i > 0 && s.bandCellBorder]}>
          <Text style={[s.bandValue, it.accent && { color: GOLD }]}>{it.value}</Text>
          <Text style={s.bandLabel}>{it.label.toUpperCase()}</Text>
        </View>
      ))}
    </LinearGradient>
  );
}

export function SearchField({
  value,
  onChangeText,
  placeholder,
  autoCapitalize = "none",
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  autoCapitalize?: "none" | "characters";
}) {
  return (
    <View style={s.search}>
      <Ionicons name="search" size={16} color={MUTED} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={MUTED}
        style={s.searchInput}
        autoCorrect={false}
        autoCapitalize={autoCapitalize}
        clearButtonMode="while-editing"
        returnKeyType="search"
      />
    </View>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={s.seg}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={o.value} onPress={() => onChange(o.value)} style={[s.segItem, on && s.segItemOn]}>
            <Text style={[s.segText, on && s.segTextOn]}>{o.label}</Text>
            {typeof o.count === "number" ? (
              <Text style={[s.segCount, on && s.segCountOn]}>{o.count}</Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export function SectionLabel({ numeral, label, count }: { numeral?: string; label: string; count?: number }) {
  return (
    <View style={s.section}>
      {numeral ? <Text style={s.sectionNumeral}>{numeral}.</Text> : null}
      <Text style={s.sectionLabel}>{label}</Text>
      <View style={s.sectionRule} />
      {typeof count === "number" ? <Text style={s.sectionCount}>{String(count).padStart(2, "0")}</Text> : null}
    </View>
  );
}

/** Horizontally scrolling filter chips — for option sets too long for Segmented. */
export function ChipRail<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.rail} style={s.railWrap}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={o.value} onPress={() => onChange(o.value)} style={[s.railChip, on && s.railChipOn]}>
            <Text style={[s.railText, on && s.railTextOn]}>{o.label}</Text>
            {typeof o.count === "number" ? <Text style={[s.segCount, on && s.segCountOn]}>{o.count}</Text> : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export const premiumCard = {
  backgroundColor: colors.light.card,
  borderRadius: radii["2xl"],
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: colors.light.border,
  ...shadows.soft,
  shadowOpacity: 0.06,
} as const;

const s = StyleSheet.create({
  pressed: { transform: [{ scale: 0.96 }], opacity: 0.9 },

  mast: { flexDirection: "row", alignItems: "flex-end", gap: 12, paddingHorizontal: 20, paddingTop: 22, paddingBottom: 14 },
  eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  eyebrowRule: { width: 18, height: 1, backgroundColor: colors.light.primary },
  eyebrow: { fontFamily: fontFamilies.mono.medium, fontSize: 10, color: colors.light.primary, letterSpacing: 2 },
  title: { fontFamily: fontFamilies.display.semibold, fontSize: 34, lineHeight: 40, color: FG, letterSpacing: -1, marginTop: 8 },
  titleItalic: { fontFamily: fontFamilies.display.italic, color: colors.olive[600] },
  subtitle: { fontFamily: fontFamilies.sans.regular, fontSize: 13, lineHeight: 19, color: MUTED, marginTop: 6 },

  addShadow: { borderRadius: 28, ...shadows.editorial },
  addRing: { width: 52, height: 52, borderRadius: 26, padding: 1.5 },
  addInner: { flex: 1, borderRadius: 25, alignItems: "center", justifyContent: "center" },

  band: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginBottom: 14,
    paddingVertical: 16,
    borderRadius: radii["2xl"],
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(200,164,74,0.35)",
  },
  bandRing: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    top: -110,
    right: -50,
    borderWidth: 1,
    borderColor: "rgba(200,164,74,0.16)",
  },
  bandCell: { flex: 1, paddingHorizontal: 14 },
  bandCellBorder: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: "rgba(250,248,241,0.16)" },
  bandValue: { fontFamily: fontFamilies.display.semibold, fontSize: 22, color: CREAM, letterSpacing: -0.4 },
  bandLabel: { fontFamily: fontFamilies.mono.regular, fontSize: 8, color: "rgba(250,248,241,0.55)", letterSpacing: 1.3, marginTop: 3 },

  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 14,
    height: 46,
    borderRadius: radii["2xl"],
    backgroundColor: colors.light.card,
    borderWidth: 1,
    borderColor: "#e0dfd2",
  },
  searchInput: { flex: 1, fontFamily: fontFamilies.sans.regular, fontSize: 14, color: FG, paddingVertical: 0 },

  seg: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginBottom: 14,
    padding: 4,
    borderRadius: radii.full,
    backgroundColor: "#ebeadf",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#d9d8c8",
  },
  segItem: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 9, borderRadius: radii.full },
  segItemOn: { backgroundColor: colors.olive[900], ...shadows.soft },
  segText: { fontFamily: fontFamilies.sans.semibold, fontSize: 13, color: MUTED },
  segTextOn: { color: CREAM },
  segCount: { fontFamily: fontFamilies.mono.medium, fontSize: 10, color: MUTED },
  segCountOn: { color: GOLD },

  railWrap: { flexGrow: 0, marginBottom: 14 },
  rail: { paddingHorizontal: 16, gap: 8 },
  railChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 15,
    height: 36,
    borderRadius: radii.full,
    backgroundColor: colors.light.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#d6d4c4",
  },
  railChipOn: { backgroundColor: colors.olive[900], borderColor: colors.olive[900] },
  railText: { fontFamily: fontFamilies.sans.semibold, fontSize: 13, color: MUTED },
  railTextOn: { color: CREAM },

  section: { flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 10, marginBottom: 10, paddingHorizontal: 4 },
  sectionNumeral: { fontFamily: fontFamilies.display.italic, fontSize: 15, color: colors.olive[500] },
  sectionLabel: { fontFamily: fontFamilies.display.semibold, fontSize: 18, color: FG, letterSpacing: -0.3 },
  sectionRule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.light.border, alignSelf: "center", marginHorizontal: 4 },
  sectionCount: { fontFamily: fontFamilies.mono.regular, fontSize: 10, color: MUTED, letterSpacing: 1 },
});
