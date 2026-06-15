import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ScreenHeader } from "@/components/layout";
import { Button } from "@/components/ui";
import { Badge } from "@/components/ui";
import { Body, Display, Label } from "@/components/ui/Typography";
import { useAuth } from "@/lib/supabase/auth";
import { useToast } from "@/components/ui";
import {
  getStoredPayments,
  setStoredPayments,
  type PaymentBrand,
  type PaymentCard,
} from "@/lib/account-local";
import { colors, radii, spacing, shadows, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

const BRAND_META: Record<PaymentBrand, { label: string; color: string; logo: string }> = {
  visa: { label: "Visa", color: "#1a1f71", logo: "VISA" },
  mastercard: { label: "Mastercard", color: "#eb001b", logo: "MC" },
  amex: { label: "Amex", color: "#016fd0", logo: "AMEX" },
};

export default function PaymentsScreen() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [payments, setPayments] = useState<PaymentCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ number: "", holder: "", exp: "", cvv: "" });

  useEffect(() => {
    let cancelled = false;
    getStoredPayments(user?.id).then((items) => {
      if (!cancelled) setPayments(items);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const save = (next: PaymentCard[]) => {
    setPayments(next);
    setStoredPayments(user?.id, next);
  };

  const defaultCard = payments.find((p) => p.is_default);

  const stats = useMemo(() => [
    { label: "Cards", value: payments.length },
    { label: "Default", value: defaultCard ? `${defaultCard.brand} •••• ${defaultCard.last4}` : "None" },
    { label: "Charges YTD", value: payments.reduce((sum, p) => sum + p.charges, 0) },
    { label: "Security", value: "3DS on" },
  ], [payments, defaultCard]);

  const makeDefault = (id: string) => {
    save(payments.map((p) => ({ ...p, is_default: p.id === id })));
    toast("Default card updated", "success");
  };

  const removeCard = (id: string) => {
    const next = payments.filter((p) => p.id !== id);
    if (next.length > 0 && !next.some((p) => p.is_default)) next[0].is_default = true;
    save(next);
    toast("Card removed", "success");
  };

  const addCard = () => {
    const clean = form.number.replace(/\s+/g, "");
    if (clean.length < 15 || clean.length > 16) {
      toast("Enter a valid card number", "error");
      return;
    }
    if (!form.holder.trim()) {
      toast("Cardholder name required", "error");
      return;
    }
    if (!/^\d{2}\/\d{2}$/.test(form.exp)) {
      toast("Use MM/YY expiry", "error");
      return;
    }

    let brand: PaymentBrand = "visa";
    if (clean.startsWith("5")) brand = "mastercard";
    if (clean.startsWith("3")) brand = "amex";

    const next: PaymentCard = {
      id: `card-${Date.now()}`,
      brand,
      last4: clean.slice(-4),
      exp: form.exp,
      holder: form.holder.trim(),
      is_default: payments.length === 0,
      added: new Date().toLocaleString("en-US", { month: "short", year: "numeric" }),
      charges: 0,
    };

    setSaving(true);
    setTimeout(() => {
      save([...payments, next]);
      setForm({ number: "", holder: "", exp: "", cvv: "" });
      setModalOpen(false);
      setSaving(false);
      toast("Card added successfully", "success");
    }, 450);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <ScreenHeader title="Payment methods" />
        <View style={styles.loading}><Body muted>Loading cards…</Body></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader
        title="Payment methods"
        right={
          <TouchableOpacity style={styles.headerButton} onPress={() => setModalOpen(true)}>
            <Ionicons name="add" size={22} color={colors.light.foreground} />
          </TouchableOpacity>
        }
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View>
            <Label style={styles.heroLabel}>Wallet</Label>
            <Display size="2xl" style={styles.heroTitle}>Plastic & pixels</Display>
            <Body muted>Cards on file, encrypted end-to-end. Switch the default whenever.</Body>
          </View>
          <View style={styles.lockBadge}>
            <Ionicons name="lock-closed-outline" size={16} color={colors.light.primaryForeground} />
          </View>
        </View>

        <View style={styles.statsGrid}>
          {stats.map((s, i) => (
            <View key={s.label} style={styles.statCard}>
              <Display size="lg">{typeof s.value === "number" ? s.value.toLocaleString() : s.value}</Display>
              <Label style={styles.statLabel}>{s.label}</Label>
            </View>
          ))}
        </View>

        {payments.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}><Ionicons name="card-outline" size={28} color={colors.light.mutedForeground} /></View>
            <Display size="xl">No cards saved</Display>
            <Body muted>Add a card to speed up checkout.</Body>
            <Button onPress={() => setModalOpen(true)}>Add card</Button>
          </View>
        ) : (
          <View style={styles.cards}>
            {payments.map((card) => {
              const meta = BRAND_META[card.brand];
              return (
                <View key={card.id} style={[styles.card, card.is_default && styles.cardDefault]}>
                  <View style={[styles.cardArt, { backgroundColor: meta.color }]}>
                    <View style={styles.cardArtTop}>
                      <Label style={styles.cardMeta}>{meta.label}</Label>
                      <Label style={styles.cardLogo}>{meta.logo}</Label>
                    </View>
                    <Body style={styles.cardNumber}>•••• •••• •••• {card.last4}</Body>
                    <View style={styles.cardArtBottom}>
                      <Body muted size="xs">{card.holder}</Body>
                      <Body muted size="xs">{card.exp}</Body>
                    </View>
                  </View>
                  <View style={styles.cardMetaRow}>
                    <View>
                      <Body size="xs" muted>Added {card.added} · {card.charges} charges</Body>
                      {card.is_default && <Badge style={{ marginTop: 6, backgroundColor: colors.olive[100] }}><Label style={{ color: colors.olive[700] }}>Default</Label></Badge>}
                    </View>
                    <View style={styles.cardActions}>
                      {!card.is_default && (
                        <TouchableOpacity onPress={() => makeDefault(card.id)} style={styles.iconButton}>
                          <Ionicons name="star-outline" size={18} color={colors.light.primary} />
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity onPress={() => Alert.alert("Remove card", "Remove this card from your wallet?", [
                        { text: "Cancel", style: "cancel" },
                        { text: "Remove", style: "destructive", onPress: () => removeCard(card.id) },
                      ])} style={styles.iconButton}>
                        <Ionicons name="trash-outline" size={18} color={colors.light.destructive} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <Modal visible={modalOpen} transparent animationType="fade">
          <View style={styles.modalBackdrop}>
            <View style={styles.modal}>
              <View style={styles.modalHeader}>
                <Display size="lg">Add card</Display>
                <TouchableOpacity onPress={() => setModalOpen(false)}><Ionicons name="close" size={22} color={colors.light.foreground} /></TouchableOpacity>
              </View>
              <Field label="Card number" value={form.number} onChangeText={(v) => setForm((f) => ({ ...f, number: v.replace(/[^\d]/g, "").slice(0, 19) }))} keyboardType="number-pad" />
              <Field label="Cardholder" value={form.holder} onChangeText={(v) => setForm((f) => ({ ...f, holder: v }))} />
              <View style={styles.rowFields}>
                <Field label="Expiry" value={form.exp} onChangeText={(v) => {
                  const digits = v.replace(/[^\d]/g, "").slice(0, 4);
                  setForm((f) => ({ ...f, exp: digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits }));
                }} keyboardType="number-pad" />
                <Field label="CVV" value={form.cvv} onChangeText={(v) => setForm((f) => ({ ...f, cvv: v.replace(/[^\d]/g, "").slice(0, 4) }))} keyboardType="number-pad" />
              </View>
              <Button loading={saving} onPress={addCard}>Save card</Button>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: "default" | "number-pad";
}) {
  return (
    <View style={styles.field}>
      <Label style={styles.fieldLabel}>{label}</Label>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        autoCapitalize="words"
        placeholderTextColor={colors.light.mutedForeground}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: spacing[5], paddingBottom: spacing[8] },
  headerButton: { width: 40, height: 40, borderRadius: radii.lg, backgroundColor: colors.olive[50], alignItems: "center", justifyContent: "center" },
  hero: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    backgroundColor: colors.light.card,
    borderRadius: radii["2xl"],
    padding: 20,
    borderWidth: 1,
    borderColor: colors.light.border,
    ...shadows.soft,
    marginBottom: spacing[5],
  },
  heroLabel: { color: colors.light.mutedForeground },
  heroTitle: { marginTop: spacing[2], marginBottom: spacing[2] },
  lockBadge: { width: 40, height: 40, borderRadius: radii.lg, alignItems: "center", justifyContent: "center", backgroundColor: colors.light.primary },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: spacing[5] },
  statCard: { width: "48%", backgroundColor: colors.light.card, borderRadius: radii.xl, padding: 14, borderWidth: 1, borderColor: colors.light.border },
  statLabel: { color: colors.light.mutedForeground, marginTop: 4 },
  empty: {
    alignItems: "center",
    backgroundColor: colors.light.card,
    borderRadius: radii["2xl"],
    padding: spacing[8],
    borderWidth: 1,
    borderColor: colors.light.border,
    gap: spacing[3],
  },
  emptyIcon: { width: 54, height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center", backgroundColor: colors.olive[50] },
  cards: { gap: 14 },
  card: {
    backgroundColor: colors.light.card,
    borderRadius: radii["2xl"],
    padding: 12,
    borderWidth: 1,
    borderColor: colors.light.border,
    ...shadows.soft,
  },
  cardDefault: { borderColor: colors.light.primary },
  cardArt: {
    borderRadius: radii.xl,
    padding: 16,
    minHeight: 138,
    justifyContent: "space-between",
    overflow: "hidden",
  },
  cardArtTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardMeta: { color: "rgba(255,255,255,0.75)" },
  cardLogo: { color: "#fff", fontSize: typography.fontSizes.lg, fontFamily: fontFamilies.mono.semibold },
  cardNumber: { color: "#fff", fontSize: typography.fontSizes.xl, fontFamily: fontFamilies.mono.medium, letterSpacing: 2, marginTop: 28 },
  cardArtBottom: { flexDirection: "row", justifyContent: "space-between" },
  cardMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: spacing[3],
  },
  cardActions: { flexDirection: "row", gap: 6 },
  iconButton: { width: 36, height: 36, borderRadius: radii.lg, alignItems: "center", justifyContent: "center", backgroundColor: colors.olive[50] },
  field: { gap: 7, marginBottom: spacing[3] },
  fieldLabel: { color: colors.light.mutedForeground },
  input: {
    backgroundColor: colors.paper.cream,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.light.foreground,
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.base,
  },
  rowFields: { flexDirection: "row", gap: 10 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center", padding: 24 },
  modal: { width: "100%", backgroundColor: colors.light.card, borderRadius: radii["2xl"], padding: 20, borderWidth: 1, borderColor: colors.light.border },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing[4] },
});
