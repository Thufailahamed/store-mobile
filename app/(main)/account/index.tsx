import React, { useState, useCallback } from "react";
import { View, ScrollView, TouchableOpacity, Pressable, StyleSheet, Text } from "react-native";
import { Image } from "expo-image";
import { useRouter, useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Ionicons } from "@/components/ui/Icon";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { expandableTabBarInset } from "@/components/layout/ExpandableTabBar";
import { AnimatedScrollView, useHideTabBarOnScroll } from "@/lib/hooks/useTabBarScroll";
import { useAuth } from "@/lib/supabase/auth";
import { useWishlist } from "@/lib/stores";
import { colors } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { getFollowedStores, getOrders, type FollowedStore } from "@/lib/api";
import { getRecentlyViewedIds, type PaymentCard } from "@/lib/account-local";
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
import { ORDER_TONE } from "@/components/orders/luxe-order";
import { C, CLOSED, ParcelArt, RIBBON, TrackRail } from "@/components/orders/parcel-track";
import { useWishlistToggle } from "@/lib/hooks/useWishlistToggle";

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

function getInitials(name: string): string {
  const parts = name.trim().split(" ").filter(Boolean);
  if (!parts.length) return "L";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const BRAND_LABEL: Record<PaymentCard["brand"], string> = { visa: "VISA", mastercard: "MC", amex: "AMEX" };

function orderThumb(o: Order): string | null {
  const it = o.items?.[0];
  return (
    it?.image_url ??
    it?.product?.images?.find((i) => i.is_primary)?.url ??
    it?.product?.images?.[0]?.url ??
    null
  );
}

/** Most recent order still moving; otherwise the newest one. */
function pickLatest(orders: Order[]): Order | null {
  return orders.find((o) => !CLOSED.includes(o.status) && o.status !== "delivered") ?? orders[0] ?? null;
}

function SectionHead({
  kicker,
  title,
  action,
  onAction,
}: {
  kicker: string;
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHead}>
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle} accessibilityHint={kicker.toLowerCase()}>
          {title}
        </Text>
      </View>
      {action && onAction ? (
        <TouchableOpacity onPress={onAction} hitSlop={8} style={styles.sectionAction} activeOpacity={0.75}>
          <Text style={styles.sectionActionText}>{action}</Text>
          <Ionicons name="chevron-forward" size={13} color={C.accent} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const tabBarScrollHandler = useHideTabBarOnScroll();
  const router = useRouter();
  const { user, signOut, role } = useAuth();
  const wishlistItems = useWishlist((s) => s.items);
  const toggleWishlist = useWishlistToggle();

  const [orders, setOrders] = useState<Order[]>([]);
  const [followedStores, setFollowedStores] = useState<FollowedStore[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<Product[]>([]);
  const [payments, setPayments] = useState<PaymentCard[]>([]);
  const [profileName, setProfileName] = useState("");
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState(false);

  const name = profileName || user?.user_metadata?.full_name || "Guest";
  const email = user?.email ?? user?.phone ?? "Sign in to sync your account";
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
            const byId = new Map(mapProducts(res.data.products ?? []).map((p) => [p.id, p]));
            setRecentlyViewed(viewedIds.map((id) => byId.get(id)).filter((p): p is Product => !!p));
          } else {
            setRecentlyViewed([]);
          }
        } else {
          setRecentlyViewed([]);
        }

        if (!user?.id) {
          setOrders([]);
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
        setOrders(ordersRes.ok && Array.isArray(ordersRes.data) ? ordersRes.data : []);

        const profile = profileRes.ok ? profileRes.data?.user : null;
        if (profile?.full_name) setProfileName(profile.full_name);
        const nextAvatar = profile?.avatar_url ?? user.user_metadata?.avatar_url ?? null;
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
    router.push("/(auth)/welcome");
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
  const ribbon =
    role === "admin"
      ? { label: "ADMIN", bg: C.ink, fg: C.goldSoft }
      : user
        ? { label: "MEMBER", bg: colors.olive[700], fg: C.lime }
        : { label: "GUEST", bg: C.faint, fg: C.ink };

  const latest = pickLatest(orders);

  const stats = [
    {
      key: "orders",
      value: orders.length,
      label: orders.length === 1 ? "Order" : "Orders",
      onPress: () => (user ? router.push("/(main)/account/orders") : handleSignIn()),
    },
    { key: "wishlist", value: wishlistCount, label: "Wishlist", onPress: () => router.push("/(main)/wishlist") },
    {
      key: "following",
      value: followedStores.length,
      label: "Following",
      onPress: () => router.push("/(main)/account/following"),
    },
  ];

  const quick: { icon: keyof typeof Ionicons.glyphMap; label: string; route: string }[] = [
    { icon: "cube-outline", label: "Orders", route: "/(main)/account/orders" },
    { icon: "return-up-back-outline", label: "Returns", route: "/(main)/account/returns" },
    { icon: "location-outline", label: "Addresses", route: "/(main)/account/addresses" },
    { icon: "shirt-outline", label: "Wardrobe", route: "/(main)/account/wardrobe" },
  ];

  return (
    <View style={styles.root}>
      <LinearGradient
        pointerEvents="none"
        colors={[C.glow, C.glowSoft, C.paper]}
        locations={[0, 0.55, 1]}
        style={styles.glow}
      />
      <AnimatedScrollView
        showsVerticalScrollIndicator={false}
        onScroll={tabBarScrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: insets.top + 8,
            paddingBottom: expandableTabBarInset(insets.bottom) + 28,
          },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.circleBtn}
            onPress={() => navigateHome(router)}
            activeOpacity={0.8}
            accessibilityLabel="Back to home"
          >
            <Ionicons name="chevron-back" size={20} color={C.text} />
          </TouchableOpacity>
          <Text style={styles.title} accessibilityRole="header">
            Account
          </Text>
          {user ? (
            <TouchableOpacity
              style={styles.circleBtn}
              onPress={() => router.push("/(main)/account/settings")}
              activeOpacity={0.8}
              accessibilityLabel="Settings"
            >
              <Ionicons name="settings-outline" size={19} color={C.text} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Profile card */}
        <Animated.View entering={FadeInDown.duration(420)} style={styles.cardShadow}>
          <View style={styles.profileCard}>
            <View pointerEvents="none" style={styles.ribbonClip}>
              <View style={[styles.ribbon, { backgroundColor: ribbon.bg }]}>
                <Text style={[styles.ribbonText, { color: ribbon.fg }]}>{ribbon.label}</Text>
              </View>
            </View>

            <View style={styles.profileRow}>
              <Pressable
                onPress={() => (user ? router.push("/(main)/account/profile") : handleSignIn())}
                style={styles.avatarRing}
                accessibilityRole="button"
                accessibilityLabel={user ? "Edit profile" : "Sign in"}
              >
                {showAvatarImage ? (
                  <Image
                    source={{ uri: avatarUri! }}
                    style={styles.avatarImg}
                    contentFit="cover"
                    transition={200}
                    onError={() => setAvatarError(true)}
                  />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Text style={styles.avatarInitials}>{initials}</Text>
                  </View>
                )}
                {user ? (
                  <View style={styles.avatarEdit}>
                    <Ionicons name="pencil" size={10} color={C.ink} />
                  </View>
                ) : null}
              </Pressable>
              <View style={styles.profileText}>
                <Text style={styles.profileName} numberOfLines={1}>
                  {name}
                </Text>
                <Text style={styles.profileEmail} numberOfLines={1}>
                  {email}
                </Text>
                {user && memberSince ? (
                  <View style={styles.sincePill}>
                    <Ionicons name="sparkles" size={10} color={C.accent} />
                    <Text style={styles.sinceText}>Member since {memberSince}</Text>
                  </View>
                ) : null}
              </View>
            </View>

            {user ? (
              <View style={styles.statsStrip}>
                {stats.map((st, i) => (
                  <React.Fragment key={st.key}>
                    {i > 0 ? <View style={styles.statDivider} /> : null}
                    <TouchableOpacity
                      style={styles.stat}
                      onPress={st.onPress}
                      activeOpacity={0.75}
                      accessibilityRole="button"
                      accessibilityLabel={`${st.value} ${st.label}`}
                    >
                      <Text style={styles.statValue}>{st.value}</Text>
                      <Text style={styles.statLabel}>{st.label}</Text>
                    </TouchableOpacity>
                  </React.Fragment>
                ))}
              </View>
            ) : (
              <TouchableOpacity style={styles.signInCta} onPress={handleSignIn} activeOpacity={0.88}>
                <View style={styles.signInIcon}>
                  <Ionicons name="log-in-outline" size={17} color={C.ink} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.signInTitle}>Sign in or register</Text>
                  <Text style={styles.signInSub}>Track orders, save pieces and check out faster</Text>
                </View>
                <Ionicons name="arrow-forward" size={17} color={C.lime} />
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>

        {/* Quick actions */}
        <Animated.View entering={FadeInDown.duration(420).delay(60)} style={styles.quickRow}>
          {quick.map((q) => (
            <Pressable
              key={q.label}
              style={({ pressed }) => [styles.quick, pressed && { transform: [{ scale: 0.96 }] }]}
              onPress={() => (user ? router.push(q.route as never) : handleSignIn())}
              accessibilityRole="button"
              accessibilityLabel={q.label}
            >
              <View style={styles.quickIcon}>
                <Ionicons name={q.icon} size={21} color={C.text} />
              </View>
              <Text style={styles.quickLabel}>{q.label}</Text>
            </Pressable>
          ))}
        </Animated.View>

        {/* Latest order — same parcel card language as My Orders */}
        {user && latest ? (
          <>
            <SectionHead
              kicker="YOUR PARCEL"
              title="Latest order"
              action="All orders"
              onAction={() => router.push("/(main)/account/orders")}
            />
            <Pressable
              onPress={() => router.push(`/(main)/account/orders/${latest.id}` as never)}
              style={({ pressed }) => [styles.cardShadow, pressed && { transform: [{ scale: 0.985 }] }]}
              accessibilityRole="button"
              accessibilityLabel={`Order ${latest.order_number}`}
            >
              <View style={styles.parcel}>
                <ParcelArt />
                <View style={styles.parcelHead}>
                  <View style={styles.parcelThumb}>
                    {orderThumb(latest) ? (
                      <Image source={{ uri: orderThumb(latest)! }} style={StyleSheet.absoluteFill} contentFit="cover" />
                    ) : (
                      <Ionicons name="shirt-outline" size={22} color={C.muted} />
                    )}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.parcelId} numberOfLines={1}>
                      ID: {latest.order_number}
                    </Text>
                    <Text style={styles.parcelName} numberOfLines={1}>
                      {latest.items?.[0]?.product_name ?? "Order"} · {formatPrice(latest.total, latest.currency)}
                    </Text>
                  </View>
                  <View style={[styles.parcelPill, { backgroundColor: RIBBON[latest.status].bg }]}>
                    <Text style={[styles.parcelPillText, { color: RIBBON[latest.status].fg }]} numberOfLines={1}>
                      {ORDER_TONE[latest.status]?.label ?? latest.status}
                    </Text>
                  </View>
                </View>
                <TrackRail order={latest} />
              </View>
            </Pressable>
          </>
        ) : null}

        {/* Recently viewed */}
        {recentlyViewed.length > 0 ? (
          <>
            <SectionHead
              kicker="CONTINUE BROWSING"
              title="Recently viewed"
              action="Shop"
              onAction={() => router.push("/(main)/products")}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.rail}
              contentContainerStyle={styles.railContent}
              decelerationRate="fast"
              snapToInterval={150 + 12}
            >
              {recentlyViewed.map((p) => {
                const img = p.images?.find((i) => i.is_primary)?.url ?? p.images?.[0]?.url;
                const saved = !!wishlistItems[p.id];
                return (
                  <Pressable
                    key={p.id}
                    style={styles.recentCard}
                    onPress={() => router.push(`/(main)/products/${p.slug}`)}
                    accessibilityRole="button"
                    accessibilityLabel={p.name}
                  >
                    <View style={styles.recentImgWrap}>
                      {img ? (
                        <Image source={{ uri: img }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
                      ) : (
                        <Ionicons name="shirt-outline" size={26} color={C.muted} />
                      )}
                      <TouchableOpacity
                        style={styles.heartBtn}
                        onPress={() => toggleWishlist(p, img)}
                        hitSlop={8}
                        accessibilityLabel={saved ? "Remove from wishlist" : "Add to wishlist"}
                      >
                        <Ionicons name={saved ? "heart" : "heart-outline"} size={15} color={saved ? C.rust : C.ink} />
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.recentBrand} numberOfLines={1}>
                      {(p.brand?.name || p.store?.name || "LUXE").toUpperCase()}
                    </Text>
                    <Text style={styles.recentName} numberOfLines={1}>
                      {p.name.split(" - ")[0] || p.name}
                    </Text>
                    {p.price ? <Text style={styles.recentPrice}>{formatPrice(p.price, p.currency)}</Text> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </>
        ) : null}

        {/* Menu groups */}
        {ACCOUNT_GROUPS.map((group) => (
          <View key={group.id}>
            <SectionHead kicker={group.kicker} title={group.title} />
            <View style={styles.menuCard}>
              {group.items.map((item, i) => (
                <TouchableOpacity
                  key={item.route}
                  style={[styles.menuRow, i > 0 && styles.menuDivider]}
                  activeOpacity={0.65}
                  onPress={() => openAccountLink(item)}
                >
                  <View style={styles.menuIcon}>
                    <Ionicons name={item.icon} size={18} color={C.text} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={styles.menuLabelRow}>
                      <Text style={styles.menuLabel} numberOfLines={1}>
                        {item.label}
                      </Text>
                      {item.badge ? (
                        <View style={styles.menuBadge}>
                          <Text style={styles.menuBadgeText}>{item.badge}</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.menuSub} numberOfLines={1}>
                      {item.sub}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={C.faint} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {/* Payment methods */}
        <SectionHead
          kicker="SECURE CHECKOUT"
          title="Payment methods"
          action={payments.length > 0 ? "Manage" : undefined}
          onAction={() => router.push("/(main)/account/payments")}
        />
        <View style={styles.menuCard}>
          {payments.slice(0, 3).map((card, i) => (
            <TouchableOpacity
              key={card.id}
              style={[styles.menuRow, i > 0 && styles.menuDivider]}
              activeOpacity={0.65}
              onPress={() => router.push("/(main)/account/payments")}
            >
              <View style={styles.cardChip}>
                <Text style={styles.cardChipText}>{BRAND_LABEL[card.brand] ?? "CARD"}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.menuLabel}>•••• {card.last4}</Text>
                <Text style={styles.menuSub} numberOfLines={1}>
                  Expires {card.exp}
                  {card.holder ? ` · ${card.holder}` : ""}
                </Text>
              </View>
              {card.is_default ? (
                <View style={styles.defaultPill}>
                  <Text style={styles.defaultPillText}>Default</Text>
                </View>
              ) : (
                <Ionicons name="chevron-forward" size={16} color={C.faint} />
              )}
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[styles.menuRow, payments.length > 0 && styles.menuDivider]}
            activeOpacity={0.65}
            onPress={() => (user ? router.push("/(main)/account/payments/add") : handleSignIn())}
          >
            <View style={[styles.menuIcon, styles.menuIconDark]}>
              <Ionicons name="add" size={20} color={C.lime} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.menuLabel}>Add a card</Text>
              <Text style={styles.menuSub}>Save cards for one-tap checkout</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={C.faint} />
          </TouchableOpacity>
        </View>

        {/* Admin portal */}
        {user && role === "admin" ? (
          <TouchableOpacity style={styles.darkCta} activeOpacity={0.88} onPress={() => router.push("/(admin)")}>
            <View style={styles.darkCtaIcon}>
              <Ionicons name="shield-checkmark" size={18} color={C.ink} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.darkCtaTitle}>Platform administration</Text>
              <Text style={styles.darkCtaSub}>Catalogue, moderation, payouts & settings</Text>
            </View>
            <Ionicons name="arrow-forward" size={17} color={C.lime} />
          </TouchableOpacity>
        ) : null}

        {user ? (
          <TouchableOpacity style={styles.signOut} onPress={signOut} activeOpacity={0.75}>
            <Ionicons name="log-out-outline" size={17} color={C.rust} />
            <Text style={styles.signOutText}>Sign out</Text>
          </TouchableOpacity>
        ) : null}

        <View style={styles.footer}>
          <View style={styles.footerMark}>
            <MaterialCommunityIcons name="hanger" size={16} color={C.goldSoft} />
          </View>
          <Text style={styles.footerWord}>LUXE</Text>
          <Text style={styles.footerCaption}>Curated boutiques · v1.0</Text>
        </View>
      </AnimatedScrollView>
      {/* Keeps the status bar legible once content scrolls under it. */}
      <LinearGradient
        pointerEvents="none"
        colors={[C.glow, "rgba(235,229,204,0)"]}
        locations={[0.7, 1]}
        style={[styles.statusMask, { height: insets.top + 14 }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.paper },
  glow: { position: "absolute", top: 0, left: 0, right: 0, height: 380 },
  statusMask: { position: "absolute", top: 0, left: 0, right: 0 },
  scroll: { paddingHorizontal: 20 },

  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingBottom: 16 },
  title: {
    flex: 1,
    fontFamily: fontFamilies.display.semibold,
    fontSize: 31,
    letterSpacing: -0.8,
    color: C.text,
  },
  circleBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#16170f",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 3,
  },

  cardShadow: {
    borderRadius: 26,
    backgroundColor: "#FFFFFF",
    shadowColor: "#16170f",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.07,
    shadowRadius: 20,
    elevation: 3,
  },
  profileCard: { borderRadius: 26, overflow: "hidden", borderWidth: 1, borderColor: C.line, padding: 18 },
  ribbonClip: { position: "absolute", top: 0, right: 0, width: 116, height: 116, overflow: "hidden" },
  ribbon: {
    position: "absolute",
    top: 24,
    right: -44,
    width: 170,
    paddingVertical: 6,
    alignItems: "center",
    transform: [{ rotate: "35deg" }],
  },
  ribbonText: { fontFamily: fontFamilies.sans.bold, fontSize: 11, letterSpacing: 1.6 },
  profileRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingRight: 60 },
  avatarRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    padding: 3,
    borderWidth: 2,
    borderColor: C.goldSoft,
  },
  avatarImg: { width: "100%", height: "100%", borderRadius: 33 },
  avatarFallback: {
    flex: 1,
    borderRadius: 33,
    backgroundColor: C.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: { fontFamily: fontFamilies.display.semibold, fontSize: 24, color: C.goldSoft },
  avatarEdit: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: C.lime,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  profileText: { flex: 1, minWidth: 0, gap: 2 },
  profileName: { fontFamily: fontFamilies.sans.bold, fontSize: 20, letterSpacing: -0.4, color: C.text },
  profileEmail: { fontFamily: fontFamilies.sans.regular, fontSize: 13.5, color: C.muted },
  sincePill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 6,
    paddingHorizontal: 10,
    height: 24,
    borderRadius: 12,
    backgroundColor: C.accentSoft,
  },
  sinceText: { fontFamily: fontFamilies.sans.semibold, fontSize: 11.5, color: colors.olive[800] },

  statsStrip: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 18,
    paddingVertical: 14,
    borderRadius: 20,
    backgroundColor: C.ink,
  },
  stat: { flex: 1, alignItems: "center", gap: 2 },
  statValue: { fontFamily: fontFamilies.sans.bold, fontSize: 21, color: C.cream, fontVariant: ["tabular-nums"] },
  statLabel: { fontFamily: fontFamilies.sans.medium, fontSize: 12, color: "rgba(250,248,241,0.6)" },
  statDivider: { width: 1, height: 28, backgroundColor: "rgba(250,248,241,0.12)" },

  signInCta: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 20,
    backgroundColor: C.ink,
  },
  signInIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: C.lime,
    alignItems: "center",
    justifyContent: "center",
  },
  signInTitle: { fontFamily: fontFamilies.sans.bold, fontSize: 15, color: C.cream },
  signInSub: { fontFamily: fontFamilies.sans.regular, fontSize: 12.5, color: "rgba(250,248,241,0.6)", marginTop: 1 },

  quickRow: { flexDirection: "row", gap: 10, marginTop: 16 },
  quick: {
    flex: 1,
    alignItems: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: C.line,
  },
  quickIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  quickLabel: { fontFamily: fontFamilies.sans.semibold, fontSize: 12.5, color: C.text },

  sectionHead: { flexDirection: "row", alignItems: "flex-end", marginTop: 28, marginBottom: 12, paddingHorizontal: 2 },
  sectionKicker: { fontFamily: fontFamilies.mono.semibold, fontSize: 10, letterSpacing: 1.8, color: C.accent },
  sectionTitle: { marginTop: 3, fontFamily: fontFamilies.sans.bold, fontSize: 19, letterSpacing: -0.4, color: C.text },
  sectionAction: { flexDirection: "row", alignItems: "center", gap: 2, paddingBottom: 2 },
  sectionActionText: { fontFamily: fontFamilies.sans.semibold, fontSize: 13.5, color: C.accent },

  parcel: { borderRadius: 26, overflow: "hidden", borderWidth: 1, borderColor: C.line, padding: 18, paddingBottom: 22 },
  parcelHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  parcelThumb: {
    width: 52,
    height: 52,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#f0ede2",
    alignItems: "center",
    justifyContent: "center",
  },
  parcelId: { fontFamily: fontFamilies.sans.semibold, fontSize: 15, letterSpacing: -0.2, color: C.text },
  parcelName: { fontFamily: fontFamilies.sans.regular, fontSize: 13, color: C.muted, marginTop: 1 },
  parcelPill: { height: 26, paddingHorizontal: 10, borderRadius: 13, justifyContent: "center", maxWidth: 120 },
  parcelPillText: { fontFamily: fontFamilies.sans.bold, fontSize: 11.5 },

  rail: { marginHorizontal: -20 },
  railContent: { paddingHorizontal: 20, gap: 12 },
  recentCard: {
    width: 150,
    padding: 8,
    paddingBottom: 12,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: C.line,
  },
  recentImgWrap: {
    height: 160,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#f0ede2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  heartBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  recentBrand: { fontFamily: fontFamilies.mono.semibold, fontSize: 9.5, letterSpacing: 1.4, color: C.accent, paddingHorizontal: 4 },
  recentName: { fontFamily: fontFamilies.sans.bold, fontSize: 14, color: C.text, marginTop: 2, paddingHorizontal: 4 },
  recentPrice: { fontFamily: fontFamilies.sans.medium, fontSize: 12.5, color: C.muted, marginTop: 2, paddingHorizontal: 4 },

  menuCard: {
    paddingHorizontal: 14,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: C.line,
  },
  menuRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13 },
  menuDivider: { borderTopWidth: 1, borderTopColor: C.line },
  menuIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: C.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  menuIconDark: { backgroundColor: C.ink },
  menuLabelRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  menuLabel: { fontFamily: fontFamilies.sans.bold, fontSize: 15, letterSpacing: -0.2, color: C.text },
  menuSub: { fontFamily: fontFamilies.sans.regular, fontSize: 12.5, color: C.muted, marginTop: 1 },
  menuBadge: { paddingHorizontal: 7, height: 18, borderRadius: 9, backgroundColor: C.ink, justifyContent: "center" },
  menuBadgeText: { fontFamily: fontFamilies.sans.bold, fontSize: 9.5, letterSpacing: 0.8, color: C.goldSoft },

  cardChip: {
    width: 42,
    height: 30,
    borderRadius: 8,
    backgroundColor: C.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  cardChipText: { fontFamily: fontFamilies.sans.bold, fontSize: 9.5, letterSpacing: 0.8, color: C.goldSoft },
  defaultPill: { paddingHorizontal: 10, height: 24, borderRadius: 12, backgroundColor: C.lime, justifyContent: "center" },
  defaultPillText: { fontFamily: fontFamilies.sans.bold, fontSize: 11, color: C.ink },

  darkCta: {
    marginTop: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 22,
    backgroundColor: C.ink,
  },
  darkCtaIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: C.lime,
    alignItems: "center",
    justifyContent: "center",
  },
  darkCtaTitle: { fontFamily: fontFamilies.sans.bold, fontSize: 15, color: C.cream },
  darkCtaSub: { fontFamily: fontFamilies.sans.regular, fontSize: 12.5, color: "rgba(250,248,241,0.6)", marginTop: 1 },

  signOut: {
    marginTop: 18,
    height: 52,
    borderRadius: 26,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(184,92,58,0.3)",
    backgroundColor: "#FFFFFF",
  },
  signOutText: { fontFamily: fontFamilies.sans.bold, fontSize: 14.5, color: C.rust },

  footer: { alignItems: "center", marginTop: 30, gap: 4 },
  footerMark: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.ink,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  footerWord: { fontFamily: fontFamilies.display.semibold, fontSize: 15, letterSpacing: 4, color: C.text },
  footerCaption: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: C.muted },
});
