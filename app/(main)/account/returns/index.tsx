import React, { useEffect, useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { ScreenHeader } from "@/components/layout";
import { Badge } from "@/components/ui";
import { Body, Display, Label, Price } from "@/components/ui/Typography";
import { useAuth } from "@/lib/supabase/auth";
import { getReturns, type MobileReturnRequest } from "@/lib/api";
import { type ReturnStatus } from "@/lib/account-local";
import { colors, radii, shadows, spacing, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";

const STATUS_TONE: Record<ReturnStatus, { label: string; bg: string; fg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  requested: { label: "Requested", bg: colors.accent2.ochre + "20", fg: colors.accent2.ochre, icon: "hourglass-outline" },
  approved: { label: "Approved", bg: colors.olive[100], fg: colors.olive[700], icon: "checkmark-circle-outline" },
  received: { label: "Received", bg: colors.olive[100], fg: colors.olive[700], icon: "archive-outline" },
  refunded: { label: "Refunded", bg: colors.olive[200], fg: colors.olive[800], icon: "card-outline" },
  rejected: { label: "Rejected", bg: colors.light.destructive + "20", fg: colors.light.destructive, icon: "close-circle-outline" },
};

type Tab = "all" | ReturnStatus;

export default function ReturnsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [returns, setReturns] = useState<MobileReturnRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!user?.id) return;
    const userId = user.id;
    let cancelled = false;
    getReturns(userId).then((res) => {
      if (cancelled) return;
      if (res.ok) setReturns(res.data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const counts = useMemo(() => {
    return {
      all: returns.length,
      requested: returns.filter((r) => r.status === "requested").length,
      approved: returns.filter((r) => r.status === "approved").length,
      received: returns.filter((r) => r.status === "received").length,
      refunded: returns.filter((r) => r.status === "refunded").length,
      rejected: returns.filter((r) => r.status === "rejected").length,
    };
  }, [returns]);

  const filtered = useMemo(() => {
    let list = returns;
    if (tab !== "all") list = list.filter((r) => r.status === tab);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (r) =>
          r.return_number.toLowerCase().includes(q) ||
          r.order_number.toLowerCase().includes(q) ||
          r.items.some((i) => i.product_name.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [returns, tab, query]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <ScreenHeader title="Returns" />
        <View style={styles.loading}>
          <Body muted>Loading returns…</Body>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader title="Returns" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View>
            <Label style={styles.heroLabel}>Reverse logistics</Label>
            <Display size="2xl" style={styles.heroTitle}>
              Returns & refunds
            </Display>
            <Body muted>Track what's coming back and what is on its way to your wallet.</Body>
          </View>
          <View style={styles.refundBadge}>
            <Ionicons name="refresh" size={18} color={colors.light.primaryForeground} />
          </View>
        </View>

        <View style={styles.statsGrid}>
          <Stat label="Active" value={counts.requested + counts.approved + counts.received} icon="hourglass-outline" />
          <Stat label="Refunded" value={counts.refunded} icon="card-outline" />
          <Stat label="Rejected" value={counts.rejected} icon="close-circle-outline" />
          <Stat label="Lifetime" value={returns.length} icon="archive-outline" />
        </View>

        <View style={styles.searchRow}>
          <View style={styles.searchInputWrap}>
            <Ionicons name="search-outline" size={14} color={colors.light.mutedForeground} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by order, return, or item"
              placeholderTextColor={colors.light.mutedForeground}
              value={query}
              onChangeText={setQuery}
            />
          </View>
        </View>

        <View style={styles.tabs}>
          {(["all", "requested", "approved", "received", "refunded", "rejected"] as Tab[]).map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.tab, tab === t && styles.tabActive]}
              onPress={() => setTab(t)}
            >
              <Body size="xs" style={[styles.tabText, tab === t && styles.tabTextActive]}>
                {t === "all" ? "All" : STATUS_TONE[t].label}
              </Body>
              <Body size="xs" style={[styles.tabCount, tab === t && styles.tabCountActive]}>
                {counts[t]}
              </Body>
            </TouchableOpacity>
          ))}
        </View>

        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="refresh-outline" size={28} color={colors.light.mutedForeground} />
            </View>
            <Display size="xl">No returns yet</Display>
            <Body muted>Return a delivered order to see it tracked here.</Body>
          </View>
        ) : (
          <View style={styles.list}>
            {filtered.map((r) => {
              const tone = STATUS_TONE[r.status];
              return (
                <TouchableOpacity
                  key={r.return_group_id}
                  style={styles.card}
                  onPress={() => router.push(`/(main)/account/returns/${r.return_group_id}` as never)}
                  activeOpacity={0.85}
                >
                  <View style={styles.cardTop}>
                    <View style={styles.cardHeader}>
                      <Label style={styles.kicker}>Return #{r.return_number}</Label>
                      <Label style={styles.subtle}>Order #{r.order_number}</Label>
                    </View>
                    <Badge style={{ backgroundColor: tone.bg }}>
                      <View style={styles.statusContent}>
                        <Ionicons name={tone.icon} size={11} color={tone.fg} />
                        <Label style={{ color: tone.fg, fontSize: 10 }}>{tone.label}</Label>
                      </View>
                    </Badge>
                  </View>
                  <View style={styles.items}>
                    {r.items.slice(0, 2).map((item, i) => (
                      <Body key={i} size="sm" numberOfLines={1} style={styles.itemLine}>
                        {item.product_name}
                        {item.variant_label ? ` · ${item.variant_label}` : ""} ×{item.quantity}
                      </Body>
                    ))}
                    {r.items.length > 2 && (
                      <Body muted size="xs">+{r.items.length - 2} more</Body>
                    )}
                  </View>
                  <View style={styles.cardFooter}>
                    <View>
                      <Label style={styles.kicker}>Refund</Label>
                      <Price style={styles.refundValue}>{formatPrice(r.refund_amount, r.currency)}</Price>
                    </View>
                    <View style={styles.metaRight}>
                      <Body muted size="xs">{new Date(r.created_at).toLocaleDateString()}</Body>
                      <View style={styles.arrow}>
                        <Ionicons name="arrow-up" size={14} color={colors.light.primary} />
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value, icon }: { label: string; value: number; icon: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={styles.statCard}>
      <View style={styles.statIcon}>
        <Ionicons name={icon} size={16} color={colors.light.primary} />
      </View>
      <Display size="lg">{value.toLocaleString()}</Display>
      <Label style={styles.statLabel}>{label}</Label>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: spacing[5], paddingBottom: spacing[8] },
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
  refundBadge: {
    width: 40,
    height: 40,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.light.primary,
  },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: spacing[5] },
  statCard: {
    width: "48%",
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
  statLabel: { color: colors.light.mutedForeground, fontSize: typography.fontSizes.xs },
  searchRow: { marginBottom: spacing[3] },
  searchInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.light.card,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.xl,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    color: colors.light.foreground,
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.sm,
  },
  tabs: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    backgroundColor: colors.light.card,
    borderRadius: radii.xl,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.light.border,
    marginBottom: spacing[5],
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radii.lg,
  },
  tabActive: { backgroundColor: colors.light.primary },
  tabText: { color: colors.light.mutedForeground, fontFamily: fontFamilies.mono.medium },
  tabTextActive: { color: colors.light.primaryForeground },
  tabCount: { color: colors.light.mutedForeground, fontSize: 9, fontFamily: fontFamilies.mono.regular },
  tabCountActive: { color: colors.light.primaryForeground, opacity: 0.8 },
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
  list: { gap: 12 },
  card: {
    backgroundColor: colors.light.card,
    borderRadius: radii["2xl"],
    padding: 16,
    borderWidth: 1,
    borderColor: colors.light.border,
    ...shadows.soft,
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 },
  cardHeader: { flex: 1 },
  kicker: {
    color: colors.light.mutedForeground,
    fontFamily: fontFamilies.mono.medium,
    fontSize: typography.fontSizes.xs,
  },
  subtle: { color: colors.light.mutedForeground, fontSize: 10, marginTop: 2 },
  statusContent: { flexDirection: "row", alignItems: "center", gap: 4 },
  items: { gap: 4, marginBottom: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.light.border },
  itemLine: { color: colors.light.foreground },
  cardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  refundValue: { fontFamily: fontFamilies.mono.semibold, fontSize: typography.fontSizes.lg, color: colors.olive[700] },
  metaRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  arrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.olive[50],
  },
});
