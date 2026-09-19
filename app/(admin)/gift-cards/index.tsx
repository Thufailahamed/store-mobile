import React, { useState } from "react";
import {
  View, Text, FlatList, Pressable, RefreshControl, StyleSheet, Alert, Modal, ScrollView,
} from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@/components/ui/Icon";
import {
  getAdminGiftCards, createGiftCard, adjustAdminGiftCard, voidAdminGiftCard,
  getAdminGiftCardTransactions,
} from "@/lib/api";
import { Card, EmptyState, Skeleton, Input, Button } from "@/components/ui";
import { colors, radii, shadows } from "@/lib/theme/tokens";
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
      if (r.ok) return { list: r.data, error: null as string | null };
      return { list: [] as any[], error: r.error ?? "Failed to load gift cards" };
    },
  });

  const cards = q.data?.list ?? [];
  const loadError = q.data?.error ?? null;
  const activeCards = cards.filter((c: any) => !c.voided_at);
  const outstanding = activeCards.reduce((n: number, c: any) => n + (c.current_balance ?? 0), 0);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>GIFT</Text>
          <Text style={styles.title}>Gift Cards</Text>
          <Text style={styles.subtitle}>
            {cards.length
              ? `${activeCards.length} active · ${formatPrice(outstanding, "LKR")} outstanding`
              : "Issue and manage gift cards"}
          </Text>
        </View>
        <Pressable onPress={() => setShowCreate(true)} style={styles.addBtn}>
          <Ionicons name="add" size={20} color="#fff" />
        </Pressable>
      </View>

      {q.isLoading ? (
        <View style={styles.list}>
          <Skeleton height={96} style={{ borderRadius: radii.xl }} />
          <Skeleton height={96} style={{ borderRadius: radii.xl }} />
          <Skeleton height={96} style={{ borderRadius: radii.xl }} />
        </View>
      ) : loadError ? (
        <EmptyState icon="cloud-offline-outline" title="Couldn't load gift cards" description={loadError} />
      ) : cards.length === 0 ? (
        <EmptyState icon="gift-outline" title="No gift cards" description="Issue your first card with the + button." />
      ) : (
        <FlatList
          data={cards}
          keyExtractor={(c: any) => c.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={colors.light.primary} />
          }
          renderItem={({ item }: any) => (
            <GiftCardRow item={item} onPress={() => setManaging(item)} />
          )}
        />
      )}
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

