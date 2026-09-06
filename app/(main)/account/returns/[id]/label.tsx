import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, Share, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { ScreenHeader } from "@/components/layout";
import { Button } from "@/components/ui";
import { Body, Display, Label } from "@/components/ui/Typography";
import { getReturnByGroupId } from "@/lib/api";
import { useAuth } from "@/lib/supabase/auth";
import { colors, radii, spacing } from "@/lib/theme/tokens";
import { formatPrice } from "@/lib/utils";

const DROPOFF = {
  company: "LUXE Returns",
  line1: "No. 42, Independence Avenue",
  line2: "Colombo 03",
  country: "Sri Lanka",
  phone: "+94 11 234 5678",
};

export default function ReturnLabelScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{
    return_number: string;
    order_number: string;
    refund_amount: number;
    currency: string;
    item_count: number;
  } | null>(null);

  const load = useCallback(async () => {
    if (!user?.id || !id) return;
    setLoading(true);
    const res = await getReturnByGroupId(user.id, id);
    setLoading(false);
    if (!res.ok) {
      setError(res.error ?? "Could not load return");
      return;
    }
    if (!res.data) {
      setError("Return not found");
      return;
    }
    setSummary({
      return_number: res.data.return_number,
      order_number: res.data.order_number,
      refund_amount: res.data.refund_amount,
      currency: res.data.currency,
      item_count: res.data.items.length,
    });
  }, [user?.id, id]);

  useEffect(() => {
    void load();
  }, [load]);

  const shareLabel = async () => {
    if (!summary) return;
    const text = [
      `LUXE return label · #${summary.return_number}`,
      `Order #${summary.order_number}`,
      `Ship to: ${DROPOFF.company}`,
      DROPOFF.line1,
      DROPOFF.line2,
      DROPOFF.country,
      DROPOFF.phone,
    ].join("\n");
    await Share.share({ message: text });
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader title="Return label" />
      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <Body muted>Loading label…</Body>
        ) : error || !summary ? (
          <Body muted>{error ?? "Return not found"}</Body>
        ) : (
          <>
            <Display size="xl">Prepaid drop-off</Display>
            <Body muted>
              Tape this address to the parcel. Return #{summary.return_number} · Order #{summary.order_number}
            </Body>
            <View style={styles.card}>
              <Label>From</Label>
              <Body>Customer · {summary.item_count} item{summary.item_count === 1 ? "" : "s"}</Body>
              <Body size="sm" muted>
                Refund {formatPrice(summary.refund_amount, summary.currency)}
              </Body>
            </View>
            <View style={styles.card}>
              <Label>To (drop-off)</Label>
              <Display size="lg">{DROPOFF.company}</Display>
              <Body>{DROPOFF.line1}</Body>
              <Body>{DROPOFF.line2}</Body>
              <Body>{DROPOFF.country}</Body>
              <Body size="sm">{DROPOFF.phone}</Body>
            </View>
            <Button onPress={() => void shareLabel()}>Share label details</Button>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  content: { padding: spacing[5], gap: spacing[4] },
  card: {
    gap: 4,
    padding: spacing[5],
    borderRadius: radii["2xl"],
    backgroundColor: colors.light.card,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
});
