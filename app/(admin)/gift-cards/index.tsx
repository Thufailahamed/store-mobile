import React, { useState } from "react";
import {
  View, Text, FlatList, Pressable, RefreshControl, StyleSheet, Alert, Modal, TextInput, ScrollView,
} from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@/components/ui/Icon";
import {
  getAdminGiftCards, createGiftCard, adjustAdminGiftCard, voidAdminGiftCard,
  getAdminGiftCardTransactions,
} from "@/lib/api";
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

const TX_ICONS: Record<string, string> = {
  purchase: "card-outline",
  redeem: "bag-check-outline",
  adjust: "swap-vertical-outline",
  void: "close-circle-outline",
  refund: "refresh-outline",
};

export default function AdminGiftCards() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [managing, setManaging] = useState<any | null>(null);
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
        renderItem={({ item, index }: any) => {
          const isVoided = !!item.voided_at;
          const isScheduled = !!item.scheduled_for && !item.email_sent_at;
          return (
            <Pressable onPress={() => setManaging(item)}>
              <Card style={StyleSheet.flatten([
                styles.card,
                isVoided && { opacity: 0.55 },
                isScheduled && { borderColor: colors.olive[400] },
              ])}>
                <View style={styles.row}>
                  <Text style={[styles.index, { color: colors.light.mutedForeground }]}>{String(index + 1).padStart(2, "0")}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.code}>{item.code}</Text>
                    <Text style={styles.meta}>
                      {item.recipient_email ?? item.issued_to_email ?? "unissued"} · {rel(item.created_at)} ago
                    </Text>
                    <View style={{ flexDirection: "row", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                      {isVoided && <Badge text="Voided" variant="destructive" />}
                      {!isVoided && isScheduled && <Badge text={`Scheduled`} variant="outline" />}
                      {!isVoided && item.email_sent_at && <Badge text="Sent" variant="secondary" />}
                      {!isVoided && item.redeemed_by && <Badge text="Redeemed" variant="secondary" />}
                    </View>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={styles.balance}>{formatPrice(item.current_balance, item.currency ?? "LKR")}</Text>
                    <Text style={styles.balanceSub}>of {formatPrice(item.initial_balance, item.currency ?? "LKR")}</Text>
                    <Text style={styles.viewLedger}>Manage ›</Text>
                  </View>
                </View>
              </Card>
            </Pressable>
          );
        }}
      />
      <CreateModal visible={showCreate} onClose={() => setShowCreate(false)} onCreated={() => { qc.invalidateQueries({ queryKey: ["admin-gift-cards"] }); setShowCreate(false); }} />
      {managing && (
        <ManageModal
          card={managing}
          onClose={() => setManaging(null)}
          onChanged={() => { qc.invalidateQueries({ queryKey: ["admin-gift-cards"] }); }}
        />
      )}
    </View>
  );
}

function CreateModal({ visible, onClose, onCreated }: { visible: boolean; onClose: () => void; onCreated: () => void }) {
  const [amount, setAmount] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
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
      recipient_name: name || undefined,
    } as any);
    setLoading(false);
    if (r.ok) { setAmount(""); setEmail(""); setName(""); onCreated(); }
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
        <View style={{ height: 12 }} />
        <Input label="Recipient name (optional)" value={name} onChangeText={setName} placeholder="Jane Doe" />
        <View style={{ height: 24 }} />
        <Button onPress={create} loading={loading}>Issue Card</Button>
      </View>
    </Modal>
  );
}

function ManageModal({ card, onClose, onChanged }: { card: any; onClose: () => void; onChanged: () => void }) {
  const [tab, setTab] = useState<"ledger" | "adjust" | "void">("ledger");
  const txQ = useQuery({
    queryKey: ["admin-gc-tx", card.id],
    queryFn: async () => {
      const r = await getAdminGiftCardTransactions(card.id);
      return r.ok ? (r.data.transactions as any[]) : [];
    },
  });
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modal}>
        <View style={styles.modalHeader}>
          <View>
            <Text style={styles.modalEyebrow}>CARD</Text>
            <Text style={styles.modalTitle}>{card.code}</Text>
            <Text style={styles.modalSub}>
              Balance {formatPrice(card.current_balance, card.currency ?? "LKR")} of {formatPrice(card.initial_balance, card.currency ?? "LKR")}
            </Text>
          </View>
          <Pressable onPress={onClose}><Ionicons name="close" size={22} color={colors.light.foreground} /></Pressable>
        </View>

        <View style={styles.tabRow}>
          {(["ledger", "adjust", "void"] as const).map((t) => (
            <Pressable key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabActive]}>
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t.toUpperCase()}</Text>
            </Pressable>
          ))}
        </View>

        {tab === "ledger" && (
          <FlatList
            data={txQ.data ?? []}
            keyExtractor={(t) => t.id}
            contentContainerStyle={{ gap: 8, paddingBottom: 60 }}
            refreshControl={<RefreshControl refreshing={txQ.isFetching} onRefresh={() => txQ.refetch()} />}
            ListEmptyComponent={
              txQ.isLoading ? <Skeleton height={40} /> :
              <Text style={styles.muted}>No transactions yet.</Text>
            }
            renderItem={({ item }: any) => (
              <Card style={styles.txCard}>
                <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
                  <Ionicons name={(TX_ICONS[item.type] ?? "ellipse-outline") as any} size={16} color={colors.light.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.txType}>{item.type}</Text>
                    {item.note ? <Text style={styles.txNote}>{item.note}</Text> : null}
                    <Text style={styles.txMeta}>
                      {new Date(item.created_at).toLocaleString()}
                      {item.order_id ? ` · order ${item.order_id.slice(0, 8)}` : ""}
                    </Text>
                  </View>
                  <Text style={[styles.txAmount, item.amount >= 0 ? { color: colors.olive[700] } : { color: "#b45309" }]}>
                    {item.amount >= 0 ? "+" : ""}{formatPrice(item.amount, card.currency ?? "LKR")}
                  </Text>
                </View>
              </Card>
            )}
          />
        )}

        {tab === "adjust" && (
          <AdjustForm card={card} onDone={() => { onChanged(); onClose(); }} />
        )}

        {tab === "void" && (
          <VoidForm card={card} onDone={() => { onChanged(); onClose(); }} />
        )}
      </View>
    </Modal>
  );
}

