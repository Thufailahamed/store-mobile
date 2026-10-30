import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Ionicons } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui";
import { getReturnByGroupId } from "@/lib/api";
import { listReturnPickupsBackend } from "@/lib/api/backend";
import { useAuth } from "@/lib/supabase/auth";
import { fontFamilies } from "@/lib/theme/fonts";
import { C, DottedRail, ParcelArt, routeStyles, shortDate } from "@/components/orders/parcel-track";
import { ParcelScreen } from "@/components/orders/detail-chrome";

type McIcon = React.ComponentProps<typeof MaterialCommunityIcons>["name"];

const PICKUP_COPY: Record<string, { label: string; copy: string; icon: McIcon; stage: number }> = {
  scheduled: { label: "Pickup scheduled", copy: "A rider will collect your parcel on the scheduled window.", icon: "calendar-clock", stage: 0 },
  out_for_pickup: { label: "Rider on the way", copy: "Keep the items packed and ready at the door.", icon: "moped", stage: 1 },
  picked_up: { label: "Items collected", copy: "The rider has your return. Refund processing follows inspection.", icon: "package-variant-closed", stage: 2 },
  completed: { label: "Pickup completed", copy: "This return pickup is finished.", icon: "check-all", stage: 3 },
  failed: { label: "Pickup failed", copy: "We could not collect the parcel. Contact support to reschedule.", icon: "alert-circle-outline", stage: 1 },
  cancelled: { label: "Pickup cancelled", copy: "This pickup was cancelled.", icon: "close-circle-outline", stage: 0 },
};

const PICKUP_ICONS: McIcon[] = ["calendar-clock", "moped", "package-variant-closed", "check-all"];

