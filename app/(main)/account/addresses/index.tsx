import React, { useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ScreenHeader } from "@/components/layout";
import { Badge, Button, Skeleton, useToast } from "@/components/ui";
import { Body, Display, Label } from "@/components/ui/Typography";
import {
  AddressFormSheet,
  type AddressFormPayload,
  type AddressType,
} from "@/components/address/AddressFormSheet";
import { useAuth } from "@/lib/supabase/auth";
import {
  createAddress,
  deleteAddress,
  getAddresses,
  updateAddress,
} from "@/lib/api";
import type { Address } from "@/lib/types";
import { colors, radii, shadows, spacing, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

const TYPE_META: Record<AddressType, { label: string; icon: keyof typeof Ionicons.glyphMap; copy: string }> = {
  home: { label: "Home", icon: "home-outline", copy: "Where you live, where things get tried on." },
  work: { label: "Work", icon: "briefcase-outline", copy: "Office or studio — for daytime deliveries." },
  other: { label: "Other", icon: "location-outline", copy: "A second home, a friend's, a hotel…" },
};

export default function AddressesScreen() {
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

      let res;
      if (editing) {
        res = await updateAddress(editing.id, basePayload as any);
      } else {
        res = await createAddress(basePayload as any);
      }

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

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <ScreenHeader title="Addresses" />
        <View style={styles.loading}>
          {[1, 2].map((i) => (
            <View key={i} style={styles.skeletonRow}>
              <Skeleton height={120} borderRadius={radii.xl} />
            </View>
          ))}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader
        title="Addresses"
        right={
          <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
            <Ionicons name="add" size={20} color={colors.light.primaryForeground} />
          </TouchableOpacity>
        }
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View>
            <Label style={styles.heroLabel}>Saved places</Label>
            <Display size="2xl" style={styles.heroTitle}>
              Where to send the boxes
            </Display>
            <Body muted>Pick a default to speed up checkout. Add as many as you like.</Body>
          </View>
          <View style={styles.iconBadge}>
            <Ionicons name="map-outline" size={20} color={colors.light.primaryForeground} />
          </View>
        </View>

        <View style={styles.statsRow}>
          <Stat label="Saved" value={addresses.length} icon="location-outline" />
          <Stat
            label="Default"
            value={addresses.find((a) => a.is_default)?.type ?? "—"}
            icon="checkmark-circle-outline"
          />
        </View>

        {addresses.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="location-outline" size={28} color={colors.light.mutedForeground} />
            </View>
            <Display size="xl">No saved addresses</Display>
            <Body muted>Add a place where you'd love to receive parcels.</Body>
            <Button onPress={openAdd}>
              <Ionicons
                name="add"
                size={14}
                color={colors.light.primaryForeground}
                style={{ marginRight: 6 }}
              />
              Add new address
            </Button>
          </View>
        ) : (
          <View style={styles.list}>
            {addresses.map((a) => {
              const meta = TYPE_META[a.type];
              return (
                <View key={a.id} style={styles.addressCard}>
                  <View style={styles.typeStripe} />
                  <View style={styles.addressBody}>
                    <View style={styles.addressHeader}>
                      <View style={styles.typeRow}>
                        <View style={styles.typeIcon}>
                          <Ionicons name={meta.icon} size={14} color={colors.light.primary} />
                        </View>
                        <Label style={styles.typeLabel}>{meta.label.toUpperCase()}</Label>
                        {a.is_default && (
                          <Badge style={{ backgroundColor: colors.olive[100] }}>
                            <Label style={{ color: colors.olive[700], fontSize: 9 }}>DEFAULT</Label>
                          </Badge>
                        )}
                      </View>
                      <View style={styles.actionRow}>
                        <TouchableOpacity onPress={() => openEdit(a)} style={styles.iconBtn}>
                          <Ionicons
                            name="create-outline"
                            size={16}
                            color={colors.light.foreground}
                          />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleDelete(a)}
                          style={styles.iconBtn}
                        >
                          <Ionicons
                            name="trash-outline"
                            size={16}
                            color={colors.light.destructive}
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                    <Body size="sm" style={styles.addressName}>{a.full_name}</Body>
                    <Body muted size="xs" style={styles.addressLine}>
                      {a.line1}
                      {a.line2 ? `, ${a.line2}` : ""}
                    </Body>
                    <Body muted size="xs" style={styles.addressLine}>
                      {a.city}, {a.state} {a.postal_code}
                    </Body>
                    <Body muted size="xs" style={styles.addressLine}>
                      {a.country}
                    </Body>
                    {a.latitude && a.longitude ? (
                      <View style={styles.coordsPill}>
                        <Ionicons
                          name="navigate-outline"
                          size={11}
                          color={colors.olive[700]}
                        />
                        <Label style={styles.coordsText}>
                          PINNED · {a.latitude.toFixed(3)}, {a.longitude.toFixed(3)}
                        </Label>
                      </View>
                    ) : null}
                    <View style={styles.addressFooter}>
                      <Body muted size="xs">
                        <Ionicons
                          name="call-outline"
                          size={11}
                          color={colors.light.mutedForeground}
                        />{" "}
                        {a.phone}
                      </Body>
                      {!a.is_default && (
                        <TouchableOpacity onPress={() => setDefault(a)} style={styles.setDefaultBtn}>
                          <Ionicons
                            name="star-outline"
                            size={12}
                            color={colors.olive[700]}
                          />
                          <Label style={styles.setDefaultText}>Make default</Label>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <TouchableOpacity
          style={styles.addRow}
          onPress={openAdd}
          activeOpacity={0.85}
        >
          <View style={styles.addRowIcon}>
            <Ionicons name="add" size={18} color={colors.light.primary} />
          </View>
          <View>
            <Body size="sm" style={styles.addRowTitle}>Add a new address</Body>
            <Body muted size="xs">Home, work, or anywhere in between.</Body>
          </View>
        </TouchableOpacity>
      </ScrollView>

      <AddressFormSheet
        visible={sheetOpen}
        initial={editing}
        defaultName={user?.user_metadata?.full_name ?? ""}
        defaultPhone={(user?.user_metadata?.phone as string) ?? ""}
        onClose={closeSheet}
        onSubmit={handleSubmit}
      />
    </SafeAreaView>
  );
}

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.statCard}>
      <View style={styles.statIcon}>
        <Ionicons name={icon} size={16} color={colors.light.primary} />
      </View>
      <Body size="sm" numberOfLines={1} style={styles.statValue}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </Body>
      <Label style={styles.statLabel}>{label}</Label>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  loading: { flex: 1, padding: spacing[5], gap: 12 },
  skeletonRow: { marginBottom: 4 },
  content: { padding: spacing[5], paddingBottom: spacing[8] },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.light.primary,
  },
  hero: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    backgroundColor: colors.light.card,
    borderRadius: radii["2xl"],
    padding: 20,
    borderWidth: 1,
    borderColor: colors.light.border,
    ...shadows.soft,
    marginBottom: spacing[5],
  },
  heroLabel: { color: colors.light.mutedForeground },
  heroTitle: { marginTop: spacing[2], marginBottom: spacing[2] },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.light.primary,
  },
  statsRow: { flexDirection: "row", gap: 10, marginBottom: spacing[5] },
  statCard: {
    flex: 1,
    backgroundColor: colors.light.card,
    borderRadius: radii.xl,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.light.border,
    gap: 4,
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.olive[50],
    marginBottom: 4,
  },
  statValue: { fontFamily: fontFamilies.mono.semibold, color: colors.light.foreground },
  statLabel: { color: colors.light.mutedForeground, fontSize: typography.fontSizes.xs },
  empty: {
    alignItems: "center",
    backgroundColor: colors.light.card,
    borderRadius: radii["2xl"],
    padding: spacing[8],
    borderWidth: 1,
    borderColor: colors.light.border,
    gap: spacing[3],
  },
  emptyIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.olive[50],
  },
  list: { gap: 12, marginBottom: spacing[4] },
  addressCard: {
    backgroundColor: colors.light.card,
    borderRadius: radii["2xl"],
    borderWidth: 1,
    borderColor: colors.light.border,
    flexDirection: "row",
    overflow: "hidden",
    ...shadows.soft,
  },
  typeStripe: { width: 4, backgroundColor: colors.light.primary },
  addressBody: { flex: 1, padding: 14, gap: 4 },
  addressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  typeRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  typeIcon: {
    width: 24,
    height: 24,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.olive[50],
  },
  typeLabel: {
    color: colors.light.mutedForeground,
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10,
    letterSpacing: 0.6,
  },
  actionRow: { flexDirection: "row", gap: 4 },
  iconBtn: {
    width: 28,
    height: 28,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.olive[50],
  },
  addressName: { fontWeight: typography.fontWeights.semibold, color: colors.light.foreground },
  addressLine: { lineHeight: 16 },
  coordsPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    backgroundColor: colors.olive[50],
    marginTop: 6,
  },
  coordsText: {
    color: colors.olive[700],
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9,
    letterSpacing: 0.4,
  },
  addressFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.light.border,
  },
  setDefaultBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.olive[50],
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  setDefaultText: {
    color: colors.olive[700],
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
  },
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    backgroundColor: colors.light.card,
    borderRadius: radii["2xl"],
    borderWidth: 1,
    borderColor: colors.olive[200],
    borderStyle: "dashed",
    padding: spacing[4],
  },
  addRowIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.olive[50],
  },
  addRowTitle: { fontWeight: typography.fontWeights.semibold, color: colors.light.foreground },
});
