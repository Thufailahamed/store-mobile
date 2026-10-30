import React, { useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, Alert, RefreshControl, ScrollView, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Ionicons } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { getAdminUsers, updateUserRole } from "@/lib/api";
import { EmptyState, Skeleton, Button, useToast } from "@/components/ui";
import { colors, radii, shadows } from "@/lib/theme/tokens";
import { AdminMasthead, StatBand, SearchField, ChipRail, GOLD, CREAM } from "@/components/admin/premium-kit";
import { fontFamilies } from "@/lib/theme/fonts";
import { resolveImageUrl } from "@/lib/utils";
import type { User } from "@/lib/types";

const ROLES = ["all", "customer", "store_owner", "brand_owner", "influencer", "admin"] as const;

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

const ROLE_INFO: Record<string, { label: string; desc: string }> = {
  customer: { label: "Customer", desc: "Shops and buys on LUXE" },
  store_owner: { label: "Store owner", desc: "Runs a storefront" },
  brand_owner: { label: "Brand owner", desc: "Manages a brand catalogue" },
  influencer: { label: "Influencer", desc: "Creates content, earns commission" },
  admin: { label: "Admin", desc: "Full platform access" },
};

function rel(s?: string) {
  if (!s) return "";
  const d = new Date(s).getTime();
  const m = Math.floor((Date.now() - d) / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

type RoleFilter = (typeof ROLES)[number];

const RING: Record<string, [string, string]> = {
  admin: ["#e3c878", "#9c7a2c"],
  store_owner: [colors.olive[400], colors.olive[700]],
  brand_owner: ["#e3c878", "#b38a33"],
  influencer: ["#e7b9a2", "#b85c3a"],
  customer: ["#dddccd", "#bdbbaa"],
};

export default function AdminUsers() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [role, setRole] = useState<RoleFilter>("all");
  const [search, setSearch] = useState("");
  const [sheetUser, setSheetUser] = useState<User | null>(null);

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
      toast.success("Role updated");
      setSheetUser(null);
    },
    onError: (e) => {
      Alert.alert("Couldn't change role", e instanceof Error ? e.message : "Try again.");
    },
  });

  const users = usersQuery.data?.users ?? [];
  const loadError = usersQuery.data?.error ?? null;
  const total = usersQuery.data?.total ?? 0;

  return (
    <View style={styles.container}>
      <FlatList
        data={usersQuery.isLoading || loadError ? [] : users}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={usersQuery.isFetching && !usersQuery.isLoading}
            onRefresh={() => usersQuery.refetch()}
            tintColor={colors.light.primary}
          />
        }
        ListHeaderComponent={
          <View>
            <AdminMasthead
              eyebrow="People"
              title="Member"
              italic="Directory"
              subtitle="Every account on LUXE — shoppers, ateliers, brands and staff."
            />
            <StatBand
              items={[
                { label: role === "all" ? "Accounts" : roleLabel(role), value: total, accent: true },
                { label: "Showing", value: users.length },
                { label: "Roles", value: ROLES.length - 1 },
              ]}
            />
            <SearchField value={search} onChangeText={setSearch} placeholder="Search by name or email…" />
            <ChipRail<RoleFilter>
              value={role}
              onChange={setRole}
              options={ROLES.map((r) => ({ value: r, label: r === "all" ? "All" : roleLabel(r).replace(/^\w/, (c) => c.toUpperCase()) }))}
            />
            {users.length ? (
              <View style={styles.cardTop}>
                <Text style={styles.cardTopText}>{users.length} {users.length === 1 ? "MEMBER" : "MEMBERS"}</Text>
                <Text style={styles.cardTopHint}>Tap a member to change role</Text>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          usersQuery.isLoading ? (
            <View style={{ paddingHorizontal: 16, gap: 10 }}>
              <Skeleton height={72} style={{ borderRadius: radii.xl }} />
              <Skeleton height={72} style={{ borderRadius: radii.xl }} />
              <Skeleton height={72} style={{ borderRadius: radii.xl }} />
            </View>
          ) : loadError ? (
            <EmptyState icon="cloud-offline-outline" title="Couldn't load users" description={loadError} />
          ) : (
            <EmptyState icon="people-outline" title="No members found" description="No accounts match this role or search." />
          )
        }
        renderItem={({ item, index }) => {
          const tone = ROLE_TONES[item.role] ?? ROLE_TONES.customer;
          const ring = RING[item.role] ?? RING.customer;
          const avatar = item.avatar_url ? resolveImageUrl(item.avatar_url) || item.avatar_url : null;
          const first = index === 0;
          const last = index === users.length - 1;
          return (
            <Pressable
              onPress={() => setSheetUser(item)}
              disabled={roleMutation.isPending}
              style={({ pressed }) => [
                styles.row,
                first && styles.rowFirst,
                last && styles.rowLast,
                pressed && styles.rowPressed,
              ]}
            >
              <LinearGradient colors={ring} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ring}>
                {avatar ? (
                  <Image source={{ uri: avatar }} style={styles.avatar} contentFit="cover" />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback]}>
                    <Text style={styles.avatarText}>
                      {(item.full_name ?? item.email ?? "?").charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
              </LinearGradient>
              <View style={[styles.rowBody, !last && styles.rowDivider]}>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={[styles.userName, !item.full_name && styles.userNameMissing]} numberOfLines={1}>
                    {item.full_name ?? "Unnamed member"}
                  </Text>
                  <Text style={styles.userEmail} numberOfLines={1}>{item.email ?? item.phone ?? "No contact on file"}</Text>
                  <View style={styles.metaRow}>
                    <View style={[styles.rolePill, { backgroundColor: tone.bg }]}>
                      <Ionicons name={tone.icon} size={9} color={tone.text} />
                      <Text style={[styles.rolePillText, { color: tone.text }]}>{roleLabel(item.role)}</Text>
                    </View>
                    {item.created_at ? <Text style={styles.joined}>Joined {rel(item.created_at)}</Text> : null}
                  </View>
                </View>
                <Ionicons name="ellipsis-horizontal" size={16} color={colors.light.mutedForeground} />
              </View>
            </Pressable>
          );
        }}
      />

      <RoleSheet
        key={sheetUser?.id ?? "none"}
        user={sheetUser}
        saving={roleMutation.isPending}
        onClose={() => setSheetUser(null)}
        onSave={(newRole) => sheetUser && roleMutation.mutate({ userId: sheetUser.id, newRole })}
      />
    </View>
  );
}

