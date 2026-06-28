import React, { useState } from "react";
import { View, FlatList, StyleSheet, RefreshControl, Pressable, Share, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { Card, Badge, useToast } from "@/components/ui";
import { Display, Label, Body } from "@/components/ui/Typography";
import { ScreenHeader } from "@/components/layout";
import { useQuery } from "@tanstack/react-query";
import { getMyGiftCards } from "@/lib/api";
import { colors, radii, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";

type GiftCard = {
  id: string;
  code: string;
  current_balance: number;
  initial_balance: number;
  currency: string;
  recipient_email: string | null;
  recipient_name: string | null;
  message: string | null;
  scheduled_for: string | null;
  email_sent_at: string | null;
  expires_at: string | null;
  voided_at: string | null;
  is_active: boolean;
  source: "purchased" | "received";
};

export default function AccountGiftCards() {
  const router = useRouter();
  const { toast } = useToast();
  const q = useQuery({
    queryKey: ["my-gift-cards"],
    queryFn: async () => {
      const r = await getMyGiftCards();
      return r.ok ? (r.data.cards as GiftCard[]) : [];
    },
  });

  const copyCode = async (code: string) => {
    try {
      await Share.share({ message: code });
    } catch {
      Alert.alert("Copy failed");
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.light.background }}>
      <View style={{ padding: 20, paddingBottom: 8 }}>
        <ScreenHeader title="Gift cards" />
        <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
          <Pressable style={[styles.pill]} onPress={() => router.push("/(main)/gift-cards" as never)}>
            <Ionicons name="add" size={14} color="#fff" />
            <Label style={{ color: "#fff", marginLeft: 4 }}>Buy</Label>
          </Pressable>
          <Pressable style={[styles.pill, { backgroundColor: colors.olive[100] }]} onPress={() => router.push("/(main)/gift-cards/redeem" as never)}>
            <Ionicons name="gift-outline" size={14} color={colors.olive[700]} />
            <Label style={{ color: colors.olive[700], marginLeft: 4 }}>Redeem</Label>
          </Pressable>
        </View>
      </View>
      <FlatList
        data={q.data ?? []}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ padding: 20, gap: 10, paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} />}
        ListEmptyComponent={
          q.isLoading ? null : (
            <Card style={{ padding: 30, alignItems: "center", gap: 6 }}>
              <Ionicons name="gift-outline" size={36} color={colors.light.mutedForeground} />
              <Body muted>No gift cards yet.</Body>
            </Card>
          )
        }
        renderItem={({ item }) => {
          const purchased = item.source === "purchased";
          return (
            <Card style={{ padding: 14, gap: 6, ...shadows.soft }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Pressable onPress={() => copyCode(item.code)}>
                  <Body style={{ fontFamily: fontFamilies.mono.semibold, fontSize: 14 }}>{item.code}</Body>
                </Pressable>
                <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                  {item.voided_at && <Badge text="Voided" variant="destructive" />}
                  {!item.voided_at && item.is_active && (
                    <Badge text={`${formatPrice(item.current_balance, item.currency)}`} variant="secondary" />
                  )}
                </View>
              </View>
              <Body muted size="sm">
                {purchased ? (
                  <>To: {item.recipient_email ?? "—"}</>
                ) : (
                  <>From: {item.recipient_name ?? "Someone"}</>
                )}
                {item.message ? <> · <Body muted italic size="sm">"{item.message}"</Body></> : null}
              </Body>
              <View style={{ flexDirection: "row", gap: 6 }}>
                {item.scheduled_for && !item.email_sent_at && (
                  <Badge text={`Scheduled ${new Date(item.scheduled_for).toLocaleDateString()}`} variant="outline" />
                )}
                {item.expires_at && (
                  <Body size="xs" muted>Expires {new Date(item.expires_at).toLocaleDateString()}</Body>
                )}
              </View>
            </Card>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: radii.full,
    backgroundColor: colors.olive[700],
  },
});
