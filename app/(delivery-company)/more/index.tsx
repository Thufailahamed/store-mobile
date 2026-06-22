import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@/components/ui/Icon";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { getDeliveryCompanyMe, hasStoreApi } from "@/lib/api/delivery-company-api";
import {
  getDeliveryCompanyAccessState,
  isMoreMenuItemAccessible,
  type MoreMenuItemKind,
} from "@/lib/delivery-company-access";
import type { DeliveryCompany } from "@/lib/api/delivery-company-api";
import { colors, typography, radii } from "@/lib/theme/tokens";

const MENU_ITEMS: {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  href: string;
  kind: MoreMenuItemKind;
}[] = [
  { title: "Drivers", subtitle: "Roster & invites", icon: "people-outline", href: "/(delivery-company)/drivers", kind: "setup" },
  { title: "Warehouses", subtitle: "Hubs & receive", icon: "storefront-outline", href: "/(delivery-company)/warehouses", kind: "setup" },
  { title: "Returns", subtitle: "Driver return pickups", icon: "return-down-back-outline", href: "/(delivery-company)/returns", kind: "operations" },
  { title: "Team", subtitle: "Owners & managers", icon: "shield-outline", href: "/(delivery-company)/team", kind: "setup" },
  { title: "History", subtitle: "Routes & audit log", icon: "time-outline", href: "/(delivery-company)/history", kind: "read" },
  { title: "Settings", subtitle: "Company profile & policies", icon: "settings-outline", href: "/(delivery-company)/settings", kind: "recovery" },
];

export default function CompanyMoreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [company, setCompany] = useState<DeliveryCompany | null>(null);

  const load = useCallback(async () => {
    if (!hasStoreApi()) return;
    const res = await getDeliveryCompanyMe();
    if (res.ok) setCompany(res.data.company);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const access = useMemo(() => getDeliveryCompanyAccessState(company), [company]);

  return (
    <View style={styles.container}>
      <ScreenHeader title="More" showBack={false} />
      {!access.canUseCompanyTools && company ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>
            {access.lockReason ?? "Some tools are locked until your company is active."}
          </Text>
        </View>
      ) : null}
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}>
        {MENU_ITEMS.map((item) => {
          const enabled = isMoreMenuItemAccessible(item.kind, access);
          return (
            <TouchableOpacity
              key={item.href}
              style={[styles.row, !enabled && styles.rowDisabled]}
              onPress={() => {
                if (enabled) router.push(item.href as any);
              }}
              activeOpacity={enabled ? 0.75 : 1}
              disabled={!enabled}
            >
              <View style={[styles.iconWrap, !enabled && styles.iconWrapDisabled]}>
                <Ionicons
                  name={item.icon}
                  size={22}
                  color={enabled ? colors.light.primary : colors.light.mutedForeground}
                />
              </View>
              <View style={styles.body}>
                <Text style={[styles.title, !enabled && styles.titleDisabled]}>{item.title}</Text>
                <Text style={styles.sub}>
                  {enabled ? item.subtitle : "Locked until company is active"}
                </Text>
              </View>
              {enabled ? (
                <Ionicons name="chevron-forward" size={18} color={colors.light.mutedForeground} />
              ) : (
                <Ionicons name="lock-closed-outline" size={16} color={colors.light.mutedForeground} />
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  banner: {
    marginHorizontal: 16,
    marginTop: 8,
    padding: 12,
    borderRadius: radii.md,
    backgroundColor: "#fef3c7",
    borderWidth: 1,
    borderColor: "#fcd34d",
  },
  bannerText: {
    fontSize: typography.fontSizes.sm,
    color: "#92400e",
    lineHeight: 18,
  },
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
  rowDisabled: { opacity: 0.55 },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.light.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapDisabled: { backgroundColor: colors.light.background },
  body: { flex: 1 },
  title: { fontSize: typography.fontSizes.base, fontWeight: typography.fontWeights.semibold, color: colors.light.foreground },
  titleDisabled: { color: colors.light.mutedForeground },
  sub: { fontSize: typography.fontSizes.sm, color: colors.light.mutedForeground, marginTop: 2 },
});
