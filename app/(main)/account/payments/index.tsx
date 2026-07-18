import React, { useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { ScreenHeader } from "@/components/layout";
import { Badge } from "@/components/ui";
import { Body, Display, Label } from "@/components/ui/Typography";
import { useAuth } from "@/lib/supabase/auth";
import { useToast } from "@/components/ui";
import {
  type PaymentBrand,
  type PaymentCard,
} from "@/lib/account-local";
import {
  listPaymentMethodsBackend,
  setDefaultPaymentMethodBackend,
  deletePaymentMethodBackend,
  type SavedCard,
} from "@/lib/api/backend";
import { colors, radii, spacing, shadows, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

const BRAND_META: Record<PaymentBrand, { label: string; color: string; logo: string }> = {
  visa: { label: "Visa", color: "#1a1f71", logo: "VISA" },
  mastercard: { label: "Mastercard", color: "#eb001b", logo: "MC" },
  amex: { label: "Amex", color: "#016fd0", logo: "AMEX" },
};

function savedCardToPaymentCard(c: SavedCard): PaymentCard {
  const mm = String(c.exp_month).padStart(2, "0");
  const yy = String(c.exp_year).slice(-2);
  let added = "Recently";
  try {
    added = new Date(c.created_at).toLocaleString("en-US", { month: "short", year: "numeric" });
  } catch {
    /* keep default */
  }
  return {
    id: c.id,
    brand: c.brand,
    last4: c.last4,
    exp: `${mm}/${yy}`,
    holder: c.holder,
    is_default: c.is_default,
    added,
  };
}

export default function PaymentsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const [payments, setPayments] = useState<PaymentCard[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    if (!user?.id) {
      setPayments([]);
      return;
    }
    const res = await listPaymentMethodsBackend();
    if (!res.ok) {
      toast(res.error ?? "Couldn't load cards", "error");
      setPayments([]);
      return;
    }
    setPayments((res.data?.cards ?? []).map(savedCardToPaymentCard));
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await reload();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const makeDefault = async (id: string) => {
    if (!user?.id) return;
    const res = await setDefaultPaymentMethodBackend(id);
    if (!res.ok) {
      toast(res.error ?? "Couldn't update default", "error");
      return;
    }
    await reload();
    toast("Default card updated", "success");
  };

  const removeCard = async (id: string) => {
    if (!user?.id) return;
    const res = await deletePaymentMethodBackend(id);
    if (!res.ok) {
      toast(res.error ?? "Couldn't remove card", "error");
      return;
    }
    await reload();
    toast("Card removed", "success");
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
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => router.push("/(main)/account/payments/add")}
          >
            <Ionicons name="add" size={22} color={colors.light.foreground} />
          </TouchableOpacity>
        }
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {payments.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}><Ionicons name="card-outline" size={28} color={colors.light.mutedForeground} /></View>
            <Display size="xl">No cards saved</Display>
            <Body muted>Add a card to speed up checkout.</Body>
            <TouchableOpacity
              style={styles.addLink}
              onPress={() => router.push("/(main)/account/payments/add")}
              activeOpacity={0.85}
            >
              <Body style={styles.addLinkText}>Add payment method</Body>
            </TouchableOpacity>
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
                      <Body size="xs" muted>Added {card.added}</Body>
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: spacing[5], paddingBottom: spacing[8] },
  headerButton: { width: 40, height: 40, borderRadius: radii.lg, backgroundColor: colors.olive[50], alignItems: "center", justifyContent: "center" },
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
  addLink: {
    marginTop: spacing[2],
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3],
    backgroundColor: colors.light.foreground,
    borderRadius: radii.md,
  },
  addLinkText: { color: "#ffffff", fontFamily: fontFamilies.sans.semibold, letterSpacing: 0.5 },
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
});
