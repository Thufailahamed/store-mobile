import React, { useMemo, useState } from "react";
import { View, Text, FlatList, Pressable, RefreshControl, StyleSheet, Switch, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@/components/ui/Icon";
import { getAdminCampaigns, toggleCampaign, type AdminCampaign } from "@/lib/api";
import { Button, Skeleton } from "@/components/ui";
import { colors, radii } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { AdminMasthead, StatBand, Segmented, premiumCard, GOLD, CREAM, RUST } from "@/components/admin/premium-kit";

type Phase = "live" | "upcoming" | "ended" | "paused";
type Filter = "all" | "live" | "upcoming" | "ended";

// Backend joins the owning store and returns banner/cta fields; older
// deployments omit them, so every extra field is optional.
type CampaignRow = AdminCampaign & {
  cta_text?: string | null;
  store?: { name?: string | null; slug?: string | null } | null;
};

const PHASE: Record<Phase, { label: string; dot: string; text: string; bg: string }> = {
  live: { label: "Live", dot: "#4f8a2c", text: colors.olive[800], bg: "rgba(83,94,44,0.12)" },
  upcoming: { label: "Upcoming", dot: GOLD, text: "#7a5b1a", bg: "rgba(200,164,74,0.18)" },
  ended: { label: "Ended", dot: colors.light.mutedForeground, text: colors.light.mutedForeground, bg: colors.light.muted },
  paused: { label: "Paused", dot: RUST, text: RUST, bg: "rgba(184,92,58,0.1)" },
};

function phaseOf(c: CampaignRow, now = Date.now()): Phase {
  const start = c.starts_at ? new Date(c.starts_at).getTime() : NaN;
  const end = c.ends_at ? new Date(c.ends_at).getTime() : NaN;
  if (Number.isFinite(end) && end < now) return "ended";
  if (!c.is_active) return "paused";
  if (Number.isFinite(start) && start > now) return "upcoming";
  return "live";
}

function fmtDate(s?: string) {
  if (!s) return null;
  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) : null;
}

/** 0–1 share of the campaign window that has elapsed, or null when open-ended. */
function progressOf(c: CampaignRow, now = Date.now()) {
  const start = c.starts_at ? new Date(c.starts_at).getTime() : NaN;
  const end = c.ends_at ? new Date(c.ends_at).getTime() : NaN;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  return Math.max(0, Math.min(1, (now - start) / (end - start)));
}

export default function AdminCampaigns() {
  const qc = useQueryClient();
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");

  const q = useQuery({
    queryKey: ["admin-campaigns"],
    queryFn: async () => {
      const r = await getAdminCampaigns();
      if (!r.ok) throw new Error(r.error);
      return r.data as CampaignRow[];
    },
  });
  const toggleM = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const r = await toggleCampaign(id, is_active);
      if (!r.ok) throw new Error(r.error);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-campaigns"] }),
    onError: (e: Error) => Alert.alert("Couldn't update campaign", e.message),
  });

  const all = q.data ?? [];
  const counts = useMemo(() => {
    const c = { live: 0, upcoming: 0, ended: 0, paused: 0 };
    for (const x of all) c[phaseOf(x)] += 1;
    return c;
  }, [all]);
  const visible = filter === "all" ? all : all.filter((x) => phaseOf(x) === filter);

  return (
    <View style={styles.container}>
      <FlatList
        data={visible}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={q.isFetching && !q.isLoading} onRefresh={() => q.refetch()} tintColor={colors.light.primary} />}
        ListHeaderComponent={
          <View>
            <AdminMasthead
              eyebrow="Seasonal"
              title="Campaign"
              italic="Calendar"
              subtitle="Seller-run seasonal pushes across the marketplace. Pause anything off-brand."
            />
            {all.length ? (
              <>
                <StatBand
                  items={[
                    { label: "Live", value: counts.live, accent: true },
                    { label: "Upcoming", value: counts.upcoming },
                    { label: "Ended", value: counts.ended },
                    { label: "Paused", value: counts.paused },
                  ]}
                />
                <Segmented<Filter>
                  value={filter}
                  onChange={setFilter}
                  options={[
                    { value: "all", label: "All" },
                    { value: "live", label: "Live" },
                    { value: "upcoming", label: "Soon" },
                    { value: "ended", label: "Ended" },
                  ]}
                />
              </>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          q.isLoading ? (
            <View style={{ gap: 14, paddingHorizontal: 16 }}>
              <Skeleton height={240} style={{ borderRadius: radii["2xl"] }} />
              <Skeleton height={240} style={{ borderRadius: radii["2xl"] }} />
            </View>
          ) : q.isError ? (
            <View style={styles.errorWrap}>
              <Text style={styles.emptyTitle}>Couldn't load campaigns</Text>
              <Text style={styles.emptyBody}>{(q.error as Error)?.message}</Text>
              <Button onPress={() => q.refetch()}>Retry</Button>
            </View>
          ) : all.length ? (
            <Text style={styles.noMatch}>No {filter} campaigns.</Text>
          ) : (
            <EmptyCalendar
              onBanners={() => router.push("/(admin)/banners" as any)}
              onCoupons={() => router.push("/(admin)/coupons" as any)}
            />
          )
        }
        renderItem={({ item }) => (
          <CampaignCard
            item={item}
            busy={toggleM.isPending}
            onToggle={(v) => toggleM.mutate({ id: item.id, is_active: v })}
          />
        )}
      />
    </View>
  );
}

