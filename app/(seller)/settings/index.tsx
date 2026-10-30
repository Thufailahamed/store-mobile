import React, { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  Animated,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  RefreshControl,
  StatusBar,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { hasPickupAddress, PICKUP_ADDRESS_ROUTE } from "@/lib/seller-pickup-address";
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
import { ReturnsSettingsCard } from "@/components/seller/settings/ReturnsSettingsCard";
import { SetupChecklistCard, type SetupStep } from "@/components/seller/settings/SetupChecklistCard";
import { colors, typography, spacing, radii, shadows } from "@/lib/theme/tokens";
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
  };
}

export default function SellerSettings() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
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
  const scrollRef = useRef<ScrollView>(null);
  const infoCardY = useRef(0);
  const scrollY = useRef(new Animated.Value(0)).current;
  // Compact bar title fades in once the large title scrolls away.
  const barTitleOpacity = scrollY.interpolate({ inputRange: [40, 80], outputRange: [0, 1], extrapolate: "clamp" });
  const barBorderOpacity = scrollY.interpolate({ inputRange: [0, 24], outputRange: [0, 1], extrapolate: "clamp" });

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

  const startEditing = () => {
    setEditing(true);
    scrollRef.current?.scrollTo({ y: Math.max(infoCardY.current - 12, 0), animated: true });
  };
  const pickupDone = hasPickupAddress(store);
  const payoutDone = payoutProfile.loaded && !!payoutProfile.method && payoutProfile.missing.length === 0;
  const setupSteps: SetupStep[] = [
    { key: "description", label: "Description", icon: "document-text-outline", done: !!store.description?.trim(), onPress: startEditing },
    { key: "phone", label: "Phone", icon: "call-outline", done: !!(contact.phone ?? store.contact_phone)?.trim(), onPress: startEditing },
    { key: "email", label: "Email", icon: "mail-outline", done: !!(contact.email ?? store.contact_email)?.trim(), onPress: startEditing },
    { key: "pickup", label: "Pickup address", icon: "location-outline", done: pickupDone, onPress: () => router.push(PICKUP_ADDRESS_ROUTE as never) },
    // Only nag about payouts once we actually know their state.
    ...(payoutLoaded
      ? [{ key: "payouts", label: "Payouts", icon: "wallet-outline" as const, done: payoutDone, onPress: () => router.push("/(seller)/payouts/settings" as never) }]
      : []),
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={[styles.bar, { paddingTop: insets.top }]}>
        <View style={styles.barRow}>
          <SellerBackButton label="More" fallbackHref="/(seller)/more" />
          <Animated.Text style={[styles.barTitle, { opacity: barTitleOpacity }]} numberOfLines={1}>
            Store settings
          </Animated.Text>
          <TouchableOpacity
            style={styles.barAction}
            onPress={() => router.push(`/stores/${store.slug || store.id}` as never)}
            accessibilityRole="button"
            accessibilityLabel="View public storefront"
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Ionicons name="eye-outline" size={17} color={colors.olive[800]} />
          </TouchableOpacity>
        </View>
        <Animated.View style={[styles.barBorder, { opacity: barBorderOpacity }]} />
      </View>

      <Animated.ScrollView
        ref={scrollRef as never}
        contentContainerStyle={[styles.content, { paddingBottom: 96 + insets.bottom }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GOLD} />}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
      >
        <View style={styles.header}>
          <View style={styles.kickerRow}>
            <View style={styles.kickerDot} />
            <Text style={styles.kicker}>Account</Text>
          </View>
          <Text style={styles.title}>Store settings</Text>
          <View style={styles.accountRow}>
            <Ionicons name="person-circle-outline" size={14} color={colors.ink.mute} />
            <Text style={styles.signedIn} numberOfLines={1}>
              Signed in as <Text style={styles.signedInEmail}>{user?.email ?? "seller account"}</Text>
            </Text>
          </View>
        </View>

        <SetupChecklistCard steps={setupSteps} />

        <View onLayout={(e) => { infoCardY.current = e.nativeEvent.layout.y; }}>
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
            onEdit={startEditing}
            onCancel={() => {
              applyStore(store);
              setEditing(false);
            }}
            onSave={() => void handleSave()}
          />
        </View>

        <SectionHead index="01" label="Fulfilment" />
        <View style={styles.group}>
          <TouchableOpacity
            style={styles.pickupRow}
            onPress={() => router.push(PICKUP_ADDRESS_ROUTE as never)}
            accessibilityRole="button"
            accessibilityLabel="Product pickup address"
            activeOpacity={0.7}
          >
            <View style={[styles.rowIcon, !pickupDone && styles.rowIconWarn]}>
              <Ionicons
                name={pickupDone ? "location-outline" : "alert-circle-outline"}
                size={17}
                color={pickupDone ? colors.olive[800] : colors.accent2.rust}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.pickupTitle}>Pickup address</Text>
              <Text style={[styles.pickupSub, !pickupDone && styles.pickupSubWarn]} numberOfLines={1}>
                {pickupDone
                  ? [store.delivery_address_line1, store.delivery_city].filter(Boolean).join(", ")
                  : "Required — couriers can’t collect orders yet"}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.ink.mute} />
          </TouchableOpacity>
          <View style={styles.groupDivider} />
          <ReturnsSettingsCard store={store} onSaved={(next) => applyStore(next, editing)} />
        </View>

        <SectionHead index="02" label="Finance" />
        <KycStatusCard profile={payoutProfile} loadError={payoutError} />
      </Animated.ScrollView>
    </View>
  );
}