function GiftCardRow({ item, onPress }: { item: any; onPress: () => void }) {
  const isVoided = !!item.voided_at;
  const isScheduled = !!item.scheduled_for && !item.email_sent_at;
  const currency = item.currency ?? "LKR";
  const remainingPct =
    !isVoided && item.initial_balance > 0
      ? Math.max(0, Math.min(1, (item.current_balance ?? 0) / item.initial_balance))
      : 0;
  const fullyUsed = !isVoided && (item.current_balance ?? 0) <= 0;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        isVoided && styles.cardVoided,
        isScheduled && styles.cardScheduled,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.row}>
        <View style={[styles.iconTile, isVoided && styles.iconTileVoided]}>
          <Ionicons name="gift-outline" size={18} color={isVoided ? colors.light.mutedForeground : "#8a6a2a"} />
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.code} numberOfLines={1}>{item.code}</Text>
          <Text style={styles.meta} numberOfLines={1}>
            {item.recipient_email ?? item.issued_to_email ?? "unissued"} · {rel(item.created_at)} ago
          </Text>
          <View style={styles.pillRow}>
            {isVoided ? (
              <View style={[styles.pill, styles.pillVoided]}>
                <Text style={[styles.pillText, { color: colors.accent2.rust }]}>Voided</Text>
              </View>
            ) : (
              <>
                {isScheduled ? (
                  <View style={[styles.pill, styles.pillScheduled]}>
                    <Text style={[styles.pillText, { color: "#8a6a2a" }]}>Scheduled</Text>
                  </View>
                ) : null}
                {item.email_sent_at ? (
                  <View style={[styles.pill, styles.pillNeutral]}>
                    <Text style={[styles.pillText, { color: colors.olive[800] }]}>Sent</Text>
                  </View>
                ) : null}
                {item.redeemed_by ? (
                  <View style={[styles.pill, styles.pillNeutral]}>
                    <Text style={[styles.pillText, { color: colors.olive[800] }]}>Redeemed</Text>
                  </View>
                ) : null}
                {fullyUsed ? (
                  <View style={[styles.pill, styles.pillNeutral]}>
                    <Text style={[styles.pillText, { color: colors.light.mutedForeground }]}>Spent</Text>
                  </View>
                ) : null}
              </>
            )}
          </View>
        </View>
        <View style={styles.balanceCol}>
          <Text style={[styles.balance, isVoided && styles.balanceVoided]}>
            {formatPrice(item.current_balance, currency)}
          </Text>
          <Text style={styles.balanceSub}>of {formatPrice(item.initial_balance, currency)}</Text>
        </View>
      </View>
      <View style={styles.cardFooter}>
        <View style={styles.meterTrack}>
          <View style={[styles.meterFill, { width: `${Math.round(remainingPct * 100)}%` as never }]} />
        </View>
        <Text style={styles.manageHint}>Manage</Text>
        <Ionicons name="chevron-forward" size={12} color={colors.olive[700]} />
      </View>
    </Pressable>
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
    Alert.alert(
      "Adjust balance?",
      `${n > 0 ? "Add" : "Remove"} ${Math.abs(n)} ${card.currency ?? "LKR"} ${n > 0 ? "to" : "from"} this card.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Adjust",
          onPress: async () => {
            setBusy(true);
            const r = await adjustAdminGiftCard(card.id, { delta: n, note: note || undefined });
            setBusy(false);
            if (r.ok) { Alert.alert("Adjusted"); onDone(); }
            else Alert.alert("Failed", r.error);
          },
        },
      ],
    );
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
    Alert.alert(
      "Void this card?",
      "Voiding is permanent — remaining balance becomes unusable.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Void",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            const r = await voidAdminGiftCard(card.id, { reason: reason || undefined });
            setBusy(false);
            if (r.ok) { Alert.alert("Voided"); onDone(); }
            else Alert.alert("Failed", r.error);
          },
        },
      ],
    );
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
  subtitle: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: colors.light.mutedForeground, marginTop: 4 },
  addBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.olive[900], alignItems: "center", justifyContent: "center", ...shadows.soft },
  list: { padding: 20, paddingBottom: 100, gap: 10 },
  pressed: { opacity: 0.8 },
  card: {
    backgroundColor: colors.light.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.light.border,
    padding: 14,
    gap: 10,
    ...shadows.soft,
  },
  cardVoided: { opacity: 0.6 },
  cardScheduled: { borderColor: "rgba(200,164,74,0.55)" },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconTile: {
    width: 42,
    height: 42,
    borderRadius: 11,
    backgroundColor: "#fdf3d7",
    borderWidth: 1,
    borderColor: "#eedeac",
    alignItems: "center",
    justifyContent: "center",
  },
  iconTileVoided: { backgroundColor: colors.light.muted, borderColor: colors.light.border },
  cardBody: { flex: 1, gap: 2 },
  code: { fontFamily: fontFamilies.mono.semibold, fontSize: 14, letterSpacing: 0.5, color: colors.light.foreground },
  meta: { fontFamily: fontFamilies.sans.regular, fontSize: 11, color: colors.light.mutedForeground },
  pillRow: { flexDirection: "row", gap: 6, marginTop: 3, flexWrap: "wrap" },
  pill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: radii.full },
  pillVoided: { backgroundColor: "rgba(184,92,58,0.12)" },
  pillScheduled: { backgroundColor: "rgba(200,164,74,0.20)" },
  pillNeutral: { backgroundColor: "rgba(83,94,44,0.12)" },
  pillText: { fontFamily: fontFamilies.mono.semibold, fontSize: 8.5, letterSpacing: 0.5, textTransform: "uppercase" },
  balanceCol: { alignItems: "flex-end" },
  balance: { fontFamily: fontFamilies.display.semibold, fontSize: 17, letterSpacing: -0.3, color: colors.light.foreground },
  balanceVoided: { textDecorationLine: "line-through", color: colors.light.mutedForeground },
  balanceSub: { fontFamily: fontFamilies.mono.regular, fontSize: 10, marginTop: 2, color: colors.light.mutedForeground },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.light.border,
  },
  meterTrack: { flex: 1, height: 5, borderRadius: 3, backgroundColor: colors.light.muted, overflow: "hidden" },
  meterFill: { height: 5, borderRadius: 3, backgroundColor: "#c8a44a" },
  manageHint: { fontFamily: fontFamilies.sans.medium, fontSize: 11, color: colors.olive[700] },
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