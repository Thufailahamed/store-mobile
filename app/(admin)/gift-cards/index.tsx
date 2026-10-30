import React, { useState } from "react";
import {
  View, Text, FlatList, Pressable, RefreshControl, StyleSheet, Alert, ScrollView,
} from "react-native";
import { Modal } from "@/components/ui/Modal";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@/components/ui/Icon";
import {
  getAdminGiftCards, createGiftCard, adjustAdminGiftCard, voidAdminGiftCard,
  getAdminGiftCardTransactions,
} from "@/lib/api";
import { Card, EmptyState, Skeleton, Input, Button } from "@/components/ui";
import { colors, radii, shadows } from "@/lib/theme/tokens";
import { LinearGradient } from "expo-linear-gradient";
import { AdminMasthead, StatBand, Segmented, GOLD, CREAM, RUST } from "@/components/admin/premium-kit";
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

type Filter = "all" | "active" | "spent" | "voided";

const isSpent = (c: any) => !c.voided_at && (c.current_balance ?? 0) <= 0;
const isActive = (c: any) => !c.voided_at && (c.current_balance ?? 0) > 0;

function compactLkr(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(Math.round(n));
}

export default function AdminGiftCards() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [managing, setManaging] = useState<any | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
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
  const activeCards = cards.filter(isActive);
  const spentCount = cards.filter(isSpent).length;
  const voidedCount = cards.filter((c: any) => !!c.voided_at).length;
  const outstanding = activeCards.reduce((n: number, c: any) => n + (c.current_balance ?? 0), 0);
  const issuedLive = cards.filter((c: any) => !c.voided_at).reduce((n: number, c: any) => n + (c.initial_balance ?? 0), 0);
  const redeemedPct = issuedLive > 0 ? Math.round(((issuedLive - outstanding) / issuedLive) * 100) : 0;

  const visible =
    filter === "all" ? cards
    : filter === "active" ? activeCards
    : filter === "spent" ? cards.filter(isSpent)
    : cards.filter((c: any) => !!c.voided_at);

  return (
    <View style={styles.container}>
      <FlatList
        data={q.isLoading || loadError ? [] : visible}
        keyExtractor={(c: any) => c.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={q.isFetching && !q.isLoading} onRefresh={() => q.refetch()} tintColor={colors.light.primary} />
        }
        ListHeaderComponent={
          <View>
            <AdminMasthead
              eyebrow="Gifting"
              title="Gift"
              italic="Vault"
              subtitle="Stored value issued across LUXE. Tap a card to view its ledger, adjust or void."
              onAdd={() => setShowCreate(true)}
            />
            {cards.length ? (
              <>
                <StatBand
                  items={[
                    { label: "Outstanding", value: `${compactLkr(outstanding)}`, accent: true },
                    { label: "Active", value: activeCards.length },
                    { label: "Redeemed", value: `${redeemedPct}%` },
                  ]}
                />
                <Segmented<Filter>
                  value={filter}
                  onChange={setFilter}
                  options={[
                    { value: "all", label: "All", count: cards.length },
                    { value: "active", label: "Active", count: activeCards.length },
                    { value: "spent", label: "Spent", count: spentCount },
                    { value: "voided", label: "Void", count: voidedCount },
                  ]}
                />
              </>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          q.isLoading ? (
            <View style={{ gap: 16, paddingHorizontal: 16 }}>
              <Skeleton height={196} style={{ borderRadius: 22 }} />
              <Skeleton height={196} style={{ borderRadius: 22 }} />
            </View>
          ) : loadError ? (
            <EmptyState icon="cloud-offline-outline" title="Couldn't load gift cards" description={loadError} />
          ) : cards.length ? (
            <Text style={styles.noMatch}>No {filter} cards.</Text>
          ) : (
            <EmptyState icon="gift-outline" title="No gift cards" description="Issue your first card with the + button." />
          )
        }
        renderItem={({ item }: any) => (
          <Pressable onPress={() => setManaging(item)} style={({ pressed }) => [styles.cardWrap, pressed && styles.pressed]}>
            <GiftCardVisual item={item} />
          </Pressable>
        )}
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

/** Foil finish keyed off the card's face value; voided/spent cards go matte. */
function finishFor(item: any): { colors: [string, string, string]; ink: string; sub: string; accent: string; matte?: boolean } {
  if (item.voided_at) return { colors: ["#cfcdc2", "#bdbbb0", "#a9a79b"], ink: "#4d4b42", sub: "rgba(45,43,36,0.6)", accent: "#6d6b60", matte: true };
  if (isSpent(item)) return { colors: ["#e4e2d6", "#d6d4c6", "#c6c4b4"], ink: "#3e3d33", sub: "rgba(45,43,36,0.6)", accent: "#6d6b60", matte: true };
  const v = item.initial_balance ?? 0;
  if (v >= 100_000) return { colors: ["#2a2a22", "#16170f", "#0b0c07"], ink: CREAM, sub: "rgba(250,248,241,0.55)", accent: GOLD };
  if (v >= 40_000) return { colors: ["#e9d39a", "#c8a44a", "#9c7a2c"], ink: "#2c2410", sub: "rgba(44,36,16,0.62)", accent: "#3a2e10" };
  return { colors: ["#4a5428", colors.olive[800], "#1c200f"], ink: CREAM, sub: "rgba(250,248,241,0.6)", accent: GOLD };
}

function GiftCardVisual({ item }: { item: any }) {
  const f = finishFor(item);
  const isVoided = !!item.voided_at;
  const isScheduled = !!item.scheduled_for && !item.email_sent_at;
  const currency = item.currency ?? "LKR";
  const remainingPct =
    !isVoided && item.initial_balance > 0
      ? Math.max(0, Math.min(1, (item.current_balance ?? 0) / item.initial_balance))
      : 0;
  const status = isVoided ? "VOID" : isSpent(item) ? "SPENT" : isScheduled ? "SCHEDULED" : item.email_sent_at ? "SENT" : item.redeemed_by ? "REDEEMED" : null;
  const holder = item.recipient_name ?? item.recipient_email ?? item.issued_to_email ?? "Unassigned";
  const age = item.created_at ? rel(item.created_at) : null;

  return (
    <LinearGradient colors={f.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gc}>
      {/* sheen + guilloché rings */}
      {!f.matte ? (
        <LinearGradient
          colors={["rgba(255,255,255,0)", "rgba(255,255,255,0.14)", "rgba(255,255,255,0)"]}
          start={{ x: 0, y: 0.2 }}
          end={{ x: 1, y: 0.8 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <View pointerEvents="none" style={[styles.gcRing, { borderColor: f.accent, width: 240, height: 240, top: -130, right: -80 }]} />
      <View pointerEvents="none" style={[styles.gcRing, { borderColor: f.accent, width: 150, height: 150, top: -85, right: -35 }]} />

      <View style={styles.gcTop}>
        <View>
          <Text style={[styles.gcBrand, { color: f.ink }]}>LUXE</Text>
          <Text style={[styles.gcKind, { color: f.sub }]}>GIFT CARD</Text>
        </View>
        {status ? (
          <View style={[styles.gcStatus, { borderColor: f.sub }]}>
            <Text style={[styles.gcStatusText, { color: isVoided ? RUST : f.ink }]}>{status}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.gcMid}>
        <LinearGradient colors={["#f1dc9c", "#c8a44a", "#a3832f"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.chip, f.matte && { opacity: 0.45 }]}>
          <View style={styles.chipLineH} />
          <View style={styles.chipLineV} />
        </LinearGradient>
        <Text style={[styles.gcCode, { color: f.ink }, isVoided && styles.strike]} numberOfLines={1} adjustsFontSizeToFit>
          {item.code}
        </Text>
      </View>

      <View style={styles.gcBottom}>
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text style={[styles.gcLabel, { color: f.sub }]}>ISSUED TO{age ? ` · ${age.toUpperCase()} AGO` : ""}</Text>
          <Text style={[styles.gcHolder, { color: f.ink }]} numberOfLines={1}>{holder}</Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={[styles.gcLabel, { color: f.sub }]}>BALANCE</Text>
          <Text style={[styles.gcBalance, { color: f.ink }, isVoided && styles.strike]}>
            {formatPrice(item.current_balance ?? 0, currency)}
          </Text>
          <Text style={[styles.gcOf, { color: f.sub }]}>of {formatPrice(item.initial_balance ?? 0, currency)}</Text>
        </View>
      </View>

      <View style={[styles.gcMeter, { backgroundColor: f.matte ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.14)" }]}>
        <View style={[styles.gcMeterFill, { width: `${Math.round(remainingPct * 100)}%` as never, backgroundColor: f.accent }]} />
      </View>
    </LinearGradient>
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
            <Text style={styles.modalEyebrow}>MANAGE CARD</Text>
            <Text style={styles.modalTitle}>{card.code}</Text>
          </View>
          <Pressable onPress={onClose} hitSlop={8} style={styles.modalClose}>
            <Ionicons name="close" size={18} color={colors.light.foreground} />
          </Pressable>
        </View>

        <View style={{ marginBottom: 16 }}>
          <GiftCardVisual item={card} />
        </View>

        <View style={{ marginHorizontal: -16 }}>
          <Segmented<"ledger" | "adjust" | "void">
            value={tab}
            onChange={setTab}
            options={[
              { value: "ledger", label: "Ledger" },
              { value: "adjust", label: "Adjust" },
              ...(card.voided_at ? [] : [{ value: "void" as const, label: "Void" }]),
            ]}
          />
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
                <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
                  <View style={styles.txIcon}>
                    <Ionicons name={(TX_ICONS[item.type] ?? "ellipse-outline") as any} size={15} color={colors.olive[700]} />
                  </View>
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
  list: { paddingBottom: 140, gap: 16 },
  noMatch: { fontFamily: fontFamilies.sans.regular, fontSize: 13, color: colors.light.mutedForeground, textAlign: "center", paddingVertical: 24 },
  pressed: { transform: [{ scale: 0.985 }] },
  cardWrap: { marginHorizontal: 16, borderRadius: 22, ...shadows.editorial, shadowOpacity: 0.18 },

  gc: { borderRadius: 22, padding: 18, height: 200, overflow: "hidden", justifyContent: "space-between" },
  gcRing: { position: "absolute", borderRadius: 999, borderWidth: 1, opacity: 0.22 },
  gcTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  gcBrand: { fontFamily: fontFamilies.display.italic, fontSize: 22, letterSpacing: 2 },
  gcKind: { fontFamily: fontFamilies.mono.medium, fontSize: 8.5, letterSpacing: 2.2, marginTop: 1 },
  gcStatus: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.full, borderWidth: StyleSheet.hairlineWidth },
  gcStatusText: { fontFamily: fontFamilies.mono.semibold, fontSize: 8.5, letterSpacing: 1.4 },
  gcMid: { flexDirection: "row", alignItems: "center", gap: 14 },
  chip: { width: 36, height: 27, borderRadius: 6, overflow: "hidden" },
  chipLineH: { position: "absolute", left: 0, right: 0, top: 13, height: StyleSheet.hairlineWidth, backgroundColor: "rgba(60,45,10,0.5)" },
  chipLineV: { position: "absolute", top: 0, bottom: 0, left: 17, width: StyleSheet.hairlineWidth, backgroundColor: "rgba(60,45,10,0.5)" },
  gcCode: { flex: 1, fontFamily: fontFamilies.mono.medium, fontSize: 17, letterSpacing: 3 },
  strike: { textDecorationLine: "line-through" },
  gcBottom: { flexDirection: "row", alignItems: "flex-end" },
  gcLabel: { fontFamily: fontFamilies.mono.regular, fontSize: 7.5, letterSpacing: 1.4 },
  gcHolder: { fontFamily: fontFamilies.sans.semibold, fontSize: 12.5, marginTop: 3 },
  gcBalance: { fontFamily: fontFamilies.display.semibold, fontSize: 22, letterSpacing: -0.5, marginTop: 1 },
  gcOf: { fontFamily: fontFamilies.mono.regular, fontSize: 9 },
  gcMeter: { position: "absolute", left: 0, right: 0, bottom: 0, height: 3 },
  gcMeterFill: { height: 3 },

  modalClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.light.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.light.border,
  },
  txIcon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#eef0dc" },
  modal: { flex: 1, backgroundColor: colors.light.background, padding: 20, paddingTop: 60 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 },
  modalEyebrow: { fontFamily: fontFamilies.mono.medium, fontSize: 9, color: colors.light.primary, letterSpacing: 1.4 },
  modalTitle: { fontFamily: fontFamilies.mono.semibold, fontSize: 18, letterSpacing: 1.5, color: colors.light.foreground, marginTop: 2 },
  txCard: { padding: 12, backgroundColor: colors.light.card },
  txType: { fontFamily: fontFamilies.mono.semibold, fontSize: 12, color: colors.light.foreground, textTransform: "uppercase", letterSpacing: 0.5 },
  txNote: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: colors.light.foreground, marginTop: 2 },
  txMeta: { fontFamily: fontFamilies.mono.regular, fontSize: 10, color: colors.light.mutedForeground, marginTop: 2 },
  txAmount: { fontFamily: fontFamilies.mono.semibold, fontSize: 13 },
  muted: { color: colors.light.mutedForeground, fontFamily: fontFamilies.sans.regular, fontSize: 13, marginVertical: 12 },
});