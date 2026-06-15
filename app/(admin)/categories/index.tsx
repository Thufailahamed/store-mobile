import React, { useState } from "react";
import { View, Text, FlatList, Pressable, RefreshControl, StyleSheet, Alert, Modal } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Ionicons from "@expo/vector-icons/Ionicons";
import { getAdminCategories, createCategory, updateCategory, deleteCategory } from "@/lib/api";
import { Card, EmptyState, Skeleton, Input, Button } from "@/components/ui";
import { colors, typography, radii, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

export default function AdminCategories() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const q = useQuery({
    queryKey: ["admin-categories"],
    queryFn: async () => {
      const r = await getAdminCategories();
      return r.ok ? r.data : [];
    },
  });
  const remove = useMutation({ mutationFn: (id: string) => deleteCategory(id), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-categories"] }) });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>STRUCTURE</Text>
          <Text style={styles.title}>Categories</Text>
        </View>
        <Pressable onPress={() => setShowCreate(true)} style={styles.addBtn}>
          <Ionicons name="add" size={18} color="#fff" />
        </Pressable>
      </View>

      <FlatList
        data={q.data ?? []}
        keyExtractor={(c: any) => c.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} />}
        ListEmptyComponent={q.isLoading ? <Skeleton height={80} /> : <EmptyState icon="folder-outline" title="No categories" />}
        renderItem={({ item, index }: any) => (
          <Pressable onLongPress={() => setEditing(item)}>
            <Card style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.index}>{String(index + 1).padStart(2, "0")}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.meta}>{item.slug} · {item.product_count ?? 0} products</Text>
                </View>
                <Pressable onPress={() => Alert.alert("Delete category", item.name, [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => remove.mutate(item.id) }])}>
                  <Ionicons name="trash-outline" size={18} color={colors.light.muted} />
                </Pressable>
              </View>
            </Card>
          </Pressable>
        )}
      />

      <CategoryModal
        visible={showCreate || !!editing}
        initial={editing}
        onClose={() => { setShowCreate(false); setEditing(null); }}
        onSaved={() => { qc.invalidateQueries({ queryKey: ["admin-categories"] }); setShowCreate(false); setEditing(null); }}
      />
    </View>
  );
}

function CategoryModal({ visible, onClose, onSaved, initial }: { visible: boolean; onClose: () => void; onSaved: () => void; initial?: any }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [loading, setLoading] = useState(false);

  const save = async () => {
    if (!name.trim() || !slug.trim()) return Alert.alert("Missing fields", "Name and slug required");
    setLoading(true);
    const r = initial
      ? await updateCategory(initial.id, { name, slug })
      : await createCategory({ name, slug });
    setLoading(false);
    if (r.ok) { setName(""); setSlug(""); onSaved(); }
    else Alert.alert("Error", r.error);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modal}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{initial ? "Edit" : "New"} Category</Text>
          <Pressable onPress={onClose}><Ionicons name="close" size={22} color={colors.light.foreground} /></Pressable>
        </View>
        <Input label="Name" value={name} onChangeText={setName} placeholder="Outerwear" />
        <View style={{ height: 12 }} />
        <Input label="Slug" value={slug} onChangeText={setSlug} placeholder="outerwear" autoCapitalize="none" />
        <View style={{ height: 24 }} />
        <Button onPress={save} loading={loading}>{initial ? "Save" : "Create"}</Button>
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
  modal: { flex: 1, backgroundColor: colors.light.background, padding: 20, paddingTop: 60 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  modalTitle: { fontFamily: fontFamilies.display.regular, fontSize: 22, color: colors.light.foreground },
});
