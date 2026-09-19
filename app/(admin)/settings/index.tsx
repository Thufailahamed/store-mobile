import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { Ionicons } from "@/components/ui/Icon";
import { StatusDot } from "@/components/ui";
import { useAuth } from "@/lib/supabase/auth";
import { colors, radii, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

interface InfoRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  last?: boolean;
}

function InfoRow({ icon, label, value, last }: InfoRowProps) {
  return (
    <View style={[styles.infoRow, !last && styles.infoRowBorder]}>
      <View style={styles.infoIcon}>
        <Ionicons name={icon} size={15} color={colors.olive[700]} />
      </View>
      <View style={styles.infoBody}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

export default function AdminSettings() {
  const { user, signOut } = useAuth();
  const name = user?.user_metadata?.full_name ?? "Admin";
  const email = user?.email ?? "—";

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>ADMIN CONSOLE</Text>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>Your console account and session.</Text>
      </View>

      {/* Profile card */}
      <View style={styles.profile}>
        <View style={styles.profileRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(name ?? "A").charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{name}</Text>
            <Text style={styles.profileEmail}>{email}</Text>
            <View style={styles.profileRolePill}>
              <StatusDot tone="live" size={6} />
              <Text style={styles.profileRole}>Platform Administrator</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Account details */}
      <Text style={styles.sectionLabel}>ACCOUNT</Text>
      <View style={styles.card}>
        <InfoRow icon="person-outline" label="Name" value={name} />
        <InfoRow icon="mail-outline" label="Email" value={email} />
        <InfoRow icon="shield-checkmark-outline" label="Role" value="Platform Administrator" last />
      </View>

      {/* Session */}
      <Text style={styles.sectionLabel}>SESSION</Text>
      <Pressable
        onPress={() => signOut()}
        style={({ pressed }) => [styles.signOut, pressed && styles.pressed]}
      >
        <Ionicons name="log-out-outline" size={18} color={colors.accent2.rust} />
        <Text style={styles.signOutText}>Sign out of Console</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  content: { paddingBottom: 120 },
  hero: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 },
  eyebrow: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    color: colors.light.primary,
    letterSpacing: 1.4,
  },
  title: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 28,
    color: colors.light.foreground,
    letterSpacing: -0.6,
    marginTop: 2,
  },
  subtitle: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: colors.light.mutedForeground,
    marginTop: 4,
  },
  profile: {
    marginHorizontal: 16,
    marginTop: 14,
    padding: 16,
    backgroundColor: colors.olive[900],
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.olive[800],
    ...shadows.soft,
  },
  profileRow: { flexDirection: "row", gap: 14, alignItems: "center" },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(244,242,234,0.12)",
    borderWidth: 1,
    borderColor: colors.accent2.ochre,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 20,
    color: colors.accent2.ochre,
  },
  profileInfo: { flex: 1, gap: 2 },
  profileName: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 16,
    color: colors.paper.cream,
  },
  profileEmail: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    color: "rgba(244,242,234,0.55)",
  },
  profileRolePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    backgroundColor: "rgba(212,169,60,0.15)",
  },
  profileRole: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9,
    color: colors.accent2.ochre,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  sectionLabel: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    color: colors.light.mutedForeground,
    letterSpacing: 1.2,
    marginTop: 22,
    marginBottom: 10,
    paddingHorizontal: 16,
  },
  card: {
    marginHorizontal: 16,
    backgroundColor: colors.light.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.light.border,
    overflow: "hidden",
    ...shadows.soft,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  infoRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.light.border,
  },
  infoIcon: {
    width: 30,
    height: 30,
    borderRadius: radii.md,
    backgroundColor: "#e6e6d0",
    alignItems: "center",
    justifyContent: "center",
  },
  infoBody: { flex: 1, gap: 1 },
  infoLabel: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9,
    color: colors.light.mutedForeground,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  infoValue: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: colors.light.foreground,
  },
  signOut: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "rgba(184,92,58,0.08)",
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: "rgba(184,92,58,0.22)",
  },
  pressed: { opacity: 0.7 },
  signOutText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: colors.accent2.rust,
    letterSpacing: 0.5,
  },
});
