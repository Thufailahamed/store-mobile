import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  StyleSheet,
  Pressable,
  TextInput,
  type ListRenderItem,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { BrandScreenHeader } from "@/components/brand/BrandScreenHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { Ionicons } from "@/components/ui/Icon";
import {
  getBrandNotifications,
  markBrandNotifications,
} from "@/lib/api";
import type { BrandNotification } from "@/lib/api/backend";
import { colors, radii, shadows, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

// ---------------------------------------------------------------------------
// Visual contract — what each notification type looks like
// ---------------------------------------------------------------------------

type NotifKind = "order" | "review" | "return" | "inventory" | "system";

interface NotifVisual {
  /** Ionicons name shown in the circular badge. */
  icon: keyof typeof Ionicons.glyphMap;
  /** Foreground (icon + accent) color. */
  fg: string;
  /** Soft tint behind the icon. */
  bg: string;
  /** Mono uppercase label for the card. */
  label: string;
}

const VISUALS: Record<NotifKind, NotifVisual> = {
  order: {
    icon: "receipt-outline",
    fg: colors.olive[800],
    bg: colors.olive[50],
    label: "Order",
  },
  review: {
    icon: "star-outline",
    fg: "#8a6a2a",
    bg: "#f8f1e3",
    label: "Review",
  },
  return: {
    icon: "refresh-circle-outline",
    fg: colors.accent2.rust,
    bg: "rgba(184,92,58,0.12)",
    label: "Return",
  },
  inventory: {
    icon: "cube-outline",
    fg: "#1a3a7a",
    bg: "#dde7f3",
    label: "Inventory",
  },
  system: {
    icon: "information-circle-outline",
    fg: colors.ink.mute,
    bg: colors.light.muted,
    label: "System",
  },
};

function visualFor(type?: string | null): NotifVisual {
  const key = (type as NotifKind) ?? "system";
  return VISUALS[key] ?? VISUALS.system;
}

// ---------------------------------------------------------------------------
// Time + grouping helpers
// ---------------------------------------------------------------------------

const ONE_MIN = 60_000;
const ONE_HOUR = 60 * ONE_MIN;
const ONE_DAY = 24 * ONE_HOUR;

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

function relativeTime(date: Date, now = new Date()): string {
  const diff = now.getTime() - date.getTime();
  if (diff < ONE_MIN) return "just now";
  if (diff < ONE_HOUR) {
    const m = Math.floor(diff / ONE_MIN);
    return `${m}m ago`;
  }
  if (diff < ONE_DAY) {
    const h = Math.floor(diff / ONE_HOUR);
    return `${h}h ago`;
  }
  if (diff < ONE_DAY * 7) {
    const d = Math.floor(diff / ONE_DAY);
    return `${d}d ago`;
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function shortDate(date: Date): string {
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

type Bucket = "Today" | "Yesterday" | "Earlier this week" | "Earlier";

function bucketFor(date: Date, now = new Date()): Bucket {
  const todayStart = startOfDay(now);
  const yesterdayStart = todayStart - ONE_DAY;
  const weekStart = todayStart - 6 * ONE_DAY;
  const t = date.getTime();
  if (t >= todayStart) return "Today";
  if (t >= yesterdayStart) return "Yesterday";
  if (t >= weekStart) return "Earlier this week";
  return "Earlier";
}

const BUCKETS: Bucket[] = ["Today", "Yesterday", "Earlier this week", "Earlier"];

interface Grouped {
  bucket: Bucket;
  items: BrandNotification[];
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

type FilterId = "all" | "unread" | "order" | "inventory" | "review" | "return" | "system";

interface FilterDef {
  id: FilterId;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const FILTERS: FilterDef[] = [
  { id: "all", label: "All", icon: "apps-outline" },
  { id: "unread", label: "Unread", icon: "ellipse" },
  { id: "order", label: "Orders", icon: "receipt-outline" },
  { id: "inventory", label: "Inventory", icon: "cube-outline" },
  { id: "review", label: "Reviews", icon: "star-outline" },
  { id: "return", label: "Returns", icon: "refresh-outline" },
];

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function BrandNotifications() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<FilterId>("all");
  const [search, setSearch] = useState("");

  const q = useQuery({
    queryKey: ["brand-notifications"],
    queryFn: async () => {
      const r = await getBrandNotifications();
      return r.ok ? r.data : [];
    },
  });

  const markAll = useMutation({
    mutationFn: () => markBrandNotifications({ mark_all: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["brand-notifications"] }),
  });

  const markOne = useMutation({
    mutationFn: (id: string) => markBrandNotifications({ ids: [id] }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["brand-notifications"] }),
  });

  const all = useMemo(() => q.data ?? [], [q.data]);
  const unreadCount = useMemo(() => all.filter((n) => !n.read_at).length, [all]);

  // Counts per filter for the chip badges.
  const counts = useMemo(() => {
    const c: Record<FilterId, number> = {
      all: all.length,
      unread: unreadCount,
      order: 0,
      inventory: 0,
      review: 0,
      return: 0,
      system: 0,
    };
    for (const n of all) {
      const t = (n.type ?? "system") as FilterId;
      if (t in c) c[t] += 1;
    }
    return c;
  }, [all, unreadCount]);

  const filtered = useMemo(() => {
    const q0 = search.trim().toLowerCase();
    return all.filter((n) => {
      if (filter === "all") {
        // pass
      } else if (filter === "unread") {
        if (n.read_at) return false;
      } else if ((n.type ?? "system") !== filter) {
        return false;
      }
      if (q0) {
        const hay = `${n.title ?? ""} ${n.body ?? ""}`.toLowerCase();
        if (!hay.includes(q0)) return false;
      }
      return true;
    });
  }, [all, filter, search]);

  // Group by bucket for editorial section headers.
  const groups = useMemo<Grouped[]>(() => {
    const map = new Map<Bucket, BrandNotification[]>();
    for (const b of BUCKETS) map.set(b, []);
    for (const n of filtered) {
      const b = bucketFor(new Date(n.created_at));
      map.get(b)!.push(n);
    }
    return BUCKETS.map((b) => ({ bucket: b, items: map.get(b) ?? [] })).filter(
      (g) => g.items.length > 0,
    );
  }, [filtered]);

  // Flatten groups into rows for SectionList-style rendering on top of FlatList.
  type Row = { kind: "header"; bucket: Bucket; count: number } | { kind: "item"; item: BrandNotification };
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (const g of groups) {
      out.push({ kind: "header", bucket: g.bucket, count: g.items.length });
      for (const it of g.items) out.push({ kind: "item", item: it });
    }
    return out;
  }, [groups]);

  const renderRow: ListRenderItem<Row> = ({ item }) => {
    if (item.kind === "header") {
      return <SectionLabel bucket={item.bucket} count={item.count} />;
    }
    return (
      <NotificationRow
        item={item.item}
        onPress={() => !item.item.read_at && markOne.mutate(item.item.id)}
      />
    );
  };

  return (
    <View style={styles.root}>
      <BrandScreenHeader
        eyebrow="Atelier"
        title="Notifications"
        subtitle={`${unreadCount} unread · ${all.length} total`}
        back={{ onPress: () => router.back() }}
        right={
          unreadCount > 0 ? (
            <Button
              variant="default"
              size="sm"
              onPress={() => markAll.mutate()}
              loading={markAll.isPending}
              style={styles.markAllBtn}
              textStyle={styles.markAllText}
            >
              <Ionicons name="checkmark-done" size={14} color={colors.light.primaryForeground} />
              Mark all
            </Button>
          ) : undefined
        }
      />

      {/* Search */}
      <View style={styles.searchWrap}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={colors.ink.mute} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search order, title…"
            placeholderTextColor={colors.ink.mute}
            style={styles.searchInput}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {search.length > 0 ? (
            <Pressable hitSlop={10} onPress={() => setSearch("")} style={styles.clearBtn}>
              <Ionicons name="close-circle" size={16} color={colors.ink.mute} />
            </Pressable>
          ) : (
            <View style={styles.kbd}>
              <Text style={styles.kbdText}>⌘K</Text>
            </View>
          )}
        </View>
      </View>

      {/* Filters */}
      <FlatList
        data={FILTERS}
        keyExtractor={(f) => f.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
        renderItem={({ item: f }) => {
          const active = filter === f.id;
          const count = counts[f.id] ?? 0;
          const showCount = f.id === "all" || f.id === "unread" ? count > 0 : count > 0;
          return (
            <Pressable
              onPress={() => setFilter(f.id)}
              style={[styles.filterChip, active && styles.filterChipActive]}
            >
              <Ionicons
                name={f.icon}
                size={14}
                color={active ? colors.light.primaryForeground : colors.olive[800]}
              />
              <Text style={[styles.filterText, active && styles.filterTextActive]}>
                {f.label}
              </Text>
              {showCount ? (
                <View style={[styles.filterCount, active && styles.filterCountActive]}>
                  <Text style={[styles.filterCountText, active && styles.filterCountTextActive]}>
                    {count}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          );
        }}
      />

      {/* Body */}
      {q.isLoading ? (
        <View style={styles.listContent}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} style={styles.skelRow} />
          ))}
        </View>
      ) : all.length === 0 ? (
        <View style={styles.emptyWrap}>
          <EmptyState
            icon="notifications-off-outline"
            title="You're all caught up"
            description="Order updates, low-stock alerts and reviews will land here in real time."
          />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r, idx) =>
            r.kind === "header" ? `h-${r.bucket}` : `n-${r.item.id}-${idx}`
          }
          refreshControl={
            <RefreshControl
              refreshing={q.isRefetching}
              onRefresh={() => q.refetch()}
              tintColor={colors.light.primary}
              colors={[colors.light.primary]}
            />
          }
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 32 },
          ]}
          renderItem={renderRow}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionLabel({ bucket, count }: { bucket: Bucket; count: number }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{bucket}</Text>
      <View style={styles.sectionLine} />
      <Text style={styles.sectionCount}>{count}</Text>
    </View>
  );
}