function RoleSheet({
  user,
  saving,
  onClose,
  onSave,
}: {
  user: User | null;
  saving: boolean;
  onClose: () => void;
  onSave: (role: string) => void;
}) {
  const [selected, setSelected] = useState<string>(user?.role ?? "customer");
  if (!user) return null;

  const ring = RING[user.role] ?? RING.customer;
  const avatar = user.avatar_url ? resolveImageUrl(user.avatar_url) || user.avatar_url : null;
  const changed = selected !== user.role;
  const roles = ROLES.filter((r) => r !== "all");

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <Pressable style={styles.sheetScrim} onPress={onClose} accessibilityLabel="Close" />
        <View style={styles.sheet}>
          <View style={styles.grabber} />

          <View style={styles.sheetHeader}>
            <LinearGradient colors={ring} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.sheetRing}>
              {avatar ? (
                <Image source={{ uri: avatar }} style={styles.sheetAvatar} contentFit="cover" />
              ) : (
                <View style={[styles.sheetAvatar, styles.sheetAvatarFallback]}>
                  <Text style={styles.sheetAvatarText}>
                    {(user.full_name ?? user.email ?? "?").charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
            </LinearGradient>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={styles.sheetName} numberOfLines={1}>
                {user.full_name ?? <Text style={styles.sheetNameMissing}>Unnamed member</Text>}
              </Text>
              <Text style={styles.sheetEmail} numberOfLines={1}>{user.email ?? user.phone ?? "No contact on file"}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={6} style={({ pressed }) => [styles.sheetClose, pressed && { opacity: 0.6 }]} accessibilityLabel="Close">
              <Ionicons name="close" size={20} color={colors.light.mutedForeground} />
            </Pressable>
          </View>

          <View style={styles.sheetMetaRow}>
            {user.created_at ? (
              <View style={styles.metaChip}>
                <Ionicons name="calendar-outline" size={11} color={colors.light.mutedForeground} />
                <Text style={styles.metaChipText}>Joined {rel(user.created_at)}</Text>
              </View>
            ) : null}
            {user.phone ? (
              <View style={styles.metaChip}>
                <Ionicons name="call-outline" size={11} color={colors.light.mutedForeground} />
                <Text style={styles.metaChipText} numberOfLines={1}>{user.phone}</Text>
              </View>
            ) : null}
            {typeof user.loyalty_points === "number" && user.loyalty_points > 0 ? (
              <View style={styles.metaChip}>
                <Ionicons name="sparkles-outline" size={11} color={GOLD} />
                <Text style={styles.metaChipText}>{user.loyalty_points.toLocaleString()} pts</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.sheetRule} />
          <Text style={styles.sheetSection}>Assign role</Text>

          <ScrollView style={styles.sheetScroll} contentContainerStyle={styles.sheetScrollContent} showsVerticalScrollIndicator={false}>
            {roles.map((r) => {
              const on = selected === r;
              const tone = ROLE_TONES[r] ?? ROLE_TONES.customer;
              const info = ROLE_INFO[r];
              return (
                <Pressable
                  key={r}
                  onPress={() => setSelected(r)}
                  style={({ pressed }) => [styles.roleOpt, on && styles.roleOptOn, pressed && { transform: [{ scale: 0.99 }] }]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                >
                  {on ? <View style={styles.roleOptRing} /> : null}
                  <View style={[styles.roleOptIcon, { backgroundColor: on ? "rgba(250,248,241,0.16)" : tone.bg }]}>
                    <Ionicons name={tone.icon} size={16} color={on ? CREAM : tone.text} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[styles.roleOptLabel, on && styles.roleOptLabelOn]}>{info?.label ?? roleLabel(r)}</Text>
                    <Text style={[styles.roleOptDesc, on && styles.roleOptDescOn]}>{info?.desc}</Text>
                  </View>
                  {r === user.role ? <View style={styles.currentTag}><Text style={styles.currentTagText}>CURRENT</Text></View> : null}
                  {on ? (
                    <Ionicons name="checkmark-circle" size={20} color={GOLD} />
                  ) : (
                    <View style={styles.radio} />
                  )}
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.sheetFooter}>
            <Button variant="outline" size="lg" onPress={onClose} style={styles.sheetCancel} disabled={saving}>
              Cancel
            </Button>
            <Button variant="brand" size="lg" onPress={() => onSave(selected)} loading={saving} disabled={!changed} style={styles.sheetSave}>
              {changed ? "Save role" : "No change"}
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  list: { paddingBottom: 140 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginHorizontal: 20, marginBottom: 10 },
  cardTopText: { fontFamily: fontFamilies.mono.medium, fontSize: 9.5, color: colors.light.mutedForeground, letterSpacing: 1.6 },
  cardTopHint: { fontFamily: fontFamilies.sans.regular, fontSize: 11, color: colors.light.mutedForeground },

  // Rows render as one continuous card: first/last rows carry the radius.
  row: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    paddingLeft: 14,
    backgroundColor: colors.light.card,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: colors.light.border,
  },
  rowFirst: { borderTopWidth: StyleSheet.hairlineWidth, borderTopLeftRadius: radii["2xl"], borderTopRightRadius: radii["2xl"] },
  rowLast: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomLeftRadius: radii["2xl"], borderBottomRightRadius: radii["2xl"] },
  rowPressed: { backgroundColor: "#f1f0e6" },
  ring: { width: 48, height: 48, borderRadius: 24, padding: 1.5 },
  avatar: { flex: 1, borderRadius: 23, backgroundColor: colors.olive[100], borderWidth: 2, borderColor: colors.light.card },
  avatarFallback: { alignItems: "center", justifyContent: "center", backgroundColor: colors.olive[900] },
  avatarText: { fontFamily: fontFamilies.display.semibold, fontSize: 17, color: colors.paper.cream },
  rowBody: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, marginLeft: 14, paddingVertical: 14, paddingRight: 16 },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#dddccd" },
  userName: { fontFamily: fontFamilies.sans.semibold, fontSize: 15, color: colors.light.foreground, letterSpacing: -0.1 },
  userNameMissing: { fontFamily: fontFamilies.display.italic, color: colors.light.mutedForeground },
  userEmail: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: colors.light.mutedForeground },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 3 },
  rolePill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.full },
  rolePillText: { fontFamily: fontFamilies.mono.semibold, fontSize: 8.5, letterSpacing: 0.8, textTransform: "uppercase" },
  joined: { fontFamily: fontFamilies.mono.regular, fontSize: 9.5, color: colors.light.mutedForeground },

  // ——— Role sheet ———
  sheetBackdrop: { flex: 1, justifyContent: "flex-end" },
  sheetScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(13,14,10,0.55)" },
  sheet: {
    backgroundColor: colors.light.background,
    borderTopLeftRadius: radii["3xl"],
    borderTopRightRadius: radii["3xl"],
    paddingTop: 8,
    paddingBottom: Platform.OS === "ios" ? 24 : 16,
    maxHeight: "88%",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(200,164,74,0.35)",
    ...shadows.editorial,
  },
  grabber: { alignSelf: "center", width: 38, height: 4, borderRadius: 2, backgroundColor: "#d6d4c4", marginBottom: 14 },

  sheetHeader: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20 },
  sheetRing: { width: 56, height: 56, borderRadius: 28, padding: 1.5 },
  sheetAvatar: { flex: 1, borderRadius: 27, backgroundColor: colors.olive[100], borderWidth: 2, borderColor: colors.light.background },
  sheetAvatarFallback: { alignItems: "center", justifyContent: "center", backgroundColor: colors.olive[900] },
  sheetAvatarText: { fontFamily: fontFamilies.display.semibold, fontSize: 21, color: CREAM },
  sheetName: { fontFamily: fontFamilies.display.semibold, fontSize: 19, color: colors.light.foreground, letterSpacing: -0.4 },
  sheetNameMissing: { fontFamily: fontFamilies.display.italic, color: colors.light.mutedForeground },
  sheetEmail: { fontFamily: fontFamilies.sans.regular, fontSize: 12.5, color: colors.light.mutedForeground },
  sheetClose: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: colors.light.muted },

  sheetMetaRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 20, marginTop: 14 },
  metaChip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radii.full, backgroundColor: colors.light.card, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.light.border },
  metaChipText: { fontFamily: fontFamilies.mono.medium, fontSize: 9.5, color: colors.light.mutedForeground, letterSpacing: 0.6 },

  sheetRule: { height: StyleSheet.hairlineWidth, backgroundColor: colors.light.border, marginHorizontal: 20, marginTop: 16 },
  sheetSection: { fontFamily: fontFamilies.mono.medium, fontSize: 10.5, color: colors.light.foreground, letterSpacing: 1.6, textTransform: "uppercase", paddingHorizontal: 20, marginTop: 14, marginBottom: 8 },

  sheetScroll: { flexGrow: 0 },
  sheetScrollContent: { paddingHorizontal: 16, gap: 8, paddingBottom: 8 },
  roleOpt: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: radii.xl,
    backgroundColor: colors.light.card,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  roleOptOn: { backgroundColor: colors.olive[900], borderColor: colors.olive[900], ...shadows.glow },
  roleOptRing: { position: "absolute", top: -3, left: -3, right: -3, bottom: -3, borderRadius: radii.xl + 3, borderWidth: 1.5, borderColor: "rgba(200,164,74,0.6)" },
  roleOptIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  roleOptLabel: { fontFamily: fontFamilies.sans.semibold, fontSize: 14, color: colors.light.foreground, letterSpacing: -0.1 },
  roleOptLabelOn: { color: CREAM },
  roleOptDesc: { fontFamily: fontFamilies.sans.regular, fontSize: 11, color: colors.light.mutedForeground },
  roleOptDescOn: { color: "rgba(250,248,241,0.6)" },
  currentTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: radii.sm, backgroundColor: "rgba(200,164,74,0.18)", borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(200,164,74,0.4)" },
  currentTagText: { fontFamily: fontFamilies.mono.semibold, fontSize: 7.5, color: "#8a6a2a", letterSpacing: 0.8 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: colors.light.border },

  sheetFooter: { flexDirection: "row", gap: 10, paddingHorizontal: 20, paddingTop: 12, marginTop: 4, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#dddccd" },
  sheetCancel: { flex: 1 },
  sheetSave: { flex: 1.4 },
});
