import React, { useState, useCallback } from "react";
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
import { useAuth } from "@/lib/supabase/auth";
import { useWishlist } from "@/lib/stores";
import { colors, radii, spacing, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { getFollowedStores, getOrders, type FollowedStore } from "@/lib/api";
import {
  getRecentlyViewedIds,
  type PaymentCard,
} from "@/lib/account-local";
import {
  listPaymentMethodsBackend,
  getProfileBackend,
  getProductsByIdsBackend,
  type SavedCard,
} from "@/lib/api/backend";
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
const RECENT_CARD_WIDTH = 136;
const RECENT_CARD_HEIGHT = 176;

interface AccountLinkItem {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub: string;
  route: string;
  badge?: string;
  requiresAuth?: boolean;
}

interface AccountGroup {
  id: string;
  title: string;
  kicker: string;
  items: AccountLinkItem[];
}

const ACCOUNT_GROUPS: AccountGroup[] = [
  {
    id: "orders",
    title: "Orders & Logistics",
    kicker: "PURCHASES",
    items: [
      {
        icon: "location-outline",
        label: "Addresses",
        sub: "Shipping & billing addresses",
        route: "/(main)/account/addresses",
        requiresAuth: true,
      },
      {
        icon: "return-down-back-outline",
        label: "Returns & Refunds",
        sub: "Track claims & return status",
        route: "/(main)/account/returns",
        requiresAuth: true,
      },
      {
        icon: "shirt-outline",
        label: "Wardrobe",
        sub: "Your digital closet, outfits & wears",
        route: "/(main)/account/wardrobe",
        requiresAuth: true,
      },
    ],
  },
  {
    id: "privileges",
    title: "Privileges & Rewards",
    kicker: "EXCLUSIVE",
    items: [
      {
        icon: "ribbon-outline",
        label: "Loyalty & Rewards",
        sub: "Tier privileges, points & perks",
        route: "/(main)/account/loyalty",
        badge: "VIP",
        requiresAuth: true,
      },
      {
        icon: "gift-outline",
        label: "Gift Cards",
        sub: "Buy, redeem & balance check",
        route: "/(main)/account/gift-cards",
        requiresAuth: true,
      },
      {
        icon: "people-outline",
        label: "Referrals",
        sub: "Share your code & earn rewards",
        route: "/(main)/account/referrals",
        requiresAuth: true,
      },
      {
        icon: "megaphone-outline",
        label: "Influencer Program",
        sub: "Application & collaboration status",
        route: "/(main)/account/influencer-status",
        requiresAuth: true,
      },
    ],
  },
  {
    id: "style",
    title: "Style & Personalization",
    kicker: "CURATED FOR YOU",
    items: [
      {
        icon: "resize-outline",
        label: "Fit Profile",
        sub: "Bespoke size recommendations",
        route: "/(main)/account/fit-profile",
        requiresAuth: true,
      },
      {
        icon: "notifications-outline",
        label: "Price Drop Alerts",
        sub: "Watch for reductions on wishlist",
        route: "/(main)/account/price-alerts",
        requiresAuth: true,
      },
      {
        icon: "star-outline",
        label: "My Reviews",
        sub: "Products you have rated",
        route: "/(main)/account/reviews",
        requiresAuth: true,
      },
    ],
  },
  {
    id: "security",
    title: "Account & Concierge",
    kicker: "SETTINGS",
    items: [
      {
        icon: "shield-outline",
        label: "Security & MFA",
        sub: "Password, sessions & two-factor",
        route: "/(main)/account/security",
        requiresAuth: true,
      },
      {
        icon: "chatbubbles-outline",
        label: "Support Tickets",
        sub: "Order inquiries & claims",
        route: "/(main)/account/tickets",
        requiresAuth: true,
      },
      {
        icon: "headset-outline",
        label: "Luxe Concierge",
        sub: "Connect with personal care",
        route: "/(main)/contact",
      },
    ],
  },
];

const CARD_BRAND_STYLES: Record<PaymentCard["brand"], { colors: [string, string]; label: string }> = {
  visa: { colors: ["#0f172a", "#1e293b"], label: "VISA" },
  mastercard: { colors: ["#18181b", "#3f3f46"], label: "MASTERCARD" },
  amex: { colors: ["#0c1926", "#1c3247"], label: "AMEX" },
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

function getInitials(name: string): string {
  const parts = name.trim().split(" ").filter(Boolean);
  if (!parts.length) return "L";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const tabBarScrollHandler = useHideTabBarOnScroll();
  const router = useRouter();
  const { user, signOut, role } = useAuth();
  const wishlistItems = useWishlist((s) => s.items);
  const toggle = useWishlist((s) => s.toggle);

  const [orderThumbs, setOrderThumbs] = useState<string[]>([]);
  const [orderCount, setOrderCount] = useState<number>(0);
  const [followedStores, setFollowedStores] = useState<FollowedStore[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<Product[]>([]);
  const [payments, setPayments] = useState<PaymentCard[]>([]);
  const [profileName, setProfileName] = useState("");
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState(false);

  const name = profileName || user?.user_metadata?.full_name || "Guest";
  const email = user?.email ?? "Sign in to sync your account";
  const wishlistCount = Object.keys(wishlistItems).length;
  const showAvatarImage = Boolean(avatarUri) && !avatarError;

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
          setOrderCount(0);
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
        if (ordersRes.ok && Array.isArray(ordersRes.data)) {
          setOrderThumbs(buildOrderThumbs(ordersRes.data));
          setOrderCount(ordersRes.data.length);
        } else {
          setOrderThumbs([]);
          setOrderCount(0);
        }

        const profile = profileRes.ok ? profileRes.data?.user : null;
        if (profile?.full_name) setProfileName(profile.full_name);
        const nextAvatar =
          profile?.avatar_url ?? user.user_metadata?.avatar_url ?? null;
        setAvatarUri(nextAvatar ? resolveImageUrl(nextAvatar) || nextAvatar : null);
        setAvatarError(false);
      }

      load();
      return () => {
        cancelled = true;
      };
    }, [user?.id, user?.user_metadata?.avatar_url, user?.user_metadata?.full_name]),
  );

  const handleSignIn = useCallback(() => {
    router.push("/(auth)/login");
  }, [router]);

  const openAccountLink = useCallback(
    (link: AccountLinkItem) => {
      if (link.requiresAuth && !user) {
        handleSignIn();
        return;
      }
      router.push(link.route as never);
    },
    [user, router, handleSignIn],
  );

  const initials = getInitials(name);
  const memberSince = (() => {
    if (!user?.created_at) return null;
    const d = new Date(user.created_at);
    return Number.isNaN(d.getTime()) ? null : d.getFullYear();
  })();

  return (
    <PaperBackground style={{ backgroundColor: "#f8f7f2" }}>
      <AnimatedScrollView
        showsVerticalScrollIndicator={false}
        onScroll={tabBarScrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: Math.max(insets.top, spacing[3]) + spacing[1],
            paddingBottom: expandableTabBarInset(insets.bottom) + spacing[6],
          },
        ]}
      >
        {/* Top App Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => navigateHome(router)}
            activeOpacity={0.7}
            accessibilityLabel="Back to home"
          >
            <Ionicons name="chevron-back" size={18} color={colors.light.foreground} />
          </TouchableOpacity>

          <View style={styles.brandTitleContainer}>
            <Text style={styles.brandTitleKicker}>MEMBERSHIP</Text>
            <Text style={styles.brandTitleText}>Account</Text>
          </View>

          {user ? (
            <TouchableOpacity
              style={styles.navBtn}
              onPress={() => router.push("/(main)/account/settings")}
              activeOpacity={0.7}
              accessibilityLabel="Settings"
            >
              <Ionicons name="settings-outline" size={18} color={colors.light.foreground} />
            </TouchableOpacity>
          ) : (
            <View style={styles.navBtnPlaceholder} />
          )}
        </View>

        {/* Luxury Member Profile Card — Private Client / Executive Noir Card */}
        <View style={styles.memberCard}>
          <LinearGradient
            colors={["#1c2014", "#15180f", "#0c0e08"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.memberCardGradient}
          >
            {/* Soft champagne glow accents */}
            <LinearGradient
              pointerEvents="none"
              colors={["rgba(232, 207, 143, 0.14)", "rgba(232, 207, 143, 0.03)", "rgba(232, 207, 143, 0)"]}
              locations={[0, 0.35, 0.7]}
              start={{ x: 1, y: 0 }}
              end={{ x: 0.2, y: 0.9 }}
              style={StyleSheet.absoluteFillObject}
            />

            {/* Main Profile Info */}
            <View style={styles.profileRow}>
              <View style={styles.avatarWrapper}>
                <View style={styles.avatarOuterBezel}>
                  <View style={styles.avatarInnerBezel}>
                    {showAvatarImage ? (
                      <Image
                        source={{ uri: avatarUri! }}
                        style={styles.avatarImage}
                        contentFit="cover"
                        transition={200}
                        onError={() => setAvatarError(true)}
                      />
                    ) : (
                      <LinearGradient
                        colors={["#2b311a", "#181c0e"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.avatarFallback}
                      >
                        <Text style={styles.avatarInitials}>{initials}</Text>
                      </LinearGradient>
                    )}
                  </View>
                </View>
                {user?.email_confirmed_at ? (
                  <View style={styles.avatarVerifiedBadge} accessibilityLabel="Email verified">
                    <Ionicons name="checkmark-sharp" size={10} color="#14170d" />
                  </View>
                ) : null}
              </View>

              <View style={styles.profileCopy}>
                <Text style={styles.profileName} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                  {name}
                </Text>
                <Text style={styles.profileEmail} numberOfLines={1}>
                  {email}
                </Text>
              </View>

              {user ? (
                <TouchableOpacity
                  style={styles.editBtn}
                  onPress={() => router.push("/(main)/account/profile")}
                  activeOpacity={0.75}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Edit profile"
                >
                  <Ionicons name="pencil" size={15} color="#E8CF8F" />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Membership meta */}
            <View style={styles.memberBadgeRow}>
              <View style={styles.privilegePill}>
                <Ionicons
                  name={role === "admin" ? "shield-checkmark" : "diamond-outline"}
                  size={11}
                  color="#E8CF8F"
                />
                <Text style={styles.privilegePillText}>
                  {role === "admin" ? "Platform admin" : "Private client"}
                </Text>
              </View>
              <Text style={styles.memberIdText}>
                {user ? (memberSince ? `Member since ${memberSince}` : "Member") : "Guest"}
              </Text>
            </View>

            {!user ? (
              <TouchableOpacity
                style={styles.actionPill}
                onPress={handleSignIn}
                activeOpacity={0.8}
                accessibilityRole="button"
              >
                <Ionicons name="log-in-outline" size={15} color="#14170d" />
                <Text style={styles.actionPillText}>Sign in</Text>
              </TouchableOpacity>
            ) : null}

            {/* Haute Horlogerie / Private Client Stats Ribbon */}
            <View style={styles.statsRibbon}>
              {[
                {
                  key: "orders",
                  value: orderCount,
                  label: orderCount === 1 ? "Order" : "Orders",
                  icon: "bag-handle-outline" as const,
                  onPress: () => (user ? router.push("/(main)/account/orders") : handleSignIn()),
                },
                {
                  key: "wishlist",
                  value: wishlistCount,
                  label: "Wishlist",
                  icon: "heart-outline" as const,
                  onPress: () => router.push("/(main)/wishlist"),
                },
                {
                  key: "following",
                  value: followedStores.length,
                  label: "Following",
                  icon: "storefront-outline" as const,
                  onPress: () => router.push("/(main)/account/following"),
                },
              ].map((st, i) => (
                <React.Fragment key={st.key}>
                  {i > 0 ? <View style={styles.statDivider} /> : null}
                  <TouchableOpacity
                    style={styles.statItem}
                    onPress={st.onPress}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={`${st.value} ${st.label}`}
                  >
                    <View style={styles.statLabelRow}>
                      <Ionicons name={st.icon} size={13} color="#C8A44A" />
                      <Text style={styles.statValue}>{st.value}</Text>
                    </View>
                    <Text style={styles.statLabel}>{st.label}</Text>
                  </TouchableOpacity>
                </React.Fragment>
              ))}
            </View>
          </LinearGradient>
        </View>

        {/* Recent orders strip */}
        {user ? (
          <TouchableOpacity
            style={styles.ordersRow}
            onPress={() => router.push("/(main)/account/orders")}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Order history"
          >
            {orderThumbs.length > 0 ? (
              <View style={[styles.overlapContainer, { width: 40 + (orderThumbs.length - 1) * 22 }]}>
                {orderThumbs.map((uri, idx) => (
                  <Image
                    key={`${uri}-${idx}`}
                    source={{ uri }}
                    style={[styles.overlapThumb, { left: idx * 22, zIndex: 10 - idx }]}
                    contentFit="cover"
                  />
                ))}
              </View>
            ) : (
              <View style={styles.ordersIcon}>
                <Ionicons name="bag-handle-outline" size={18} color={colors.olive[700]} />
              </View>
            )}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.ordersTitle}>Order history</Text>
              <Text style={styles.ordersSub} numberOfLines={1}>
                {orderCount > 0 ? `${orderCount} recent · track deliveries` : "Your orders will appear here"}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.light.mutedForeground} />
          </TouchableOpacity>
        ) : null}

        {/* Recently Viewed Editorial Rail */}
        <View style={styles.sectionHeaderWrap}>
          <View style={styles.sectionTitleBlock}>
            <Text style={styles.sectionKicker}>CONTINUE BROWSING</Text>
            <Text style={styles.sectionHeading}>Recently viewed</Text>
          </View>

          {recentlyViewed.length > 0 ? (
            <TouchableOpacity
              style={styles.seeAllBtn}
              onPress={() => router.push("/(main)/products")}
              activeOpacity={0.7}
            >
              <Text style={styles.seeAllText}>Browse all</Text>
              <Ionicons name="chevron-forward" size={12} color={colors.olive[700]} />
            </TouchableOpacity>
          ) : null}
        </View>

        {recentlyViewed.length === 0 ? (
          <View style={styles.emptyRecentCard}>
            <View style={styles.emptyRecentIconWrap}>
              <Ionicons name="eye-outline" size={22} color={colors.light.mutedForeground} />
            </View>
            <View style={styles.emptyRecentTextWrap}>
              <Text style={styles.emptyRecentTitle}>No recently viewed pieces</Text>
              <Text style={styles.emptyRecentSub}>Luxury pieces you explore will appear here</Text>
            </View>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.recentScrollContainer}
          >
            {recentlyViewed.map((p) => {
              const img = p.images?.find((i) => i.is_primary)?.url ?? p.images?.[0]?.url;
              const isWishlisted = !!wishlistItems[p.id];
              const brand = p.brand?.name || p.store?.name || "LUXE";
              const displayName = p.name.split(" - ")[0] || p.name;

              return (
                <TouchableOpacity
                  key={p.id}
                  style={styles.recentProductCard}
                  activeOpacity={0.9}
                  onPress={() => router.push(`/(main)/products/${p.slug}`)}
                >
                  {/* High-res Image */}
                  {img ? (
                    <Image
                      source={{ uri: img }}
                      style={styles.recentProductImage}
                      contentFit="cover"
                      transition={200}
                    />
                  ) : (
                    <View style={[styles.recentProductImage, styles.recentImagePlaceholder]}>
                      <Ionicons name="shirt-outline" size={28} color={colors.light.mutedForeground} />
                    </View>
                  )}

                  {/* Floating Wishlist Heart */}
                  <TouchableOpacity
                    style={styles.floatingHeartBtn}
                    onPress={(e) => {
                      e.stopPropagation();
                      toggle(p.id);
                    }}
                    activeOpacity={0.75}
                    hitSlop={8}
                  >
                    <Ionicons
                      name={isWishlisted ? "heart" : "heart-outline"}
                      size={14}
                      color={isWishlisted ? colors.light.destructive : "#16170f"}
                    />
                  </TouchableOpacity>

                  {/* Editorial Gradient Scrim & Info */}
                  <LinearGradient
                    colors={["transparent", "rgba(18, 19, 14, 0.7)", "rgba(18, 19, 14, 0.95)"]}
                    locations={[0, 0.6, 1]}
                    style={styles.recentProductScrim}
                  >
                    <Text style={styles.recentBrandName} numberOfLines={1}>
                      {brand.toUpperCase()}
                    </Text>
                    <Text style={styles.recentProductName} numberOfLines={1}>
                      {displayName}
                    </Text>
                    {p.price ? (
                      <Text style={styles.recentProductPrice}>
                        {formatPrice(p.price, p.currency)}
                      </Text>
                    ) : null}
                  </LinearGradient>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* Categorized Luxury Account Menu */}
        {ACCOUNT_GROUPS.map((group) => (
          <View key={group.id} style={styles.groupContainer}>
            <View style={styles.groupHeaderRow}>
              <Text style={styles.groupKicker}>{group.kicker}</Text>
              <Text style={styles.groupTitle}>{group.title}</Text>
            </View>

            <View style={styles.groupMenuCard}>
              {group.items.map((item, index) => (
                <TouchableOpacity
                  key={item.route}
                  style={[
                    styles.groupRow,
                    index < group.items.length - 1 && styles.groupRowDivider,
                  ]}
                  activeOpacity={0.7}
                  onPress={() => openAccountLink(item)}
                >
                  <View style={styles.groupIconBox}>
                    <Ionicons name={item.icon} size={18} color={colors.olive[700]} />
                  </View>

                  <View style={styles.groupTextBox}>
                    <View style={styles.groupLabelRow}>
                      <Text style={styles.groupItemLabel}>{item.label}</Text>
                      {item.badge ? (
                        <View style={styles.itemBadgePill}>
                          <Text style={styles.itemBadgeText}>{item.badge}</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.groupItemSub}>{item.sub}</Text>
                  </View>

                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={colors.light.mutedForeground}
                  />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {/* Payment Methods Section */}
        <View style={styles.groupContainer}>
          <View style={styles.paymentHeaderRow}>
            <View>
              <Text style={styles.groupKicker}>SECURE CHECKOUT</Text>
              <Text style={styles.groupTitle}>Payment methods</Text>
            </View>

            <TouchableOpacity
              style={styles.addCardBtn}
              activeOpacity={0.8}
              onPress={() =>
                user
                  ? router.push("/(main)/account/payments/add")
                  : handleSignIn()
              }
            >
              <Ionicons name="add" size={14} color={colors.olive[700]} />
              <Text style={styles.addCardBtnText}>Add card</Text>
            </TouchableOpacity>
          </View>

          {payments.length === 0 ? (
            <TouchableOpacity
              style={styles.paymentEmptyCard}
              activeOpacity={0.85}
              onPress={() =>
                user
                  ? router.push("/(main)/account/payments/add")
                  : handleSignIn()
              }
            >
              <View style={styles.paymentEmptyIconWrap}>
                <Ionicons name="card-outline" size={22} color={colors.olive[700]} />
              </View>
              <View style={styles.paymentEmptyCopy}>
                <Text style={styles.paymentEmptyTitle}>No payment methods saved</Text>
                <Text style={styles.paymentEmptySub}>
                  Store credit and debit cards securely for one-tap purchases
                </Text>
              </View>
              <View style={styles.paymentEmptyPlus}>
                <Ionicons name="chevron-forward" size={16} color={colors.light.mutedForeground} />
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.cardStack}
              activeOpacity={0.9}
              onPress={() => router.push("/(main)/account/payments")}
            >
              {payments.slice(0, 2).map((card, index) => (
                <PaymentCardPreview
                  key={card.id}
                  card={card}
                  index={index}
                  total={Math.min(payments.length, 2)}
                />
              ))}
            </TouchableOpacity>
          )}
        </View>

        {/* Admin Executive Portal Banner (Admins only) */}
        {user && role === "admin" ? (
          <TouchableOpacity
            style={styles.adminBanner}
            activeOpacity={0.9}
            onPress={() => router.push("/(admin)")}
          >
            <LinearGradient
              colors={["#1c2012", "#2d3419"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.adminBannerGradient}
            >
              <View style={styles.adminBannerIconWrap}>
                <Ionicons name="shield-checkmark" size={24} color="#f4efe2" />
              </View>
              <View style={styles.adminBannerCopy}>
                <View style={styles.adminPillSmall}>
                  <Text style={styles.adminPillSmallText}>EXECUTIVE PORTAL</Text>
                </View>
                <Text style={styles.adminBannerTitle}>Platform Administration</Text>
                <Text style={styles.adminBannerSub}>
                  Catalog, moderation, vendor payouts & system settings
                </Text>
              </View>
              <View style={styles.adminBannerArrow}>
                <Ionicons name="arrow-forward" size={16} color="#1c2012" />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        ) : null}

        {/* Sign Out / Sign In Button */}
        {user ? (
          <TouchableOpacity style={styles.signOutBtn} onPress={signOut} activeOpacity={0.7}>
            <Ionicons name="log-out-outline" size={16} color={colors.light.destructive} />
            <Text style={styles.signOutBtnText}>Sign out of Luxe</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.signInBtn} onPress={handleSignIn} activeOpacity={0.85}>
            <Text style={styles.signInBtnText}>Sign in to your account</Text>
          </TouchableOpacity>
        )}

        {/* Brand Atelier Signature */}
        <View style={styles.brandFooter}>
          <Text style={styles.brandFooterSignature}>LUXE ATELIER</Text>
          <Text style={styles.brandFooterCaption}>Curated Luxury Fashion & Lifestyle • v1.0</Text>
        </View>
      </AnimatedScrollView>
    </PaperBackground>
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
  const meta = CARD_BRAND_STYLES[card.brand] || { colors: ["#0f172a", "#1e293b"], label: "VISA" };
  const isFront = index === total - 1 || total === 1;
  const cardScale = isFront ? 1 : 0.94;
  const cardTop = isFront ? 26 : 0;
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
      <Svg style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <Path
          d="M-20 40 C 60 100, 160 30, 240 90 S 320 40, 400 80"
          fill="none"
          stroke="rgba(255, 255, 255, 0.07)"
          strokeWidth={1.2}
        />
        <Path
          d="M-20 55 C 60 115, 160 45, 240 105 S 320 55, 400 95"
          fill="none"
          stroke="rgba(255, 255, 255, 0.07)"
          strokeWidth={1.2}
        />
        <Path
          d="M-20 70 C 60 130, 160 60, 240 120 S 320 70, 400 110"
          fill="none"
          stroke="rgba(255, 255, 255, 0.07)"
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
        <Text style={styles.cardHolderText}>{card.holder || "LUXE MEMBER"}</Text>
        <View style={styles.cardWatermark}>
          <Text style={styles.watermarkText}>{card.exp}</Text>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: H_PAD,
  },

  /* Top Bar */
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing[4],
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(22, 23, 15, 0.08)",
    ...shadows.soft,
  },
  navBtnPlaceholder: {
    width: 40,
    height: 40,
  },
  brandTitleContainer: {
    alignItems: "center",
    gap: 1,
  },
  brandTitleKicker: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9,
    letterSpacing: 2,
    color: colors.olive[700],
    textTransform: "uppercase",
  },
  brandTitleText: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 18,
    color: colors.light.foreground,
    letterSpacing: -0.3,
  },

  /* Member Card */
  /* Member Card — Noir Obsidian & Champagne Gold Pass */
  memberCard: {
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(200, 164, 74, 0.45)",
    marginBottom: spacing[5],
    backgroundColor: "#16190e",
    shadowColor: "#16190e",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 10,
  },
  memberCardGradient: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[5],
    paddingBottom: spacing[2],
    position: "relative",
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[4],
  },
  avatarWrapper: {
    position: "relative",
  },
  avatarOuterBezel: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 1.5,
    borderColor: "#C8A44A",
    padding: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInnerBezel: {
    width: "100%",
    height: "100%",
    borderRadius: 31,
    overflow: "hidden",
    backgroundColor: "#1c2012",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarFallback: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 22,
    color: "#F4E2B2",
    letterSpacing: 0.5,
  },
  avatarVerifiedBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#C8A44A",
    borderWidth: 2,
    borderColor: "#16190e",
    alignItems: "center",
    justifyContent: "center",
  },
  profileCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  profileName: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 24,
    color: "#FFFFFF",
    letterSpacing: -0.4,
  },
  profileEmail: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    color: "rgba(250, 248, 241, 0.6)",
  },
  editBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.3)",
    alignSelf: "flex-start",
  },
  memberBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    marginTop: spacing[4],
  },
  privilegePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(200, 164, 74, 0.14)",
    borderRadius: radii.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  privilegePillText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 11,
    letterSpacing: 0.3,
    color: "#E8CF8F",
  },
  memberIdText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: "rgba(250, 248, 241, 0.5)",
  },
  actionPill: {
    marginTop: spacing[4],
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 44,
    borderRadius: radii.full,
    backgroundColor: "#E8CF8F",
  },
  actionPillText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 14,
    color: "#14170d",
  },
  statsRibbon: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing[5],
    paddingVertical: spacing[3],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(200, 164, 74, 0.3)",
  },
  statItem: {
    alignItems: "center",
    flex: 1,
    gap: 2,
    paddingVertical: spacing[1],
  },
  statValue: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 20,
    color: "#FFFFFF",
    letterSpacing: -0.2,
  },
  statLabelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  statLabel: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 12,
    color: "rgba(250, 248, 241, 0.6)",
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    height: 30,
    backgroundColor: "rgba(200, 164, 74, 0.3)",
  },

  /* Recent orders strip */
  ordersRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    backgroundColor: "#ffffff",
    borderRadius: 20,
    paddingHorizontal: spacing[4],
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "rgba(22, 23, 15, 0.08)",
    marginBottom: spacing[6],
  },
  ordersIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.olive[50],
    alignItems: "center",
    justifyContent: "center",
  },
  ordersTitle: { fontFamily: fontFamilies.sans.semibold, fontSize: 15, color: colors.light.foreground },
  ordersSub: { marginTop: 2, fontFamily: fontFamilies.sans.regular, fontSize: 12, color: colors.light.mutedForeground },
  overlapContainer: {
    position: "relative",
    height: 40,
  },
  overlapThumb: {
    position: "absolute",
    top: 0,
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#ffffff",
    backgroundColor: "#f0ede2",
  },

  /* Section Header */
  sectionHeaderWrap: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginBottom: spacing[3],
  },
  sectionTitleBlock: {
    gap: 2,
  },
  sectionKicker: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    color: colors.olive[700],
    letterSpacing: 1.5,
  },
  sectionHeading: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 20,
    color: colors.light.foreground,
    letterSpacing: -0.3,
  },
  seeAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingVertical: 2,
  },
  seeAllText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 12,
    color: colors.olive[700],
  },

  /* Recently Viewed Editorial Rail */
  recentScrollContainer: {
    gap: spacing[3],
    paddingBottom: spacing[5],
  },
  recentProductCard: {
    width: RECENT_CARD_WIDTH,
    height: RECENT_CARD_HEIGHT,
    borderRadius: radii.xl,
    overflow: "hidden",
    backgroundColor: "#f5f4ef",
    position: "relative",
    borderWidth: 1,
    borderColor: "rgba(22, 23, 15, 0.08)",
    ...shadows.soft,
  },
  recentProductImage: {
    width: "100%",
    height: "100%",
  },
  recentImagePlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eae8de",
  },
  floatingHeartBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
    ...shadows.soft,
  },
  recentProductScrim: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing[3],
    paddingBottom: spacing[3],
    paddingTop: spacing[5],
    justifyContent: "flex-end",
  },
  recentBrandName: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9,
    letterSpacing: 1,
    color: "#e6e6d0",
    marginBottom: 2,
  },
  recentProductName: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 12,
    color: "#ffffff",
    lineHeight: 16,
    marginBottom: 4,
  },
  recentProductPrice: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 12,
    color: "#ffffff",
    letterSpacing: -0.2,
  },
  emptyRecentCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    padding: spacing[4],
    backgroundColor: "#ffffff",
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: "rgba(22, 23, 15, 0.06)",
    marginBottom: spacing[5],
  },
  emptyRecentIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.olive[50],
    alignItems: "center",
    justifyContent: "center",
  },
  emptyRecentTextWrap: {
    flex: 1,
    gap: 2,
  },
  emptyRecentTitle: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 14,
    color: colors.light.foreground,
  },
  emptyRecentSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: colors.light.mutedForeground,
  },

  /* Grouped Account Links */
  groupContainer: {
    marginBottom: spacing[5],
  },
  groupHeaderRow: {
    marginBottom: spacing[2],
    paddingHorizontal: spacing[1],
    gap: 1,
  },
  groupKicker: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9,
    letterSpacing: 1.5,
    color: colors.olive[700],
    textTransform: "uppercase",
  },
  groupTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 17,
    color: colors.light.foreground,
    letterSpacing: -0.2,
  },
  groupMenuCard: {
    backgroundColor: "#ffffff",
    borderRadius: radii["2xl"],
    borderWidth: 1,
    borderColor: "rgba(22, 23, 15, 0.08)",
    overflow: "hidden",
    ...shadows.soft,
  },
  groupRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3] + 2,
  },
  groupRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: "#f3f2eb",
  },
  groupIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#f7f6f0",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(83, 94, 44, 0.1)",
  },
  groupTextBox: {
    flex: 1,
    gap: 2,
  },
  groupLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  groupItemLabel: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 14,
    color: colors.light.foreground,
    letterSpacing: -0.2,
  },
  itemBadgePill: {
    backgroundColor: "#e8a938",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  itemBadgeText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    color: "#ffffff",
    letterSpacing: 0.5,
  },
  groupItemSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: colors.light.mutedForeground,
  },

  /* Payment Section */
  paymentHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing[2],
    paddingHorizontal: spacing[1],
  },
  addCardBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.olive[50],
    borderRadius: radii.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.olive[100],
  },
  addCardBtnText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12,
    color: colors.olive[800],
  },
  paymentEmptyCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    backgroundColor: "#ffffff",
    borderRadius: radii["2xl"],
    borderWidth: 1,
    borderColor: "rgba(22, 23, 15, 0.08)",
    padding: spacing[4],
    ...shadows.soft,
  },
  paymentEmptyIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.olive[50],
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.olive[100],
  },
  paymentEmptyCopy: {
    flex: 1,
    gap: 2,
  },
  paymentEmptyTitle: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 14,
    color: colors.light.foreground,
  },
  paymentEmptySub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: colors.light.mutedForeground,
    lineHeight: 16,
  },
  paymentEmptyPlus: {
    paddingLeft: 4,
  },
  cardStack: {
    height: 154,
    marginBottom: spacing[2],
    position: "relative",
  },
  paymentCard: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 120,
    borderRadius: radii["2xl"],
    padding: spacing[4],
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    ...shadows.soft,
  },
  paymentCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brandBadge: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  brandBadgeText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10,
    color: "#0f172a",
    letterSpacing: 0.8,
  },
  cardNumberText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 14,
    color: "#ffffff",
    letterSpacing: 1.5,
  },
  paymentCardBottom: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  cardHolderText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 11,
    color: "rgba(255, 255, 255, 0.75)",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  cardWatermark: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  watermarkText: {
    fontFamily: fontFamilies.mono.regular,
    fontSize: 11,
    color: "#ffffff",
  },

  /* Admin Banner */
  adminBanner: {
    borderRadius: radii["2xl"],
    overflow: "hidden",
    marginBottom: spacing[5],
    borderWidth: 1,
    borderColor: "rgba(83, 94, 44, 0.3)",
    ...shadows.soft,
  },
  adminBannerGradient: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing[4],
    gap: spacing[3],
  },
  adminBannerIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  adminBannerCopy: {
    flex: 1,
    gap: 2,
  },
  adminPillSmall: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(200, 164, 74, 0.25)",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.4)",
    marginBottom: 2,
  },
  adminPillSmallText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    color: "#e8c878",
    letterSpacing: 1,
  },
  adminBannerTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 16,
    color: "#faf8f1",
    letterSpacing: -0.2,
  },
  adminBannerSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    color: "rgba(250, 248, 241, 0.7)",
    lineHeight: 15,
  },
  adminBannerArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#faf8f1",
    alignItems: "center",
    justifyContent: "center",
  },

  /* Sign In / Sign Out */
  signOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: spacing[3],
    marginBottom: spacing[4],
    backgroundColor: "rgba(192, 57, 43, 0.05)",
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: "rgba(192, 57, 43, 0.12)",
  },
  signOutBtnText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: colors.light.destructive,
  },
  signInBtn: {
    backgroundColor: colors.olive[700],
    borderRadius: radii.full,
    paddingVertical: spacing[4],
    alignItems: "center",
    marginBottom: spacing[4],
    ...shadows.soft,
  },
  signInBtnText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 14,
    color: "#faf8f1",
    letterSpacing: 0.3,
  },

  /* Brand Signature Footer */
  brandFooter: {
    alignItems: "center",
    paddingVertical: spacing[4],
    gap: 4,
  },
  brandFooterSignature: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 13,
    letterSpacing: 3,
    color: colors.olive[800],
  },
  brandFooterCaption: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    color: colors.light.mutedForeground,
  },
});