function NotificationRow({
  item,
  onPress,
}: {
  item: BrandNotification;
  onPress: () => void;
}) {
  const v = visualFor(item.type);
  const date = new Date(item.created_at);
  const unread = !item.read_at;

  // Best-effort: detect an order id / amount in the body so we can render the
  // prominent value block like the design.
  const orderIdMatch = (item.body ?? "").match(/LX-\d{8}-[A-Z0-9]{5,}/i);
  const amountMatch = (item.body ?? "").match(/(LKR|Rs\.?|USD|\$|€|£)\s?([\d,]+(?:\.\d+)?)/i);
  const storeMatch = (item.body ?? "").match(/from\s+([A-Z][\w&'.\- ]{1,40})/i);

  const subtitle = (() => {
    const t = (item.title ?? "").toLowerCase();
    if (t.includes("order") && amountMatch) {
      return {
        eyebrow: "New order",
        big: `${amountMatch[1]} ${amountMatch[2]}`,
        context: storeMatch?.[1] ?? orderIdMatch?.[0] ?? "Order placed",
      };
    }
    if (t.includes("review")) {
      return {
        eyebrow: "New review",
        big: item.body?.slice(0, 60) ?? "Customer left a review",
        context: "Tap to reply",
      };
    }
    if (t.includes("stock") || (item.type ?? "") === "inventory") {
      return {
        eyebrow: "Stock alert",
        big: item.body?.split(".")[0] ?? "Inventory running low",
        context: "Open inventory",
      };
    }
    if (t.includes("return") || (item.type ?? "") === "return") {
      return {
        eyebrow: "Return request",
        big: item.body?.split(".")[0] ?? "Customer requested a return",
        context: "Review request",
      };
    }
    return {
      eyebrow: v.label,
      big: item.body ?? item.title ?? "Notification",
      context: "Open details",
    };
  })();

  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: "rgba(83,94,44,0.08)" }}
      style={({ pressed }) => [
        styles.cardWrap,
        pressed && { transform: [{ scale: 0.995 }] },
      ]}
    >
      {/* Left accent bar — narrow, full height */}
      <View
        style={[
          styles.accent,
          { backgroundColor: unread ? v.fg : "transparent" },
        ]}
      />

      {/* Soft unread halo on the icon */}
      {unread ? (
        <LinearGradient
          colors={[v.bg, "rgba(245,244,239,0)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      ) : null}

      <View style={styles.cardInner}>
        <View style={[styles.iconWrap, { backgroundColor: v.bg }]}>
          <Ionicons name={v.icon} size={20} color={v.fg} />
          {unread ? (
            <View style={[styles.unreadDot, { borderColor: colors.light.card }]}>
              <View style={[styles.unreadDotInner, { backgroundColor: v.fg }]} />
            </View>
          ) : null}
        </View>

        <View style={styles.body}>
          <View style={styles.headRow}>
            <Text style={styles.kind} numberOfLines={1}>
              {subtitle.eyebrow.toUpperCase()}
            </Text>
            <Text style={styles.timeMono}>{relativeTime(date)}</Text>
          </View>

          <Text
            style={[styles.headline, unread && styles.headlineUnread]}
            numberOfLines={1}
          >
            {item.title ?? "Notification"}
          </Text>

          <Text style={styles.big} numberOfLines={1}>
            {subtitle.big}
          </Text>

          <View style={styles.footRow}>
            <Text style={styles.context} numberOfLines={1}>
              {subtitle.context}
            </Text>
            <Text style={styles.timeFull}>{shortDate(date)}</Text>
          </View>
        </View>

        <View style={styles.chev}>
          <Ionicons name="chevron-forward" size={16} color={colors.ink.mute} />
        </View>
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.light.background },
  listContent: { paddingHorizontal: 16, paddingTop: 8 },

  // Mark-all pill
  markAllBtn: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: radii.full,
    backgroundColor: colors.olive[900],
    gap: 6,
  },
  markAllText: {
    fontSize: 11,
    letterSpacing: typography.letterSpacing.wider,
    color: colors.light.primaryForeground,
  },

  // Search
  searchWrap: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 10 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    height: 48,
    paddingHorizontal: 14,
    backgroundColor: colors.light.card,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.full,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.base,
    color: colors.light.foreground,
    paddingVertical: 0,
  },
  clearBtn: { padding: 2 },
  kbd: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: colors.light.muted,
  },
  kbdText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    color: colors.ink.mute,
    letterSpacing: 0.5,
  },

  // Filter chips
  filterRow: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    height: 36,
    paddingHorizontal: 14,
    gap: 6,
    borderRadius: radii.full,
    backgroundColor: colors.light.card,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  filterChipActive: {
    backgroundColor: colors.olive[900],
    borderColor: colors.olive[900],
    ...shadows.soft,
  },
  filterText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.sm,
    color: colors.olive[800],
    letterSpacing: 0.2,
  },
  filterTextActive: { color: colors.light.primaryForeground },
  filterCount: {
    minWidth: 22,
    paddingHorizontal: 6,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.light.muted,
    justifyContent: "center",
    alignItems: "center",
  },
  filterCountActive: { backgroundColor: "rgba(255,255,255,0.16)" },
  filterCountText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    color: colors.olive[800],
    letterSpacing: 0.4,
  },
  filterCountTextActive: { color: colors.light.primaryForeground },

  // Sections
  section: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 22,
    paddingBottom: 12,
    gap: 10,
  },
  sectionLabel: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 11,
    color: colors.olive[700],
    letterSpacing: typography.letterSpacing.editorial,
    textTransform: "uppercase",
  },
  sectionLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.light.border,
    opacity: 0.8,
  },
  sectionCount: {
    fontFamily: fontFamilies.mono.regular,
    fontSize: 10,
    color: colors.ink.mute,
    letterSpacing: 0.4,
  },

  // Skeleton / empty
  skelRow: { height: 96, borderRadius: radii.xl, marginBottom: 10 },
  emptyWrap: { flex: 1, justifyContent: "center", paddingHorizontal: 16 },

  // Card
  cardWrap: {
    flexDirection: "row",
    borderRadius: radii["2xl"],
    backgroundColor: colors.light.card,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.light.border,
    minHeight: 104,
  },
  accent: {
    width: 4,
  },
  cardInner: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    paddingLeft: 14,
    gap: 12,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  unreadDot: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    backgroundColor: colors.light.card,
    alignItems: "center",
    justifyContent: "center",
  },
  unreadDotInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  body: {
    flex: 1,
    gap: 4,
  },
  headRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  kind: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    color: colors.olive[700],
    letterSpacing: typography.letterSpacing.editorial,
  },
  timeMono: {
    fontFamily: fontFamilies.mono.regular,
    fontSize: 10,
    color: colors.ink.mute,
    letterSpacing: 0.3,
  },
  headline: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.base,
    color: colors.light.foreground,
    letterSpacing: -0.1,
  },
  headlineUnread: {
    fontFamily: fontFamilies.sans.bold,
  },
  big: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 18,
    color: colors.light.foreground,
    letterSpacing: typography.letterSpacing.tight,
    marginTop: 1,
  },
  footRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
    gap: 8,
  },
  context: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.xs,
    color: colors.ink.mute,
    flex: 1,
  },
  timeFull: {
    fontFamily: fontFamilies.mono.regular,
    fontSize: 10,
    color: colors.ink.mute,
    letterSpacing: 0.4,
  },
  chev: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.light.muted,
  },
});
