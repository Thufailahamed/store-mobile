import React, { useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, RefreshControl, StyleSheet, Switch, Alert } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Modal } from "@/components/ui/Modal";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@/components/ui/Icon";
import { getAdminBanners, createBanner, updateBanner, deleteBanner } from "@/lib/api";
import { EmptyState, Skeleton, Input, Button } from "@/components/ui";
import { AdminMasthead, StatBand, Segmented, SectionLabel, premiumCard, RUST } from "@/components/admin/premium-kit";
import type { Banner } from "@/lib/types";
import { colors, radii } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

function rel(s?: string) {
  if (!s) return null;
  const d = new Date(s).getTime();
  if (!Number.isFinite(d)) return null;
  const m = Math.max(0, Math.floor((Date.now() - d) / 60000));
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const prettyPlacement = (p?: string) =>
  (p || "hero").replace(/[_-]+/g, " ").replace(/^\w/, (c) => c.toUpperCase());

type BannerRow = Banner & { created_at?: string };
type Filter = "all" | "live" | "paused";

export default function AdminBanners() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const q = useQuery({
    queryKey: ["admin-banners"],
    queryFn: async () => {
      const r = await getAdminBanners();
      return (r.ok ? r.data : []) as BannerRow[];
    },
  });
  const toggleM = useMutation({ mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) => updateBanner(id, { is_active }), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-banners"] }) });
  const remove = useMutation({ mutationFn: (id: string) => deleteBanner(id), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-banners"] }) });

  const all = q.data ?? [];
  const live = all.filter((b) => b.is_active).length;
  const visible = all.filter((b) => (filter === "all" ? true : filter === "live" ? b.is_active : !b.is_active));

  const groups = useMemo(() => {
    const map = new Map<string, BannerRow[]>();
    for (const b of visible) {
      const k = b.position || "hero";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(b);
    }
    return [...map.entries()];
  }, [visible]);

  const confirmDelete = (b: BannerRow) =>
    Alert.alert("Delete banner?", `“${b.title}” will be removed from the storefront. This can't be undone.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => remove.mutate(b.id) },
    ]);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={q.isFetching && !q.isLoading} onRefresh={() => q.refetch()} tintColor={colors.light.primary} />}
      >
        <AdminMasthead
          eyebrow="Promotions"
          title="Banner"
          italic="Gallery"
          subtitle="The first thing shoppers see. Toggle to publish or pause instantly."
          onAdd={() => setShowCreate(true)}
        />

        {all.length ? (
          <>
            <StatBand
              items={[
                { label: "Banners", value: all.length },
                { label: "Live", value: live, accent: true },
                { label: "Paused", value: all.length - live },
              ]}
            />
            <Segmented<Filter>
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all", label: "All", count: all.length },
                { value: "live", label: "Live", count: live },
                { value: "paused", label: "Paused", count: all.length - live },
              ]}
            />
          </>
        ) : null}

        <View style={styles.body}>
          {q.isLoading ? (
            <View style={{ gap: 14 }}>
              <Skeleton height={230} style={{ borderRadius: radii["2xl"] }} />
              <Skeleton height={230} style={{ borderRadius: radii["2xl"] }} />
            </View>
          ) : !all.length ? (
            <EmptyState icon="image-outline" title="No banners yet" description="Tap + to compose your first hero." />
          ) : !visible.length ? (
            <Text style={styles.noMatch}>No {filter} banners.</Text>
          ) : (
            groups.map(([placement, items]) => (
              <View key={placement}>
                <SectionLabel label={prettyPlacement(placement)} count={items.length} />
                <View style={{ gap: 14 }}>
                  {items.map((b, i) => (
                    <BannerCard
                      key={b.id}
                      item={b}
                      index={i}
                      busy={toggleM.isPending}
                      onToggle={(v) => toggleM.mutate({ id: b.id, is_active: v })}
                      onDelete={() => confirmDelete(b)}
                    />
                  ))}
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <CreateModal visible={showCreate} onClose={() => setShowCreate(false)} onCreated={() => { qc.invalidateQueries({ queryKey: ["admin-banners"] }); setShowCreate(false); }} />
    </View>
  );
}

function BannerCard({
  item,
  index,
  busy,
  onToggle,
  onDelete,
}: {
  item: BannerRow;
  index: number;
  busy: boolean;
  onToggle: (v: boolean) => void;
  onDelete: () => void;
}) {
  const age = rel(item.created_at);
  return (
    <View style={[styles.card, !item.is_active && styles.cardPaused]}>
      <View style={styles.media}>
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
        ) : (
          <LinearGradient colors={["#3a4120", "#1c200f"]} style={[StyleSheet.absoluteFill, styles.mediaEmpty]}>
            <Ionicons name="image-outline" size={28} color="rgba(250,248,241,0.4)" />
          </LinearGradient>
        )}
        <LinearGradient
          colors={["rgba(14,15,9,0.05)", "rgba(14,15,9,0.15)", "rgba(14,15,9,0.82)"]}
          locations={[0, 0.4, 1]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.mediaTop}>
          <View style={styles.glassChip}>
            <Text style={styles.glassChipText}>{String((item.display_order ?? index) + 1).padStart(2, "0")}</Text>
          </View>
          <View style={[styles.glassChip, styles.statusChip]}>
            <View style={[styles.statusDot, { backgroundColor: item.is_active ? "#8fd16a" : "rgba(250,248,241,0.5)" }]} />
            <Text style={styles.glassChipText}>{item.is_active ? "LIVE" : "PAUSED"}</Text>
          </View>
        </View>
        <View style={styles.mediaText}>
          <Text style={styles.bTitle} numberOfLines={2}>{item.title}</Text>
          {item.subtitle ? <Text style={styles.bSub} numberOfLines={1}>{item.subtitle}</Text> : null}
          {item.cta_text ? (
            <View style={styles.cta}>
              <Text style={styles.ctaText}>{item.cta_text}</Text>
              <Ionicons name="arrow-forward" size={11} color={colors.ink.DEFAULT} />
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.footer}>
        <View style={{ flex: 1 }}>
          <Text style={styles.footLabel}>{prettyPlacement(item.position).toUpperCase()}</Text>
          <Text style={styles.footMeta} numberOfLines={1}>
            {[age, item.link].filter(Boolean).join(" · ") || "No link set"}
          </Text>
        </View>
        <Switch
          value={item.is_active}
          disabled={busy}
          onValueChange={onToggle}
          trackColor={{ true: colors.olive[600], false: colors.light.border }}
          thumbColor={colors.light.card}
          ios_backgroundColor={colors.light.border}
        />
        <Pressable onPress={onDelete} hitSlop={8} style={styles.trash} accessibilityLabel={`Delete ${item.title}`}>
          <Ionicons name="trash-outline" size={15} color={RUST} />
        </Pressable>
      </View>
    </View>
  );
}

function CreateModal({ visible, onClose, onCreated }: { visible: boolean; onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [position, setPosition] = useState<"hero" | "secondary" | "footer">("hero");
  const [image, setImage] = useState("");
  const [loading, setLoading] = useState(false);

  const create = async () => {
    if (!title.trim() || !image.trim()) return;
    setLoading(true);
    const r = await createBanner({ title, subtitle, position, image_url: image, is_active: true, display_order: 0 });
    setLoading(false);
    if (r.ok) { setTitle(""); setSubtitle(""); setImage(""); onCreated(); }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modal}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>New Banner</Text>
          <Pressable onPress={onClose}><Ionicons name="close" size={22} color={colors.light.foreground} /></Pressable>
        </View>
        <Input label="Title" value={title} onChangeText={setTitle} placeholder="Endless summer" />
        <View style={{ height: 12 }} />
        <Input label="Subtitle" value={subtitle} onChangeText={setSubtitle} placeholder="Silk pieces for warm days" />
        <View style={{ height: 12 }} />
        <Input label="Image URL" value={image} onChangeText={setImage} placeholder="https://…" autoCapitalize="none" />
        <View style={{ height: 12 }} />
        <Text style={styles.fieldLabel}>Placement</Text>
        <View style={styles.row2}>
          {(["hero", "secondary", "footer"] as const).map((p) => (
            <Pressable key={p} onPress={() => setPosition(p)} style={[styles.chip, position === p && styles.chipActive]}>
              <Text style={[styles.chipText, position === p && styles.chipTextActive]}>{p}</Text>
            </Pressable>
          ))}
        </View>
        <View style={{ height: 24 }} />
        <Button onPress={create} loading={loading}>Create Banner</Button>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  list: { paddingBottom: 140 },
  body: { paddingHorizontal: 16, gap: 12 },
  noMatch: { fontFamily: fontFamilies.sans.regular, fontSize: 13, color: colors.light.mutedForeground, textAlign: "center", paddingVertical: 24 },
  card: { ...premiumCard, overflow: "hidden" },
  cardPaused: { opacity: 0.78 },
  media: { height: 190, justifyContent: "space-between", backgroundColor: colors.olive[900] },
  mediaEmpty: { alignItems: "center", justifyContent: "center" },
  mediaTop: { flexDirection: "row", justifyContent: "space-between", padding: 12 },
  glassChip: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radii.full,
    backgroundColor: "rgba(14,15,9,0.45)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(250,248,241,0.3)",
  },
  statusChip: { flexDirection: "row", alignItems: "center", gap: 6 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  glassChipText: { fontFamily: fontFamilies.mono.medium, fontSize: 9.5, color: colors.paper.cream, letterSpacing: 1.2 },
  mediaText: { padding: 16, paddingTop: 0, gap: 4 },
  bTitle: { fontFamily: fontFamilies.display.semibold, fontSize: 24, lineHeight: 28, color: colors.paper.cream, letterSpacing: -0.5 },
  bSub: { fontFamily: fontFamilies.sans.regular, fontSize: 13, color: "rgba(250,248,241,0.78)" },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: colors.paper.cream,
  },
  ctaText: { fontFamily: fontFamilies.sans.semibold, fontSize: 11, color: colors.ink.DEFAULT },
  footer: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  footLabel: { fontFamily: fontFamilies.mono.medium, fontSize: 9.5, color: colors.olive[700], letterSpacing: 1.4 },
  footMeta: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: colors.light.mutedForeground, marginTop: 2 },
  trash: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(184,92,58,0.08)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(184,92,58,0.3)",
  },
  modal: { flex: 1, backgroundColor: colors.light.background, padding: 20, paddingTop: 60 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  modalTitle: { fontFamily: fontFamilies.display.regular, fontSize: 22, color: colors.light.foreground },
  fieldLabel: { fontFamily: fontFamilies.mono.medium, fontSize: 11, color: colors.light.foreground, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8 },
  row2: { flexDirection: "row", gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.light.card, borderWidth: 1, borderColor: colors.light.border },
  chipActive: { backgroundColor: colors.light.primary, borderColor: colors.light.primary },
  chipText: { fontFamily: fontFamilies.mono.medium, fontSize: 10, color: colors.light.mutedForeground, letterSpacing: 0.5, textTransform: "uppercase" },
  chipTextActive: { color: "#fff" },
});