function CampaignCard({ item, busy, onToggle }: { item: CampaignRow; busy: boolean; onToggle: (v: boolean) => void }) {
  const phase = phaseOf(item);
  const tone = PHASE[phase];
  const progress = progressOf(item);
  const start = fmtDate(item.starts_at);
  const end = fmtDate(item.ends_at);
  const dim = phase === "ended" || phase === "paused";

  return (
    <View style={[styles.card, dim && styles.cardDim]}>
      <View style={styles.media}>
        {item.banner_url ? (
          <Image source={{ uri: item.banner_url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
        ) : (
          <LinearGradient colors={["#3a4120", "#1c200f"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill}>
            <View style={styles.mediaRing} />
            <View style={styles.mediaIcon}>
              <Ionicons name="megaphone-outline" size={22} color={GOLD} />
            </View>
          </LinearGradient>
        )}
        <LinearGradient
          colors={["rgba(14,15,9,0)", "rgba(14,15,9,0.78)"]}
          locations={[0.35, 1]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.mediaTop}>
          {item.store?.name ? (
            <View style={styles.glassChip}>
              <Ionicons name="storefront-outline" size={10} color={CREAM} />
              <Text style={styles.glassChipText} numberOfLines={1}>{item.store.name.toUpperCase()}</Text>
            </View>
          ) : <View />}
          <View style={[styles.phasePill, { backgroundColor: tone.bg }]}>
            <View style={[styles.phaseDot, { backgroundColor: tone.dot }]} />
            <Text style={[styles.phaseText, { color: tone.text }]}>{tone.label.toUpperCase()}</Text>
          </View>
        </View>
        <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
      </View>

      <View style={styles.body}>
        {item.description ? <Text style={styles.desc} numberOfLines={2}>{item.description}</Text> : null}

        <View style={styles.window}>
          <View style={styles.windowEnd}>
            <Text style={styles.windowLabel}>STARTS</Text>
            <Text style={styles.windowDate}>{start ?? "Anytime"}</Text>
          </View>
          <View style={styles.windowTrackWrap}>
            <View style={styles.windowTrack}>
              {progress !== null ? (
                <LinearGradient
                  colors={phase === "live" ? [colors.olive[700], colors.olive[400]] : ["#b9b7a6", "#d6d4c4"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.windowFill, { width: `${Math.max(3, Math.round(progress * 100))}%` as never }]}
                />
              ) : null}
            </View>
            <Text style={styles.windowPct}>
              {progress === null ? "Open-ended" : phase === "upcoming" ? "Not started" : `${Math.round(progress * 100)}% elapsed`}
            </Text>
          </View>
          <View style={[styles.windowEnd, { alignItems: "flex-end" }]}>
            <Text style={styles.windowLabel}>ENDS</Text>
            <Text style={styles.windowDate}>{end ?? "No end"}</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footMeta} numberOfLines={1}>
            {item.cta_text ? `CTA · “${item.cta_text}”` : "No call to action"}
          </Text>
          <Text style={styles.switchLabel}>{item.is_active ? "On" : "Off"}</Text>
          <Switch
            value={item.is_active}
            disabled={busy}
            onValueChange={onToggle}
            trackColor={{ true: colors.olive[600], false: colors.light.border }}
            thumbColor={colors.light.card}
            ios_backgroundColor={colors.light.border}
            style={styles.switch}
            accessibilityLabel={`${item.is_active ? "Pause" : "Resume"} ${item.name}`}
          />
        </View>
      </View>
    </View>
  );
}

function EmptyCalendar({ onBanners, onCoupons }: { onBanners: () => void; onCoupons: () => void }) {
  return (
    <View style={styles.emptyWrap}>
      <LinearGradient colors={["#3a4120", colors.olive[900], "#1c200f"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.emptyHero}>
        <View style={[styles.emptyRing, { width: 260, height: 260, top: -120, right: -90 }]} />
        <View style={[styles.emptyRing, { width: 160, height: 160, top: -70, right: -40, opacity: 0.6 }]} />
        <View style={styles.emptyIcon}>
          <Ionicons name="calendar-outline" size={22} color={GOLD} />
        </View>
        <Text style={styles.emptyEyebrow}>THE CALENDAR IS CLEAR</Text>
        <Text style={styles.emptyHeroTitle}>
          No campaigns <Text style={styles.emptyHeroItalic}>yet</Text>
        </Text>
        <Text style={styles.emptyHeroBody}>
          Sellers launch seasonal campaigns from their storefront dashboard. They'll appear here the moment one is created, ready for you to review or pause.
        </Text>
      </LinearGradient>

      <Text style={styles.altLabel}>MEANWHILE, PROMOTE PLATFORM-WIDE</Text>
      <View style={styles.altCard}>
        <AltRow icon="images-outline" title="Banners" body="Hero & grid placements" onPress={onBanners} divider />
        <AltRow icon="ticket-outline" title="Coupons" body="Discount codes for every shopper" onPress={onCoupons} />
      </View>
    </View>
  );
}

function AltRow({
  icon,
  title,
  body,
  onPress,
  divider,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  onPress: () => void;
  divider?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.altRow, pressed && styles.altPressed]}>
      <LinearGradient colors={["#eef0dc", "#dfe3c2"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.altIcon}>
        <Ionicons name={icon} size={17} color={colors.olive[700]} />
      </LinearGradient>
      <View style={[styles.altBody, divider && styles.altDivider]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.altTitle}>{title}</Text>
          <Text style={styles.altText}>{body}</Text>
        </View>
        <Ionicons name="chevron-forward" size={15} color={colors.light.border} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  list: { paddingBottom: 140, gap: 16 },
  noMatch: { fontFamily: fontFamilies.sans.regular, fontSize: 13, color: colors.light.mutedForeground, textAlign: "center", paddingVertical: 24 },

  card: { ...premiumCard, marginHorizontal: 16, overflow: "hidden" },
  cardDim: { opacity: 0.82 },
  media: { height: 168, justifyContent: "space-between", padding: 14, backgroundColor: colors.olive[900] },
  mediaRing: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    top: -90,
    right: -60,
    borderWidth: 1,
    borderColor: "rgba(200,164,74,0.16)",
  },
  mediaIcon: {
    position: "absolute",
    right: 18,
    bottom: 18,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(200,164,74,0.5)",
  },
  mediaTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  glassChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flexShrink: 1,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radii.full,
    backgroundColor: "rgba(14,15,9,0.45)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(250,248,241,0.3)",
  },
  glassChipText: { fontFamily: fontFamilies.mono.medium, fontSize: 9, color: CREAM, letterSpacing: 1.1, flexShrink: 1 },
  phasePill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 9, paddingVertical: 4, borderRadius: radii.full },
  phaseDot: { width: 6, height: 6, borderRadius: 3 },
  phaseText: { fontFamily: fontFamilies.mono.semibold, fontSize: 9, letterSpacing: 1.1 },
  name: { fontFamily: fontFamilies.display.semibold, fontSize: 24, lineHeight: 28, color: CREAM, letterSpacing: -0.5, maxWidth: "80%" },

  body: { padding: 14, gap: 12 },
  desc: { fontFamily: fontFamilies.sans.regular, fontSize: 13, lineHeight: 19, color: colors.ink.soft },
  window: { flexDirection: "row", alignItems: "center", gap: 12 },
  windowEnd: { minWidth: 58 },
  windowLabel: { fontFamily: fontFamilies.mono.regular, fontSize: 8, color: colors.light.mutedForeground, letterSpacing: 1.3 },
  windowDate: { fontFamily: fontFamilies.display.semibold, fontSize: 15, color: colors.light.foreground, marginTop: 2 },
  windowTrackWrap: { flex: 1, gap: 5 },
  windowTrack: { height: 4, borderRadius: 2, backgroundColor: "#e6e5d8", overflow: "hidden" },
  windowFill: { height: 4, borderRadius: 2 },
  windowPct: { fontFamily: fontFamilies.mono.regular, fontSize: 9, color: colors.light.mutedForeground, textAlign: "center", letterSpacing: 0.6 },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#dddccd",
  },
  footMeta: { flex: 1, fontFamily: fontFamilies.sans.regular, fontSize: 12, color: colors.light.mutedForeground },
  switchLabel: { fontFamily: fontFamilies.mono.medium, fontSize: 9.5, color: colors.light.mutedForeground, letterSpacing: 1 },
  switch: { transform: [{ scale: 0.82 }], marginVertical: -6, marginRight: -4 },

  errorWrap: { alignItems: "center", gap: 10, paddingVertical: 32, paddingHorizontal: 32 },
  emptyTitle: { fontFamily: fontFamilies.display.semibold, fontSize: 18, color: colors.light.foreground },
  emptyBody: { fontFamily: fontFamilies.sans.regular, fontSize: 13, color: colors.light.mutedForeground, textAlign: "center" },

  emptyWrap: { paddingHorizontal: 16 },
  emptyHero: {
    borderRadius: radii["3xl"],
    padding: 22,
    paddingTop: 24,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(200,164,74,0.35)",
  },
  emptyRing: { position: "absolute", borderRadius: 999, borderWidth: 1, borderColor: "rgba(200,164,74,0.15)" },
  emptyIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(200,164,74,0.55)",
    backgroundColor: "rgba(200,164,74,0.08)",
  },
  emptyEyebrow: { fontFamily: fontFamilies.mono.medium, fontSize: 9.5, color: GOLD, letterSpacing: 1.8, marginTop: 18 },
  emptyHeroTitle: { fontFamily: fontFamilies.display.semibold, fontSize: 28, color: CREAM, letterSpacing: -0.6, marginTop: 6 },
  emptyHeroItalic: { fontFamily: fontFamilies.display.italic, color: GOLD },
  emptyHeroBody: { fontFamily: fontFamilies.sans.regular, fontSize: 13.5, lineHeight: 20, color: "rgba(250,248,241,0.68)", marginTop: 10 },
  altLabel: { fontFamily: fontFamilies.mono.medium, fontSize: 9.5, color: colors.light.mutedForeground, letterSpacing: 1.6, marginTop: 26, marginBottom: 10, paddingHorizontal: 4 },
  altCard: { ...premiumCard, overflow: "hidden" },
  altRow: { flexDirection: "row", alignItems: "center", paddingLeft: 14 },
  altPressed: { backgroundColor: "rgba(83,94,44,0.06)" },
  altIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  altBody: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, marginLeft: 14, paddingVertical: 14, paddingRight: 14 },
  altDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#dddccd" },
  altTitle: { fontFamily: fontFamilies.sans.semibold, fontSize: 15, color: colors.light.foreground },
  altText: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: colors.light.mutedForeground, marginTop: 2 },
});
