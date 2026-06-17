import React from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { colors, typography, radii } from "@/lib/theme/tokens";

const MENU_ITEMS: {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  href: string;
}[] = [
  { title: "Drivers", subtitle: "Roster & invites", icon: "people-outline", href: "/(delivery-company)/drivers" },
  { title: "Warehouses", subtitle: "Hubs & receive", icon: "storefront-outline", href: "/(delivery-company)/warehouses" },
  { title: "Returns", subtitle: "Driver return pickups", icon: "return-down-back-outline", href: "/(delivery-company)/returns" },
  { title: "Team", subtitle: "Owners & managers", icon: "shield-outline", href: "/(delivery-company)/team" },
  { title: "History", subtitle: "Routes & audit log", icon: "time-outline", href: "/(delivery-company)/history" },
  { title: "Settings", subtitle: "Company profile & policies", icon: "settings-outline", href: "/(delivery-company)/settings" },
];

export default function CompanyMoreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <ScreenHeader title="More" showBack={false} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}>
        {MENU_ITEMS.map((item) => (
          <TouchableOpacity
            key={item.href}
            style={styles.row}
            onPress={() => router.push(item.href as any)}
            activeOpacity={0.75}
          >
            <View style={styles.iconWrap}>
              <Ionicons name={item.icon} size={22} color={colors.light.primary} />
            </View>
            <View style={styles.body}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.sub}>{item.subtitle}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.light.mutedForeground} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.light.card,
    borderRadius: radii.lg,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.light.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1 },
  title: { fontSize: typography.fontSizes.base, fontWeight: typography.fontWeights.semibold, color: colors.light.foreground },
  sub: { fontSize: typography.fontSizes.sm, color: colors.light.mutedForeground, marginTop: 2 },
});
