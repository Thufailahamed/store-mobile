import React, { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@/components/ui/Icon";
import { PaperBackground } from "@/components/layout";
import { Skeleton, useToast } from "@/components/ui";
import {
  AddressFormSheet,
  type AddressFormPayload,
  type AddressType,
} from "@/components/address/AddressFormSheet";
import { useAuth } from "@/lib/supabase/auth";
import {
  validateCheckoutAddress,
  checkoutAddressFieldLabel,
  checkoutAddressInvalidLabel,
} from "@/lib/checkout-validation";
import {
  createAddress,
  deleteAddress,
  getAddresses,
  updateAddress,
} from "@/lib/api";
import type { Address } from "@/lib/types";
import { colors, radii, spacing, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

const TYPE_META: Record<AddressType, { label: string }> = {
  home: { label: "Home" },
  work: { label: "Work" },
  other: { label: "Other" },
};

function formatFullAddress(a: Address): string {
  const locality = [a.city, a.state, a.postal_code].filter(Boolean).join(", ");
  return [a.line1, a.line2, locality, a.country].filter(Boolean).join(", ");
}

function savedPlacesSubtitle(count: number, defaultType?: AddressType): string {
  if (count === 0) return "NO SAVED PLACES YET";
  const base = `${count} SAVED PLACE${count === 1 ? "" : "S"}`;
  if (!defaultType) return base;
  return `${base} · DEFAULT IS ${TYPE_META[defaultType].label.toUpperCase()}`;
}

export default function AddressesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { toast } = useToast();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Address | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    const userId = user.id;
    let cancelled = false;
    getAddresses(userId).then((res) => {
      if (cancelled) return;
      if (res.ok) setAddresses(res.data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const refresh = async () => {
    if (!user?.id) return;
    const res = await getAddresses(user.id);
    if (res.ok) setAddresses(res.data);
  };

  const openAdd = () => {
    setEditing(null);
    setSheetOpen(true);
  };

  const openEdit = (a: Address) => {
    setEditing(a);
    setSheetOpen(true);
  };

  const closeSheet = () => {
    if (saving) return;
    setSheetOpen(false);
    setEditing(null);
  };

  const handleSubmit = async (payload: AddressFormPayload) => {
    if (!user?.id) return;

    const check = validateCheckoutAddress({
      full_name: payload.full_name,
      phone: payload.phone,
      line1: payload.line1,
      city: payload.city,
      state: payload.state,
      postal_code: payload.postal_code,
    });
    if (!check.ok) {
      const firstIssue =
        check.invalid[0] != null
          ? checkoutAddressInvalidLabel(check.invalid[0])
          : `${checkoutAddressFieldLabel(check.missing[0])} required`;
      toast(`Address incomplete (${firstIssue})`, "error");
      return;
    }

    setSaving(true);
    try {
      const basePayload = {
        user_id: user.id,
        type: payload.type,
        full_name: payload.full_name.trim(),
        phone: payload.phone.trim(),
        line1: payload.line1.trim(),
        line2: payload.line2.trim() || undefined,
        city: payload.city.trim(),
        state: payload.state.trim(),
        postal_code: payload.postal_code.trim(),
        country: payload.country.trim() || "Sri Lanka",
        latitude: payload.latitude,
        longitude: payload.longitude,
        is_default: payload.is_default || addresses.length === 0,
      };

      if (payload.is_default) {
        for (const a of addresses) {
          if (a.is_default && a.id !== editing?.id) {
            await updateAddress(a.id, { is_default: false });
          }
        }
      }

      const res = editing
        ? await updateAddress(editing.id, basePayload as any)
        : await createAddress(basePayload as any);

      if (!res.ok) {
        toast(res.error, "error");
        return;
      }
      toast(editing ? "Address updated" : "Address added", "success");
      setSheetOpen(false);
      setEditing(null);
      await refresh();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (a: Address) => {
    Alert.alert("Remove address", "This will remove the address from your saved list.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          if (a.is_default) {
            const nextDefault = addresses.find((addr) => addr.id !== a.id);
            if (nextDefault) {
              await updateAddress(nextDefault.id, { is_default: true });
            }
          }
          const res = await deleteAddress(a.id);
          if (!res.ok) {
            toast(res.error, "error");
            return;
          }
          toast("Address removed", "success");
          refresh();
        },
      },
    ]);
  };

  const setDefault = async (a: Address) => {
    for (const existing of addresses) {
      if (existing.is_default && existing.id !== a.id) {
        await updateAddress(existing.id, { is_default: false });
      }
    }
    const res = await updateAddress(a.id, { is_default: true });
    if (!res.ok) {
      toast(res.error, "error");
      return;
    }
    toast("Default updated", "success");
    refresh();
  };

  const defaultAddress = addresses.find((a) => a.is_default);

  return (
    <PaperBackground style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing[2] }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerSide} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={colors.light.foreground} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Addresses</Text>
        <TouchableOpacity onPress={openAdd} style={styles.headerSide} hitSlop={8}>
          <Ionicons name="add" size={22} color={colors.light.foreground} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loading}>
          <Skeleton height={28} width="70%" borderRadius={4} />
          <Skeleton height={14} width="50%" borderRadius={4} />
          <Skeleton height={180} borderRadius={radii.lg} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing[10] }]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.pageTitle}>Where we deliver</Text>
          <Text style={styles.pageSubtitle}>
            {savedPlacesSubtitle(addresses.length, defaultAddress?.type)}
          </Text>

          {addresses.length > 0 ? (
            <View style={styles.list}>
              {addresses.map((a) => (
                <AddressCard
                  key={a.id}
                  address={a}
                  onEdit={() => openEdit(a)}
                  onDelete={() => handleDelete(a)}
                  onSetDefault={() => setDefault(a)}
                />
              ))}
            </View>
          ) : null}

          <Pressable
            onPress={openAdd}
            style={({ pressed }) => [styles.addDashed, pressed && styles.addDashedPressed]}
          >
            <View style={styles.addSquare}>
              <Ionicons name="add" size={22} color={colors.light.foreground} />
            </View>
            <Text style={styles.addTitle}>Add another address</Text>
            <Text style={styles.addSub}>Home, work, or anywhere else</Text>
          </Pressable>
        </ScrollView>
      )}

      <AddressFormSheet
        visible={sheetOpen}
        initial={editing}
        defaultName={user?.user_metadata?.full_name ?? ""}
        defaultPhone={(user?.user_metadata?.phone as string) ?? ""}
        onClose={closeSheet}
        onSubmit={handleSubmit}
      />
    </PaperBackground>
  );
}

