import React, { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  RefreshControl,
  StatusBar,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@/components/ui/Icon";
import { useAuth } from "@/lib/supabase/auth";
import {
  getSellerStore,
  getSellerPayoutSettings,
  updateSellerStore,
  updateStoreMeta,
} from "@/lib/api";
import { getPayoutsBackend } from "@/lib/api/backend";
import { StoreInfoCard } from "@/components/seller/settings/StoreInfoCard";
import { KycStatusCard } from "@/components/seller/settings/KycStatusCard";
import { colors, typography, spacing, radii } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { isValidEmail, isValidPhone } from "@/lib/contact-validation";
import {
  describePayoutProfile,
  readStorefrontContact,
  type SellerPayoutCompliance,
} from "@/lib/seller-access";
import { Skeleton } from "@/components/ui/Skeleton";
import { SellerBackButton } from "@/components/seller/SellerBackButton";
import type { Store } from "@/lib/types";
import type { PayoutSettings } from "@/lib/api/backend";

const GOLD = colors.accent2.ochre;
const CREAM = colors.paper.cream;
const INK = colors.olive[950];

function mergePayout(
  settings: SellerPayoutCompliance | null,
  payout: PayoutSettings | null,
): SellerPayoutCompliance | null {
  if (!settings && !payout) return null;
  return {
    method: settings?.method ?? payout?.method ?? null,
    bank_name: settings?.bank_name ?? payout?.bank_name ?? null,
    account_name: settings?.account_name ?? payout?.account_name ?? null,
    account_number_last4: settings?.account_number_last4 ?? payout?.account_number_last4 ?? null,
    tax_form_submitted: settings?.tax_form_submitted ?? payout?.tax_form_submitted,
    kyc_status: settings?.kyc_status ?? null,
    stripe_account_id: settings?.stripe_account_id ?? payout?.stripe_account_id ?? null,
  };
}

export default function SellerSettings() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [store, setStore] = useState<Store | null>(null);
  const [payout, setPayout] = useState<SellerPayoutCompliance | null>(null);
  const [payoutLoaded, setPayoutLoaded] = useState(false);
  const [payoutError, setPayoutError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [draftPhone, setDraftPhone] = useState("");
  const [draftEmail, setDraftEmail] = useState("");
  const editingRef = useRef(false);
  editingRef.current = editing;

  const applyStore = (next: Store, keepDrafts = false) => {
    setStore(next);
    if (keepDrafts) return;
    const contact = readStorefrontContact(next as Store & Record<string, unknown>);
    setDraftName(next.name ?? "");
    setDraftDescription(next.description ?? "");
    setDraftPhone(contact.phone ?? next.contact_phone ?? "");
    setDraftEmail(contact.email ?? next.contact_email ?? "");
  };

  const fetchData = useCallback(async () => {
    if (!user) return;
    const storeRes = await getSellerStore(user.id);
    if (!storeRes.ok) {
      setLoadError(storeRes.error);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    if (!storeRes.data) {
      setStore(null);
      setLoadError(null);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    applyStore(storeRes.data, editingRef.current);
    setLoadError(null);

    const [settingsRes, payoutsRes] = await Promise.all([
      getSellerPayoutSettings(storeRes.data.id),
      getPayoutsBackend(),
    ]);
    const settings = settingsRes.ok ? settingsRes.data : null;
    const payoutRow = payoutsRes.ok ? payoutsRes.data.payout : null;
    setPayout(mergePayout(settings, payoutRow));
    setPayoutLoaded(settingsRes.ok || payoutsRes.ok);
    if (!settingsRes.ok && !payoutsRes.ok) {
      setPayoutError(settingsRes.error || (!payoutsRes.ok ? payoutsRes.error : "Couldn’t load payouts"));
    } else {
      setPayoutError(null);
    }
    setLoading(false);
    setRefreshing(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void fetchData();
    }, [fetchData]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void fetchData();
  }, [fetchData]);

  const handleSave = async () => {
    if (!store) return;
    const name = draftName.trim();
    if (!name) {
      Alert.alert("Name required", "Enter a store name.");
      return;
    }
    const phone = draftPhone.trim();
    const email = draftEmail.trim();
    if (phone && !isValidPhone(phone)) {
      Alert.alert("Invalid phone", "Enter a valid phone number, or leave it blank.");
      return;
    }
    if (email && !isValidEmail(email)) {
      Alert.alert("Invalid email", "Enter a valid email address, or leave it blank.");
      return;
    }
    setSaving(true);
    const storeRes = await updateSellerStore(store.id, {
      name,
      description: draftDescription.trim() || undefined,
    });
    if (!storeRes.ok) {
      setSaving(false);
      Alert.alert("Save failed", storeRes.error);
      return;
    }
    const metaRes = await updateStoreMeta({
      contact_phone: phone || null,
      contact_email: email || null,
    });
    setSaving(false);
    if (!metaRes.ok) {
      Alert.alert("Contact not saved", metaRes.error);
      applyStore({
        ...storeRes.data,
        contact_phone: store.contact_phone,
        contact_email: store.contact_email,
      });
      return;
    }
    applyStore({
      ...storeRes.data,
      contact_phone: metaRes.data.contact_phone ?? null,
      contact_email: metaRes.data.contact_email ?? null,
    });
    setEditing(false);
  };

  const contact = store
    ? readStorefrontContact(store as Store & Record<string, unknown>)
    : { phone: null, email: null };
  const payoutProfile = describePayoutProfile(payout, payoutLoaded);

  if (loading && !store) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) + 8 }]}>
          <Skeleton width={72} height={10} />
          <Skeleton width={140} height={28} style={{ marginTop: 8 }} />
        </View>
        <View style={styles.goldRule} />
        <View style={{ paddingHorizontal: spacing[5], gap: 12 }}>
          <Skeleton height={180} borderRadius={radii["2xl"]} />
          <Skeleton height={140} borderRadius={radii["2xl"]} />
        </View>
      </View>
    );
  }

  if (!store) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Ionicons name="cloud-offline-outline" size={40} color={colors.olive[700]} />
        <Text style={styles.emptyTitle}>{loadError ? "Couldn’t load the maison" : "No store found"}</Text>
        <Text style={styles.emptySub}>{loadError ?? "Create a store from the dashboard to continue."}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={onRefresh}>
          <Text style={styles.retryText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 80 + insets.bottom }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GOLD} />}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) + 8 }]}>
          <SellerBackButton label="More" fallbackHref="/(seller)/more" />
          <Text style={styles.kicker}>Account</Text>
          <Text style={styles.title}>Store settings</Text>
          <Text style={styles.signedIn} numberOfLines={1}>
            {user?.email ? `Signed in as ${user.email}` : "Seller account"}
          </Text>
        </View>
        <View style={styles.goldRule} />

        <StoreInfoCard
          store={store}
          phone={contact.phone ?? store.contact_phone ?? null}
          email={contact.email ?? store.contact_email ?? null}
          editing={editing}
          saving={saving}
          draftName={draftName}
          draftDescription={draftDescription}
          draftPhone={draftPhone}
          draftEmail={draftEmail}
          onChangeName={setDraftName}
          onChangeDescription={setDraftDescription}
          onChangePhone={setDraftPhone}
          onChangeEmail={setDraftEmail}
          onEdit={() => setEditing(true)}
          onCancel={() => {
            applyStore(store);
            setEditing(false);
          }}
          onSave={() => void handleSave()}
        />

        <KycStatusCard profile={payoutProfile} loadError={payoutError} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  content: { paddingHorizontal: spacing[5], gap: spacing[4] },
  centered: { alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 8 },
  header: { paddingBottom: spacing[3] },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    alignSelf: "flex-start",
    marginBottom: 10,
    marginLeft: -4,
  },
  backText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: typography.fontSizes.sm,
    color: colors.olive[800],
  },
  kicker: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 10,
    letterSpacing: typography.letterSpacing.editorial,
    textTransform: "uppercase",
    color: colors.olive[700],
    marginBottom: 2,
  },
  title: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 28,
    color: INK,
    letterSpacing: -0.4,
  },
  signedIn: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
    marginTop: 4,
  },
  goldRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(200,164,74,0.55)",
    marginBottom: 4,
  },
  emptyTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 22,
    color: INK,
    textAlign: "center",
  },
  emptySub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.sm,
    color: colors.light.mutedForeground,
    textAlign: "center",
  },
  retryBtn: {
    marginTop: 12,
    minHeight: 44,
    paddingHorizontal: 20,
    borderRadius: radii.full,
    backgroundColor: colors.olive[900],
    alignItems: "center",
    justifyContent: "center",
  },
  retryText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.sm,
    color: CREAM,
  },
});