export default function ReturnPickupScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [returnNumber, setReturnNumber] = useState<string | null>(null);
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
    setReturnNumber(retRes.data?.return_number ?? null);
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
  const closed = active?.status === "failed" || active?.status === "cancelled";

  const openSupport = () =>
    router.push({
      pathname: "/(main)/contact",
      params: {
        subject: `Return pickup${returnNumber ? ` #${returnNumber}` : ""}`,
        message: `I need help with the pickup for return${returnNumber ? ` #${returnNumber}` : ""}.`,
      },
    } as never);

  return (
    <ParcelScreen title="Return Pickup" onBack={() => router.back()}>
      {loading ? (
        <>
          <Skeleton height={200} borderRadius={28} />
          <Skeleton height={180} borderRadius={26} />
        </>
      ) : error ? (
        <View style={styles.emptyCard}>
          <Ionicons name="cloud-offline-outline" size={26} color={C.muted} />
          <Text style={styles.emptyTitle}>Couldn’t load pickup</Text>
          <Text style={styles.emptySub}>{error}</Text>
          <TouchableOpacity style={styles.darkBtn} onPress={() => void load()} activeOpacity={0.85}>
            <Text style={styles.darkBtnText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : !active || !tone ? (
        <View style={styles.emptyCard}>
          <View style={styles.emptyArt}>
            <MaterialCommunityIcons name="calendar-clock" size={32} color={C.accent} />
          </View>
          <Text style={styles.emptyTitle}>Pickup not scheduled yet</Text>
          <Text style={styles.emptySub}>
            Once a rider is assigned you’ll see the window here. You can drop off with the prepaid label in the
            meantime.
          </Text>
          <TouchableOpacity
            style={styles.darkBtn}
            onPress={() =>
              router.push({ pathname: "/(main)/account/returns/[id]/label", params: { id } } as never)
            }
            activeOpacity={0.85}
          >
            <Ionicons name="print-outline" size={15} color={C.lime} />
            <Text style={styles.darkBtnText}>Prepaid return label</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={styles.hero}>
            <View style={[styles.heroIcon, closed && { backgroundColor: C.rust }]}>
              <MaterialCommunityIcons name={tone.icon} size={26} color={closed ? C.cream : C.ink} />
            </View>
            <Text style={styles.heroKicker}>{returnNumber ? `RETURN ${returnNumber}` : "RETURN PICKUP"}</Text>
            <Text style={styles.heroTitle}>{tone.label}</Text>
            <Text style={styles.heroCopy}>{tone.copy}</Text>
          </View>

          <View style={styles.cardShadow}>
            <View style={styles.card}>
              <ParcelArt />
              <Text style={styles.cardLabel}>Pickup progress</Text>
              <DottedRail
                stage={tone.stage}
                icons={PICKUP_ICONS}
                finished={active.status === "completed"}
                closed={closed}
                label={closed ? (active.status === "failed" ? "Failed" : "Cancelled") : tone.stage === 1 ? "On the way" : null}
              />
              <View style={routeStyles.route}>
                <View style={routeStyles.routeCol}>
                  <Text style={routeStyles.routeLabel}>WINDOW</Text>
                  <Text style={routeStyles.routeValue} numberOfLines={1}>
                    {active.scheduled_for ? shortDate(active.scheduled_for) : "To be confirmed"}
                  </Text>
                  <Text style={routeStyles.routeSub} numberOfLines={1}>
                    {active.scheduled_for
                      ? new Date(active.scheduled_for).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
                      : "We’ll notify you"}
                  </Text>
                </View>
                <View style={routeStyles.routeCol}>
                  <Text style={routeStyles.routeLabel}>COLLECT FROM</Text>
                  <Text style={routeStyles.routeValue} numberOfLines={2}>
                    {active.address || "Your delivery address"}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.tips}>
            {[
              { icon: "cube-outline" as const, text: "Pack items in their original bags and box." },
              { icon: "pricetag-outline" as const, text: "Keep all tags and authenticity seals attached." },
              { icon: "call-outline" as const, text: "Keep your phone nearby — the rider may call." },
            ].map((t) => (
              <View key={t.text} style={styles.tipRow}>
                <View style={styles.tipIcon}>
                  <Ionicons name={t.icon} size={15} color={C.accent} />
                </View>
                <Text style={styles.tipText}>{t.text}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity style={styles.outlineBtn} onPress={openSupport} activeOpacity={0.85}>
            <Ionicons name="headset-outline" size={16} color={C.text} />
            <Text style={styles.outlineBtnText}>{closed ? "Reschedule with support" : "Contact support"}</Text>
          </TouchableOpacity>
        </>
      )}
    </ParcelScreen>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: "center",
    paddingVertical: 28,
    paddingHorizontal: 24,
    borderRadius: 28,
    backgroundColor: C.ink,
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: C.lime,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  heroKicker: { fontFamily: fontFamilies.mono.semibold, fontSize: 10, letterSpacing: 1.8, color: C.goldSoft },
  heroTitle: {
    marginTop: 6,
    fontFamily: fontFamilies.display.semibold,
    fontSize: 26,
    letterSpacing: -0.5,
    color: C.cream,
    textAlign: "center",
  },
  heroCopy: {
    marginTop: 6,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13.5,
    lineHeight: 19,
    color: "rgba(250,248,241,0.65)",
    textAlign: "center",
  },

  cardShadow: {
    borderRadius: 26,
    backgroundColor: "#FFFFFF",
    shadowColor: "#16170f",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.07,
    shadowRadius: 20,
    elevation: 3,
  },
  card: { borderRadius: 26, overflow: "hidden", borderWidth: 1, borderColor: C.line, padding: 20 },
  cardLabel: { fontFamily: fontFamilies.sans.medium, fontSize: 13.5, color: C.muted },

  tips: {
    padding: 16,
    gap: 12,
    borderRadius: 24,
    backgroundColor: "#faf9f4",
    borderWidth: 1,
    borderColor: C.line,
  },
  tipRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  tipIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: C.line,
    alignItems: "center",
    justifyContent: "center",
  },
  tipText: { flex: 1, fontFamily: fontFamilies.sans.medium, fontSize: 13.5, color: C.text },

  outlineBtn: {
    height: 50,
    borderRadius: 25,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(22,23,15,0.12)",
    backgroundColor: "#FFFFFF",
  },
  outlineBtnText: { fontFamily: fontFamilies.sans.bold, fontSize: 14, color: C.text },

  emptyCard: {
    alignItems: "center",
    paddingVertical: 36,
    paddingHorizontal: 26,
    borderRadius: 26,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: C.line,
    gap: 8,
  },
  emptyArt: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: C.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  emptyTitle: { fontFamily: fontFamilies.sans.bold, fontSize: 18, letterSpacing: -0.3, color: C.text, textAlign: "center" },
  emptySub: { fontFamily: fontFamilies.sans.regular, fontSize: 13.5, lineHeight: 19, color: C.muted, textAlign: "center" },
  darkBtn: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 46,
    paddingHorizontal: 22,
    borderRadius: 23,
    backgroundColor: C.ink,
  },
  darkBtnText: { fontFamily: fontFamilies.sans.bold, fontSize: 14, color: C.cream },
});
