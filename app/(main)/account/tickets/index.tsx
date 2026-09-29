import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@/components/ui/Icon";
import { PaperBackground } from "@/components/layout";
import { useToast } from "@/components/ui";
import { fetchJson } from "@/lib/api/backend";
import { colors, radii, shadows, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

type Ticket = {
  id: string;
  ticket_number?: string;
  subject: string;
  status: string;
  created_at: string;
};

type FilterTab = "all" | "active" | "resolved";

const GOLD = colors.accent2.ochre;
const GOLD_DEEP = "#85651b";
const GOLD_SOFT = "#E8CF8F";
const HAIRLINE = "rgba(22, 23, 15, 0.08)";
const GREEN = "#15803d";

const TABS: { key: FilterTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "resolved", label: "Resolved" },
];

const SUPPORT_POINTS = [
  {
    n: "01",
    title: "Fast response",
    desc: "Urgent delivery and sizing requests are triaged first.",
  },
  {
    n: "02",
    title: "One owner per ticket",
    desc: "A dedicated specialist handles your inquiry end to end.",
  },
  {
    n: "03",
    title: "Full history kept",
    desc: "Replies and documents stay in your account archive.",
  },
];

function getStatusMeta(status: string) {
  const norm = status.toLowerCase().replace(/[\s_]+/g, "_");
  switch (norm) {
    case "awaiting_support":
      return {
        label: "Awaiting reply",
        color: GOLD_DEEP,
        bg: "rgba(200, 164, 74, 0.12)",
        icon: "time-outline" as const,
      };
    case "open":
      return {
        label: "In review",
        color: "#2C5E8A",
        bg: "rgba(44, 94, 138, 0.1)",
        icon: "flash-outline" as const,
      };
    case "awaiting_customer":
      return {
        label: "Action needed",
        color: "#734B8F",
        bg: "rgba(115, 75, 143, 0.1)",
        icon: "chatbubble-ellipses-outline" as const,
      };
    case "resolved":
      return {
        label: "Resolved",
        color: GREEN,
        bg: "rgba(21, 128, 61, 0.1)",
        icon: "checkmark-circle-outline" as const,
      };
    case "closed":
      return {
        label: "Archived",
        color: colors.light.mutedForeground,
        bg: "rgba(22, 23, 15, 0.06)",
        icon: "archive-outline" as const,
      };
    default:
      return {
        label: status.toLowerCase().replace(/_/g, " "),
        color: GOLD_DEEP,
        bg: "rgba(200, 164, 74, 0.12)",
        icon: "help-circle-outline" as const,
      };
  }
}

