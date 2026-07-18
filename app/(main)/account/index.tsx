import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Text,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import { PaperBackground } from "@/components/layout";
import { expandableTabBarInset } from "@/components/layout/ExpandableTabBar";
import { AnimatedScrollView, useHideTabBarOnScroll } from "@/lib/hooks/useTabBarScroll";
import { Avatar } from "@/components/ui";
import { useAuth } from "@/lib/supabase/auth";
import { useWishlist } from "@/lib/stores";
import { colors, radii, spacing, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { getFollowedStores, getOrders, type FollowedStore } from "@/lib/api";
import {
  getRecentlyViewedIds,
  type PaymentCard,
} from "@/lib/account-local";
import { listPaymentMethodsBackend, getProfileBackend, getProductsByIdsBackend, type SavedCard } from "@/lib/api/backend";
import { formatPrice } from "@/lib/utils";
import { resolveImageUrl } from "@/lib/utils/resolve-image-url";
import { navigateHome } from "@/lib/navigation";
import type { Order, Product } from "@/lib/types";
import { mapProducts } from "@/lib/api/product-mapper";

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

const H_PAD = spacing[5];
const CARD_GAP = spacing[3];
const RECENT_SIZE = 120;

const ACCOUNT_LINKS: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub: string;
  route: string;
  requiresAuth?: boolean;
}[] = [
  {
    icon: "location-outline",
    label: "Addresses",
    sub: "Shipping & billing",
    route: "/(main)/account/addresses",
    requiresAuth: true,
  },
  {
    icon: "return-down-back-outline",
    label: "Returns",
    sub: "Track refunds",
    route: "/(main)/account/returns",
    requiresAuth: true,
  },
  {
    icon: "ribbon-outline",
    label: "Loyalty & rewards",
    sub: "Points and perks",
    route: "/(main)/account/loyalty",
    requiresAuth: true,
  },
  {
    icon: "shirt-outline",
    label: "Wardrobe",
    sub: "Your closet · wears · outfits",
    route: "/(main)/account/wardrobe",
    requiresAuth: true,
  },
  {
    icon: "star-outline",
    label: "My reviews",
    sub: "Products you've rated",
    route: "/(main)/account/reviews",
    requiresAuth: true,
  },
  {
    icon: "shield-outline",
    label: "Security",
    sub: "Password & MFA",
    route: "/(main)/account/security",
    requiresAuth: true,
  },
  {
    icon: "headset-outline",
    label: "Contact support",
    sub: "Get help with orders",
    route: "/(main)/contact",
  },
];

const CARD_BRAND_STYLES: Record<PaymentCard["brand"], { colors: [string, string]; label: string }> = {
  visa: { colors: ["#0a0d24", "#1b2d72"], label: "VISA" },
  mastercard: { colors: ["#1b0c24", "#4a1236"], label: "MC" },
  amex: { colors: ["#0d213a", "#123c60"], label: "AMEX" },
};

