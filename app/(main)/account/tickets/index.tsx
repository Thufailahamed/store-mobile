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
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@/components/ui/Icon";
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

function getStatusMeta(status: string) {
  const norm = status.toLowerCase().replace(/[\s_]+/g, "_");
  switch (norm) {
    case "awaiting_support":
      return {
        label: "AWAITING CONCIERGE",
        color: "#85651B",
        bg: "#FDF8E8",
        border: "#F5E4B5",
        icon: "time-outline" as const,
      };
    case "open":
      return {
        label: "ACTIVE REVIEW",
        color: "#2C5E8A",
        bg: "#EDF5FC",
        border: "#CCE3F6",
        icon: "flash-outline" as const,
      };
    case "awaiting_customer":
      return {
        label: "ACTION REQUIRED",
        color: "#734B8F",
        bg: "#F8F2FC",
        border: "#E9D5F7",
        icon: "chatbubble-ellipses-outline" as const,
      };
    case "resolved":
      return {
        label: "RESOLVED",
        color: "#2B6E3F",
        bg: "#EBF7EE",
        border: "#C5E6CC",
        icon: "checkmark-circle-outline" as const,
      };
    case "closed":
      return {
        label: "ARCHIVED",
        color: "#787469",
        bg: "#F2EFE9",
        border: "#E0DDD5",
        icon: "archive-outline" as const,
      };
    default:
      return {
        label: status.toUpperCase().replace(/_/g, " "),
        color: "#85651B",
        bg: "#F7F5EE",
        border: "#E6E2D4",
        icon: "help-circle-outline" as const,
      };
  }
}

