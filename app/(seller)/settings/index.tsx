import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Switch,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/lib/supabase/auth";
import { getSellerStore, updateSellerStore, createSellerStore, getSellerPayoutSettings, upsertSellerPayoutSettings } from "@/lib/api";
import { colors, typography, radii } from "@/lib/theme/tokens";
import type { Store } from "@/lib/types";
import { getSellerAccessState } from "@/lib/seller-access";

export default function SellerSettings() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [slug, setSlug] = useState("");
  const [legalName, setLegalName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountLast4, setAccountLast4] = useState("");
  const [taxFormSubmitted, setTaxFormSubmitted] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user) return;
    const res = await getSellerStore(user.id);
    if (res.ok && res.data) {
      setStore(res.data);
      setName(res.data.name);
      setDescription(res.data.description ?? "");
      setSlug(res.data.slug);
      const fullStore = res.data as Store & Record<string, unknown>;
      setLegalName(typeof fullStore.legal_name === "string" ? fullStore.legal_name : "");
      setTaxId(typeof fullStore.tax_id === "string" ? fullStore.tax_id : "");
      const payoutRes = await getSellerPayoutSettings(res.data.id);
      if (payoutRes.ok && payoutRes.data) {
        setBankName(payoutRes.data.bank_name ?? "");
        setAccountName(payoutRes.data.account_name ?? "");
        setAccountLast4(payoutRes.data.account_number_last4 ?? "");
        setTaxFormSubmitted(Boolean(payoutRes.data.tax_form_submitted));
      }
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSave = async () => {
    if (!store) return;
    if (!name.trim()) {
      Alert.alert("Error", "Store name is required");
      return;
    }
    setSaving(true);
    const res = await updateSellerStore(store.id, {
      name: name.trim(),
      description: description.trim() || undefined,
      slug: slug.trim() || undefined,
      ...({
        legal_name: legalName.trim() || null,
        tax_id: taxId.trim() || null,
      } as Record<string, unknown>),
    } as Partial<Store>);
    const payoutRes = await upsertSellerPayoutSettings(store.id, {
      bank_name: bankName.trim() || null,
      account_name: accountName.trim() || null,
      account_number_last4: accountLast4.trim() || null,
      tax_form_submitted: taxFormSubmitted,
    });
    setSaving(false);
    if (res.ok && payoutRes.ok) {
      Alert.alert("Success", "Store and compliance details updated");
      fetchData();
    } else {
      Alert.alert("Error", !res.ok ? res.error : payoutRes.error);
    }
  };

  const handleCreate = async () => {
    if (!user) return;
    if (!name.trim()) {
      Alert.alert("Error", "Store name is required");
      return;
    }
    setCreating(true);
    const res = await createSellerStore(user.id, {
      name: name.trim(),
      slug: slug.trim() || undefined,
      description: description.trim() || undefined,
    });
    setCreating(false);
    if (res.ok) {
      setStore(res.data);
      Alert.alert("Success", "Store created. It will be reviewed before going live.");
    } else {
      Alert.alert("Error", res.error);
    }
  };

  const handleSignOut = () => {
    Alert.alert("Sign out?", "You will be logged out", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: signOut },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{store ? "Store Settings" : "Create Your Store"}</Text>
        <Text style={styles.subtitle}>
          {store ? "Manage your store profile" : "Set up your seller profile to start listing products"}
        </Text>
      </View>

      {/* Store Status */}
      {store && (
        <View style={styles.statusCard}>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Status</Text>
            <View style={[styles.statusBadge, store.status === "approved" ? styles.statusApproved : styles.statusPending]}>
              <Text style={[styles.statusText, store.status === "approved" ? styles.statusTextApproved : styles.statusTextPending]}>
                {store.status}
              </Text>
            </View>
          </View>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Rating</Text>
            <Text style={styles.statusValue}>⭐ {store.rating.toFixed(1)}</Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Products</Text>
            <Text style={styles.statusValue}>{store.total_products}</Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Followers</Text>
            <Text style={styles.statusValue}>{store.total_followers}</Text>
          </View>
        </View>
      )}

      {store && (() => {
        const access = getSellerAccessState(store as Store & Record<string, unknown>);
        if (access.canAccessSellerTools) return null;
        return (
          <View style={styles.warningCard}>
            <Text style={styles.warningTitle}>Action required</Text>
            <Text style={styles.warningBody}>
              {access.lockReason ?? "Complete required compliance details to unlock seller tools."}
            </Text>
          </View>
        );
      })()}

      {/* Edit Form */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Store Profile</Text>

        <View style={styles.field}>
          <Text style={styles.label}>Store Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Your store name"
            placeholderTextColor={colors.light.mutedForeground}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Slug</Text>
          <TextInput
            style={styles.input}
            value={slug}
            onChangeText={setSlug}
            placeholder="your-store-slug"
            placeholderTextColor={colors.light.mutedForeground}
            autoCapitalize="none"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Tell customers about your store..."
            multiline
            numberOfLines={4}
            placeholderTextColor={colors.light.mutedForeground}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Legal Business Name</Text>
          <TextInput
            style={styles.input}
            value={legalName}
            onChangeText={setLegalName}
            placeholder="Registered company or proprietor name"
            placeholderTextColor={colors.light.mutedForeground}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Tax ID</Text>
          <TextInput
            style={styles.input}
            value={taxId}
            onChangeText={setTaxId}
            placeholder="TIN / VAT number"
            placeholderTextColor={colors.light.mutedForeground}
            autoCapitalize="characters"
          />
        </View>

        <Text style={styles.sectionTitle}>Banking & compliance</Text>

        <View style={styles.field}>
          <Text style={styles.label}>Bank Name</Text>
          <TextInput
            style={styles.input}
            value={bankName}
            onChangeText={setBankName}
            placeholder="Your bank"
            placeholderTextColor={colors.light.mutedForeground}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Account Holder</Text>
          <TextInput
            style={styles.input}
            value={accountName}
            onChangeText={setAccountName}
            placeholder="Name on account"
            placeholderTextColor={colors.light.mutedForeground}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Account Last 4 Digits</Text>
          <TextInput
            style={styles.input}
            value={accountLast4}
            onChangeText={setAccountLast4}
            placeholder="1234"
            keyboardType="number-pad"
            maxLength={4}
            placeholderTextColor={colors.light.mutedForeground}
          />
        </View>

        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Tax declaration submitted</Text>
            <Text style={styles.switchHint}>Required before payouts and seller tools unlock.</Text>
          </View>
          <Switch
            value={taxFormSubmitted}
            onValueChange={setTaxFormSubmitted}
            trackColor={{ false: colors.light.border, true: colors.light.primary }}
          />
        </View>

        <TouchableOpacity
          style={[styles.saveButton, (saving || creating) && { opacity: 0.6 }]}
          onPress={store ? handleSave : handleCreate}
          disabled={saving || creating}
        >
          <Text style={styles.saveButtonText}>
            {store ? (saving ? "Saving..." : "Save Changes") : (creating ? "Creating..." : "Create Store")}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Account */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Email</Text>
          <Text style={styles.infoValue}>{user?.email ?? "—"}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Role</Text>
          <Text style={styles.infoValue}>Store Owner</Text>
        </View>
      </View>

      {/* Sign Out */}
      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  content: { padding: 16 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { color: colors.light.mutedForeground },

  header: { marginBottom: 20 },
  title: {
    fontSize: typography.fontSizes.xl,
    fontWeight: typography.fontWeights.bold as any,
    color: colors.light.foreground,
  },
  subtitle: {
    fontSize: typography.fontSizes.sm,
    color: colors.light.mutedForeground,
    marginTop: 2,
  },

  statusCard: {
    backgroundColor: colors.light.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.light.border,
    padding: 16,
    marginBottom: 20,
  },
  warningCard: {
    backgroundColor: "#fff7ed",
    borderWidth: 1,
    borderColor: "#fed7aa",
    borderRadius: radii.lg,
    padding: 14,
    marginBottom: 18,
  },
  warningTitle: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold as any,
    color: "#9a3412",
    marginBottom: 4,
  },
  warningBody: {
    fontSize: typography.fontSizes.xs,
    color: "#9a3412",
    lineHeight: 18,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  switchHint: {
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
    marginTop: 4,
    lineHeight: 16,
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  statusLabel: {
    fontSize: typography.fontSizes.sm,
    color: colors.light.mutedForeground,
  },
  statusValue: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.medium as any,
    color: colors.light.foreground,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  statusApproved: { backgroundColor: "#dcfce7" },
  statusPending: { backgroundColor: "#fef9c3" },
  statusText: {
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.semibold as any,
    textTransform: "capitalize",
  },
  statusTextApproved: { color: "#166534" },
  statusTextPending: { color: "#854d0e" },

  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.bold as any,
    color: colors.light.foreground,
    marginBottom: 12,
  },

  field: { marginBottom: 14 },
  label: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.medium as any,
    color: colors.light.foreground,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.light.card,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.lg,
    padding: 12,
    fontSize: typography.fontSizes.sm,
    color: colors.light.foreground,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: "top",
  },

  saveButton: {
    backgroundColor: colors.light.primary,
    padding: 14,
    borderRadius: radii.lg,
    alignItems: "center",
    marginTop: 4,
  },
  saveButtonText: {
    color: colors.light.card,
    fontSize: typography.fontSizes.base,
    fontWeight: typography.fontWeights.bold as any,
  },

  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  infoLabel: {
    fontSize: typography.fontSizes.sm,
    color: colors.light.mutedForeground,
  },
  infoValue: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.medium as any,
    color: colors.light.foreground,
  },

  signOutButton: {
    padding: 14,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "#fecaca",
    alignItems: "center",
    marginTop: 8,
  },
  signOutText: {
    color: "#dc2626",
    fontSize: typography.fontSizes.base,
    fontWeight: typography.fontWeights.semibold as any,
  },
});
