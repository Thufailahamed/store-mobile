import React, { useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, TextInput, Alert, RefreshControl } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Ionicons } from "@/components/ui/Icon";
import { getAdminUsers, updateUserRole } from "@/lib/api";
import { EmptyState, Skeleton } from "@/components/ui";
import { colors, radii, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { resolveImageUrl } from "@/lib/utils";

const ROLES = ["all", "customer", "store_owner", "brand_owner", "influencer", "admin"];

const ROLE_TONES: Record<string, { bg: string; text: string; icon: keyof typeof Ionicons.glyphMap }> = {
  customer: { bg: colors.light.muted, text: colors.light.mutedForeground, icon: "person-outline" },
  store_owner: { bg: "rgba(83,94,44,0.14)", text: colors.olive[800], icon: "storefront-outline" },
  brand_owner: { bg: "rgba(200,164,74,0.20)", text: "#8a6a2a", icon: "pricetag-outline" },
  influencer: { bg: "rgba(200,164,74,0.20)", text: "#8a6a2a", icon: "sparkles-outline" },
  admin: { bg: colors.olive[900], text: colors.paper.cream, icon: "shield-checkmark-outline" },
};

function roleLabel(role: string) {
  return role.replace(/_/g, " ");
}

function rel(s?: string) {
  if (!s) return "";
  const d = new Date(s).getTime();
  const m = Math.floor((Date.now() - d) / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function AdminUsers() {
  const queryClient = useQueryClient();
  const [role, setRole] = useState("all");
  const [search, setSearch] = useState("");

  const usersQuery = useQuery({
    queryKey: ["admin-users", role, search],
    queryFn: async () => {
      const res = await getAdminUsers({ role, search });
      if (res.ok) return { users: res.data.users, total: res.data.total, error: null as string | null };
      return { users: [], total: 0, error: res.error ?? "Failed to load users" };
    },
  });

  const roleMutation = useMutation({
    mutationFn: ({ userId, newRole }: { userId: string; newRole: string }) =>
      updateUserRole(userId, newRole),
    onSuccess: (res) => {
      if (!res.ok) {
        Alert.alert("Couldn't change role", res.error);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e) => {
      Alert.alert("Couldn't change role", e instanceof Error ? e.message : "Try again.");
    },
  });

  const users = usersQuery.data?.users ?? [];
  const loadError = usersQuery.data?.error ?? null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>PEOPLE</Text>
          <Text style={styles.title}>Users</Text>
          <Text style={styles.subtitle}>
            {usersQuery.data?.total ? `${usersQuery.data.total} accounts` : "Platform accounts & roles"}
          </Text>
        </View>
      </View>

      <TextInput
        style={styles.search}
        placeholder="Search by name or email…"
        placeholderTextColor={colors.light.mutedForeground}
        value={search}
        onChangeText={setSearch}
      />

      <FlatList
        horizontal
        data={ROLES}
        keyExtractor={(r) => r}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabs}
        renderItem={({ item: tab }) => (
          <Pressable
            style={[styles.tab, role === tab && styles.tabActive]}
            onPress={() => setRole(tab)}
          >
            <Text style={[styles.tabText, role === tab && styles.tabTextActive]}>
              {tab === "all" ? "All" : roleLabel(tab)}
            </Text>
          </Pressable>
        )}
      />

      {usersQuery.isLoading ? (
        <View style={styles.list}>
          <Skeleton height={72} style={{ borderRadius: radii.xl }} />
          <Skeleton height={72} style={{ borderRadius: radii.xl }} />
          <Skeleton height={72} style={{ borderRadius: radii.xl }} />
        </View>
      ) : loadError ? (
        <EmptyState icon="cloud-offline-outline" title="Couldn't load users" description={loadError} />
      ) : users.length === 0 ? (
        <EmptyState
          icon="people-outline"
          title="No users found"
          description="No accounts match this role or search."
        />
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={usersQuery.isFetching}
              onRefresh={() => usersQuery.refetch()}
              tintColor={colors.light.primary}
            />
          }
          renderItem={({ item }) => {
            const tone = ROLE_TONES[item.role] ?? ROLE_TONES.customer;
            const avatar = item.avatar_url ? resolveImageUrl(item.avatar_url) || item.avatar_url : null;
            return (
              <View style={styles.userCard}>
                <View style={styles.userRow}>
                  {avatar ? (
                    <Image source={{ uri: avatar }} style={styles.avatar} contentFit="cover" />
                  ) : (
                    <View style={[styles.avatar, styles.avatarFallback]}>
                      <Text style={styles.avatarText}>
                        {(item.full_name ?? item.email ?? "?").charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={styles.userInfo}>
                    <Text style={styles.userName} numberOfLines={1}>{item.full_name ?? "Unnamed"}</Text>
                    <Text style={styles.userEmail} numberOfLines={1}>{item.email ?? item.phone ?? "—"}</Text>
                    <View style={styles.userMetaRow}>
                      <View style={[styles.rolePill, { backgroundColor: tone.bg }]}>
                        <Ionicons name={tone.icon} size={9} color={tone.text} />
                        <Text style={[styles.rolePillText, { color: tone.text }]}>{roleLabel(item.role)}</Text>
                      </View>
                      {item.created_at ? (
                        <Text style={styles.joined}>{rel(item.created_at)}</Text>
                      ) : null}
                    </View>
                  </View>
                  <Pressable
                    style={styles.roleBtn}
                    disabled={roleMutation.isPending}
                    onPress={() => {
                      const otherRoles = ROLES.filter((r) => r !== "all" && r !== item.role);
                      Alert.alert("Change role", `Change role for ${item.full_name ?? "this user"}:`, [
                        ...otherRoles.map((r) => ({
                          text: roleLabel(r),
                          onPress: () => roleMutation.mutate({ userId: item.id, newRole: r }),
                        })),
                        { text: "Cancel", style: "cancel" },
                      ]);
                    }}
                  >
                    <Ionicons name="swap-horizontal-outline" size={13} color={colors.olive[800]} />
                    <Text style={styles.roleBtnText}>Role</Text>
                  </Pressable>
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", padding: 20, paddingBottom: 12 },
  eyebrow: { fontFamily: fontFamilies.mono.medium, fontSize: 10, color: colors.light.primary, letterSpacing: 1.4 },
  title: { fontFamily: fontFamilies.display.regular, fontSize: 28, color: colors.light.foreground, marginTop: 4, letterSpacing: -0.5 },
  subtitle: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: colors.light.mutedForeground, marginTop: 4 },
  search: {
    marginHorizontal: 20,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.light.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.light.border,
    fontSize: 14,
    color: colors.light.foreground,
  },
  tabs: { paddingHorizontal: 20, gap: 8, paddingBottom: 12 },
  tab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: radii.full, backgroundColor: colors.light.card, borderWidth: 1, borderColor: colors.light.border },
  tabActive: { backgroundColor: colors.light.primary, borderColor: colors.light.primary },
  tabText: { fontFamily: fontFamilies.mono.medium, fontSize: 10, color: colors.light.mutedForeground, letterSpacing: 0.5, textTransform: "uppercase" },
  tabTextActive: { color: "#fff" },
  list: { padding: 20, paddingTop: 0, paddingBottom: 100, gap: 10 },
  userCard: {
    backgroundColor: colors.light.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.light.border,
    padding: 14,
    ...shadows.soft,
  },
  userRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.olive[100] },
  avatarFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.olive[800],
  },
  avatarText: { fontFamily: fontFamilies.display.semibold, fontSize: 17, color: colors.paper.cream },
  userInfo: { flex: 1, gap: 2 },
  userName: { fontFamily: fontFamilies.sans.semibold, fontSize: 14, color: colors.light.foreground },
  userEmail: { fontFamily: fontFamilies.sans.regular, fontSize: 11.5, color: colors.light.mutedForeground },
  userMetaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  rolePill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.full },
  rolePillText: { fontFamily: fontFamilies.mono.semibold, fontSize: 9, letterSpacing: 0.5, textTransform: "uppercase" },
  joined: { fontFamily: fontFamilies.mono.regular, fontSize: 9.5, color: colors.light.mutedForeground },
  roleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.full,
    backgroundColor: "#f8f6f0",
    borderWidth: 1,
    borderColor: "#e4dfd3",
  },
  roleBtnText: { fontFamily: fontFamilies.sans.semibold, fontSize: 11, color: colors.olive[800] },
});
