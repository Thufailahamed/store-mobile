import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { ScreenHeader } from "@/components/layout";
import { Body, Display, Label } from "@/components/ui/Typography";
import { getReturnByGroupId } from "@/lib/api";
import { listReturnPickupsBackend } from "@/lib/api/backend";
import { useAuth } from "@/lib/supabase/auth";
import { colors, radii, spacing } from "@/lib/theme/tokens";

const PICKUP_COPY: Record<string, { label: string; copy: string; icon: keyof typeof Ionicons.glyphMap }> = {
  scheduled: { label: "Pickup scheduled", copy: "A rider will collect your parcel on the scheduled window.", icon: "calendar-outline" },
  out_for_pickup: { label: "Rider on the way", copy: "Keep the items packed and ready at the door.", icon: "navigate-outline" },
  picked_up: { label: "Items collected", copy: "The rider has your return. Refund processing follows inspection.", icon: "cube-outline" },
  completed: { label: "Pickup completed", copy: "This return pickup is finished.", icon: "checkmark-circle-outline" },
  failed: { label: "Pickup failed", copy: "We could not collect the parcel. Contact support to reschedule.", icon: "alert-circle-outline" },
  cancelled: { label: "Pickup cancelled", copy: "This pickup was cancelled.", icon: "close-circle-outline" },
};

export default function ReturnPickupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pickups, setPickups] = useState<Array<{
    id: string;
    return_id: string;
    scheduled_for: string | null;
    status: string;
    address: string | null;
  }>>([]);

  const load = useCallback(async () => {
    if (!user?.id || !id) return;
    setLoading(true);
    setError(null);
    const [retRes, pickupRes] = await Promise.all([
      getReturnByGroupId(user.id, id),
      listReturnPickupsBackend(),
    ]);
    if (!retRes.ok) {
      setError(retRes.error ?? "Could not load return");
      setLoading(false);
      return;
    }
    const itemIds = new Set((retRes.data?.items ?? []).map((it) => it.return_id).filter(Boolean));
    const all = pickupRes.ok ? pickupRes.data.pickups ?? [] : [];
    setPickups(
      all.filter((p) => p.return_id === id || itemIds.has(p.return_id)),
    );
    if (!pickupRes.ok && all.length === 0) setError(pickupRes.error);
    setLoading(false);
  }, [user?.id, id]);

  useEffect(() => {
    void load();
  }, [load]);

  const active = pickups.find((p) => !["completed", "cancelled", "failed"].includes(p.status)) ?? pickups[0];
  const tone = active ? PICKUP_COPY[active.status] ?? PICKUP_COPY.scheduled : null;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader title="Return pickup" />
      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <Body muted>Loading pickup…</Body>
        ) : error ? (
          <Body muted>{error}</Body>
        ) : !active ? (
          <View style={styles.card}>
            <Ionicons name="time-outline" size={28} color={colors.light.mutedForeground} />
            <Display size="lg">Pickup not scheduled yet</Display>
            <Body muted>
              After the seller approves, a rider is assigned. You can drop off with the prepaid label in the meantime.
            </Body>
          </View>
        ) : (
          <View style={styles.card}>
            <Ionicons name={tone?.icon ?? "navigate-outline"} size={28} color={colors.olive[700]} />
            <Display size="lg">{tone?.label}</Display>
            <Body muted>{tone?.copy}</Body>
            {active.scheduled_for ? (
              <Label>Window · {new Date(active.scheduled_for).toLocaleString()}</Label>
            ) : null}
            {active.address ? <Body size="sm">{active.address}</Body> : null}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  content: { padding: spacing[5], gap: spacing[4] },
  card: {
    gap: spacing[2],
    padding: spacing[5],
    borderRadius: radii["2xl"],
    backgroundColor: colors.light.card,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
});