export default function TicketsScreen() {
  const router = useRouter();
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

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      {/* 1. Custom Atelier Top Navigation Header */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={20} color="#141311" />
        </TouchableOpacity>

        <View style={styles.headerTitleCenter}>
          <Text style={styles.headerEyebrow}>CONCIERGE LIAISON</Text>
          <Text style={styles.headerTitle}>Support Tickets</Text>
        </View>

        <TouchableOpacity
          onPress={() => load(true)}
          style={styles.refreshButton}
          activeOpacity={0.7}
        >
          <Ionicons
            name="refresh-outline"
            size={18}
            color={refreshing ? "#C8A44A" : "#141311"}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor="#C8A44A"
            colors={["#C8A44A"]}
          />
        }
      >
        {/* 2. Velvet Obsidian Hero Card ("Atelier Client Concierge") */}
        <LinearGradient
          colors={["#141311", "#1E1C18", "#0F0E0D"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.heroTopRow}>
            <View style={styles.heroTagBadge}>
              <Ionicons name="sparkles" size={10} color="#C8A44A" />
              <Text style={styles.heroTagText}>WHITE-GLOVE CLIENT SERVICE</Text>
            </View>

            {/* Headset Concierge Seal */}
            <View style={styles.headsetMedallion}>
              <View style={styles.headsetMedallionInner}>
                <Ionicons name="headset-outline" size={18} color="#E8CF8F" />
              </View>
            </View>
          </View>

          <Text style={styles.heroTitle}>Atelier Client Concierge</Text>
          <Text style={styles.heroSubtitle}>
            Direct private liaison with our master curators, horologists, and logistics directors
            for delivery modifications, bespoke sizing, and archival requests.
          </Text>

          {/* 3-Metric Intelligence Strip */}
          <View style={styles.heroMetricsStrip}>
            <View style={styles.metricItem}>
              <Text style={styles.metricValue}>{metrics.active}</Text>
              <Text style={styles.metricLabel}>ACTIVE INQUIRIES</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={styles.metricValue}>&lt; 2h</Text>
              <Text style={styles.metricLabel}>AVG RESPONSE</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={styles.metricValue}>{metrics.resolved}</Text>
              <Text style={styles.metricLabel}>RESOLVED</Text>
            </View>
          </View>
        </LinearGradient>

        {/* 3. Luxury "Initiate Concierge Inquiry" CTA Card */}
        <TouchableOpacity
          activeOpacity={0.88}
          onPress={() => router.push("/(main)/account/tickets/new" as never)}
          style={styles.newInquiryCard}
        >
          <LinearGradient
            colors={["#1E1C18", "#141311"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.newInquiryGradient}
          >
            <View style={styles.newInquiryLeft}>
              <View style={styles.newInquiryIconWrap}>
                <Ionicons name="create-outline" size={18} color="#E8CF8F" />
              </View>
              <View style={styles.newInquiryTextCol}>
                <Text style={styles.newInquiryTitle}>Open New Concierge Inquiry</Text>
                <Text style={styles.newInquirySubtitle}>
                  Order modifications, bespoke sizing, or invoice filing
                </Text>
              </View>
            </View>
            <View style={styles.newInquiryArrowBadge}>
              <Ionicons name="arrow-forward" size={15} color="#141311" />
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* 4. Segmented Status Filter Tabs */}
        {tickets.length > 0 && (
          <View style={styles.tabsRow}>
            <TouchableOpacity
              style={[styles.tabButton, filterTab === "all" && styles.tabButtonActive]}
              onPress={() => setFilterTab("all")}
            >
              <Text style={[styles.tabButtonText, filterTab === "all" && styles.tabButtonTextActive]}>
                All Inquiries ({tickets.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, filterTab === "active" && styles.tabButtonActive]}
              onPress={() => setFilterTab("active")}
            >
              <Text
                style={[
                  styles.tabButtonText,
                  filterTab === "active" && styles.tabButtonTextActive,
                ]}
              >
                Active ({metrics.active})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, filterTab === "resolved" && styles.tabButtonActive]}
              onPress={() => setFilterTab("resolved")}
            >
              <Text
                style={[
                  styles.tabButtonText,
                  filterTab === "resolved" && styles.tabButtonTextActive,
                ]}
              >
                Resolved ({metrics.resolved})
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 5. Inquiries List or Editorial Empty State */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color="#C8A44A" size="large" />
            <Text style={styles.loadingText}>Accessing concierge logs...</Text>
          </View>
        ) : filteredTickets.length === 0 ? (
          /* Editorial Empty State */
          <View style={styles.emptyContainer}>
            <View style={styles.emptyCard}>
              <View style={styles.emptyMedallionOuter}>
                <View style={styles.emptyMedallionInner}>
                  <Ionicons name="headset-outline" size={26} color="#C8A44A" />
                  <View style={styles.emptySparkle}>
                    <Ionicons name="sparkles" size={10} color="#E8CF8F" />
                  </View>
                </View>
              </View>

              <Text style={styles.emptyTitle}>
                {filterTab === "all"
                  ? "No Active Inquiries"
                  : filterTab === "active"
                    ? "All Inquiries Resolved"
                    : "No Resolved Inquiries"}
              </Text>
              <Text style={styles.emptyBody}>
                {filterTab === "all"
                  ? "Your private client log is clear. Should you require bespoke tailoring adjustments, insured freight rerouting, or archival assistance, our concierge desk is at your disposal 24/7."
                  : filterTab === "active"
                    ? "You have no pending requests requiring client action or concierge review."
                    : "Past resolved inquiries and correspondence will be archived here."}
              </Text>

              {filterTab === "all" && (
                <TouchableOpacity
                  style={styles.emptyPrimaryButton}
                  activeOpacity={0.85}
                  onPress={() => router.push("/(main)/account/tickets/new" as never)}
                >
                  <LinearGradient
                    colors={["#1C1A17", "#141311"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.emptyPrimaryButtonGradient}
                  >
                    <Text style={styles.emptyPrimaryButtonText}>Open First Inquiry</Text>
                    <Ionicons name="arrow-forward" size={15} color="#E8CF8F" />
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>

            {/* 6. "Atelier Concierge Standards" Feature Cards */}
            <View style={styles.protocolsSection}>
              <View style={styles.protocolsHeaderRow}>
                <Ionicons name="shield-outline" size={14} color="#85651B" />
                <Text style={styles.protocolsEyebrow}>WHITE-GLOVE COMMITMENT</Text>
              </View>
              <Text style={styles.protocolsTitle}>How Concierge Support Operates</Text>

              <View style={styles.protocolCardsList}>
                <View style={styles.protocolCard}>
                  <View style={styles.protocolNumberBadge}>
                    <Text style={styles.protocolNumberText}>01</Text>
                  </View>
                  <View style={styles.protocolCardContent}>
                    <Text style={styles.protocolCardTitle}>Priority 120-Minute Review</Text>
                    <Text style={styles.protocolCardDesc}>
                      Inquiries regarding active freight, courier holding, or urgent sizing changes
                      receive immediate liaison triage.
                    </Text>
                  </View>
                </View>

                <View style={styles.protocolCard}>
                  <View style={styles.protocolNumberBadge}>
                    <Text style={styles.protocolNumberText}>02</Text>
                  </View>
                  <View style={styles.protocolCardContent}>
                    <Text style={styles.protocolCardTitle}>Dedicated Specialist Assignment</Text>
                    <Text style={styles.protocolCardDesc}>
                      Each ticket is assigned to a specific atelier manager who oversees the
                      resolution from intake to final confirmation.
                    </Text>
                  </View>
                </View>

                <View style={styles.protocolCard}>
                  <View style={styles.protocolNumberBadge}>
                    <Text style={styles.protocolNumberText}>03</Text>
                  </View>
                  <View style={styles.protocolCardContent}>
                    <Text style={styles.protocolCardTitle}>Encrypted Correspondence Ledger</Text>
                    <Text style={styles.protocolCardDesc}>
                      All replies, invoices, and customs receipts are preserved permanently within
                      your private member archives.
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        ) : (
          /* Active Tickets List */
          <View style={styles.ticketsList}>
            {filteredTickets.map((t) => {
              const meta = getStatusMeta(t.status);
              const refNumber = t.ticket_number ?? t.id.slice(0, 9).toUpperCase();

              return (
                <TouchableOpacity
                  key={t.id}
                  style={styles.ticketCard}
                  activeOpacity={0.85}
                  onPress={() =>
                    router.push({
                      pathname: "/(main)/account/tickets/[id]",
                      params: { id: t.id },
                    } as never)
                  }
                >
                  {/* Top Row: Ref Pill & Status Badge */}
                  <View style={styles.ticketTopRow}>
                    <View style={styles.refPill}>
                      <Ionicons name="bookmark-outline" size={11} color="#85651B" />
                      <Text style={styles.refPillText}>{refNumber}</Text>
                    </View>

                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: meta.bg, borderColor: meta.border },
                      ]}
                    >
                      <Ionicons name={meta.icon} size={11} color={meta.color} />
                      <Text style={[styles.statusBadgeText, { color: meta.color }]}>
                        {meta.label}
                      </Text>
                    </View>
                  </View>

                  {/* Middle: Subject Headline */}
                  <Text style={styles.ticketSubject} numberOfLines={2}>
                    {t.subject}
                  </Text>

                  {/* Bottom Row: Date & Action Link */}
                  <View style={styles.ticketBottomRow}>
                    <View style={styles.dateMeta}>
                      <Ionicons name="calendar-outline" size={12} color="#8F8B82" />
                      <Text style={styles.dateMetaText}>
                        Logged on {new Date(t.created_at).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </Text>
                    </View>

                    <View style={styles.viewLogLink}>
                      <Text style={styles.viewLogLinkText}>Review Log</Text>
                      <Ionicons name="arrow-forward" size={12} color="#85651B" />
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

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F5F4EF",
  },
  topHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
    backgroundColor: "#F5F4EF",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E6E3DA",
    alignItems: "center",
    justifyContent: "center",
    ...shadows.soft,
  },
  headerTitleCenter: {
    alignItems: "center",
  },
  headerEyebrow: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9,
    letterSpacing: 1.8,
    color: "#85651B",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  headerTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 20,
    color: "#141311",
    letterSpacing: -0.3,
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E6E3DA",
    alignItems: "center",
    justifyContent: "center",
    ...shadows.soft,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  /* Velvet Obsidian Hero Card */
  heroCard: {
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.25)",
    marginBottom: 16,
    ...shadows.glow,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  heroTagBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(200, 164, 74, 0.12)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.3)",
  },
  heroTagText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    letterSpacing: 1.4,
    color: "#E8CF8F",
  },
  headsetMedallion: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.3)",
    padding: 3,
  },
  headsetMedallionInner: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: "#201E1A",
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 22,
    color: "#FAF8F5",
    letterSpacing: -0.4,
    marginBottom: 6,
  },
  heroSubtitle: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    lineHeight: 19,
    color: "#B3AFA5",
    marginBottom: 18,
  },
  heroMetricsStrip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  metricItem: {
    flex: 1,
    alignItems: "center",
  },
  metricValue: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 16,
    color: "#FAF8F5",
    marginBottom: 2,
  },
  metricLabel: {
    fontFamily: fontFamilies.mono.regular,
    fontSize: 8,
    letterSpacing: 1.2,
    color: "#8F8B82",
  },
  metricDivider: {
    width: 1,
    height: 20,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
  },

  /* New Inquiry Action Card */
  newInquiryCard: {
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.3)",
    ...shadows.soft,
  },
  newInquiryGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
  },
  newInquiryLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  newInquiryIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(200, 164, 74, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  newInquiryTextCol: {
    flex: 1,
  },
  newInquiryTitle: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 14,
    color: "#FAF8F5",
    marginBottom: 2,
  },
  newInquirySubtitle: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    color: "#A8A49A",
  },
  newInquiryArrowBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#C8A44A",
    alignItems: "center",
    justifyContent: "center",
  },

  /* Segmented Filter Tabs */
  tabsRow: {
    flexDirection: "row",
    backgroundColor: "#EBE8DF",
    borderRadius: 16,
    padding: 4,
    borderWidth: 1,
    borderColor: "#DFDBCF",
    marginBottom: 16,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 12,
  },
  tabButtonActive: {
    backgroundColor: "#141311",
  },
  tabButtonText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 12,
    color: "#6B675E",
  },
  tabButtonTextActive: {
    fontFamily: fontFamilies.sans.semibold,
    color: "#FAF8F5",
  },

  /* Tickets List */
  ticketsList: {
    gap: 12,
  },
  ticketCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#EAE7DF",
    padding: 16,
    ...shadows.soft,
  },
  ticketTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  refPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#F7F5EE",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#E6E2D4",
  },
  refPillText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10,
    letterSpacing: 1,
    color: "#85651B",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    letterSpacing: 0.8,
  },
  ticketSubject: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 15,
    lineHeight: 21,
    color: "#141311",
    marginBottom: 12,
  },
  ticketBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#F3F1EC",
  },
  dateMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  dateMetaText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    color: "#8F8B82",
  },
  viewLogLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  viewLogLinkText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 11,
    color: "#85651B",
  },

  /* Loading State */
  loadingContainer: {
    paddingVertical: 40,
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    color: "#8F8B82",
  },

  /* Empty State */
  emptyContainer: {
    gap: 20,
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#EAE7DF",
    padding: 26,
    alignItems: "center",
    ...shadows.soft,
  },
  emptyMedallionOuter: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.35)",
    padding: 4,
    marginBottom: 16,
  },
  emptyMedallionInner: {
    flex: 1,
    borderRadius: 30,
    backgroundColor: "#141311",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  emptySparkle: {
    position: "absolute",
    top: 6,
    right: 8,
  },
  emptyTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 21,
    color: "#141311",
    letterSpacing: -0.3,
    marginBottom: 8,
    textAlign: "center",
  },
  emptyBody: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    lineHeight: 20,
    color: "#787469",
    textAlign: "center",
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  emptyPrimaryButton: {
    width: "100%",
    borderRadius: 12,
    overflow: "hidden",
    ...shadows.soft,
  },
  emptyPrimaryButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    gap: 8,
  },
  emptyPrimaryButtonText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 14,
    color: "#FAF8F5",
  },

  /* Protocols Section */
  protocolsSection: {
    backgroundColor: "#FAF9F5",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#EBE7DD",
    padding: 20,
  },
  protocolsHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  protocolsEyebrow: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    letterSpacing: 1.6,
    color: "#85651B",
  },
  protocolsTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 17,
    color: "#141311",
    marginBottom: 16,
  },
  protocolCardsList: {
    gap: 12,
  },
  protocolCard: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#EAE6DB",
    padding: 14,
  },
  protocolNumberBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F2EFE6",
    borderWidth: 1,
    borderColor: "#E0DCcf",
    alignItems: "center",
    justifyContent: "center",
  },
  protocolNumberText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 11,
    color: "#85651B",
  },
  protocolCardContent: {
    flex: 1,
  },
  protocolCardTitle: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: "#141311",
    marginBottom: 3,
  },
  protocolCardDesc: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    lineHeight: 17,
    color: "#787469",
  },
});
