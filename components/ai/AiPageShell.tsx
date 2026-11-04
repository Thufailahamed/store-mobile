import React from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { useRouter, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@/components/ui/Icon";
import { UP as C, UserPageFrame } from "@/components/user/user-page";
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

/** Shared frame for the LUXE AI tools: Orders-style header + glow, a tab
 *  strip of chips between the tools, and the AI disclaimer footer. */
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
  const insets = useSafeAreaInsets();
  return (
    <UserPageFrame title={title} onBack={() => router.back()}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.navScroll}
        contentContainerStyle={styles.nav}
      >
        {LINKS.map((l) => {
          const slug = l.route.split("/").pop() ?? "";
          const active = pathname.endsWith(`/ai/${slug}`);
          return (
            <TouchableOpacity
              key={l.route}
              // replace, not push: hopping between tools shouldn't stack
              // history so Back always returns to where the user came from.
              onPress={() => !active && router.replace(l.route as never)}
              style={[styles.navChip, active && styles.navChipActive]}
              activeOpacity={0.8}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Ionicons name={l.icon} size={16} color={active ? C.lime : C.accent} />
              <Text style={[styles.navLink, active && styles.navLinkActive]}>{l.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      {description ? <Text style={styles.desc}>{description}</Text> : null}
      <View style={{ flex: 1 }}>{children}</View>
      <View style={[styles.disclaimerRow, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Ionicons name="information-circle-outline" size={13} color={C.muted} />
        <Text style={styles.disclaimer}>AI suggestions, not endorsements.</Text>
      </View>
    </UserPageFrame>
  );
}

const styles = StyleSheet.create({
  navScroll: { flexGrow: 0 },
  nav: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 12,
  },
  navChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    height: 42,
    paddingHorizontal: 16,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.card,
  },
  navChipActive: { backgroundColor: C.ink, borderColor: C.ink },
  navLink: { color: C.text, fontSize: 13.5, fontFamily: fontFamilies.sans.semibold },
  navLinkActive: { color: "#FFFFFF" },
  desc: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    fontSize: 13.5,
    lineHeight: 19,
    fontFamily: fontFamilies.sans.regular,
    color: C.muted,
  },
  disclaimerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 20,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: C.line,
    backgroundColor: C.paper,
  },
  disclaimer: { fontSize: 12, fontFamily: fontFamilies.sans.medium, color: C.muted },
});
