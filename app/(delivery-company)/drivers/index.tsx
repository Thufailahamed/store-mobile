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
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@/components/ui/Icon";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import {
  getDeliveryCompanyDrivers,
  getDeliveryCompanyMe,
  getDeliveryCompanyWarehouses,
  hasStoreApi,
  inviteDriver,
  revokeInvite,
  updateDriverMember,
  type DcDriverInvite,
  type DcDriverMember,
  type DcWarehouse,
} from "@/lib/api/delivery-company-api";
import { useAuth } from "@/lib/supabase/auth";
import { useCompanyRealtime } from "@/lib/hooks/useCompanyRealtime";
import { useIsTablet } from "@/lib/hooks/useIsTablet";
import { isValidEmail } from "@/lib/contact-validation";
import { colors, typography, radii } from "@/lib/theme/tokens";

export default function CompanyDriversScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const isTablet = useIsTablet();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [members, setMembers] = useState<DcDriverMember[]>([]);
  const [invites, setInvites] = useState<DcDriverInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkEmails, setBulkEmails] = useState("");
  const [bulkPostals, setBulkPostals] = useState("");
  const [bulkInviting, setBulkInviting] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteType, setInviteType] = useState<"pickup" | "last_mile" | "both">("both");
  const [inviteWarehouseId, setInviteWarehouseId] = useState<string | null>(null);
  const [warehouses, setWarehouses] = useState<DcWarehouse[]>([]);
  const [inviting, setInviting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);

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
    const meRes = await getDeliveryCompanyMe();
    if (meRes.ok) setCompanyId(meRes.data.company.id);
    const whRes = await getDeliveryCompanyWarehouses();
    if (whRes.ok) {
      const active = whRes.data.warehouses.filter((w) => w.is_active !== false);
      setWarehouses(active);
      setInviteWarehouseId((prev) => prev ?? active[0]?.id ?? null);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useCompanyRealtime(companyId, user?.id, load);

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
    if (!isValidEmail(email)) {
      Alert.alert("Invalid email", "Enter a valid email address.");
      return;
    }
    if ((inviteType === "pickup" || inviteType === "both") && !inviteWarehouseId) {
      Alert.alert("Home hub required", "Pickup drivers must be based at a warehouse.");
      return;
    }
    if (inviting) return;
    setInviting(true);
    try {
      const res = await inviteDriver({
        email,
        driver_type: inviteType,
        home_warehouse_id: inviteWarehouseId ?? undefined,
      });
      if (!res.ok) {
        Alert.alert("Invite failed", res.error);
        return;
      }
      Alert.alert("Invite sent", `Invitation emailed to ${email}`);
      setInviteEmail("");
      setInviteOpen(false);
      load();
    } finally {
      setInviting(false);
    }
  };

  const parseBulkEmails = (raw: string) =>
    raw
      .split(/[\s,;\n]+/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => /.+@.+\..+/.test(e));

  const handleBulkInvite = async () => {
    const list = parseBulkEmails(bulkEmails);
    if (list.length === 0) {
      Alert.alert("No valid emails", "Paste one or more email addresses.");
      return;
    }
    if ((inviteType === "pickup" || inviteType === "both") && !inviteWarehouseId) {
      Alert.alert("Home hub required", "Pickup drivers must be based at a warehouse.");
      return;
    }
    if (bulkInviting) return;
    const capped = list.slice(0, 50);
    setBulkInviting(true);
    setBulkProgress({ done: 0, total: capped.length });
    let ok = 0;
    let fail = 0;
    const failed: string[] = [];
    const postalList = bulkPostals
      .split(/[\s,;\n]+/)
      .map((p) => p.trim())
      .filter(Boolean);
    for (let i = 0; i < capped.length; i++) {
      const email = capped[i];
      const res = await inviteDriver({
        email,
        driver_type: inviteType,
        home_warehouse_id: inviteWarehouseId ?? undefined,
        serviceable_postal_codes: postalList.length ? postalList : undefined,
      });
      if (res.ok) ok++;
      else {
        fail++;
        failed.push(email);
      }
      setBulkProgress({ done: i + 1, total: capped.length });
    }
    setBulkInviting(false);
    setBulkProgress(null);
    Alert.alert(
      "Bulk invite complete",
      `${ok} sent${fail > 0 ? `, ${fail} failed` : ""}${failed.length ? `\n\nFailed:\n${failed.slice(0, 5).join("\n")}${failed.length > 5 ? `\n… and ${failed.length - 5} more` : ""}` : ""}`,
    );
    if (ok > 0) {
      setBulkEmails("");
      setBulkPostals("");
      setBulkOpen(false);
      load();
    }
  };

  const toggleActive = (member: DcDriverMember) => {
    if (togglingId) return;
    const next = !member.is_active;
    const displayName = member.user?.full_name ?? "this driver";
    Alert.alert(
      next ? "Activate driver" : "Deactivate driver",
      next ? `Re-enable ${displayName}?` : `Deactivate ${displayName}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: next ? "Activate" : "Deactivate",
          style: next ? "default" : "destructive",
          onPress: async () => {
            setTogglingId(member.id);
            try {
              const res = await updateDriverMember(member.id, { is_active: next });
              if (!res.ok) Alert.alert("Failed", res.error);
              else load();
            } finally {
              setTogglingId(null);
            }
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
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity
              onPress={() => setBulkOpen(true)}
              style={styles.addBtn}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Bulk invite drivers"
            >
              <Ionicons name="people-outline" size={22} color={colors.light.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setInviteOpen(true)}
              style={styles.addBtn}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Invite a driver"
            >
              <Ionicons name="person-add-outline" size={22} color={colors.light.primary} />
            </TouchableOpacity>
          </View>
        }
      />
      <Text style={styles.subtitle} numberOfLines={1}>
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
            <View key={inv.id} style={styles.inviteRow}>
              <Text style={styles.inviteEmail}>
                {inv.email} · expires {new Date(inv.expires_at).toLocaleDateString()}
              </Text>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`Revoke invite for ${inv.email}`}
                onPress={() =>
                  Alert.alert(
                    "Revoke invite",
                    `Revoke ${inv.email}? They will no longer be able to accept.`,
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Revoke",
                        style: "destructive",
                        onPress: async () => {
                          const res = await revokeInvite(inv.id);
                          if (!res.ok) Alert.alert("Failed", res.error);
                          else load();
                        },
                      },
                    ],
                  )
                }
              >
                <Text style={styles.inviteRevokeText}>Revoke</Text>
              </TouchableOpacity>
            </View>
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
          key={isTablet ? "grid-2" : "grid-1"}
          data={filtered}
          keyExtractor={(item) => item.id}
          numColumns={isTablet ? 2 : 1}
          columnWrapperStyle={isTablet ? styles.columnWrapper : undefined}
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
            <View style={isTablet ? styles.gridItem : undefined}>
              <DriverRow
                member={item}
                toggling={togglingId === item.id}
                onToggle={() => toggleActive(item)}
                onPress={() => router.push(`/(delivery-company)/drivers/${item.user_id}` as any)}
              />
            </View>
          )}
        />
      )}

      <Modal visible={inviteOpen} animationType="slide" transparent onRequestClose={() => setInviteOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalOverlay}>
          <View style={[styles.modalCard, { paddingBottom: insets.bottom + 20 }]}>
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
            <Text style={styles.modalLabel}>Driver type</Text>
            <View style={styles.typeRow}>
              {(["pickup", "last_mile", "both"] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.typeChip, inviteType === t && styles.typeChipActive]}
                  onPress={() => setInviteType(t)}
                >
                  <Text style={[styles.typeChipText, inviteType === t && styles.typeChipTextActive]}>
                    {t.replace(/_/g, " ")}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {(inviteType === "pickup" || inviteType === "both") && warehouses.length > 0 ? (
              <>
                <Text style={styles.modalLabel}>Home warehouse</Text>
                <View style={styles.typeRow}>
                  {warehouses.map((w) => (
                    <TouchableOpacity
                      key={w.id}
                      style={[styles.typeChip, inviteWarehouseId === w.id && styles.typeChipActive]}
                      onPress={() => setInviteWarehouseId(w.id)}
                    >
                      <Text style={[styles.typeChipText, inviteWarehouseId === w.id && styles.typeChipTextActive]}>
                        {w.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            ) : null}
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

      <Modal visible={bulkOpen} animationType="slide" transparent onRequestClose={() => setBulkOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalOverlay}>
          <View style={[styles.modalCard, { paddingBottom: insets.bottom + 20 }]}>
            <Text style={styles.modalTitle}>Bulk invite</Text>
            <Text style={styles.modalSub}>Paste up to 50 emails (comma, space, or newline separated).</Text>
            <ScrollView
              style={{ maxHeight: 360 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <TextInput
                style={[styles.modalInput, { minHeight: 120, textAlignVertical: "top" }]}
                placeholder={"a@x.com, b@x.com\nc@x.com"}
                placeholderTextColor={colors.light.mutedForeground}
                value={bulkEmails}
                onChangeText={setBulkEmails}
                multiline
                autoCapitalize="none"
              />
              <Text style={styles.modalLabel}>{parseBulkEmails(bulkEmails).length} valid emails</Text>
              <Text style={styles.modalLabel}>Driver type</Text>
              <View style={styles.typeRow}>
                {(["pickup", "last_mile", "both"] as const).map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.typeChip, inviteType === t && styles.typeChipActive]}
                    onPress={() => setInviteType(t)}
                  >
                    <Text style={[styles.typeChipText, inviteType === t && styles.typeChipTextActive]}>
                      {t.replace(/_/g, " ")}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {(inviteType === "pickup" || inviteType === "both") && warehouses.length > 0 ? (
                <>
                  <Text style={styles.modalLabel}>Home warehouse</Text>
                  <View style={styles.typeRow}>
                    {warehouses.map((w) => (
                      <TouchableOpacity
                        key={w.id}
                        style={[styles.typeChip, inviteWarehouseId === w.id && styles.typeChipActive]}
                        onPress={() => setInviteWarehouseId(w.id)}
                      >
                        <Text style={[styles.typeChipText, inviteWarehouseId === w.id && styles.typeChipTextActive]}>
                          {w.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              ) : null}
              <Text style={styles.modalLabel}>Serviceable postal codes (optional)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="00500, 00501"
                placeholderTextColor={colors.light.mutedForeground}
                value={bulkPostals}
                onChangeText={setBulkPostals}
                autoCapitalize="characters"
                editable={!bulkInviting}
              />
              {bulkInviting && bulkProgress ? (
                <View style={styles.progressBox}>
                  <ActivityIndicator size="small" color={colors.light.primary} />
                  <Text style={styles.progressText}>
                    Sending {bulkProgress.done}/{bulkProgress.total}…
                  </Text>
                </View>
              ) : null}
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setBulkOpen(false)} disabled={bulkInviting}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSave} onPress={handleBulkInvite} disabled={bulkInviting}>
                {bulkInviting ? (
                  <View style={styles.progressInline}>
                    <ActivityIndicator color="#fff" size="small" />
                    {bulkProgress ? (
                      <Text style={styles.modalSaveText}>{bulkProgress.done}/{bulkProgress.total}</Text>
                    ) : null}
                  </View>
                ) : (
                  <Text style={styles.modalSaveText}>Send invites</Text>
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
  toggling,
  onToggle,
  onPress,
}: {
  member: DcDriverMember;
  toggling: boolean;
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
          {(member.serviceable_postal_codes?.length ?? 0) > 0 ? (
            <View style={styles.tag}>
              <Text style={styles.tagText}>{member.serviceable_postal_codes!.length} zone(s)</Text>
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
      <TouchableOpacity style={styles.toggleBtn} onPress={onToggle} disabled={toggling}>
        {toggling ? (
          <ActivityIndicator size="small" color={colors.light.primary} />
        ) : (
          <Ionicons
            name={member.is_active ? "power" : "power-outline"}
            size={20}
            color={member.is_active ? colors.light.primary : colors.light.mutedForeground}
          />
        )}
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  addBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: radii.lg },
  subtitle: {
    fontSize: typography.fontSizes.sm,
    lineHeight: typography.lineHeights.snug * typography.fontSizes.sm,
    color: colors.light.mutedForeground,
    paddingHorizontal: 16,
    paddingTop: 4,
    marginBottom: 12,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
    backgroundColor: colors.light.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.light.border,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: typography.fontSizes.base, color: colors.light.foreground },
  columnWrapper: { gap: 12 },
  gridItem: { flex: 1 },
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
  inviteRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  inviteEmail: { fontSize: typography.fontSizes.sm, color: colors.light.foreground, flex: 1, marginRight: 12 },
  inviteRevokeText: {
    fontSize: typography.fontSizes.xs,
    color: "#dc2626",
    fontWeight: typography.fontWeights.semibold,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
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
    minHeight: 72,
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
  toggleBtn: { padding: 10, minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", paddingTop: 56, paddingHorizontal: 24, gap: 8 },
  emptyTitle: { fontSize: typography.fontSizes.lg, fontWeight: typography.fontWeights.semibold, marginTop: 4 },
  emptySub: { fontSize: typography.fontSizes.sm, lineHeight: typography.lineHeights.normal * typography.fontSizes.sm, color: colors.light.mutedForeground, textAlign: "center", marginBottom: 8 },
  emptyBtn: {
    marginTop: 8,
    backgroundColor: colors.light.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    minHeight: 44,
    borderRadius: radii.lg,
  },
  emptyBtnText: { color: "#fff", fontWeight: typography.fontWeights.semibold },
  errorText: { fontSize: typography.fontSizes.sm, color: "#dc2626", textAlign: "center" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalCard: {
    backgroundColor: colors.light.card,
    borderTopLeftRadius: radii["2xl"],
    borderTopRightRadius: radii["2xl"],
    paddingHorizontal: 20,
    paddingTop: 20,
    maxHeight: "92%",
  },
  modalTitle: { fontSize: typography.fontSizes.lg, fontWeight: typography.fontWeights.bold },
  modalSub: { fontSize: typography.fontSizes.sm, lineHeight: typography.lineHeights.normal * typography.fontSizes.sm, color: colors.light.mutedForeground, marginTop: 4, marginBottom: 16 },
  modalLabel: { fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground, marginBottom: 6, marginTop: 12, textTransform: "uppercase", letterSpacing: typography.letterSpacing.wide },
  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  typeChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 36,
    borderRadius: radii.lg,
    backgroundColor: colors.light.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  typeChipActive: { backgroundColor: colors.light.primary },
  typeChipText: { fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground, textTransform: "capitalize" },
  typeChipTextActive: { color: "#fff", fontWeight: typography.fontWeights.semibold },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.lg,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 44,
    fontSize: typography.fontSizes.base,
    color: colors.light.foreground,
    backgroundColor: colors.light.background,
  },
  progressBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
    padding: 12,
    backgroundColor: colors.light.muted,
    borderRadius: radii.lg,
  },
  progressText: {
    fontSize: typography.fontSizes.sm,
    color: colors.light.foreground,
    fontWeight: typography.fontWeights.medium,
  },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 20, paddingBottom: 20 },
  progressInline: { flexDirection: "row", alignItems: "center", gap: 8 },
  modalCancel: {
    flex: 1,
    paddingVertical: 12,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.lg,
    backgroundColor: colors.light.muted,
  },
  modalCancelText: { fontWeight: typography.fontWeights.semibold, color: colors.light.foreground },
  modalSave: {
    flex: 1,
    paddingVertical: 12,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.lg,
    backgroundColor: colors.light.primary,
  },
  modalSaveText: { fontWeight: typography.fontWeights.semibold, color: "#fff" },
});