export default function TicketsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { toast } = useToast();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterTab, setFilterTab] = useState<FilterTab>("all");

  const load = useCallback(
    async (isManualRefresh = false) => {
      if (isManualRefresh) setRefreshing(true);
      else setLoading(true);

      const res = await fetchJson<{ tickets: Ticket[] }>("/api/tickets");
      setLoading(false);
      setRefreshing(false);

      if (!res.ok) {
        if (isManualRefresh) {
          toast(res.error ?? "Could not load support tickets", "error");
        }
        return;
      }
      const payload = res.data as { tickets?: Ticket[] } | Ticket[] | undefined;
      const list = Array.isArray(payload) ? payload : payload?.tickets ?? [];
      setTickets(list);
    },
    [toast],
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  // Metrics computation
  const metrics = useMemo(() => {
    const total = tickets.length;
    let active = 0;
    let resolved = 0;

    for (const t of tickets) {
      const norm = t.status.toLowerCase().replace(/[\s_]+/g, "_");
      if (["resolved", "closed"].includes(norm)) {
        resolved++;
      } else {
        active++;
      }
    }

    return { total, active, resolved };
  }, [tickets]);

  // Filtered tickets
  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      const norm = t.status.toLowerCase().replace(/[\s_]+/g, "_");
      const isResolved = ["resolved", "closed"].includes(norm);
      if (filterTab === "active") return !isResolved;
      if (filterTab === "resolved") return isResolved;
      return true;
    });
  }, [tickets, filterTab]);

  const openNew = () => router.push("/(main)/account/tickets/new" as never);

  return (
    <PaperBackground>
      <SafeAreaView style={styles.container} edges={["top"]}>
        {/* Navigation */}
        <View style={styles.navBar}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.navBtn}
            activeOpacity={0.7}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={20} color={colors.light.foreground} />
          </TouchableOpacity>

          <Text style={styles.navTitle}>Support</Text>

          <TouchableOpacity
            onPress={() => load(true)}
            disabled={refreshing}
            style={styles.navBtn}
            activeOpacity={0.7}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Refresh"
          >
            {refreshing ? (
              <ActivityIndicator size="small" color={GOLD} />
            ) : (
              <Ionicons name="refresh-outline" size={18} color={colors.light.foreground} />
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 40 },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor={GOLD}
              colors={[GOLD]}
            />
          }
        >
          {/* Heading */}
          <View style={styles.pageHead}>
            <Text style={styles.eyebrow}>Help &amp; concierge</Text>
            <Text style={styles.pageTitle}>
              Support <Text style={styles.pageTitleAccent}>tickets.</Text>
            </Text>
            <Text style={styles.pageSub}>
              Questions about orders, sizing or delivery — we usually reply within
              a couple of hours.
            </Text>
          </View>

          {/* New inquiry CTA */}
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={openNew}
            style={styles.ctaCard}
            accessibilityRole="button"
          >
            <LinearGradient
              colors={["#1f2418", "#14170e"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.ctaInner}
            >
              <View style={styles.ctaIcon}>
                <Ionicons name="create-outline" size={17} color={GOLD_SOFT} />
              </View>
              <View style={styles.ctaText}>
                <Text style={styles.ctaTitle}>Start a new inquiry</Text>
                <Text style={styles.ctaSub}>
                  Order changes, sizing, invoices &amp; more
                </Text>
              </View>
              <View style={styles.ctaArrow}>
                <Ionicons name="arrow-forward" size={14} color={colors.olive[900]} />
              </View>
            </LinearGradient>
          </TouchableOpacity>

          {/* Stats + filters */}
          {tickets.length > 0 && (
            <>
              <View style={styles.statsStrip}>
                <View style={styles.statCell}>
                  <Text style={[styles.statNum, metrics.total === 0 && styles.statNumMuted]}>
                    {metrics.total}
                  </Text>
                  <Text style={styles.statLabel}>Total</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statCell}>
                  <Text style={[styles.statNum, metrics.active === 0 && styles.statNumMuted]}>
                    {metrics.active}
                  </Text>
                  <Text style={styles.statLabel}>Active</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statCell}>
                  <Text style={[styles.statNum, metrics.resolved === 0 && styles.statNumMuted]}>
                    {metrics.resolved}
                  </Text>
                  <Text style={styles.statLabel}>Resolved</Text>
                </View>
              </View>

              <View style={styles.segmented}>
                {TABS.map((t) => {
                  const count =
                    t.key === "all"
                      ? metrics.total
                      : t.key === "active"
                        ? metrics.active
                        : metrics.resolved;
                  const isActive = filterTab === t.key;
                  return (
                    <TouchableOpacity
                      key={t.key}
                      style={[styles.segment, isActive && styles.segmentActive]}
                      onPress={() => setFilterTab(t.key)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.segmentText, isActive && styles.segmentTextActive]}>
                        {t.label}
                        {count > 0 ? ` ${count}` : ""}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          {/* List / empty */}
          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={GOLD} size="small" />
              <Text style={styles.loadingText}>Loading your tickets…</Text>
            </View>
          ) : filteredTickets.length === 0 ? (
            <View style={styles.emptyWrap}>
              <View style={styles.emptyCard}>
                <View style={styles.emptyIcon}>
                  <Ionicons name="headset-outline" size={26} color={colors.olive[700]} />
                </View>
                <Text style={styles.emptyTitle}>
                  {filterTab === "all"
                    ? "No tickets yet"
                    : filterTab === "active"
                      ? "Nothing needs attention"
                      : "No resolved tickets"}
                </Text>
                <Text style={styles.emptySub}>
                  {filterTab === "all"
                    ? "Need help with an order, sizing or delivery? Start an inquiry and we'll take care of it."
                    : filterTab === "active"
                      ? "You have no pending requests right now."
                      : "Resolved inquiries will be archived here."}
                </Text>
                {filterTab === "all" && (
                  <TouchableOpacity
                    style={styles.primaryBtn}
                    activeOpacity={0.88}
                    onPress={openNew}
                    accessibilityRole="button"
                  >
                    <Text style={styles.primaryBtnText}>Start an inquiry</Text>
                    <View style={styles.primaryBtnArrow}>
                      <Ionicons name="arrow-forward" size={14} color={colors.olive[900]} />
                    </View>
                  </TouchableOpacity>
                )}
              </View>

              {/* How support works */}
              <View style={styles.howCard}>
                <Text style={styles.eyebrow}>How support works</Text>
                {SUPPORT_POINTS.map((s, i) => (
                  <View key={s.n} style={[styles.howRow, i > 0 && styles.rowDivider]}>
                    <Text style={styles.howNum}>{s.n}</Text>
                    <View style={styles.howBody}>
                      <Text style={styles.howTitle}>{s.title}</Text>
                      <Text style={styles.howDesc}>{s.desc}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <View style={styles.ticketsList}>
              {filteredTickets.map((t) => {
                const meta = getStatusMeta(t.status);
                const refNumber = t.ticket_number ?? t.id.slice(0, 9).toUpperCase();

                return (
                  <TouchableOpacity
                    key={t.id}
                    style={styles.ticketCard}
                    activeOpacity={0.8}
                    onPress={() =>
                      router.push({
                        pathname: "/(main)/account/tickets/[id]",
                        params: { id: t.id },
                      } as never)
                    }
                    accessibilityRole="button"
                  >
                    {/* Ref + status */}
                    <View style={styles.ticketTop}>
                      <Text style={styles.ticketRef}>{refNumber}</Text>
                      <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
                        <Ionicons name={meta.icon} size={11} color={meta.color} />
                        <Text style={[styles.statusPillText, { color: meta.color }]}>
                          {meta.label}
                        </Text>
                      </View>
                    </View>

                    {/* Subject */}
                    <Text style={styles.ticketSubject} numberOfLines={2}>
                      {t.subject}
                    </Text>

                    {/* Footer */}
                    <View style={styles.ticketFooter}>
                      <Text style={styles.ticketDate}>
                        Opened{" "}
                        {new Date(t.created_at).toLocaleDateString(undefined, {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </Text>
                      <Ionicons
                        name="chevron-forward"
                        size={14}
                        color={colors.light.mutedForeground}
                      />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </PaperBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  /* Nav */
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[2.5],
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.paper.cream,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: HAIRLINE,
  },
  navTitle: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 15,
    color: colors.light.foreground,
  },

  scrollContent: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[2],
    gap: 14,
  },

  /* Heading */
  pageHead: {
    marginBottom: spacing[2],
  },
  eyebrow: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: GOLD_DEEP,
    marginBottom: 4,
  },
  pageTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 32,
    letterSpacing: -0.6,
    lineHeight: 38,
    color: colors.light.foreground,
  },
  pageTitleAccent: {
    fontFamily: fontFamilies.display.italic,
    color: GOLD_DEEP,
  },
  pageSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.light.mutedForeground,
    marginTop: 6,
    maxWidth: 300,
  },

  /* New inquiry CTA */
  ctaCard: {
    borderRadius: 22,
    overflow: "hidden",
    ...shadows.editorial,
  },
  ctaInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    padding: spacing[4],
  },
  ctaIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(200, 164, 74, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: {
    flex: 1,
    gap: 2,
  },
  ctaTitle: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 14.5,
    color: colors.paper.cream,
  },
  ctaSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: "rgba(250, 248, 241, 0.6)",
  },
  ctaArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.paper.cream,
    alignItems: "center",
    justifyContent: "center",
  },

  /* Stat strip */
  statsStrip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.paper.cream,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: HAIRLINE,
    paddingVertical: 14,
    ...shadows.soft,
  },
  statCell: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  statNum: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 20,
    letterSpacing: -0.3,
    color: colors.light.foreground,
  },
  statNumMuted: {
    color: "rgba(22, 23, 15, 0.35)",
  },
  statLabel: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9.5,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.light.mutedForeground,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    height: 28,
    backgroundColor: colors.light.border,
  },

  /* Segmented tabs */
  segmented: {
    flexDirection: "row",
    gap: 4,
    backgroundColor: colors.paper.warm,
    borderRadius: radii.full,
    padding: 4,
    borderWidth: 1,
    borderColor: HAIRLINE,
  },
  segment: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 9,
    borderRadius: radii.full,
  },
  segmentActive: {
    backgroundColor: colors.paper.cream,
    ...shadows.soft,
  },
  segmentText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: colors.light.mutedForeground,
  },
  segmentTextActive: {
    color: colors.light.foreground,
  },

  /* Loading */
  loadingWrap: {
    paddingVertical: 50,
    alignItems: "center",
    gap: 10,
  },
  loadingText: {
    fontFamily: fontFamilies.display.italic,
    fontSize: 13.5,
    color: colors.light.mutedForeground,
  },

  /* Empty */
  emptyWrap: {
    gap: 14,
  },
  emptyCard: {
    alignItems: "center",
    backgroundColor: colors.paper.cream,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: HAIRLINE,
    paddingVertical: spacing[8],
    paddingHorizontal: spacing[6],
  },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.paper.warm,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing[4],
  },
  emptyTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 22,
    letterSpacing: -0.3,
    color: colors.light.foreground,
    textAlign: "center",
  },
  emptySub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.light.mutedForeground,
    textAlign: "center",
    marginTop: 6,
    maxWidth: 280,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    height: 50,
    paddingLeft: 22,
    paddingRight: 6,
    borderRadius: radii.full,
    backgroundColor: colors.olive[900],
    marginTop: spacing[5],
  },
  primaryBtnText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 14,
    color: colors.paper.cream,
  },
  primaryBtnArrow: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.paper.cream,
    alignItems: "center",
    justifyContent: "center",
  },

  /* How it works */
  howCard: {
    backgroundColor: colors.paper.cream,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: HAIRLINE,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[5],
    paddingBottom: spacing[2],
  },
  howRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing[4],
    paddingVertical: spacing[3.5],
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.light.border,
  },
  howNum: {
    fontFamily: fontFamilies.display.italic,
    fontSize: 16,
    color: GOLD_DEEP,
    width: 24,
  },
  howBody: {
    flex: 1,
    gap: 3,
  },
  howTitle: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13.5,
    color: colors.light.foreground,
  },
  howDesc: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    lineHeight: 17,
    color: colors.light.mutedForeground,
  },

  /* Ticket cards */
  ticketsList: {
    gap: 12,
  },
  ticketCard: {
    backgroundColor: colors.paper.cream,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: HAIRLINE,
    padding: spacing[4],
    gap: spacing[2.5],
    ...shadows.soft,
  },
  ticketTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  ticketRef: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 11.5,
    letterSpacing: 0.8,
    color: GOLD_DEEP,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  statusPillText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 11,
  },
  ticketSubject: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: -0.2,
    color: colors.light.foreground,
  },
  ticketFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: spacing[2.5],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.light.border,
  },
  ticketDate: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: colors.light.mutedForeground,
  },
});