function buildOrderThumbs(orders: Order[]): string[] {
  return orders
    .flatMap((o) => o.items ?? [])
    .map(
      (item) =>
        item.product?.images?.find((i) => i.is_primary)?.url ??
        item.product?.images?.[0]?.url,
    )
    .filter(Boolean)
    .slice(0, 4) as string[];
}

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const tabBarScrollHandler = useHideTabBarOnScroll();
  const router = useRouter();
  const { user, signOut, role } = useAuth();
  const wishlistItems = useWishlist((s) => s.items);
  const toggle = useWishlist((s) => s.toggle);

  const [orderThumbs, setOrderThumbs] = useState<string[]>([]);
  const [followedStores, setFollowedStores] = useState<FollowedStore[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<Product[]>([]);
  const [payments, setPayments] = useState<PaymentCard[]>([]);
  const [profileName, setProfileName] = useState("");
  const [avatarUri, setAvatarUri] = useState<string | null>(null);

  const name = profileName || user?.user_metadata?.full_name || "Guest";
  const email = user?.email ?? "Sign in to sync your account";

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      async function load() {
        const [viewedIds, cardsRes] = await Promise.all([
          getRecentlyViewedIds(user?.id),
          user?.id ? listPaymentMethodsBackend() : Promise.resolve(null),
        ]);
        if (cancelled) return;
        setPayments(cardsRes?.ok && cardsRes.data?.cards ? cardsRes.data.cards.map(savedCardToPaymentCard) : []);

        if (viewedIds.length > 0) {
          const res = await getProductsByIdsBackend(viewedIds);
          if (cancelled) return;
          if (res.ok && res.data) {
            const byId = new Map(
              mapProducts(res.data.products ?? []).map((p) => [p.id, p]),
            );
            setRecentlyViewed(
              viewedIds.map((id) => byId.get(id)).filter((p): p is Product => !!p),
            );
          } else {
            setRecentlyViewed([]);
          }
        } else {
          setRecentlyViewed([]);
        }

        if (!user?.id) {
          setOrderThumbs([]);
          setFollowedStores([]);
          return;
        }

        const [storesRes, ordersRes, profileRes] = await Promise.all([
          getFollowedStores(user.id),
          getOrders(user.id, 8),
          getProfileBackend(),
        ]);

        if (cancelled) return;

        if (storesRes.ok) setFollowedStores(storesRes.data);
        if (ordersRes.ok) setOrderThumbs(buildOrderThumbs(ordersRes.data));
        else setOrderThumbs([]);

        const profile = profileRes.ok ? profileRes.data?.user : null;
        if (profile?.full_name) setProfileName(profile.full_name);
        const nextAvatar =
          profile?.avatar_url ?? user.user_metadata?.avatar_url ?? null;
        setAvatarUri(nextAvatar ? resolveImageUrl(nextAvatar) || nextAvatar : null);
      }

      load();
      return () => {
        cancelled = true;
      };
    }, [user?.id, user?.user_metadata?.avatar_url, user?.user_metadata?.full_name]),
  );

  const followingAvatars = useMemo(() => {
    return followedStores.slice(0, 4).map((fs) => ({
      id: fs.id,
      uri: fs.store.logo_url,
      label: fs.store.name,
    }));
  }, [followedStores]);

  const handleSignIn = useCallback(() => {
    router.push("/(auth)/login");
  }, [router]);

  const openAccountLink = useCallback(
    (link: (typeof ACCOUNT_LINKS)[number]) => {
      if (link.requiresAuth && !user) {
        handleSignIn();
        return;
      }
      router.push(link.route as never);
    },
    [user, router, handleSignIn],
  );

  return (
    <PaperBackground style={{ backgroundColor: "#ffffff" }}>
      <AnimatedScrollView
        showsVerticalScrollIndicator={false}
        onScroll={tabBarScrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: Math.max(insets.top, spacing[4]) + spacing[2],
            paddingBottom: expandableTabBarInset(insets.bottom) + spacing[4],
          },
        ]}
      >
        {/* Back to home */}
        <TouchableOpacity
          style={styles.homeBtn}
          onPress={() => navigateHome(router)}
          activeOpacity={0.7}
          accessibilityLabel="Back to home"
        >
          <Ionicons name="chevron-back" size={20} color={colors.light.foreground} />
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.name}>{name}</Text>
            <Text style={styles.email}>{email}</Text>
            <View style={styles.pillRow}>
              <PillButton
                icon="settings-outline"
                label="Settings"
                onPress={() =>
                  user
                    ? router.push("/(main)/account/settings")
                    : handleSignIn()
                }
              />
              <PillButton
                icon="person-outline"
                label="Profile"
                onPress={() =>
                  user
                    ? router.push("/(main)/account/profile")
                    : handleSignIn()
                }
              />
            </View>
          </View>
          <Avatar
            name={name}
            uri={avatarUri}
            size={72}
            style={styles.avatar}
          />
        </View>

        {/* Order history + Following */}
        <View style={styles.summaryRow}>
          <SummaryCard
            label="Order history"
            onPress={() =>
              user
                ? router.push("/(main)/account/orders")
                : handleSignIn()
            }
          >
            <OverlapRow
              images={orderThumbs}
              emptyIcon="receipt-outline"
            />
          </SummaryCard>
          <SummaryCard
            label="Following"
            onPress={() => router.push("/(main)/account/following")}
            emptyIcon="people-outline"
          >
            <OverlapAvatars items={followingAvatars} emptyIcon="storefront-outline" />
          </SummaryCard>
        </View>

        {/* Recently viewed */}
        <SectionHeader
          title="Recently viewed"
          onPress={() => router.push("/(main)/products")}
        />
        {recentlyViewed.length === 0 ? (
          <View style={styles.emptyRail}>
            <Ionicons name="eye-outline" size={22} color={colors.light.mutedForeground} />
            <Text style={styles.emptyText}>Items you browse will show up here.</Text>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.recentScroll}
          >
            {recentlyViewed.map((p, index) => {
              const img = p.images?.find((i) => i.is_primary)?.url ?? p.images?.[0]?.url;
              const isWishlisted = !!wishlistItems[p.id];
              const showTextOverlay = index % 3 !== 2;
              const displayName = p.name.split(" - ")[0] || p.name;

              return (
                <TouchableOpacity
                  key={p.id}
                  style={styles.recentCard}
                  activeOpacity={0.85}
                  onPress={() => router.push(`/(main)/products/${p.slug}`)}
                >
                  {img ? (
                    <Image source={{ uri: img }} style={styles.recentImage} contentFit="cover" />
                  ) : (
                    <View style={[styles.recentImage, styles.recentPlaceholder]}>
                      <Ionicons name="shirt-outline" size={28} color={colors.light.mutedForeground} />
                    </View>
                  )}

                  {showTextOverlay ? (
                    <>
                      <View style={styles.recentOverlay} />
                      <View style={styles.recentTextContainer}>
                        <Text
                          style={[
                            styles.recentOverlayText,
                            index % 3 === 0
                              ? styles.recentTextAllCaps
                              : styles.recentTextItalic,
                          ]}
                          numberOfLines={2}
                        >
                          {displayName}
                        </Text>
                      </View>
                    </>
                  ) : (
                    <>
                      {p.price ? (
                        <View style={styles.priceTag}>
                          <Text style={styles.priceTagText}>{formatPrice(p.price, p.currency)}</Text>
                        </View>
                      ) : null}
                      <TouchableOpacity
                        style={styles.recentHeartBtn}
                        onPress={(e) => {
                          e.stopPropagation();
                          toggle(p.id);
                        }}
                        activeOpacity={0.75}
                        hitSlop={6}
                      >
                        <Ionicons
                          name={isWishlisted ? "heart" : "heart-outline"}
                          size={14}
                          color={isWishlisted ? colors.light.destructive : "#ffffff"}
                        />
                      </TouchableOpacity>
                    </>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* Account shortcuts */}
        <SectionHeader title="Your account" />
        <View style={styles.menuGroup}>
          {ACCOUNT_LINKS.map((link, index) => (
            <TouchableOpacity
              key={link.route}
              style={[
                styles.menuRow,
                index < ACCOUNT_LINKS.length - 1 && styles.menuRowBorder,
              ]}
              activeOpacity={0.85}
              onPress={() => openAccountLink(link)}
            >
              <View style={styles.menuIcon}>
                <Ionicons name={link.icon} size={18} color={colors.olive[700]} />
              </View>
              <View style={styles.menuText}>
                <Text style={styles.menuTitle}>{link.label}</Text>
                <Text style={styles.menuSub}>{link.sub}</Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={colors.light.mutedForeground}
              />
            </TouchableOpacity>
          ))}
        </View>

        {/* Payment methods */}
        <View style={styles.paymentHeader}>
          <Text style={styles.sectionTitle}>Payment methods</Text>
          <TouchableOpacity
            style={styles.addCardBtn}
            activeOpacity={0.8}
            onPress={() =>
              user
                ? router.push("/(main)/account/payments/add")
                : handleSignIn()
            }
          >
            <Text style={styles.addCardText}>Add card</Text>
          </TouchableOpacity>
        </View>

        {payments.length === 0 ? (
          <TouchableOpacity
            style={styles.paymentEmpty}
            activeOpacity={0.85}
            onPress={() =>
              user
                ? router.push("/(main)/account/payments/add")
                : handleSignIn()
            }
          >
            <View style={styles.emptyCardRow}>
              <View style={styles.emptyCardIconWrap}>
                <Ionicons name="card-outline" size={22} color={colors.light.primary} />
              </View>
              <View style={styles.emptyCardCopy}>
                <Text style={styles.emptyCardTitle}>No cards saved yet</Text>
                <Text style={styles.emptyCardSubtitle}>
                  Add a card for faster checkout
                </Text>
              </View>
              <View style={styles.emptyCardCta}>
                <Ionicons name="add" size={18} color={colors.light.primaryForeground} />
              </View>
            </View>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.cardStack}
            activeOpacity={0.9}
            onPress={() => router.push("/(main)/account/payments")}
          >
            {payments.slice(0, 2).map((card, index) => (
              <PaymentCardPreview key={card.id} card={card} index={index} total={Math.min(payments.length, 2)} />
            ))}
          </TouchableOpacity>
        )}

        {user && role === "admin" ? (
          <TouchableOpacity
            style={styles.adminPortal}
            activeOpacity={0.85}
            onPress={() => router.push("/(admin)")}
          >
            <View style={styles.adminPortalIcon}>
              <Ionicons name="shield-checkmark" size={22} color={colors.light.primaryForeground} />
            </View>
            <View style={styles.adminPortalText}>
              <Text style={styles.adminPortalTitle}>Admin portal</Text>
              <Text style={styles.adminPortalSub}>
                Overview, approvals, orders & CMS
              </Text>
            </View>
            <View style={styles.adminPortalChevron}>
              <Ionicons name="chevron-forward" size={16} color={colors.light.foreground} />
            </View>
          </TouchableOpacity>
        ) : null}

        {user ? (
          <TouchableOpacity style={styles.signOut} onPress={signOut} activeOpacity={0.7}>
            <Text style={styles.signOutText}>Sign out</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.signInBtn} onPress={handleSignIn} activeOpacity={0.85}>
            <Text style={styles.signInText}>Sign in</Text>
          </TouchableOpacity>
        )}
      </AnimatedScrollView>
    </PaperBackground>
  );
}

function PillButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.pill} onPress={onPress} activeOpacity={0.8}>
      <Ionicons name={icon} size={14} color={colors.light.foreground} />
      <Text style={styles.pillText}>{label}</Text>
    </TouchableOpacity>
  );
}

