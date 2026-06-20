import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import {
  getDeliveryCompanyDrivers,
  hasStoreApi,
  inviteDriver,
  type DcDriverMember,
} from "@/lib/api/delivery-company-api";
import { colors, typography, radii } from "@/lib/theme/tokens";
import { isValidEmail } from "@/lib/contact-validation";

export default function CompanyTeamScreen() {
  const [members, setMembers] = useState<DcDriverMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);

  const load = useCallback(async () => {
    if (!hasStoreApi()) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    const res = await getDeliveryCompanyDrivers();
    if (res.ok) setMembers(res.data.members);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const managers = useMemo(
    () => members.filter((m) => m.company_role === "manager" || m.company_role === "owner"),
    [members],
  );

  const handleInvite = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!isValidEmail(email)) {
      Alert.alert("Invalid email", "Enter a valid email.");
      return;
    }
    setInviting(true);
    const res = await inviteDriver({ email, company_role: "manager" });
    setInviting(false);
    if (!res.ok) Alert.alert("Invite failed", res.error);
    else {
      Alert.alert("Sent", `Manager invite sent to ${email}`);
      setInviteOpen(false);
      setInviteEmail("");
      load();
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Team"
        right={
          <TouchableOpacity onPress={() => setInviteOpen(true)} style={styles.addBtn}>
            <Ionicons name="person-add-outline" size={22} color={colors.light.primary} />
          </TouchableOpacity>
        }
      />
      <Text style={styles.sub}>Owners and managers who operate Logistics HQ.</Text>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.light.primary} />
        </View>
      ) : (
        <FlatList
          data={managers}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No managers yet</Text>
              <Text style={styles.emptySub}>Invite a manager to help dispatch.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const u = item.user;
            return (
              <View style={styles.card}>
                <View style={styles.avatar}>
                  <Ionicons name="shield-outline" size={20} color={colors.light.primary} />
                </View>
                <View style={styles.body}>
                  <Text style={styles.name}>{u?.full_name ?? "—"}</Text>
                  <Text style={styles.email}>{u?.email}</Text>
                </View>
                <View style={styles.rolePill}>
                  <Text style={styles.roleText}>{item.company_role}</Text>
                </View>
              </View>
            );
          }}
        />
      )}

      <Modal visible={inviteOpen} animationType="slide" transparent onRequestClose={() => setInviteOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Invite manager</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="email@example.com"
              value={inviteEmail}
              onChangeText={setInviteEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setInviteOpen(false)}>
                <Text>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSave} onPress={handleInvite} disabled={inviting}>
                {inviting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.modalSaveText}>Send</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  addBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  sub: { fontSize: typography.fontSizes.sm, color: colors.light.mutedForeground, paddingHorizontal: 16, marginBottom: 8 },
  card: {
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
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    backgroundColor: colors.light.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1 },
  name: { fontWeight: typography.fontWeights.semibold },
  email: { fontSize: typography.fontSizes.sm, color: colors.light.mutedForeground },
  rolePill: { backgroundColor: colors.light.muted, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radii.full },
  roleText: { fontSize: typography.fontSizes.xs, textTransform: "capitalize" },
  empty: { alignItems: "center", paddingTop: 48 },
  emptyTitle: { fontWeight: typography.fontWeights.semibold },
  emptySub: { fontSize: typography.fontSizes.sm, color: colors.light.mutedForeground, marginTop: 4 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: colors.light.card, borderTopLeftRadius: radii["2xl"], borderTopRightRadius: radii["2xl"], padding: 20 },
  modalTitle: { fontSize: typography.fontSizes.lg, fontWeight: typography.fontWeights.bold, marginBottom: 12 },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.lg,
    padding: 12,
    marginBottom: 16,
  },
  modalActions: { flexDirection: "row", gap: 10 },
  modalCancel: { flex: 1, padding: 12, alignItems: "center", backgroundColor: colors.light.muted, borderRadius: radii.lg },
  modalSave: { flex: 1, padding: 12, alignItems: "center", backgroundColor: colors.light.primary, borderRadius: radii.lg },
  modalSaveText: { color: "#fff", fontWeight: typography.fontWeights.semibold },
});
