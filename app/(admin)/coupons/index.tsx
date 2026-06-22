import React, { useState } from "react";
import { View, Text, FlatList, Pressable, RefreshControl, StyleSheet, TextInput, Alert, Modal } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@/components/ui/Icon";
import { getAdminCoupons, createCoupon, toggleCoupon } from "@/lib/api";
import { Card, EmptyState, Badge, Skeleton, Input, Button } from "@/components/ui";
import { colors, typography, radii, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

export default function AdminCoupons() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [active, setActive] = useState("all");
  const [showCreate, setShowCreate] = useState(false);

  const q = useQuery({
    queryKey: ["admin-coupons", active, search],
    queryFn: async () => {
      const r = await getAdminCoupons({ search, is_active: active });
      return r.ok ? r.data : [];
    },
  });

  const toggleM = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) => toggleCoupon(id, is_active),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-coupons"] }),
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>PROMOTIONS</Text>
          <Text style={styles.title}>Coupons</Text>
        </View>
        <Pressable onPress={() => setShowCreate(true)} style={styles.addBtn}>
          <Ionicons name="add" size={18} color="#fff" />
        </Pressable>
      </View>

      <TextInput style={styles.search} placeholder="Search by code…" placeholderTextColor={colors.light.muted} value={search} onChangeText={setSearch} />

      <FlatList
        horizontal
        data={["all", "true", "false"]}
        keyExtractor={(s) => s}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filters}
        renderItem={({ item: t }) => (
          <Pressable onPress={() => setActive(t)} style={[styles.chip, active === t && styles.chipActive]}>
            <Text style={[styles.chipText, active === t && styles.chipTextActive]}>
              {t === "all" ? "All" : t === "true" ? "Active" : "Inactive"}
            </Text>
          </Pressable>
        )}
      />

      <FlatList
        data={q.data ?? []}
        keyExtractor={(c: any) => c.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} />}
        ListEmptyComponent={q.isLoading ? <Skeleton height={80} /> : <EmptyState icon="ticket-outline" title="No coupons" />}
        renderItem={({ item, index }: any) => (
          <Card style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.index}>{String(index + 1).padStart(2, "0")}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.code}>{item.code}</Text>
                <Text style={styles.meta}>
                  {item.type === "percentage" ? `${item.value}% off` : item.type === "fixed" ? `LKR ${item.value} off` : item.type === "free_shipping" ? "Free ship" : "BXGY"}
                  {" · "}
                  {item.current_uses ?? 0}/{item.max_uses ?? "∞"} uses
                </Text>
              </View>
              <Pressable onPress={() => toggleM.mutate({ id: item.id, is_active: !item.is_active })}>
                <Badge variant={item.is_active ? "default" : "outline"}>{item.is_active ? "live" : "off"}</Badge>
              </Pressable>
            </View>
          </Card>
        )}
      />

      <CreateModal visible={showCreate} onClose={() => setShowCreate(false)} onCreated={() => { qc.invalidateQueries({ queryKey: ["admin-coupons"] }); setShowCreate(false); }} />
    </View>
  );
}

function CreateModal({ visible, onClose, onCreated }: { visible: boolean; onClose: () => void; onCreated: () => void }) {
  const [code, setCode] = useState("");
  const [value, setValue] = useState("");
  const [type, setType] = useState<"percentage" | "fixed" | "free_shipping">("percentage");
  const [loading, setLoading] = useState(false);

  const create = async () => {
    if (!code.trim() || !value.trim()) return Alert.alert("Missing fields", "Code and value are required");
    setLoading(true);
    const r = await createCoupon({
      code: code.toUpperCase().trim(),
      value: Number(value),
      type,
      is_active: true,
      current_uses: 0,
    });
    setLoading(false);
    if (r.ok) { setCode(""); setValue(""); onCreated(); }
    else Alert.alert("Error", r.error);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modal}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>New Coupon</Text>
          <Pressable onPress={onClose}><Ionicons name="close" size={22} color={colors.light.foreground} /></Pressable>
        </View>
        <Input label="Code" placeholder="WELCOME10" value={code} onChangeText={(t) => setCode(t.toUpperCase())} autoCapitalize="characters" />
        <View style={{ height: 12 }} />
        <Input label="Value" placeholder="10" value={value} onChangeText={setValue} keyboardType="numeric" />
        <View style={{ height: 12 }} />
        <Text style={styles.fieldLabel}>Type</Text>
        <View style={styles.typeRow}>
          {(["percentage", "fixed", "free_shipping"] as const).map((t) => (
            <Pressable key={t} onPress={() => setType(t)} style={[styles.typeBtn, type === t && styles.typeBtnActive]}>
              <Text style={[styles.typeText, type === t && styles.typeTextActive]}>{t === "free_shipping" ? "Free Ship" : t}</Text>
            </Pressable>
          ))}
        </View>
        <View style={{ height: 24 }} />
        <Button onPress={create} loading={loading}>Create Coupon</Button>
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
  search: { marginHorizontal: 20, marginBottom: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.light.card, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.light.border, fontSize: 14, color: colors.light.foreground },
  filters: { paddingHorizontal: 20, gap: 8, paddingBottom: 12 },
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.light.card, borderWidth: 1, borderColor: colors.light.border },
  chipActive: { backgroundColor: colors.light.primary, borderColor: colors.light.primary },
  chipText: { fontFamily: fontFamilies.mono.medium, fontSize: 10, color: colors.light.mutedForeground, letterSpacing: 0.5, textTransform: "uppercase" },
  chipTextActive: { color: "#fff" },
  list: { padding: 20, paddingTop: 0, paddingBottom: 100, gap: 10 },
  card: { padding: 14, ...shadows.soft },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  index: { fontFamily: fontFamilies.mono.regular, fontSize: 11, color: colors.light.mutedForeground, width: 24 },
  code: { fontFamily: fontFamilies.mono.semibold, fontSize: 14, color: colors.light.foreground, letterSpacing: 0.5 },
  meta: { fontFamily: fontFamilies.sans.regular, fontSize: 11, color: colors.light.mutedForeground, marginTop: 2 },
  modal: { flex: 1, backgroundColor: colors.light.background, padding: 20, paddingTop: 60 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  modalTitle: { fontFamily: fontFamilies.display.regular, fontSize: 22, color: colors.light.foreground },
  fieldLabel: { fontFamily: fontFamilies.mono.medium, fontSize: 11, color: colors.light.foreground, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8 },
  typeRow: { flexDirection: "row", gap: 8 },
  typeBtn: { flex: 1, paddingVertical: 10, borderRadius: radii.md, backgroundColor: colors.light.card, borderWidth: 1, borderColor: colors.light.border, alignItems: "center" },
  typeBtnActive: { backgroundColor: colors.light.primary, borderColor: colors.light.primary },
  typeText: { fontFamily: fontFamilies.sans.semibold, fontSize: 11, color: colors.light.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5 },
  typeTextActive: { color: "#fff" },
});