function AdjustForm({ card, onDone }: { card: any; onDone: () => void }) {
  const [delta, setDelta] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    const n = Number(delta);
    if (!Number.isFinite(n) || n === 0) return Alert.alert("Enter non-zero delta");
    setBusy(true);
    const r = await adjustAdminGiftCard(card.id, { delta: n, note: note || undefined });
    setBusy(false);
    if (r.ok) { Alert.alert("Adjusted"); onDone(); }
    else Alert.alert("Failed", r.error);
  };
  return (
    <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 40 }}>
      <Text style={styles.muted}>Positive adds balance, negative removes.</Text>
      <Input label="Delta" value={delta} onChangeText={setDelta} keyboardType="numeric" placeholder="e.g. 1000 or -500" />
      <Input label="Note" value={note} onChangeText={setNote} placeholder="Reason (optional)" />
      <Button onPress={submit} loading={busy}>Apply adjustment</Button>
    </ScrollView>
  );
}

function VoidForm({ card, onDone }: { card: any; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    const r = await voidAdminGiftCard(card.id, { reason: reason || undefined });
    setBusy(false);
    if (r.ok) { Alert.alert("Voided"); onDone(); }
    else Alert.alert("Failed", r.error);
  };
  return (
    <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 40 }}>
      <Text style={styles.muted}>Voiding is permanent — remaining balance becomes unusable.</Text>
      <Input label="Reason" value={reason} onChangeText={setReason} placeholder="Why this card is void" />
      <Button onPress={submit} loading={busy} variant="destructive">Void this card</Button>
    </ScrollView>
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
  code: { fontFamily: fontFamilies.mono.semibold, fontSize: 14, letterSpacing: 0.5, color: colors.light.foreground },
  meta: { fontFamily: fontFamilies.sans.regular, fontSize: 11, marginTop: 2, color: colors.light.mutedForeground },
  balance: { fontFamily: fontFamilies.display.semibold, fontSize: 18, letterSpacing: -0.3, color: colors.light.foreground },
  balanceSub: { fontFamily: fontFamilies.mono.regular, fontSize: 10, marginTop: 2, color: colors.light.mutedForeground },
  viewLedger: { fontFamily: fontFamilies.sans.regular, fontSize: 11, color: colors.olive[700], marginTop: 4 },
  modal: { flex: 1, backgroundColor: colors.light.background, padding: 20, paddingTop: 60 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 },
  modalEyebrow: { fontFamily: fontFamilies.mono.medium, fontSize: 9, color: colors.light.primary, letterSpacing: 1.4 },
  modalTitle: { fontFamily: fontFamilies.display.regular, fontSize: 22, color: colors.light.foreground, marginTop: 2 },
  modalSub: { fontFamily: fontFamilies.mono.regular, fontSize: 12, color: colors.light.mutedForeground, marginTop: 4 },
  tabRow: { flexDirection: "row", gap: 6, marginBottom: 16 },
  tab: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radii.full, borderWidth: 1, borderColor: colors.light.border },
  tabActive: { borderColor: colors.olive[700], backgroundColor: colors.olive[50] },
  tabText: { fontFamily: fontFamilies.mono.medium, fontSize: 10, color: colors.light.mutedForeground, letterSpacing: 1 },
  tabTextActive: { color: colors.olive[700] },
  txCard: { padding: 12, backgroundColor: colors.light.card },
  txType: { fontFamily: fontFamilies.mono.semibold, fontSize: 12, color: colors.light.foreground, textTransform: "uppercase", letterSpacing: 0.5 },
  txNote: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: colors.light.foreground, marginTop: 2 },
  txMeta: { fontFamily: fontFamilies.mono.regular, fontSize: 10, color: colors.light.mutedForeground, marginTop: 2 },
  txAmount: { fontFamily: fontFamilies.mono.semibold, fontSize: 13 },
  muted: { color: colors.light.mutedForeground, fontFamily: fontFamilies.sans.regular, fontSize: 13, marginVertical: 12 },
});