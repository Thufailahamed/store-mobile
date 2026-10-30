import React from "react";
import { View, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { useRouter, usePathname } from "expo-router";
import { ScreenHeader } from "@/components/layout";
import { Body, Label } from "@/components/ui/Typography";
import { Ionicons } from "@/components/ui/Icon";
import { colors, radii, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

const LINKS = [
  {
    label: "Stylist",
    route: "/(main)/ai/stylist",
    icon: "chatbubble-ellipses-outline" as const,
  },
  {
    label: "Smart search",
    route: "/(main)/ai/search",
    icon: "sparkles-outline" as const,
  },
  {
    label: "Outfit builder",
    route: "/(main)/ai/outfit",
    icon: "shirt-outline" as const,
  },
  {
    label: "Trends",
    route: "/(main)/ai/trends",
    icon: "trending-up-outline" as const,
  },
];

export function AiPageShell({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <View style={styles.screen}>
      <ScreenHeader title={title} onBack={() => router.back()} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.navScroll}
        contentContainerStyle={styles.nav}
      >
        {LINKS.map((l) => {
          const active = pathname === l.route.replace(/^\(main\)/, "") ||
            pathname.endsWith(l.route.split("/").pop() ?? "");
          return (
            <TouchableOpacity
              key={l.route}
              onPress={() => !active && router.push(l.route as never)}
              style={[styles.navChip, active && styles.navChipActive]}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Ionicons
                name={l.icon}
                size={13}
                color={active ? colors.accent2.ochre : colors.olive[700]}
              />
              <Label style={[styles.navLink, active && styles.navLinkActive]}>
                {l.label}
              </Label>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      {description ? (
        <Body muted size="sm" style={styles.desc}>{description}</Body>
      ) : null}
      {children}
      <View style={styles.disclaimerRow}>
        <Ionicons
          name="information-circle-outline"
          size={11}
          color={colors.light.mutedForeground}
        />
        <Body muted size="xs" style={styles.disclaimer}>
          AI suggestions, not endorsements.
        </Body>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.light.background },
  navScroll: { flexGrow: 0 },
  nav: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: spacing[5],
    paddingVertical: 12,
  },
  navChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: `${colors.ink.DEFAULT}0F`,
    backgroundColor: "#ffffff",
    shadowColor: colors.ink.DEFAULT,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  navChipActive: {
    backgroundColor: colors.olive[950],
    borderColor: colors.olive[950],
    shadowColor: colors.olive[950],
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  navLink: {
    color: colors.olive[800],
    fontSize: 11,
    letterSpacing: 0.6,
    fontFamily: fontFamilies.sans.semibold,
  },
  navLinkActive: { color: colors.paper.cream },
  desc: { paddingHorizontal: spacing[5], paddingTop: 10, paddingBottom: 4 },
  disclaimerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: spacing[5],
    paddingVertical: 14,
  },
  disclaimer: { textAlign: "center" },
});
