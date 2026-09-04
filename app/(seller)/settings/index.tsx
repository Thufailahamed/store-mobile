import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { useAuth } from "@/lib/supabase/auth";
import { getSellerStore, getSellerPayoutSettings } from "@/lib/api";
import { StoreInfoCard } from "@/components/seller/settings/StoreInfoCard";
import { KycStatusCard } from "@/components/seller/settings/KycStatusCard";
import { colors, typography, spacing, radii } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import type { Store } from "@/lib/types";
import type { SellerPayoutCompliance } from "@/lib/seller-access";

export default function SellerSettings() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [store, setStore] = useState<Store | null>(null);
  const [payout, setPayout] = useState<SellerPayoutCompliance | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const storeRes = await getSellerStore(user.id);
      if (storeRes.ok && storeRes.data) {
        setStore(storeRes.data);
        const payoutRes = await getSellerPayoutSettings(storeRes.data.id);
        if (payoutRes.ok) setPayout(payoutRes.data);
      }
      setLoading(false);
    })();
  }, [user]);

  const handleSignOut = () => {
    Alert.alert("Sign out", "Sign out of your seller account?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: () => signOut() },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>Loading…</Text>
      </View>
    );
  }

  if (!store) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>No store found.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <StoreInfoCard store={store} />
      <KycStatusCard payout={payout} />
      <TouchableOpacity
        style={styles.row}
        onPress={() => router.push("/(seller)/payouts/settings" as any)}
      >
        <Ionicons name="wallet-outline" size={18} color={colors.light.foreground} />
        <Text style={styles.rowText}>Payout settings</Text>
        <Ionicons name="chevron-forward" size={14} color={colors.light.mutedForeground} />
      </TouchableOpacity>
      <TouchableOpacity style={[styles.row, styles.logoutRow]} onPress={handleSignOut}>
        <Ionicons name="log-out-outline" size={18} color={colors.light.destructive} />
        <Text style={styles.logoutText}>Sign out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  content: { padding: spacing[4], gap: spacing[4], paddingBottom: 80 },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.light.background,
  },
  loadingText: {
    color: colors.light.mutedForeground,
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    backgroundColor: colors.light.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.light.border,
    padding: spacing[4],
  },
  rowText: {
    flex: 1,
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.base,
    color: colors.light.foreground,
  },
  logoutRow: { borderColor: colors.light.destructive },
  logoutText: {
    flex: 1,
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.base,
    color: colors.light.destructive,
  },
});
