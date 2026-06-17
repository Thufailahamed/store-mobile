import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  TouchableOpacity,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import {
  getDeliveryCompanyDrivers,
  hasStoreApi,
  inviteDriver,
  updateDriverMember,
  type DcDriverInvite,
  type DcDriverMember,
} from "@/lib/api/delivery-company-api";
import { colors, typography, radii } from "@/lib/theme/tokens";

export default function CompanyDriversScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [members, setMembers] = useState<DcDriverMember[]>([]);
  const [invites, setInvites] = useState<DcDriverInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);

  const load = useCallback(async () => {
    if (!hasStoreApi()) {
      setError("EXPO_PUBLIC_STORE_API_URL is not configured");
      setLoading(false);
      setRefreshing(false);
      return;
    }
    const res = await getDeliveryCompanyDrivers();
    if (res.ok) {
      setMembers(res.data.members.filter((m) => m.company_role === "driver"));
      setInvites((res.data.invites as DcDriverInvite[]) ?? []);
    } else setError(res.error);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => {
      const u = m.user;
      const hay = `${u?.full_name ?? ""} ${u?.email ?? ""} ${u?.phone ?? ""} ${m.driver_type ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [members, search]);

  const activeCount = members.filter((m) => m.is_active).length;

  const handleInvite = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      Alert.alert("Invalid email", "Enter a valid email address.");
      return;
    }
    setInviting(true);
    const res = await inviteDriver({ email, driver_type: "both" });
    setInviting(false);
    if (!res.ok) {
      Alert.alert("Invite failed", res.error);
      return;
    }
    Alert.alert("Invite sent", `Invitation emailed to ${email}`);
    setInviteEmail("");
    setInviteOpen(false);
    load();
  };

  const toggleActive = (member: DcDriverMember) => {
    const next = !member.is_active;
    Alert.alert(
      next ? "Activate driver" : "Deactivate driver",
      next ? `Re-enable ${member.user?.full_name ?? "this driver"}?` : `Deactivate ${member.user?.full_name ?? "this driver"}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: next ? "Activate" : "Deactivate",
          style: next ? "default" : "destructive",
          onPress: async () => {
            const res = await updateDriverMember(member.id, { is_active: next });
            if (!res.ok) Alert.alert("Failed", res.error);
            else load();
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Drivers"
        showBack={false}
        right={
          <TouchableOpacity onPress={() => setInviteOpen(true)} style={styles.addBtn}>
            <Ionicons name="person-add-outline" size={22} color={colors.light.primary} />
          </TouchableOpacity>
        }
      />
      <Text style={styles.subtitle}>
        {activeCount} active · {members.length} total
        {invites.length > 0 ? ` · ${invites.length} pending invites` : ""}
      </Text>
      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={18} color={colors.light.mutedForeground} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search drivers…"
          placeholderTextColor={colors.light.mutedForeground}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {invites.length > 0 ? (
        <View style={styles.invitesBox}>
          <Text style={styles.invitesTitle}>Pending invites</Text>
          {invites.slice(0, 3).map((inv) => (
            <Text key={inv.id} style={styles.inviteEmail}>
              {inv.email} · expires {new Date(inv.expires_at).toLocaleDateString()}
            </Text>
          ))}
        </View>
      ) : null}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.light.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={40} color={colors.light.mutedForeground} />
              <Text style={styles.emptyTitle}>No drivers yet</Text>
              <Text style={styles.emptySub}>Invite drivers by email to join your fleet.</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => setInviteOpen(true)}>
                <Text style={styles.emptyBtnText}>Invite driver</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item }) => (
            <DriverRow
              member={item}
              onToggle={() => toggleActive(item)}
              onPress={() => router.push(`/(delivery-company)/drivers/${item.user_id}` as any)}
            />
          )}
        />
      )}

      <Modal visible={inviteOpen} animationType="slide" transparent onRequestClose={() => setInviteOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Invite driver</Text>
            <Text style={styles.modalSub}>They will receive an email to join your company.</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="email@example.com"
              placeholderTextColor={colors.light.mutedForeground}
              value={inviteEmail}
              onChangeText={setInviteEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setInviteOpen(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSave} onPress={handleInvite} disabled={inviting}>
                {inviting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalSaveText}>Send invite</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function DriverRow({
  member,
  onToggle,
  onPress,
}: {
  member: DcDriverMember;
  onToggle: () => void;
  onPress: () => void;
}) {
  const u = member.user;
  const load = member.active_load ?? 0;
  const cap = member.capacity_max ?? 0;
  const loadPct = cap > 0 ? Math.min(100, Math.round((load / cap) * 100)) : 0;

  return (
    <TouchableOpacity style={[styles.card, !member.is_active && styles.cardInactive]} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.avatar}>
        <Ionicons name="person" size={22} color={colors.light.primary} />
      </View>
      <View style={styles.cardBody}>
        <View style={styles.nameRow}>
          <Text style={styles.name}>{u?.full_name ?? "Driver"}</Text>
          {!member.is_active ? (
            <View style={styles.inactivePill}>
              <Text style={styles.inactiveText}>Inactive</Text>
            </View>
          ) : null}
        </View>
        {u?.email ? <Text style={styles.phone}>{u.email}</Text> : null}
        {u?.phone ? <Text style={styles.phone}>{u.phone}</Text> : null}
        <View style={styles.tags}>
          {member.driver_type ? (
            <View style={styles.tag}>
              <Text style={styles.tagText}>{member.driver_type.replace(/_/g, " ")}</Text>
            </View>
          ) : null}
          {member.home_warehouse?.name ? (
            <View style={styles.tag}>
              <Text style={styles.tagText}>{member.home_warehouse.name}</Text>
            </View>
          ) : null}
        </View>
        {cap > 0 ? (
          <View style={styles.loadRow}>
            <View style={styles.loadBar}>
              <View style={[styles.loadFill, { width: `${loadPct}%` }]} />
            </View>
            <Text style={styles.loadText}>
              {load}/{cap} active
            </Text>
          </View>
        ) : null}
      </View>
      <TouchableOpacity style={styles.toggleBtn} onPress={(e) => { onToggle(); }}>
        <Ionicons
          name={member.is_active ? "power" : "power-outline"}
          size={20}
          color={member.is_active ? colors.light.primary : colors.light.mutedForeground}
        />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  addBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  subtitle: {
    fontSize: typography.fontSizes.sm,
    color: colors.light.mutedForeground,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.light.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.light.border,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: typography.fontSizes.base, color: colors.light.foreground },
  invitesBox: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    backgroundColor: "#fffbeb",
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "#fde68a",
  },
  invitesTitle: { fontSize: typography.fontSizes.xs, fontWeight: typography.fontWeights.semibold, color: "#a16207", marginBottom: 6 },
  inviteEmail: { fontSize: typography.fontSizes.sm, color: colors.light.foreground, marginTop: 2 },
  card: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: colors.light.card,
    borderRadius: radii.lg,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.light.border,
    alignItems: "center",
  },
  cardInactive: { opacity: 0.65 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radii.full,
    backgroundColor: colors.light.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  cardBody: { flex: 1 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: { fontSize: typography.fontSizes.base, fontWeight: typography.fontWeights.semibold, color: colors.light.foreground },
  inactivePill: { backgroundColor: colors.light.muted, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radii.full },
  inactiveText: { fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground },
  phone: { fontSize: typography.fontSizes.sm, color: colors.light.mutedForeground, marginTop: 2 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  tag: { backgroundColor: colors.light.muted, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.full },
  tagText: { fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground, textTransform: "capitalize" },
  loadRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  loadBar: { flex: 1, height: 6, backgroundColor: colors.light.muted, borderRadius: radii.full, overflow: "hidden" },
  loadFill: { height: "100%", backgroundColor: colors.light.primary, borderRadius: radii.full },
  loadText: { fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground },
  toggleBtn: { padding: 8 },
  empty: { alignItems: "center", paddingTop: 48, gap: 8 },
  emptyTitle: { fontSize: typography.fontSizes.lg, fontWeight: typography.fontWeights.semibold },
  emptySub: { fontSize: typography.fontSizes.sm, color: colors.light.mutedForeground, textAlign: "center", paddingHorizontal: 32 },
  emptyBtn: {
    marginTop: 12,
    backgroundColor: colors.light.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: radii.lg,
  },
  emptyBtnText: { color: "#fff", fontWeight: typography.fontWeights.semibold },
  errorText: { fontSize: typography.fontSizes.sm, color: "#dc2626", textAlign: "center" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalCard: {
    backgroundColor: colors.light.card,
    borderTopLeftRadius: radii["2xl"],
    borderTopRightRadius: radii["2xl"],
    padding: 20,
  },
  modalTitle: { fontSize: typography.fontSizes.lg, fontWeight: typography.fontWeights.bold },
  modalSub: { fontSize: typography.fontSizes.sm, color: colors.light.mutedForeground, marginTop: 4, marginBottom: 16 },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.lg,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: typography.fontSizes.base,
    color: colors.light.foreground,
    backgroundColor: colors.light.background,
  },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 16 },
  modalCancel: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: radii.lg,
    backgroundColor: colors.light.muted,
  },
  modalCancelText: { fontWeight: typography.fontWeights.semibold },
  modalSave: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: radii.lg,
    backgroundColor: colors.light.primary,
  },
  modalSaveText: { fontWeight: typography.fontWeights.semibold, color: "#fff" },
});
