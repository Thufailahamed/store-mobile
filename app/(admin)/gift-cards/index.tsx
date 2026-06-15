import React, { useState } from "react";
import { View, Text, FlatList, Pressable, RefreshControl, StyleSheet, Alert, Modal } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Ionicons from "@expo/vector-icons/Ionicons";
import { getAdminGiftCards, createGiftCard } from "@/lib/api";
import { Card, EmptyState, Badge, Skeleton, Input, Button } from "@/components/ui";
import { colors, typography, radii, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";

function rel(s: string) {
  const d = new Date(s).getTime();
  const m = Math.floor((Date.now() - d) / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default function AdminGiftCards() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const q = useQuery({
    queryKey: ["admin-gift-cards"],
    queryFn: async () => {
      const r = await getAdminGiftCards();
      return r.ok ? r.data : [];
    },
  });
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>GIFT</Text>
          <Text style={styles.title}>Gift Cards</Text>
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
        ListEmptyComponent={q.isLoading ? <Skeleton height={80} /> : <EmptyState icon="gift-outline" title="No gift cards" />}
        renderItem={({ item, index }: any) => (
          <Card style={StyleSheet.flatten([styles.card, { backgroundColor: item.is_active ? colors.olive[700] : colors.light.card }])}>
            <View style={styles.row}>
              <Text style={[styles.index, { color: item.is_active ? "#fff" : colors.light.mutedForeground }]}>{String(index + 1).padStart(2, "0")}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.code, { color: item.is_active ? "#fff" : colors.light.foreground }]}>{item.code}</Text>
                <Text style={[styles.meta, { color: item.is_active ? "rgba(255,255,255,0.7)" : colors.light.mutedForeground }]}>
                  {item.issued_to_email ?? "unissued"} · {rel(item.created_at)} ago
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={[styles.balance, { color: item.is_active ? "#fff" : colors.light.foreground }]}>
                  {formatPrice(item.current_balance, item.currency ?? "LKR")}
                </Text>
                <Text style={[styles.balanceSub, { color: item.is_active ? "rgba(255,255,255,0.6)" : colors.light.mutedForeground }]}>
                  of {formatPrice(item.initial_balance, item.currency ?? "LKR")}
                </Text>
              </View>
            </View>
          </Card>
        )}
      />
      <CreateModal visible={showCreate} onClose={() => setShowCreate(false)} onCreated={() => { qc.invalidateQueries({ queryKey: ["admin-gift-cards"] }); setShowCreate(false); }} />
    </View>
  );
}

function CreateModal({ visible, onClose, onCreated }: { visible: boolean; onClose: () => void; onCreated: () => void }) {
  const [amount, setAmount] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const create = async () => {
    const n = Number(amount);
    if (!n || n <= 0) return Alert.alert("Invalid amount", "Enter a positive number");
    setLoading(true);
    const r = await createGiftCard({
      initial_balance: n,
      current_balance: n,
      currency: "LKR",
      issued_to_email: email || undefined,
      is_active: true,
    });
    setLoading(false);
    if (r.ok) { setAmount(""); setEmail(""); onCreated(); }
    else Alert.alert("Error", r.error);
  };
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modal}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Issue Gift Card</Text>
          <Pressable onPress={onClose}><Ionicons name="close" size={22} color={colors.light.foreground} /></Pressable>
        </View>
        <Input label="Amount (LKR)" value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="5000" />
        <View style={{ height: 12 }} />
        <Input label="Recipient email (optional)" value={email} onChangeText={setEmail} keyboardType="email-address" placeholder="someone@example.com" />
        <View style={{ height: 24 }} />
        <Button onPress={create} loading={loading}>Issue Card</Button>
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
  card: { padding: 16, ...shadows.soft },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  index: { fontFamily: fontFamilies.mono.regular, fontSize: 11, width: 24 },
  code: { fontFamily: fontFamilies.mono.semibold, fontSize: 14, letterSpacing: 0.5 },
  meta: { fontFamily: fontFamilies.sans.regular, fontSize: 11, marginTop: 2 },
  balance: { fontFamily: fontFamilies.display.semibold, fontSize: 18, letterSpacing: -0.3 },
  balanceSub: { fontFamily: fontFamilies.mono.regular, fontSize: 10, marginTop: 2 },
  modal: { flex: 1, backgroundColor: colors.light.background, padding: 20, paddingTop: 60 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  modalTitle: { fontFamily: fontFamilies.display.regular, fontSize: 22, color: colors.light.foreground },
});
