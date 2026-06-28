import React from "react";
import { View, Text, ScrollView, StyleSheet, Alert, Pressable, Modal, TextInput, KeyboardAvoidingView, Platform } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { BrandScreenHeader } from "@/components/brand/BrandScreenHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { getBrandCollections, createBrandCollection, updateBrandCollection, deleteBrandCollection } from "@/lib/api";
import type { BrandCollection } from "@/lib/api/backend";
import { colors, typography, radii } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

export default function BrandCollections() {
  const qc = useQueryClient();
  const [editing, setEditing] = React.useState<BrandCollection | null>(null);
  const [creating, setCreating] = React.useState(false);

  const q = useQuery({
    queryKey: ["brand-collections"],
    queryFn: async () => {
      const r = await getBrandCollections();
      return r.ok ? r.data : [];
    },
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteBrandCollection(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["brand-collections"] }),
  });

  return (
    <View style={styles.root}>
      <BrandScreenHeader
        eyebrow="Catalog"
        title="Collections"
        subtitle={`${q.data?.length ?? 0} total`}
        back={{ onPress: () => router.back() }}
        right={<Button variant="default" onPress={() => setCreating(true)}>+ New</Button>}
      />
      {q.isLoading ? (
        <ScrollView contentContainerStyle={styles.grid}>
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} style={styles.skel} />)}
        </ScrollView>
      ) : !q.data || q.data.length === 0 ? (
        <EmptyState icon="albums-outline" title="No collections" description="Group products into themed collections." action={<Button onPress={() => setCreating(true)}>Create collection</Button>} />
      ) : (
        <ScrollView contentContainerStyle={styles.grid}>
          {q.data.map((c) => (
            <Pressable key={c.id} onPress={() => setEditing(c)} onLongPress={() => Alert.alert("Delete collection?", c.name ?? "", [
              { text: "Cancel", style: "cancel" },
              { text: "Delete", style: "destructive", onPress: () => del.mutate(c.id) },
            ])} style={styles.gridItem}>
              <Card style={styles.tile}>
                <View style={styles.tileCover}><Text style={styles.tileEmoji}>✦</Text></View>
                <Text style={styles.tileTitle} numberOfLines={1}>{c.name ?? "Untitled"}</Text>
                {c.description ? <Text style={styles.tileDesc} numberOfLines={2}>{c.description}</Text> : null}
                <Badge variant={c.is_featured ? "default" : "secondary"} style={styles.tileBadge}>{c.is_featured ? "Live" : "Draft"}</Badge>
              </Card>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {(creating || editing) ? <CollectionModal collection={editing} onClose={() => { setCreating(false); setEditing(null); }} /> : null}
    </View>
  );
}

function CollectionModal({ collection, onClose }: { collection: BrandCollection | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = React.useState(collection?.name ?? "");
  const [description, setDescription] = React.useState(collection?.description ?? "");
  const [featured, setFeatured] = React.useState(Boolean(collection?.is_featured));

  const save = useMutation({
    mutationFn: () => {
      const body = { name, description, is_featured: featured };
      return collection ? updateBrandCollection(collection.id, body as never) : createBrandCollection(body as never);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["brand-collections"] });
      onClose();
    },
    onError: (e) => Alert.alert("Error", String(e)),
  });

  return (
    <Modal animationType="slide" transparent visible onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.modalRoot} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <Text style={styles.modalTitle}>{collection ? "Edit collection" : "New collection"}</Text>
          <ScrollView contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">
            <FieldLabel>Name</FieldLabel>
            <Input value={name} onChangeText={setName} placeholder="Resort 26" />
            <FieldLabel>Description</FieldLabel>
            <TextInput value={description} onChangeText={setDescription} placeholder="Collection story" multiline numberOfLines={4} style={styles.textArea} />
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Feature on storefront</Text>
              <Badge variant={featured ? "default" : "secondary"}>
                <Text onPress={() => setFeatured(!featured)} style={styles.toggleText}>{featured ? "Live" : "Draft"}</Text>
              </Badge>
            </View>
          </ScrollView>
          <View style={styles.sheetActions}>
            <Button variant="outline" onPress={onClose} style={styles.sheetBtn}>Cancel</Button>
            <Button onPress={() => save.mutate()} loading={save.isPending} style={styles.sheetBtn}>{collection ? "Save" : "Create"}</Button>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.light.background },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, padding: 16, paddingBottom: 40 },
  gridItem: { width: "47%", flexGrow: 1 },
  skel: { height: 180, width: "47%", borderRadius: radii.lg },
  tile: { padding: 0, overflow: "hidden" as const },
  tileCover: { height: 110, backgroundColor: colors.light.muted, alignItems: "center", justifyContent: "center" },
  tileEmoji: { fontFamily: fontFamilies.display.semibold, fontSize: typography.fontSizes["4xl"], color: colors.light.mutedForeground },
  tileTitle: { fontFamily: fontFamilies.sans.semibold, fontSize: typography.fontSizes.sm, color: colors.light.foreground, paddingHorizontal: 12, paddingTop: 8 },
  tileDesc: { fontFamily: fontFamilies.sans.regular, fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground, paddingHorizontal: 12, paddingTop: 4, lineHeight: 16 },
  tileBadge: { alignSelf: "flex-start", margin: 12 },
  modalRoot: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: { backgroundColor: colors.light.background, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, padding: 20, maxHeight: "85%" },
  sheetContent: { gap: 4, paddingBottom: 8 },
  sheetActions: { flexDirection: "row", gap: 12, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.light.border },
  sheetBtn: { flex: 1 },
  modalTitle: { fontFamily: fontFamilies.display.semibold, fontSize: typography.fontSizes.xl, color: colors.light.foreground, marginBottom: 12 },
  label: { fontFamily: fontFamilies.mono.medium, fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground, textTransform: "uppercase", letterSpacing: typography.letterSpacing.editorial, marginTop: 8 },
  textArea: { fontFamily: fontFamilies.sans.regular, fontSize: typography.fontSizes.sm, color: colors.light.foreground, backgroundColor: colors.light.card, borderWidth: 1, borderColor: colors.light.border, borderRadius: radii.lg, padding: 12, minHeight: 100, textAlignVertical: "top" },
  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12, marginTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.light.border },
  toggleLabel: { fontFamily: fontFamilies.sans.medium, fontSize: typography.fontSizes.base, color: colors.light.foreground },
  toggleText: { fontFamily: fontFamilies.mono.medium, fontSize: typography.fontSizes.xs, color: colors.light.foreground },
});