function SectionHead({ index, label }: { index: string; label: string }) {
  return (
    <View style={styles.sectionHead}>
      <Text style={styles.sectionIndex}>{index}</Text>
      <Text style={styles.sectionLabel}>{label}</Text>
      <View style={styles.sectionLine} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { backgroundColor: colors.light.background, zIndex: 2 },
  barRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 52,
    paddingHorizontal: spacing[5],
  },
  barTitle: {
    position: "absolute",
    left: 96,
    right: 96,
    textAlign: "center",
    fontFamily: fontFamilies.display.semibold,
    fontSize: 17,
    color: INK,
  },
  barAction: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(83,94,44,0.06)",
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.12)",
  },
  barBorder: { height: StyleSheet.hairlineWidth, backgroundColor: "rgba(200,164,74,0.55)" },
  group: {
    backgroundColor: "#FFFFFF",
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "rgba(200,164,74,0.22)",
    overflow: "hidden",
    ...shadows.editorial,
  },
  groupDivider: { height: StyleSheet.hairlineWidth, backgroundColor: "rgba(83,94,44,0.14)", marginHorizontal: 16 },
  pickupRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, minHeight: 68 },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.paper.cream,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  rowIconWarn: { backgroundColor: "rgba(184,92,58,0.06)", borderColor: "rgba(184,92,58,0.2)" },
  pickupTitle: { fontFamily: fontFamilies.sans.semibold, fontSize: 14, color: colors.olive[950] },
  pickupSub: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: colors.ink.mute, marginTop: 2 },
  pickupSubWarn: { color: colors.accent2.rust },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: spacing[3], marginBottom: -4 },
  sectionIndex: { fontFamily: fontFamilies.mono.medium, fontSize: 10, color: GOLD, letterSpacing: 1 },
  sectionLabel: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: INK,
  },
  sectionLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: "rgba(200,164,74,0.5)", marginLeft: 4 },
  container: { flex: 1, backgroundColor: colors.light.background },
  content: { paddingHorizontal: spacing[5], gap: spacing[4], paddingTop: spacing[1] },
  centered: { alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 8 },
  header: { paddingBottom: spacing[1] },

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
  kickerRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6, marginBottom: 4 },
  kickerDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: GOLD },
  kicker: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: colors.olive[700],
  },
  title: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 34,
    lineHeight: 40,
    color: INK,
    letterSpacing: -0.8,
  },
  accountRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  signedIn: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.xs,
    color: colors.ink.mute,
    flexShrink: 1,
  },
  signedInEmail: { fontFamily: fontFamilies.sans.semibold, color: colors.olive[800] },
  goldRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(200,164,74,0.55)",
    marginBottom: 8,
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
