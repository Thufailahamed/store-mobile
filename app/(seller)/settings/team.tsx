import React, { useState } from "react";
import { View, Text, TextInput, Pressable, FlatList, ActivityIndicator, Alert, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getSellerTeamBackend,
  inviteSellerTeamBackend,
  removeSellerTeamMemberBackend,
  resendSellerTeamInviteBackend,
  type SellerTeamMember,
  type SellerTeamInvite,
} from "@/lib/api/backend";
import { colors, radii, spacing, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

const ROLES = ["staff", "manager"] as const;

export default function SellerTeamScreen() {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<(typeof ROLES)[number]>("staff");

  const team = useQuery({
    queryKey: ["sellerTeam"],
    queryFn: async () => {
      const res = await getSellerTeamBackend();
      if (!res.ok) throw new Error(res.error);
      return res.data;
    },
  });

  const inviteMut = useMutation({
    mutationFn: inviteSellerTeamBackend,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sellerTeam"] });
      setEmail("");
    },
    onError: (e) => Alert.alert("Could not invite", String((e as Error).message ?? e)),
  });

  const removeMut = useMutation({
    mutationFn: removeSellerTeamMemberBackend,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sellerTeam"] }),
    onError: (e) => Alert.alert("Could not remove", String((e as Error).message ?? e)),
  });

  const resendMut = useMutation({
    mutationFn: resendSellerTeamInviteBackend,
    onSuccess: () => Alert.alert("Invite resent"),
    onError: (e) => Alert.alert("Could not resend", String((e as Error).message ?? e)),
  });

  if (team.isLoading) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: "Team" }} />
        <ActivityIndicator />
      </View>
    );
  }
  if (team.isError) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: "Team" }} />
        <Text style={styles.body}>Could not load team.</Text>
      </View>
    );
  }

  const members = team.data?.members ?? [];
  const invites = team.data?.invites ?? [];

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <Stack.Screen options={{ title: "Team" }} />
      <View style={styles.inviteBox}>
        <Text style={styles.sectionTitle}>Invite member</Text>
        <TextInput
          placeholder="email@example.com"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          style={styles.input}
        />
        <View style={styles.roleRow}>
          {ROLES.map((r) => (
            <Pressable
              key={r}
              onPress={() => setRole(r)}
              style={[styles.roleChip, role === r && styles.roleChipActive]}
            >
              <Text style={[styles.roleChipText, role === r && styles.roleChipTextActive]}>{r}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable
          onPress={() => email && inviteMut.mutate({ email, role })}
          disabled={!email || inviteMut.isPending}
          style={[styles.primaryButton, (!email || inviteMut.isPending) && styles.primaryButtonDisabled]}
        >
          <Text style={styles.primaryButtonText}>{inviteMut.isPending ? "Sending…" : "Send invite"}</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>Members ({members.length})</Text>
      <FlatList
        data={members}
        keyExtractor={(m) => m.id}
        renderItem={({ item }: { item: SellerTeamMember }) => (
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{item.user?.full_name ?? item.user?.email ?? "Member"}</Text>
              <Text style={styles.rowSubtitle}>{item.role}</Text>
            </View>
            <Pressable
              onPress={() =>
                Alert.alert("Remove member?", "This cannot be undone.", [
                  { text: "Cancel" },
                  { text: "Remove", style: "destructive", onPress: () => removeMut.mutate(item.id) },
                ])
              }
            >
              <Text style={styles.destructiveText}>Remove</Text>
            </Pressable>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No members yet.</Text>}
      />

      {invites.length > 0 ? <Text style={styles.sectionTitle}>Pending invites ({invites.length})</Text> : null}
      <FlatList
        data={invites}
        keyExtractor={(i) => i.id}
        renderItem={({ item }: { item: SellerTeamInvite }) => (
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{item.email}</Text>
              <Text style={styles.rowSubtitle}>
                {item.role} · expires {item.expires_at ? new Date(item.expires_at).toLocaleDateString() : "—"}
              </Text>
            </View>
            <Pressable onPress={() => resendMut.mutate(item.id)}>
              <Text style={styles.linkText}>Resend</Text>
            </Pressable>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background, padding: spacing[5], gap: spacing[3] },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.light.background },
  inviteBox: { backgroundColor: colors.light.card, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.light.border, padding: spacing[4], gap: spacing[3] },
  sectionTitle: { fontFamily: fontFamilies.sans.semibold, fontSize: typography.fontSizes.sm, color: colors.light.foreground, marginTop: spacing[3] },
  input: { borderWidth: 1, borderColor: colors.light.border, borderRadius: radii.md, padding: spacing[3], fontFamily: fontFamilies.sans.regular, color: colors.light.foreground },
  roleRow: { flexDirection: "row", gap: spacing[2] },
  roleChip: { paddingVertical: spacing[2], paddingHorizontal: spacing[3], borderRadius: radii.full, backgroundColor: colors.light.muted },
  roleChipActive: { backgroundColor: colors.light.primary },
  roleChipText: { fontFamily: fontFamilies.sans.medium, fontSize: typography.fontSizes.sm, color: colors.light.foreground, textTransform: "capitalize" },
  roleChipTextActive: { color: colors.light.primaryForeground },
  primaryButton: { backgroundColor: colors.light.primary, padding: spacing[3], borderRadius: radii.md, alignItems: "center" },
  primaryButtonDisabled: { opacity: 0.5 },
  primaryButtonText: { fontFamily: fontFamilies.sans.semibold, color: colors.light.primaryForeground },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: spacing[3], borderBottomWidth: 1, borderColor: colors.light.border },
  rowTitle: { fontFamily: fontFamilies.sans.medium, color: colors.light.foreground },
  rowSubtitle: { fontFamily: fontFamilies.sans.regular, fontSize: typography.fontSizes.sm, color: colors.light.mutedForeground, textTransform: "capitalize" },
  empty: { fontFamily: fontFamilies.sans.regular, color: colors.light.mutedForeground, padding: spacing[3] },
  destructiveText: { fontFamily: fontFamilies.sans.medium, color: colors.light.destructive ?? "#c00" },
  linkText: { fontFamily: fontFamilies.sans.medium, color: colors.light.primary },
  body: { fontFamily: fontFamilies.sans.regular, color: colors.light.foreground, padding: spacing[4] },
});
