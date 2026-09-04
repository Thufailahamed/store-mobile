import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { ScreenHeader } from "@/components/layout";
import { Body, Label } from "@/components/ui/Typography";
import { colors, spacing } from "@/lib/theme/tokens";

const LINKS = [
  { label: "Smart search", route: "/(main)/ai/search" },
  { label: "Outfit builder", route: "/(main)/ai/outfit" },
  { label: "Trends", route: "/(main)/ai/trends" },
];

export function AiPageShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <View style={styles.screen}>
      <ScreenHeader title={title} onBack={() => router.back()} />
      <View style={styles.nav}>
        {LINKS.map((l) => (
          <TouchableOpacity key={l.route} onPress={() => router.push(l.route as never)}>
            <Label style={styles.navLink}>{l.label}</Label>
          </TouchableOpacity>
        ))}
      </View>
      <Body muted size="sm" style={styles.desc}>{description}</Body>
      {children}
      <Body muted size="xs" style={styles.disclaimer}>AI suggestions, not endorsements.</Body>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.light.background },
  nav: { flexDirection: "row", gap: 16, paddingHorizontal: spacing[5], paddingTop: 8 },
  navLink: { color: colors.olive[700], fontSize: 11, letterSpacing: 0.4 },
  desc: { paddingHorizontal: spacing[5], paddingTop: 8, paddingBottom: 12 },
  disclaimer: { paddingHorizontal: spacing[5], paddingVertical: 16, textAlign: "center" },
});
