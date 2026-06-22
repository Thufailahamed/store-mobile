import React, { useState } from "react";
import { View, Text, FlatList, Pressable, RefreshControl, StyleSheet, Switch, Modal } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@/components/ui/Icon";
import { getAdminBanners, createBanner, updateBanner, deleteBanner } from "@/lib/api";
import { Card, EmptyState, Skeleton, Input, Button } from "@/components/ui";
import { colors, typography, radii, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

function rel(s: string) {
  const d = new Date(s).getTime();
  const m = Math.floor((Date.now() - d) / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default function AdminBanners() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const q = useQuery({
    queryKey: ["admin-banners"],
    queryFn: async () => {
      const r = await getAdminBanners();
      return r.ok ? r.data : [];
    },
  });
  const toggleM = useMutation({ mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) => updateBanner(id, { is_active }), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-banners"] }) });
  const remove = useMutation({ mutationFn: (id: string) => deleteBanner(id), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-banners"] }) });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>PROMOTIONS</Text>
          <Text style={styles.title}>Banners</Text>
        </View>
        <Pressable onPress={() => setShowCreate(true)} style={styles.addBtn}>
          <Ionicons name="add" size={18} color="#fff" />
        </Pressable>
      </View>

      <FlatList
        data={q.data ?? []}
        keyExtractor={(b: any) => b.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} />}
        ListEmptyComponent={q.isLoading ? <Skeleton height={80} /> : <EmptyState icon="image-outline" title="No banners" />}
        renderItem={({ item, index }: any) => (
          <Card style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.index}>{String(index + 1).padStart(2, "0")}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.title}</Text>
                <Text style={styles.meta}>
                  {item.position ?? "hero"} · {rel(item.created_at)} ago
                </Text>
              </View>
              <Switch
                value={item.is_active}
                onValueChange={(v) => toggleM.mutate({ id: item.id, is_active: v })}
                trackColor={{ true: colors.olive[500], false: colors.light.border }}
                thumbColor={colors.light.card}
              />
              <Pressable onPress={() => remove.mutate(item.id)} style={styles.trash}>
                <Ionicons name="trash-outline" size={16} color={colors.light.muted} />
              </Pressable>
            </View>
          </Card>
        )}
      />

      <CreateModal visible={showCreate} onClose={() => setShowCreate(false)} onCreated={() => { qc.invalidateQueries({ queryKey: ["admin-banners"] }); setShowCreate(false); }} />
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
  header: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", padding: 20, paddingBottom: 12 },
  eyebrow: { fontFamily: fontFamilies.mono.medium, fontSize: 10, color: colors.light.primary, letterSpacing: 1.4 },
  title: { fontFamily: fontFamilies.display.regular, fontSize: 28, color: colors.light.foreground, marginTop: 4, letterSpacing: -0.5 },
  addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.light.primary, alignItems: "center", justifyContent: "center" },
  list: { padding: 20, paddingBottom: 100, gap: 10 },
  card: { padding: 14, ...shadows.soft },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  index: { fontFamily: fontFamilies.mono.regular, fontSize: 11, color: colors.light.mutedForeground, width: 24 },
  name: { fontFamily: fontFamilies.sans.semibold, fontSize: 14, color: colors.light.foreground },
  meta: { fontFamily: fontFamilies.mono.regular, fontSize: 10, color: colors.light.mutedForeground, marginTop: 2, letterSpacing: 0.5, textTransform: "uppercase" },
  trash: { paddingLeft: 8, paddingVertical: 4 },
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
