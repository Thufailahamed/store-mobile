/**
 * Order invoice — native render of the backend invoice (same data as the
 * web PDF). scope="buyer" reads GET /api/orders/:id/invoice, scope="seller"
 * GET /api/seller/orders/:id/invoice (store-ownership checked server-side). Issued at placement; flips to PAID live via
 * Realtime when the order's payment_status changes (COD: when the rider
 * collects cash). "Save PDF" opens the signed printable view.
 */
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import * as WebBrowser from "expo-web-browser";
import { Ionicons } from "@/components/ui/Icon";
import { ScreenHeader } from "@/components/layout";
import { useToast } from "@/components/ui";
import {
  getOrderInvoiceBackend,
  getSellerOrderInvoiceBackend,
  type OrderInvoice,
  type SellerSettlement,
} from "@/lib/api/backend";
import { supabase } from "@/lib/supabase/client";
import { colors, radii, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

const P = {
  ink: "#0B0B0C",
  body: "#2A2A2E",
  muted: "#7A7A80",
  faint: "#B4B4BA",
  rule: "#E6E4DF",
  paper: "#FAF8F4",
  gold: "#B08D57",
  paid: "#1F7A4D",
  paidBg: "#E7F3EC",
  due: "#9A6A12",
  dueBg: "#FBF1DC",
  bad: "#8A2E2E",
  badBg: "#F7E6E6",
};

function money(currency: string, n: number) {
  return `${currency} ${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function statusMeta(inv: OrderInvoice): { label: string; fg: string; bg: string } {
  switch (inv.status) {
    case "paid":
      return { label: "Paid", fg: P.paid, bg: P.paidBg };
    case "refunded":
      return { label: "Refunded", fg: P.bad, bg: P.badBg };
    case "partially_refunded":
      return { label: "Part refunded", fg: P.bad, bg: P.badBg };
    case "void":
      return { label: "Void", fg: P.bad, bg: P.badBg };
    case "failed":
      return { label: "Payment failed", fg: P.bad, bg: P.badBg };
    default:
      return inv.payment_method === "cod"
        ? { label: "Unpaid · COD", fg: P.due, bg: P.dueBg }
        : { label: "Payment due", fg: P.due, bg: P.dueBg };
  }
}

const isSettled = (inv: OrderInvoice) =>
  inv.status === "paid" || inv.status === "refunded" || inv.status === "partially_refunded";

function Lab({ children, style }: { children: React.ReactNode; style?: object }) {
  return <Text style={[s.lab, style]}>{children}</Text>;
}

function SumRow({ k, v, accent, strong }: { k: string; v: string; accent?: boolean; strong?: boolean }) {
  return (
    <View style={[s.sumRow, strong && s.sumRowStrong]}>
      <Text style={[s.sumK, strong && s.sumStrong]} numberOfLines={1}>{k}</Text>
      <Text style={[s.sumV, accent && { color: P.paid }, strong && s.sumStrong]}>{v}</Text>
    </View>
  );
}

export function InvoiceScreen({ scope = "buyer" }: { scope?: "buyer" | "seller" }) {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { toast } = useToast();
  const [inv, setInv] = useState<OrderInvoice | null>(null);
  const [settlement, setSettlement] = useState<SellerSettlement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchInvoice = scope === "seller" ? getSellerOrderInvoiceBackend : getOrderInvoiceBackend;

  const load = useCallback(async () => {
    if (!id) return;
    const res = await fetchInvoice(id);
    if (res.ok && res.data.invoice?.invoice_number) {
      setInv(res.data.invoice);
      setSettlement((res.data as { settlement?: SellerSettlement | null }).settlement ?? null);
      setError(null);
    } else {
      setError(res.ok ? "Invoice not available yet." : res.error);
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, scope]);

  useEffect(() => {
    void load();
  }, [load]);

  // Flip to PAID live when the order's payment_status changes.
  useEffect(() => {
    if (!id) return;
    const uniqueId = Math.random().toString(36).slice(2, 10);
    const ch = supabase
      .channel(`order-invoice-${id}-${uniqueId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${id}` }, () => {
        void load();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [id, load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const openPrintable = async () => {
    // Re-fetch so the signed link is fresh (24h TTL).
    const res = await fetchInvoice(id!);
    const url = res.ok ? res.data.invoice?.invoice_url : null;
    if (!url) {
      toast(res.ok ? "Printable invoice unavailable" : res.error, "error");
      return;
    }
    await WebBrowser.openBrowserAsync(url);
  };

  const share = async () => {
    if (!inv) return;
    const due = isSettled(inv) ? `Paid ${money(inv.currency, inv.totals.amount_paid)}` : `Due ${money(inv.currency, inv.totals.amount_due)}`;
    await Share.share({
      message: `LUXE invoice ${inv.invoice_number} · Order ${inv.order_number} · ${due}${inv.invoice_url ? `\n${inv.invoice_url}` : ""}`,
    }).catch(() => undefined);
  };

  const header = (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader
        title="Invoice"
        onBack={() => router.back()}
        right={
          inv ? (
            <TouchableOpacity onPress={share} accessibilityLabel="Share invoice" hitSlop={10}>
              <Ionicons name="share-outline" size={20} color={colors.light.foreground} />
            </TouchableOpacity>
          ) : undefined
        }
      />
    </>
  );

  if (loading) {
    return (
      <SafeAreaView style={s.screen} edges={["left", "right"]}>
        {header}
        <View style={s.center}><ActivityIndicator color={P.ink} /></View>
      </SafeAreaView>
    );
  }

  if (!inv) {
    return (
      <SafeAreaView style={s.screen} edges={["left", "right"]}>
        {header}
        <View style={s.center}>
          <Ionicons name="document-text-outline" size={28} color={P.muted} />
          <Text style={s.errText}>{error ?? "Invoice not found."}</Text>
          <TouchableOpacity style={s.ghostBtn} onPress={() => void load()}>
            <Text style={s.ghostBtnText}>Try again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const t = inv.totals;
  const c = inv.currency;
  const st = statusMeta(inv);
  const settled = isSettled(inv);
  const remainderPaid = Math.round((t.amount_paid - t.gift_card_credit) * 100) / 100;
  const bandLabel = settled ? "Total paid" : inv.status === "void" ? "Nothing due" : inv.payment_method === "cod" ? "Due on delivery" : "Amount due";

  return (
    <SafeAreaView style={s.screen} edges={["left", "right"]}>
      {header}
      <ScrollView
        contentContainerStyle={{ padding: spacing[4], paddingBottom: insets.bottom + 110 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={s.sheet}>
          <View style={s.topBand} />
          {/* Header */}
          <View style={s.headRow}>
            <View>
              <Text style={s.brand}>LUXE</Text>
              <Lab style={{ marginTop: 2 }}>Curated fashion</Lab>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={s.title}>Invoice</Text>
              <Text style={s.invNo}>{inv.invoice_number}</Text>
            </View>
          </View>
          <View style={s.inkRule} />

          {/* Status */}
          <View style={[s.pill, { backgroundColor: st.bg }]}>
            <View style={[s.pillDot, { backgroundColor: st.fg }]} />
            <Text style={[s.pillText, { color: st.fg }]}>{st.label}</Text>
          </View>

          {/* Meta */}
          <View style={s.metaGrid}>
            {[
              ["Order", inv.order_number],
              ["Issued", fmtDate(inv.issued_at)],
              ["Payment", inv.payment_label],
              inv.paid_at ? ["Paid on", fmtDate(inv.paid_at)] : ["Delivered", fmtDate(inv.delivered_at)],
            ].map(([k, v]) => (
              <View key={k} style={s.metaCell}>
                <Lab>{k}</Lab>
                <Text style={s.metaV} numberOfLines={2}>{v}</Text>
              </View>
            ))}
          </View>

          {/* Parties */}
          <View style={[s.party, { borderLeftColor: P.gold }]}>
            <Lab>Billed & shipped to</Lab>
            <Text style={s.partyName}>{inv.buyer.name}</Text>
            {[...inv.buyer.address_lines, inv.buyer.phone, inv.buyer.email].filter(Boolean).map((l) => (
              <Text key={String(l)} style={s.partyLine}>{l}</Text>
            ))}
          </View>
          <View style={[s.party, { borderLeftColor: P.ink }]}>
            <Lab>Sold by</Lab>
            <Text style={s.partyName}>{inv.seller.name}</Text>
            {[inv.seller.origin, inv.seller.email, inv.seller.phone].filter(Boolean).map((l) => (
              <Text key={String(l)} style={s.partyLine}>{l}</Text>
            ))}
            <Text style={[s.partyLine, { color: P.muted }]}>via LUXE Marketplace · Colombo</Text>
          </View>

          {/* Lines */}
          <View style={s.tableHead}>
            <Lab>Item</Lab>
            <Lab>Amount</Lab>
          </View>
          {inv.lines.map((l) => (
            <View key={l.id} style={s.line}>
              {l.image_url ? (
                <Image source={{ uri: l.image_url }} style={s.thumb} contentFit="cover" />
              ) : (
                <View style={[s.thumb, s.mono]}><Text style={s.monoText}>{l.name.charAt(0).toUpperCase()}</Text></View>
              )}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.lineName} numberOfLines={2}>{l.name}</Text>
                {(l.variant || l.sku) && (
                  <Text style={s.lineSub} numberOfLines={1}>{[l.variant, l.sku ? `SKU ${l.sku}` : null].filter(Boolean).join(" · ")}</Text>
                )}
                <Text style={s.lineSub}>{l.quantity} × {money(c, l.unit_price)}</Text>
                {l.is_gift && <Text style={s.gift} numberOfLines={1}>{l.gift_message ? `Gift — “${l.gift_message}”` : "Gift wrapped"}</Text>}
              </View>
              <Text style={s.lineTotal}>{money(c, l.total)}</Text>
            </View>
          ))}

          {/* Totals */}
          <View style={{ marginTop: spacing[4] }}>
            <SumRow k="Subtotal" v={money(c, t.subtotal)} />
            {t.coupon_discount > 0 && <SumRow k={t.coupon_code ? `Coupon ${t.coupon_code}` : "Coupon"} v={`– ${money(c, t.coupon_discount)}`} accent />}
            {t.points_discount > 0 && <SumRow k={`Points (${t.points_redeemed.toLocaleString()} pts)`} v={`– ${money(c, t.points_discount)}`} accent />}
            <SumRow k="Shipping" v={t.shipping > 0 ? money(c, t.shipping) : "Complimentary"} />
            {t.tax > 0 && <SumRow k="Platform fee" v={money(c, t.tax)} />}
            <SumRow k="Invoice total" v={money(c, t.total)} strong />
            {t.gift_card_credit > 0 && (
              <SumRow k={`Paid · gift card${t.gift_card_code ? ` ${t.gift_card_code}` : ""}`} v={money(c, t.gift_card_credit)} accent />
            )}
            {settled && remainderPaid > 0 && <SumRow k={`Paid · ${inv.payment_label}`} v={money(c, remainderPaid)} accent />}
          </View>

          <View style={s.band}>
            <Text style={s.bandLab}>{bandLabel.toUpperCase()}</Text>
            <Text style={s.bandAmt}>{money(c, settled ? t.amount_paid : t.amount_due)}</Text>
          </View>
          {inv.paid_at ? (
            <Text style={s.paidNote}>Paid in full on {fmtDate(inv.paid_at)} · {inv.payment_label}</Text>
          ) : inv.payment_method === "cod" && inv.status === "unpaid" ? (
            <Text style={[s.paidNote, { color: P.due }]}>
              {scope === "seller"
                ? `Collect ${money(c, t.amount_due)} in cash on delivery — switches to Paid once collected.`
                : "Pay the rider in cash — this invoice switches to Paid once collected."}
            </Text>
          ) : null}

          {inv.status === "paid" && (
            <View style={s.stamp} pointerEvents="none">
              <Text style={s.stampText}>PAID</Text>
            </View>
          )}

          <Text style={s.thanks}>Thank you.</Text>
          <Text style={s.fine}>This is a computer-generated invoice and does not require a signature.</Text>
        </View>

        {scope === "seller" && settlement && (
          <View style={s.settle}>
            <Lab>Your earnings · not shown to the customer</Lab>
            <SumRow k="Your items" v={money(c, settlement.gross)} />
            <SumRow k={`Platform fee${settlement.rate_pct ? ` (${settlement.rate_pct}%)` : ""}`} v={`– ${money(c, settlement.commission)}`} />
            <SumRow
              k={`Payout · ${settlement.status === "paid_out" ? "paid out" : settlement.status === "reversed" ? "reversed" : "pending"}`}
              v={money(c, settlement.payout)}
              strong
            />
          </View>
        )}
      </ScrollView>

      <View style={[s.footer, { paddingBottom: insets.bottom + spacing[2] }]}>
        <TouchableOpacity style={s.primaryBtn} onPress={openPrintable} activeOpacity={0.85} accessibilityRole="button">
          <Ionicons name="download-outline" size={18} color="#fff" />
          <Text style={s.primaryBtnText}>Save as PDF</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.light.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing[2], padding: spacing[6] },
  errText: { fontFamily: fontFamilies.sans.medium, color: P.muted, textAlign: "center" },
  ghostBtn: { marginTop: spacing[2], borderWidth: 1, borderColor: P.rule, borderRadius: radii.full, paddingHorizontal: 18, paddingVertical: 9 },
  ghostBtnText: { fontFamily: fontFamilies.sans.semibold, color: P.ink },
  sheet: { backgroundColor: "#fff", borderRadius: 4, padding: 20, paddingTop: 26, overflow: "hidden" },
  topBand: { position: "absolute", top: 0, left: 0, right: 0, height: 5, backgroundColor: P.ink, borderBottomWidth: 1.5, borderBottomColor: P.gold },
  headRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  brand: { fontFamily: fontFamilies.display.regular, fontSize: 26, letterSpacing: 7, color: P.ink },
  title: { fontFamily: fontFamilies.display.italic, fontSize: 26, color: P.ink },
  invNo: { fontFamily: fontFamilies.mono.medium, fontSize: 11, color: P.muted, marginTop: 2 },
  inkRule: { height: 1, backgroundColor: P.ink, marginTop: 14, marginBottom: 14 },
  lab: { fontFamily: fontFamilies.sans.bold, fontSize: 9, letterSpacing: 1.3, textTransform: "uppercase", color: P.muted },
  pill: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5 },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { fontFamily: fontFamilies.sans.bold, fontSize: 10.5, letterSpacing: 1, textTransform: "uppercase" },
  metaGrid: { flexDirection: "row", flexWrap: "wrap", marginTop: 14, rowGap: 12 },
  metaCell: { width: "50%", paddingRight: 8 },
  metaV: { fontFamily: fontFamilies.sans.bold, fontSize: 13, color: P.ink, marginTop: 3 },
  party: { backgroundColor: P.paper, borderLeftWidth: 2, padding: 14, marginTop: 14 },
  partyName: { fontFamily: fontFamilies.display.regular, fontSize: 17, color: P.ink, marginTop: 5, marginBottom: 3 },
  partyLine: { fontFamily: fontFamilies.sans.regular, fontSize: 12.5, color: P.body, lineHeight: 18 },
  tableHead: { flexDirection: "row", justifyContent: "space-between", marginTop: 22, paddingBottom: 7, borderBottomWidth: 1, borderBottomColor: P.ink },
  line: { flexDirection: "row", gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: P.rule, alignItems: "flex-start" },
  thumb: { width: 42, height: 52, backgroundColor: P.paper },
  mono: { alignItems: "center", justifyContent: "center" },
  monoText: { fontFamily: fontFamilies.display.regular, fontSize: 18, color: P.faint },
  lineName: { fontFamily: fontFamilies.sans.bold, fontSize: 13, color: P.ink },
  lineSub: { fontFamily: fontFamilies.sans.regular, fontSize: 11.5, color: P.muted, marginTop: 2 },
  gift: { fontFamily: fontFamilies.display.italic, fontSize: 11.5, color: P.gold, marginTop: 2 },
  lineTotal: { fontFamily: fontFamilies.sans.bold, fontSize: 13, color: P.ink },
  sumRow: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 5 },
  sumRowStrong: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: P.rule, marginTop: 4, paddingTop: 9 },
  sumK: { flex: 1, fontFamily: fontFamilies.sans.regular, fontSize: 13, color: P.muted },
  sumV: { fontFamily: fontFamilies.sans.medium, fontSize: 13, color: P.body },
  sumStrong: { fontFamily: fontFamilies.sans.bold, color: P.ink },
  band: { marginTop: 12, backgroundColor: P.ink, borderBottomWidth: 2, borderBottomColor: P.gold, paddingHorizontal: 16, paddingVertical: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  bandLab: { fontFamily: fontFamilies.sans.bold, fontSize: 9.5, letterSpacing: 1.3, color: "#C9C9CE" },
  bandAmt: { fontFamily: fontFamilies.display.regular, fontSize: 20, color: "#fff" },
  paidNote: { marginTop: 8, fontFamily: fontFamilies.sans.medium, fontSize: 11.5, color: P.paid, textAlign: "right" },
  stamp: { alignSelf: "flex-start", marginTop: 18, borderWidth: 2.5, borderColor: P.paid, borderRadius: 6, paddingHorizontal: 22, paddingVertical: 5, transform: [{ rotate: "-10deg" }], opacity: 0.6 },
  stampText: { fontFamily: fontFamilies.sans.bold, fontSize: 22, letterSpacing: 7, color: P.paid },
  settle: { marginTop: spacing[4], backgroundColor: "#fff", borderRadius: 16, padding: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: P.rule },
  thanks: { marginTop: 22, fontFamily: fontFamilies.display.italic, fontSize: 18, color: P.ink },
  fine: { marginTop: 6, fontFamily: fontFamilies.sans.regular, fontSize: 10, color: P.faint },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: spacing[4], paddingTop: spacing[2], backgroundColor: colors.light.background, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.light.border },
  primaryBtn: { height: 52, borderRadius: radii.full, backgroundColor: P.ink, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  primaryBtnText: { fontFamily: fontFamilies.sans.semibold, fontSize: 15, color: "#fff" },
});
