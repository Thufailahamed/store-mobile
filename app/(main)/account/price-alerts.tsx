import React, { useState } from "react";
import {
  View, FlatList, StyleSheet, RefreshControl, Pressable, Alert, TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { Card, useToast } from "@/components/ui";
import { Display, Label, Body } from "@/components/ui/Typography";
import { ScreenHeader } from "@/components/layout";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listPriceAlerts, updatePriceAlert, unsubscribePriceAlert } from "@/lib/api";
import { colors, radii, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";

type PriceAlert = {
  id: string;
  product_id: string;
  variant_id: string | null;
  threshold_price: number | null;
  current_price_at_signup: number;
  currency: string;
  is_active: boolean;
  cancelled_at: string | null;
  product: { id: string; name: string; slug: string; price: number | null } | null;
};

export default function PriceAlertsScreen() {
  const router = useRouter();
  const { toast } = useToast();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["price-alerts"],
    queryFn: async () => {
      const r = await listPriceAlerts();
      return r.ok ? (r.data.alerts as PriceAlert[]) : [];
    },
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const onSaveThreshold = async (id: string) => {
    const num = editValue === "" ? null : Number(editValue);
    const r = await updatePriceAlert(id, { threshold_price: num });
    if (r.ok) {
      toast("Updated", "success");
      setEditingId(null);
      qc.invalidateQueries({ queryKey: ["price-alerts"] });
    } else {
      toast(r.error.message, "error");
    }
  };

  const onCancel = async (id: string) => {
    const r = await unsubscribePriceAlert(id);
    if (r.ok) {
      toast("Cancelled", "success");
      qc.invalidateQueries({ queryKey: ["price-alerts"] });
    } else {
      toast(r.error.message, "error");
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.light.background }}>
      <View style={{ padding: 20, paddingBottom: 8 }}>
        <ScreenHeader title="Price alerts" />
      </View>
      <FlatList
        data={q.data ?? []}
        keyExtractor={(a) => a.id}
        contentContainerStyle={{ padding: 20, gap: 10, paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} />}
        ListEmptyComponent={
          q.isLoading ? null : (
            <Card style={{ padding: 30, alignItems: "center", gap: 6 }}>
              <Ionicons name="notifications-off-outline" size={36} color={colors.light.mutedForeground} />
              <Body muted>No alerts yet. Tap "Notify me on price drop" on a product.</Body>
            </Card>
          )
        }
        renderItem={({ item }) => {
          const editing = editingId === item.id;
          return (
            <Card style={{ padding: 14, gap: 6, ...shadows.soft }}>
              <Pressable onPress={() => item.product?.slug && router.push(`/(main)/products/${item.product.slug}`)}>
                <Body style={{ fontWeight: "600" }}>{item.product?.name ?? "Product"}</Body>
              </Pressable>
              <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                <Body size="sm" muted>
                  Current: {formatPrice(item.current_price_at_signup, item.currency)}
                </Body>
                {item.threshold_price != null && (
                  <Body size="sm" muted>· ≤ {formatPrice(item.threshold_price, item.currency)}</Body>
                )}
              </View>
              {editing ? (
                <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                  <TextInput
                    style={styles.input}
                    value={editValue}
                    onChangeText={setEditValue}
                    placeholder={`New threshold (${item.currency})`}
                    keyboardType="numeric"
                    placeholderTextColor={colors.light.mutedForeground}
                  />
                  <Pressable onPress={() => onSaveThreshold(item.id)} style={styles.saveBtn}>
                    <Label style={{ color: "#fff" }}>Save</Label>
                  </Pressable>
                  <Pressable onPress={() => setEditingId(null)}>
                    <Label style={{ color: colors.light.mutedForeground }}>×</Label>
                  </Pressable>
                </View>
              ) : (
                <View style={{ flexDirection: "row", gap: 12, marginTop: 4 }}>
                  <Pressable onPress={() => { setEditingId(item.id); setEditValue(item.threshold_price?.toString() ?? ""); }}>
                    <Label style={{ color: colors.olive[700] }}>Edit threshold</Label>
                  </Pressable>
                  <Pressable onPress={() => onCancel(item.id)}>
                    <Label style={{ color: "#b45309" }}>Cancel</Label>
                  </Pressable>
                </View>
              )}
            </Card>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  input: {
    flex: 1,
    backgroundColor: colors.light.card,
    borderRadius: radii.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontFamily: fontFamilies.sans.regular,
    color: colors.light.foreground,
    fontSize: 13,
  },
  saveBtn: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: radii.md,
    backgroundColor: colors.olive[700],
  },
});
