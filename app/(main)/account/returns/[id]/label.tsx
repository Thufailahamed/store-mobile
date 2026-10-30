import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Share, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Ionicons } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui";
import { getReturnByGroupId } from "@/lib/api";
import { useAuth } from "@/lib/supabase/auth";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";
import { C, ParcelArt } from "@/components/orders/parcel-track";
import { ParcelScreen } from "@/components/orders/detail-chrome";

const DROPOFF = {
  company: "LUXE Returns",
  line1: "No. 42, Independence Avenue",
  line2: "Colombo 03",
  country: "Sri Lanka",
  phone: "+94 11 234 5678",
};

/** Decorative bar pattern derived from the return number (not a scannable code). */
function barPattern(seed: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < 46; i++) {
    const c = seed.charCodeAt(i % Math.max(seed.length, 1)) || 7;
    out.push(((c * (i + 3)) % 3) + 1);
  }
  return out;
}

export default function ReturnLabelScreen() {
  const router = useRouter();
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

  const bars = useMemo(() => barPattern(summary?.return_number ?? ""), [summary?.return_number]);

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
    <ParcelScreen
      title="Return Label"
      onBack={() => router.back()}
      footer={
        summary ? (
          <TouchableOpacity style={styles.shareBtn} onPress={() => void shareLabel()} activeOpacity={0.88}>
            <Ionicons name="share-outline" size={17} color={C.lime} />
            <Text style={styles.shareBtnText}>Share label details</Text>
          </TouchableOpacity>
        ) : undefined
      }
    >
      {loading ? (
        <Skeleton height={460} borderRadius={26} />
      ) : error || !summary ? (
        <View style={styles.emptyCard}>
          <Ionicons name="cloud-offline-outline" size={26} color={C.muted} />
          <Text style={styles.emptyTitle}>{error ?? "Return not found"}</Text>
        </View>
      ) : (
        <>
          <View style={styles.intro}>
            <Text style={styles.introKicker}>PREPAID DROP-OFF</Text>
            <Text style={styles.introTitle}>Tape this to your parcel</Text>
            <Text style={styles.introSub}>Postage is covered. Hand it to the rider or any LUXE drop-off point.</Text>
          </View>

          <View style={styles.labelShadow}>
            <View style={styles.label}>
              <View style={styles.labelHead}>
                <View style={styles.labelBrand}>
                  <MaterialCommunityIcons name="keyboard-return" size={16} color={C.lime} />
                  <Text style={styles.labelBrandText}>LUXE RETURNS</Text>
                </View>
                <Text style={styles.labelPaid}>POSTAGE PAID</Text>
              </View>

              <View style={styles.labelBody}>
                <Text style={styles.fieldKicker}>FROM</Text>
                <Text style={styles.fieldValue}>Customer</Text>
                <Text style={styles.fieldSub}>
                  {summary.item_count} item{summary.item_count === 1 ? "" : "s"} · Order #{summary.order_number}
                </Text>

                <View style={styles.cut} />

                <Text style={styles.fieldKicker}>SHIP TO</Text>
                <Text style={styles.toCompany}>{DROPOFF.company}</Text>
                <Text style={styles.toLine}>{DROPOFF.line1}</Text>
                <Text style={styles.toLine}>
                  {DROPOFF.line2}, {DROPOFF.country}
                </Text>
                <Text style={styles.toPhone}>{DROPOFF.phone}</Text>

                <View style={styles.cut} />

                <View style={styles.barcode}>
                  {bars.map((w, i) => (
                    <View
                      key={i}
                      style={{ width: w, marginRight: (i * 7) % 3 === 0 ? 3 : 2, backgroundColor: C.ink, height: 56 }}
                    />
                  ))}
                </View>
                <Text style={styles.barcodeText}>{summary.return_number}</Text>
              </View>

              <View style={styles.labelFoot}>
                <View>
                  <Text style={styles.fieldKicker}>REFUND VALUE</Text>
                  <Text style={styles.footValue}>{formatPrice(summary.refund_amount, summary.currency)}</Text>
                </View>
              </View>
              <ParcelArt />
            </View>
          </View>
        </>
      )}
    </ParcelScreen>
  );
}

const styles = StyleSheet.create({
  intro: { paddingHorizontal: 4, gap: 4 },
  introKicker: { fontFamily: fontFamilies.mono.semibold, fontSize: 10, letterSpacing: 1.8, color: C.accent },
  introTitle: { fontFamily: fontFamilies.display.semibold, fontSize: 26, letterSpacing: -0.5, color: C.text },
  introSub: { fontFamily: fontFamilies.sans.regular, fontSize: 13.5, lineHeight: 19, color: C.muted },

  labelShadow: {
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    shadowColor: "#16170f",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.09,
    shadowRadius: 22,
    elevation: 4,
  },
  label: { borderRadius: 24, overflow: "hidden", backgroundColor: "#FFFFFF" },
  labelHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    height: 52,
    backgroundColor: C.ink,
  },
  labelBrand: { flexDirection: "row", alignItems: "center", gap: 8 },
  labelBrandText: { fontFamily: fontFamilies.mono.semibold, fontSize: 12, letterSpacing: 2, color: C.cream },
  labelPaid: { fontFamily: fontFamilies.mono.semibold, fontSize: 10, letterSpacing: 1.4, color: C.goldSoft },

  labelBody: { padding: 20 },
  fieldKicker: { fontFamily: fontFamilies.mono.semibold, fontSize: 10, letterSpacing: 1.6, color: C.muted },
  fieldValue: { marginTop: 4, fontFamily: fontFamilies.sans.bold, fontSize: 16, color: C.text },
  fieldSub: { marginTop: 2, fontFamily: fontFamilies.sans.regular, fontSize: 12.5, color: C.muted },
  cut: {
    marginVertical: 16,
    borderTopWidth: 1.5,
    borderTopColor: "rgba(22,23,15,0.18)",
    borderStyle: "dashed",
  },
  toCompany: {
    marginTop: 4,
    fontFamily: fontFamilies.display.semibold,
    fontSize: 24,
    letterSpacing: -0.4,
    color: C.text,
  },
  toLine: { marginTop: 2, fontFamily: fontFamilies.sans.medium, fontSize: 14.5, color: C.text },
  toPhone: { marginTop: 6, fontFamily: fontFamilies.mono.medium, fontSize: 12.5, color: C.muted },
  barcode: { flexDirection: "row", alignItems: "flex-end", justifyContent: "center", overflow: "hidden" },
  barcodeText: {
    marginTop: 8,
    textAlign: "center",
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 13,
    letterSpacing: 3,
    color: C.text,
  },
  labelFoot: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingRight: 130,
    borderTopWidth: 1,
    borderTopColor: C.line,
    backgroundColor: "#faf9f4",
  },
  footValue: { marginTop: 4, fontFamily: fontFamilies.sans.bold, fontSize: 18, color: C.text },

  shareBtn: {
    height: 54,
    borderRadius: 27,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: C.ink,
  },
  shareBtnText: { fontFamily: fontFamilies.sans.bold, fontSize: 15, color: C.cream },

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
  emptyTitle: { fontFamily: fontFamilies.sans.bold, fontSize: 17, color: C.text, textAlign: "center" },
});