function SectionHeader({ title, onPress }: { title: string; onPress?: () => void }) {
  const content = (
    <View style={styles.sectionHeaderRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {onPress ? (
        <View style={styles.chevronCircle}>
          <Ionicons name="chevron-forward" size={12} color={colors.light.foreground} />
        </View>
      ) : null}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={styles.sectionHeader}>
        {content}
      </TouchableOpacity>
    );
  }
  return <View style={styles.sectionHeader}>{content}</View>;
}

function SummaryCard({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress: () => void;
  emptyIcon?: keyof typeof Ionicons.glyphMap;
  children: React.ReactNode;
}) {
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = (screenWidth - H_PAD * 2 - CARD_GAP) / 2;
  return (
    <TouchableOpacity
      style={[styles.summaryCard, { width: cardWidth }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.summaryVisual}>{children}</View>
      <Text style={styles.summaryLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function OverlapRow({
  images,
  emptyIcon,
}: {
  images: string[];
  emptyIcon: keyof typeof Ionicons.glyphMap;
}) {
  if (!images.length) {
    return (
      <View style={styles.overlapEmpty}>
        <Ionicons name={emptyIcon} size={22} color={colors.light.mutedForeground} />
      </View>
    );
  }

  return (
    <View style={styles.overlapRow}>
      {images.map((uri, i) => (
        <Image
          key={`${uri}-${i}`}
          source={{ uri }}
          style={[styles.overlapImage, i > 0 && { marginLeft: -14 }]}
          contentFit="cover"
        />
      ))}
    </View>
  );
}

function OverlapAvatars({
  items,
  emptyIcon,
}: {
  items: { id: string; uri?: string | null; label: string }[];
  emptyIcon: keyof typeof Ionicons.glyphMap;
}) {
  if (!items.length) {
    return (
      <View style={styles.overlapEmpty}>
        <Ionicons name={emptyIcon} size={22} color={colors.light.mutedForeground} />
      </View>
    );
  }

  return (
    <View style={styles.overlapRow}>
      {items.map((item, i) => (
        <View
          key={item.id}
          style={[styles.overlapAvatar, i > 0 && { marginLeft: -14 }]}
        >
          {item.uri ? (
            <Image source={{ uri: item.uri }} style={styles.overlapAvatarImage} contentFit="cover" />
          ) : (
            <Text style={styles.overlapInitial}>{item.label.charAt(0)}</Text>
          )}
        </View>
      ))}
    </View>
  );
}

function PaymentCardPreview({
  card,
  index,
  total,
}: {
  card: PaymentCard;
  index: number;
  total: number;
}) {
  const meta = CARD_BRAND_STYLES[card.brand] || { colors: ["#0a0d24", "#1b2d72"], label: "VISA" };
  const isFront = index === total - 1 || total === 1;
  const cardScale = isFront ? 1 : 0.94;
  const cardTop = isFront ? 30 : 0;
  const cardZ = index;

  return (
    <LinearGradient
      colors={meta.colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.paymentCard,
        {
          top: cardTop,
          zIndex: cardZ,
          transform: [{ scale: cardScale }],
        },
      ]}
    >
      {/* Curved Waves Background */}
      <Svg style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <Path
          d="M-20 40 C 60 100, 160 30, 240 90 S 320 40, 400 80"
          fill="none"
          stroke="rgba(255, 255, 255, 0.06)"
          strokeWidth={1.2}
        />
        <Path
          d="M-20 50 C 60 110, 160 40, 240 100 S 320 50, 400 90"
          fill="none"
          stroke="rgba(255, 255, 255, 0.06)"
          strokeWidth={1.2}
        />
        <Path
          d="M-20 60 C 60 120, 160 50, 240 110 S 320 60, 400 100"
          fill="none"
          stroke="rgba(255, 255, 255, 0.06)"
          strokeWidth={1.2}
        />
        <Path
          d="M-20 70 C 60 130, 160 60, 240 120 S 320 70, 400 110"
          fill="none"
          stroke="rgba(255, 255, 255, 0.06)"
          strokeWidth={1.2}
        />
        <Path
          d="M-20 80 C 60 140, 160 70, 240 130 S 320 80, 400 120"
          fill="none"
          stroke="rgba(255, 255, 255, 0.06)"
          strokeWidth={1.2}
        />
      </Svg>

      <View style={styles.paymentCardHeader}>
        <View style={styles.brandBadge}>
          <Text style={styles.brandBadgeText}>{meta.label}</Text>
        </View>
        <Text style={styles.cardNumberText}>•••• {card.last4}</Text>
      </View>
      
      <View style={styles.paymentCardBottom}>
        <View style={styles.cardWatermark}>
          <Text style={styles.watermarkText}>{meta.label}</Text>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: H_PAD,
  },
  homeBtn: {
    width: 38,
    height: 38,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.olive[50],
    marginBottom: spacing[3],
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing[6],
    gap: spacing[4],
  },
  headerText: {
    flex: 1,
    gap: spacing[1],
  },
  name: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 26,
    color: colors.light.foreground,
    letterSpacing: -0.5,
  },
  email: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 14,
    color: colors.light.mutedForeground,
    marginBottom: spacing[2],
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[2],
    marginTop: spacing[1],
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#f3f3f3",
    borderRadius: radii.full,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  pillText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: colors.light.foreground,
  },
  avatar: {
    borderRadius: 36,
  },
  summaryRow: {
    flexDirection: "row",
    gap: CARD_GAP,
    marginBottom: spacing[6],
  },
  summaryCard: {
    backgroundColor: "#ffffff",
    borderRadius: radii["2xl"],
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: spacing[4],
    minHeight: 120,
    justifyContent: "space-between",
    ...shadows.soft,
  },
  summaryVisual: {
    minHeight: 44,
    justifyContent: "center",
  },
  summaryLabel: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 15,
    color: colors.light.foreground,
    marginTop: spacing[3],
  },
  overlapRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  overlapImage: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#ffffff",
    backgroundColor: "#f5f5f5",
  },
  overlapAvatar: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#ffffff",
    backgroundColor: "#f5f5f5",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  overlapAvatarImage: {
    width: "100%",
    height: "100%",
  },
  overlapInitial: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 14,
    color: colors.light.primary,
  },
  overlapEmpty: {
    height: 40,
    justifyContent: "center",
  },
  sectionHeader: {
    marginBottom: spacing[3],
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  chevronCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#f3f3f3",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: spacing[1],
  },
  sectionTitle: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 18,
    color: colors.light.foreground,
    letterSpacing: -0.3,
  },
  recentScroll: {
    gap: spacing[3],
    paddingBottom: spacing[6],
  },
  recentCard: {
    width: RECENT_SIZE,
    height: RECENT_SIZE,
    borderRadius: radii.xl,
    overflow: "hidden",
    backgroundColor: "#f5f5f5",
    position: "relative",
  },
  recentImage: {
    width: "100%",
    height: "100%",
  },
  recentPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  recentOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.2)",
  },
  recentTextContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing[2],
  },
  recentOverlayText: {
    color: "#ffffff",
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  recentTextAllCaps: {
    fontFamily: fontFamilies.sans.bold,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  recentTextItalic: {
    fontFamily: fontFamilies.display.italic,
    fontSize: 14,
  },
  priceTag: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  priceTagText: {
    fontFamily: fontFamilies.sans.bold,
    fontWeight: "700",
    fontSize: 10,
    color: "#ffffff",
  },
  recentHeartBtn: {
    position: "absolute",
    bottom: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0, 0, 0, 0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyRail: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    paddingVertical: spacing[4],
    marginBottom: spacing[6],
  },
  emptyText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    color: colors.light.mutedForeground,
    flex: 1,
  },
  paymentHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing[3],
  },
  menuGroup: {
    backgroundColor: "#ffffff",
    borderRadius: radii["2xl"],
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: spacing[6],
    overflow: "hidden",
    ...shadows.soft,
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
  },
  menuRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.lg,
    backgroundColor: colors.olive[50],
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.olive[100],
  },
  menuText: {
    flex: 1,
    gap: 2,
  },
  menuTitle: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 15,
    color: colors.light.foreground,
    letterSpacing: -0.2,
  },
  menuSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: colors.light.mutedForeground,
  },
  addCardBtn: {
    backgroundColor: colors.olive[100],
    borderRadius: radii.full,
    paddingHorizontal: spacing[4],
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.olive[200],
  },
  addCardText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: colors.olive[700],
  },
  paymentEmpty: {
    backgroundColor: "#ffffff",
    borderRadius: radii["2xl"],
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: spacing[4],
    marginBottom: spacing[6],
    ...shadows.soft,
  },
  emptyCardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
  },
  emptyCardIconWrap: {
    width: 44,
    height: 44,
    borderRadius: radii.xl,
    backgroundColor: colors.olive[50],
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.olive[100],
  },
  emptyCardCopy: {
    flex: 1,
    gap: 3,
  },
  emptyCardTitle: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 15,
    color: colors.light.foreground,
    letterSpacing: -0.2,
  },
  emptyCardSubtitle: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: colors.light.mutedForeground,
    lineHeight: 16,
  },
  emptyCardCta: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.light.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  cardStack: {
    height: 158,
    marginBottom: spacing[8],
    position: "relative",
  },
  paymentCard: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 120,
    borderRadius: radii["2xl"],
    padding: spacing[5],
    justifyContent: "space-between",
    ...shadows.soft,
  },
  paymentCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
  },
  brandBadge: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  brandBadgeText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 9,
    color: "#0c0f24",
    letterSpacing: 0.5,
  },
  cardNumberText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 14,
    color: "#ffffff",
    letterSpacing: 1.5,
  },
  paymentCardBottom: {
    alignItems: "flex-end",
    justifyContent: "flex-end",
  },
  cardWatermark: {
    alignSelf: "flex-end",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  watermarkText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 11,
    color: "rgba(255, 255, 255, 0.35)",
    letterSpacing: 0.5,
  },
  signOut: {
    alignSelf: "center",
    paddingVertical: spacing[3],
    marginBottom: spacing[4],
  },
  adminPortal: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    backgroundColor: "#ffffff",
    borderRadius: radii["2xl"],
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: spacing[4],
    marginBottom: spacing[5],
    ...shadows.soft,
  },
  adminPortalIcon: {
    width: 48,
    height: 48,
    borderRadius: radii.xl,
    backgroundColor: colors.light.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  adminPortalText: {
    flex: 1,
    gap: 4,
  },
  adminPortalTitle: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 16,
    color: colors.light.foreground,
    letterSpacing: -0.2,
  },
  adminPortalSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: colors.light.mutedForeground,
    lineHeight: 17,
  },
  adminPortalChevron: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f3f3f3",
    alignItems: "center",
    justifyContent: "center",
  },
  signOutText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 14,
    color: colors.light.destructive,
  },
  signInBtn: {
    alignSelf: "stretch",
    backgroundColor: colors.light.primary,
    borderRadius: radii.full,
    paddingVertical: spacing[4],
    alignItems: "center",
    marginBottom: spacing[4],
  },
  signInText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 15,
    color: colors.light.primaryForeground,
  },
});