function AddressCard({
  address: a,
  onEdit,
  onDelete,
  onSetDefault,
}: {
  address: Address;
  onEdit: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
}) {
  const typeLabel = TYPE_META[a.type].label.toUpperCase();

  return (
    <View style={styles.cardOuter}>
      <View style={styles.pinBadge}>
        <Ionicons name="pin" size={13} color={colors.light.foreground} />
      </View>

      <View style={styles.card}>
        <View style={styles.cardHead}>
          <View style={styles.cardHeadMain}>
            <Text style={styles.cardName} numberOfLines={1}>
              {a.full_name}
            </Text>
            <View style={styles.pillRow}>
              <View style={styles.typePill}>
                <Text style={styles.typePillText}>{typeLabel}</Text>
              </View>
              {a.is_default ? (
                <View style={styles.defaultPill}>
                  <Text style={styles.defaultPillText}>Default</Text>
                </View>
              ) : null}
            </View>
          </View>
          <View style={styles.cardActions}>
            <TouchableOpacity onPress={onEdit} hitSlop={8} style={styles.iconTap}>
              <Ionicons name="pencil-outline" size={18} color={colors.light.foreground} />
            </TouchableOpacity>
            <TouchableOpacity onPress={onDelete} hitSlop={8} style={styles.iconTap}>
              <Ionicons name="trash-outline" size={18} color={colors.light.mutedForeground} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.detailRow}>
          <Ionicons
            name="location-outline"
            size={15}
            color={colors.light.mutedForeground}
            style={styles.detailIcon}
          />
          <Text style={styles.detailText}>{formatFullAddress(a)}</Text>
        </View>

        <View style={[styles.detailRow, styles.phoneRow]}>
          <Ionicons
            name="call-outline"
            size={15}
            color={colors.light.mutedForeground}
            style={styles.detailIcon}
          />
          <Text style={styles.detailText}>{a.phone}</Text>
        </View>

        {!a.is_default ? (
          <TouchableOpacity onPress={onSetDefault} style={styles.setDefaultLink}>
            <Text style={styles.setDefaultText}>Set as default</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.light.border,
  },
  headerSide: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontFamily: fontFamilies.display.regular,
    fontSize: typography.fontSizes["2xl"],
    color: colors.light.foreground,
  },
  loading: {
    padding: spacing[5],
    gap: spacing[4],
  },
  content: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[6],
  },
  pageTitle: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 34,
    lineHeight: 40,
    color: colors.light.foreground,
    marginBottom: spacing[2],
  },
  pageSubtitle: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 1.2,
    color: colors.light.mutedForeground,
    textTransform: "uppercase",
    marginBottom: spacing[6],
  },
  list: {
    gap: spacing[6],
    marginBottom: spacing[6],
  },
  cardOuter: {
    position: "relative",
    marginTop: spacing[3],
  },
  pinBadge: {
    position: "absolute",
    top: -14,
    left: spacing[4],
    zIndex: 2,
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.paper.cream,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.lg,
    backgroundColor: colors.paper.cream,
    paddingHorizontal: spacing[4],
    paddingTop: spacing[5],
    paddingBottom: spacing[4],
  },
  cardHead: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing[2],
  },
  cardHeadMain: {
    flex: 1,
    minWidth: 0,
    gap: spacing[2],
  },
  cardName: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: typography.fontSizes.xl,
    color: colors.light.foreground,
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
  },
  typePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
    backgroundColor: colors.light.secondary,
  },
  typePillText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9,
    letterSpacing: 0.8,
    color: colors.light.foreground,
  },
  defaultPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
    backgroundColor: colors.light.foreground,
  },
  defaultPillText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9,
    letterSpacing: 0.8,
    color: colors.paper.cream,
    textTransform: "uppercase",
  },
  cardActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    flexShrink: 0,
    paddingTop: 2,
  },
  iconTap: {
    padding: 2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.light.border,
    marginVertical: spacing[4],
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  detailIcon: {
    marginTop: 2,
    marginRight: spacing[2],
  },
  detailText: {
    flex: 1,
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.sm,
    lineHeight: 21,
    color: colors.light.foreground,
  },
  phoneRow: {
    marginTop: spacing[3],
  },
  setDefaultLink: {
    marginTop: spacing[4],
    alignSelf: "flex-start",
  },
  setDefaultText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: typography.fontSizes.xs,
    color: colors.light.primary,
    textDecorationLine: "underline",
  },
  addDashed: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing[8],
    paddingHorizontal: spacing[4],
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.light.border,
    borderRadius: radii.lg,
    backgroundColor: "transparent",
  },
  addDashedPressed: {
    opacity: 0.85,
    backgroundColor: colors.olive[50],
  },
  addSquare: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.light.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.paper.cream,
    marginBottom: spacing[3],
  },
  addTitle: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.light.foreground,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  addSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.sm,
    color: colors.light.mutedForeground,
    textAlign: "center",
  },
});
