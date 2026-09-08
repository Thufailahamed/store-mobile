import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@/components/ui/Icon";
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
import { colors, radii, shadows, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

const BRAND_META: Record<
  PaymentBrand,
  { label: string; gradient: [string, string, string]; logo: string; accent: string }
> = {
  visa: {
    label: "Visa",
    gradient: ["#141E30", "#182848", "#0E1726"],
    logo: "VISA",
    accent: "#E8CF8F",
  },
  mastercard: {
    label: "Mastercard",
    gradient: ["#2C1318", "#3D1A20", "#1E0D10"],
    logo: "MC",
    accent: "#EB001B",
  },
  amex: {
    label: "American Express",
    gradient: ["#1C2321", "#2D3A37", "#121715"],
    logo: "AMEX",
    accent: "#C8A44A",
  },
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
  const [refreshing, setRefreshing] = useState(false);

  const reload = async (isManualRefresh = false) => {
    if (!user?.id) {
      setPayments([]);
      setLoading(false);
      return;
    }
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);

    const res = await listPaymentMethodsBackend();
    setLoading(false);
    setRefreshing(false);

    if (!res.ok) {
      if (isManualRefresh) toast(res.error ?? "Couldn't load cards", "error");
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
    toast("Default payment instrument updated", "success");
  };

  const removeCard = async (id: string) => {
    if (!user?.id) return;
    Alert.alert(
      "Remove Payment Instrument",
      "Are you sure you wish to remove this card from your saved wallet?",
      [
        { text: "Keep Card", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            const res = await deletePaymentMethodBackend(id);
            if (!res.ok) {
              toast(res.error ?? "Couldn't remove card", "error");
              return;
            }
            await reload();
            toast("Card removed", "success");
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      {/* 1. Atelier Top Navigation Header */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={20} color="#141311" />
        </TouchableOpacity>

        <View style={styles.headerTitleCenter}>
          <Text style={styles.headerEyebrow}>FINANCIAL VAULT</Text>
          <Text style={styles.headerTitle}>Payment Methods</Text>
        </View>

        <TouchableOpacity
          onPress={() => router.push("/(main)/account/payments/add")}
          style={styles.headerActionButton}
          activeOpacity={0.7}
        >
          <Ionicons name="add" size={20} color="#141311" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => reload(true)}
            tintColor="#C8A44A"
            colors={["#C8A44A"]}
          />
        }
      >
        {/* 2. Velvet Obsidian Hero Card ("The Financial Vault") */}
        <LinearGradient
          colors={["#141311", "#1E1C18", "#0F0E0D"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.heroTopRow}>
            <View style={styles.heroTagBadge}>
              <Ionicons name="sparkles" size={10} color="#C8A44A" />
              <Text style={styles.heroTagText}>ENCRYPTED INSTRUMENTS</Text>
            </View>

            {/* Shield Medallion */}
            <View style={styles.shieldMedallion}>
              <View style={styles.shieldMedallionInner}>
                <Ionicons name="card-outline" size={18} color="#E8CF8F" />
              </View>
            </View>
          </View>

          <Text style={styles.heroTitle}>The Financial Vault</Text>
          <Text style={styles.heroSubtitle}>
            Manage tokenized payment instruments. Full cardholder numbers are never stored in-app;
            all settlements execute through PCI-DSS certified gateway sandboxes.
          </Text>

          {/* 3-Metric Intelligence Strip */}
          <View style={styles.heroMetricsStrip}>
            <View style={styles.metricItem}>
              <Text style={styles.metricValue}>{payments.length}</Text>
              <Text style={styles.metricLabel}>SAVED CARDS</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={styles.metricValue}>Tokenized</Text>
              <Text style={styles.metricLabel}>STORAGE TYPE</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={[styles.metricValue, { color: "#54B870" }]}>Active</Text>
              <Text style={styles.metricLabel}>VAULT STATUS</Text>
            </View>
          </View>
        </LinearGradient>

        {/* 3. Cards List or Editorial Empty State */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color="#C8A44A" size="large" />
            <Text style={styles.loadingText}>Accessing financial vault...</Text>
          </View>
        ) : payments.length === 0 ? (
          /* Editorial Empty State */
          <View style={styles.emptyContainer}>
            <View style={styles.emptyCard}>
              <View style={styles.emptyMedallionOuter}>
                <View style={styles.emptyMedallionInner}>
                  <Ionicons name="card-outline" size={28} color="#C8A44A" />
                  <View style={styles.emptySparkle}>
                    <Ionicons name="sparkles" size={10} color="#E8CF8F" />
                  </View>
                </View>
              </View>

              <Text style={styles.emptyTitle}>No Saved Payment Instruments</Text>
              <Text style={styles.emptyBody}>
                You have not registered any tokenized cards yet. Add a card to your financial
                vault for accelerated one-touch boutique checkout.
              </Text>

              {/* Primary Action Button */}
              <TouchableOpacity
                style={styles.emptyPrimaryButton}
                activeOpacity={0.85}
                onPress={() => router.push("/(main)/account/payments/add")}
              >
                <LinearGradient
                  colors={["#1C1A17", "#141311"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.emptyPrimaryGradient}
                >
                  <Text style={styles.emptyPrimaryText}>Register Payment Card</Text>
                  <Ionicons name="arrow-forward" size={15} color="#E8CF8F" />
                </LinearGradient>
              </TouchableOpacity>

              {/* Secondary Button */}
              <TouchableOpacity
                style={styles.emptySecondaryButton}
                activeOpacity={0.7}
                onPress={() => router.push("/(main)/checkout")}
              >
                <Ionicons name="bag-check-outline" size={14} color="#85651B" />
                <Text style={styles.emptySecondaryText}>Go to Checkout</Text>
              </TouchableOpacity>
            </View>

            {/* 4. Atelier Security Architecture Guide */}
            <View style={styles.protocolsSection}>
              <View style={styles.protocolsHeaderRow}>
                <Ionicons name="shield-outline" size={14} color="#85651B" />
                <Text style={styles.protocolsEyebrow}>ZERO-TRUST STANDARDS</Text>
              </View>
              <Text style={styles.protocolsTitle}>How Vault Tokenization Works</Text>

              <View style={styles.protocolCardsList}>
                <View style={styles.protocolCard}>
                  <View style={styles.protocolNumberBadge}>
                    <Text style={styles.protocolNumberText}>01</Text>
                  </View>
                  <View style={styles.protocolCardContent}>
                    <Text style={styles.protocolCardTitle}>Isolated Gateway Tokenization</Text>
                    <Text style={styles.protocolCardDesc}>
                      Only surrogate cryptographic tokens are retained; full PAN and CVV never touch
                      our database or your phone.
                    </Text>
                  </View>
                </View>

                <View style={styles.protocolCard}>
                  <View style={styles.protocolNumberBadge}>
                    <Text style={styles.protocolNumberText}>02</Text>
                  </View>
                  <View style={styles.protocolCardContent}>
                    <Text style={styles.protocolCardTitle}>PCI-DSS Level 1 Compliance</Text>
                    <Text style={styles.protocolCardDesc}>
                      Transactions conform to the highest tier of global banking standards and
                      security audits.
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        ) : (
          /* Stored Cards List */
          <View style={styles.cardsList}>
            {payments.map((card) => {
              const meta = BRAND_META[card.brand] ?? {
                label: card.brand.toUpperCase(),
                gradient: ["#141311", "#1E1C18", "#0F0E0D"],
                logo: card.brand.slice(0, 4).toUpperCase(),
                accent: "#C8A44A",
              };

              return (
                <View key={card.id} style={styles.cardContainer}>
                  {/* Embossed Metallic Luxury Card Surface */}
                  <LinearGradient
                    colors={meta.gradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.cardArt}
                  >
                    <View style={styles.cardArtTop}>
                      {/* Gold Chip */}
                      <View style={styles.cardChip}>
                        <View style={styles.cardChipLine} />
                      </View>
                      <Text style={styles.cardBrandLogo}>{meta.logo}</Text>
                    </View>

                    <Text style={styles.cardNumber}>•••• •••• •••• {card.last4}</Text>

                    <View style={styles.cardArtBottom}>
                      <View>
                        <Text style={styles.cardHolderLabel}>CARDHOLDER</Text>
                        <Text style={styles.cardHolderName} numberOfLines={1}>
                          {card.holder.toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={styles.cardExpiresLabel}>EXPIRES</Text>
                        <Text style={styles.cardExpiresDate}>{card.exp}</Text>
                      </View>
                    </View>
                  </LinearGradient>

                  {/* Card Actions & Status Strip */}
                  <View style={styles.cardMetaStrip}>
                    <View style={styles.cardMetaLeft}>
                      {card.is_default ? (
                        <View style={styles.defaultPill}>
                          <Ionicons name="checkmark-circle" size={11} color="#2B6E3F" />
                          <Text style={styles.defaultPillText}>DEFAULT INSTRUMENT</Text>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={styles.makeDefaultButton}
                          onPress={() => makeDefault(card.id)}
                        >
                          <Ionicons name="star-outline" size={13} color="#85651B" />
                          <Text style={styles.makeDefaultText}>Set as Default</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    <TouchableOpacity
                      style={styles.removeCardButton}
                      onPress={() => removeCard(card.id)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons name="trash-outline" size={16} color="#8F8B82" />
                    </TouchableOpacity>
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
  safeArea: {
    flex: 1,
    backgroundColor: "#F5F4EF",
  },
  topHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
    backgroundColor: "#F5F4EF",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E6E3DA",
    alignItems: "center",
    justifyContent: "center",
    ...shadows.soft,
  },
  headerTitleCenter: {
    alignItems: "center",
  },
  headerEyebrow: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9,
    letterSpacing: 1.8,
    color: "#85651B",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  headerTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 20,
    color: "#141311",
    letterSpacing: -0.3,
  },
  headerActionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E6E3DA",
    alignItems: "center",
    justifyContent: "center",
    ...shadows.soft,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  /* Velvet Obsidian Hero Card */
  heroCard: {
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.25)",
    marginBottom: 16,
    ...shadows.glow,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  heroTagBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(200, 164, 74, 0.12)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.3)",
  },
  heroTagText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    letterSpacing: 1.4,
    color: "#E8CF8F",
  },
  shieldMedallion: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.3)",
    padding: 3,
  },
  shieldMedallionInner: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: "#201E1A",
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 22,
    color: "#FAF8F5",
    letterSpacing: -0.4,
    marginBottom: 6,
  },
  heroSubtitle: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    lineHeight: 19,
    color: "#B3AFA5",
    marginBottom: 18,
  },
  heroMetricsStrip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  metricItem: {
    flex: 1,
    alignItems: "center",
  },
  metricValue: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 16,
    color: "#FAF8F5",
    marginBottom: 2,
  },
  metricLabel: {
    fontFamily: fontFamilies.mono.regular,
    fontSize: 8,
    letterSpacing: 1.2,
    color: "#8F8B82",
  },
  metricDivider: {
    width: 1,
    height: 20,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
  },

  /* Loading State */
  loadingContainer: {
    paddingVertical: 40,
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    color: "#8F8B82",
  },

  /* Empty State */
  emptyContainer: {
    gap: 20,
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#EAE7DF",
    padding: 26,
    alignItems: "center",
    ...shadows.soft,
  },
  emptyMedallionOuter: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.35)",
    padding: 4,
    marginBottom: 16,
  },
  emptyMedallionInner: {
    flex: 1,
    borderRadius: 30,
    backgroundColor: "#141311",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  emptySparkle: {
    position: "absolute",
    top: 6,
    right: 8,
  },
  emptyTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 21,
    color: "#141311",
    letterSpacing: -0.3,
    marginBottom: 8,
    textAlign: "center",
  },
  emptyBody: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    lineHeight: 20,
    color: "#787469",
    textAlign: "center",
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  emptyPrimaryButton: {
    width: "100%",
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 10,
    ...shadows.soft,
  },
  emptyPrimaryGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    gap: 8,
  },
  emptyPrimaryText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 14,
    color: "#FAF8F5",
  },
  emptySecondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  emptySecondaryText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 13,
    color: "#85651B",
  },

  /* Protocols Section */
  protocolsSection: {
    backgroundColor: "#FAF9F5",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#EBE7DD",
    padding: 20,
  },
  protocolsHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  protocolsEyebrow: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    letterSpacing: 1.6,
    color: "#85651B",
  },
  protocolsTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 17,
    color: "#141311",
    marginBottom: 16,
  },
  protocolCardsList: {
    gap: 12,
  },
  protocolCard: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#EAE6DB",
    padding: 14,
  },
  protocolNumberBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F2EFE6",
    borderWidth: 1,
    borderColor: "#E0DCcf",
    alignItems: "center",
    justifyContent: "center",
  },
  protocolNumberText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 11,
    color: "#85651B",
  },
  protocolCardContent: {
    flex: 1,
  },
  protocolCardTitle: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: "#141311",
    marginBottom: 3,
  },
  protocolCardDesc: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    lineHeight: 17,
    color: "#787469",
  },

  /* Cards List */
  cardsList: {
    gap: 16,
  },
  cardContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#EAE7DF",
    padding: 14,
    ...shadows.soft,
  },
  cardArt: {
    borderRadius: 16,
    padding: 20,
    minHeight: 160,
    justifyContent: "space-between",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  cardArtTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardChip: {
    width: 38,
    height: 28,
    borderRadius: 6,
    backgroundColor: "#D8BC7E",
    borderWidth: 1,
    borderColor: "#BCA05E",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  cardChipLine: {
    height: 1,
    backgroundColor: "#A2843E",
  },
  cardBrandLogo: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 16,
    color: "#FAF8F5",
    letterSpacing: 2,
  },
  cardNumber: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 18,
    color: "#FAF8F5",
    letterSpacing: 3,
    marginVertical: 14,
  },
  cardArtBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  cardHolderLabel: {
    fontFamily: fontFamilies.mono.regular,
    fontSize: 8,
    letterSpacing: 1.2,
    color: "rgba(250, 248, 245, 0.6)",
    marginBottom: 2,
  },
  cardHolderName: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 12,
    color: "#FAF8F5",
    letterSpacing: 1,
    maxWidth: 180,
  },
  cardExpiresLabel: {
    fontFamily: fontFamilies.mono.regular,
    fontSize: 8,
    letterSpacing: 1.2,
    color: "rgba(250, 248, 245, 0.6)",
    marginBottom: 2,
  },
  cardExpiresDate: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 12,
    color: "#FAF8F5",
    letterSpacing: 1,
  },
  cardMetaStrip: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    paddingHorizontal: 4,
  },
  cardMetaLeft: {
    flex: 1,
  },
  defaultPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#EBF7EE",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  defaultPillText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    letterSpacing: 0.8,
    color: "#2B6E3F",
  },
  makeDefaultButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  makeDefaultText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 11,
    color: "#85651B",
  },
  removeCardButton: {
    padding: 6,
  },
});
