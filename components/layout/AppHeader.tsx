import { CrossfadeGradient } from "@/components/ui/CrossfadeGradient";
import React from "react";
import { View, TouchableOpacity, StyleSheet, Text } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { useRouter, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@/components/ui/Icon";
import { Label } from "@/components/ui/Typography";
import { Avatar } from "@/components/ui";
import { LiveTicker } from "./LiveTicker";
import { useCart, useWishlist, useUI } from "@/lib/stores";
import { colors, radii, typography } from "@/lib/theme/tokens";
import { useAuth } from "@/lib/supabase/auth";
import { fontFamilies } from "@/lib/theme/fonts";
import { useDeliveryAddressPicker } from "@/components/address/DeliveryAddressPicker";
import { navigateHome } from "@/lib/navigation";
import { C } from "@/components/orders/parcel-track";

interface AppHeaderProps {
  showTicker?: boolean;
  showSearch?: boolean;
  compact?: boolean;
  showBackToHome?: boolean;
  /**
   * Scroll offset of the screen's main list. When given (and search is
   * shown), the ticker + address row fold away as the user scrolls, leaving
   * just the search bar pinned — the account button swaps to the bag so
   * the cart stays one tap away.
   */
  scrollY?: SharedValue<number>;
  /**
   * "atelier" matches the Account screen: cream glow backdrop, white circular
   * action buttons with lime badges, and a white search pill. Home uses it.
   */
  /** "festive" = atelier layout on the home sale gradient. */
  tone?: "default" | "atelier" | "festive";
  /** Gradient for the festive tone; crossfades when it changes. */
  festiveColors?: readonly [string, string, ...string[]];
}

/** Scroll-up distance needed to unfold the header; scroll-down folds it. */
const HEADER_DIR_THRESHOLD = 6;
/** Always keep the header fully expanded near the top of the list. */
const HEADER_TOP_REVEAL = 24;
const HEADER_COLLAPSE_MS = 220;

const FESTIVE_DEFAULT = ["#f7a6cf", "#efb3e3", "#e9bdf2"] as const;

export function AppHeader({
  showTicker = true,
  showSearch = true,
  compact = false,
  showBackToHome = false,
  scrollY,
  tone = "default",
  festiveColors = FESTIVE_DEFAULT,
}: AppHeaderProps) {
  const atelier = tone === "atelier" || tone === "festive";
  const festive = tone === "festive";
  const router = useRouter();
  const pathname = usePathname();
  const isWishlistScreen = pathname.includes("/wishlist");
  const isCartScreen = pathname.includes("/cart");
  const isNotificationsScreen = pathname.includes("/notifications");

  const insets = useSafeAreaInsets();
  const cartCount = useCart((s) => s.itemCount());
  const wishlistCount = useWishlist((s) => s.count());
  const { user } = useAuth();
  const avatarUrl = (user?.user_metadata?.avatar_url as string | undefined) ?? null;
  const addressPicker = useDeliveryAddressPicker();
  const { addressText, openPicker: handleAddressPress } = addressPicker;

  const handleNotificationsPress = () => {
    router.push("/(main)/notifications");
  };

  const handleWishlistPress = () => {
    router.push("/(main)/wishlist");
  };

  const handleCartPress = () => {
    useUI.getState().setCartDrawer(true);
  };

  // ── Collapse-on-scroll ─────────────────────────────────────────────
  // Direction-driven, not position-driven: the ticker + address row fold
  // away on any downward scroll and unfold on any upward scroll (and are
  // always expanded near the top). Tying the fold to the raw offset left
  // it hidden until the user scrolled all the way back to y=0 — it felt
  // "stuck" when scrolling up mid-list.
  const collapsible = Boolean(scrollY) && showSearch;
  const topHeight = useSharedValue(0);
  const collapse = useSharedValue(0); // 0 = expanded, 1 = folded away
  // Offset where the current scroll direction started. Direction is judged
  // against this anchor — not per-event deltas — because Android delivers
  // many small scroll events whose individual deltas never reach the
  // threshold, which left the header stuck folded.
  const collapseAnchor = useSharedValue(0);
  const [collapsed, setCollapsed] = React.useState(false);
  const topStyle = useAnimatedStyle(() => {
    if (!scrollY || topHeight.value === 0) return {};
    return {
      height: (1 - collapse.value) * topHeight.value,
      opacity: interpolate(collapse.value, [0, 0.6], [1, 0], Extrapolation.CLAMP),
    };
  });
  const accountStyle = useAnimatedStyle(() => {
    if (!scrollY || topHeight.value === 0) return { opacity: 1 };
    return { opacity: interpolate(collapse.value, [0.5, 1], [1, 0], Extrapolation.CLAMP) };
  });
  const bagStyle = useAnimatedStyle(() => {
    if (!scrollY || topHeight.value === 0) return { opacity: 0 };
    return { opacity: interpolate(collapse.value, [0.5, 1], [0, 1], Extrapolation.CLAMP) };
  });
  useAnimatedReaction(
    () => (scrollY ? scrollY.value : 0),
    (y) => {
      if (!scrollY || topHeight.value === 0) return;
      const offset = Math.max(0, y);
      if (offset <= HEADER_TOP_REVEAL) {
        collapseAnchor.value = offset;
        collapse.value = withTiming(0, { duration: HEADER_COLLAPSE_MS });
        return;
      }
      const drift = offset - collapseAnchor.value;
      if (drift > HEADER_DIR_THRESHOLD) {
        collapseAnchor.value = offset;
        collapse.value = withTiming(1, { duration: HEADER_COLLAPSE_MS });
      } else if (drift < -HEADER_DIR_THRESHOLD) {
        collapseAnchor.value = offset;
        collapse.value = withTiming(0, { duration: HEADER_COLLAPSE_MS });
      }
    },
  );
  useAnimatedReaction(
    () => collapse.value > 0.75,
    (next, prev) => {
      if (next !== prev) runOnJS(setCollapsed)(next);
    },
  );

  return (
    <View style={[styles.wrapper, atelier && styles.wrapperAtelier, festive && styles.wrapperFestive, { paddingTop: insets.top }]}>
      {festive && <CrossfadeGradient colors={festiveColors} style={StyleSheet.absoluteFill} />}
      <Animated.View style={[collapsible && styles.collapsibleTop, collapsible && topStyle]}>
        <View
          style={collapsible && styles.collapsibleInner}
          onLayout={(e) => {
            // Only trust the measurement while fully expanded: mid-fold the
            // clipped parent can squeeze this view, and recording that smaller
            // height made the header "expand" back to a cut-off size (ticker
            // visible, address row missing).
            const h = e.nativeEvent.layout.height;
            if (collapsible && h > 0 && (collapse.value === 0 || topHeight.value === 0)) {
              topHeight.value = h;
            }
          }}
        >
          {showTicker ? (
            atelier ? (
              <View style={styles.tickerPill}>
                <LiveTicker tone="atelier" />
              </View>
            ) : (
              <LiveTicker />
            )
          ) : null}
          <View style={[styles.masthead, compact && styles.mastheadCompact]}>
            {showBackToHome ? (
              <TouchableOpacity
                style={[styles.backBtn, atelier && styles.circleAtelier, atelier && styles.backBtnAtelier]}
                onPress={() => navigateHome(router)}
                activeOpacity={0.7}
                accessibilityLabel="Back to home"
              >
                <Ionicons name="chevron-back" size={22} color={colors.light.foreground} />
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={[styles.locationSelector, showBackToHome && styles.locationSelectorWithBack]}
              activeOpacity={0.7}
              onPress={handleAddressPress}
              accessibilityLabel="Change delivery address"
            >
              {atelier && !showBackToHome ? (
                <View style={styles.pinCircle}>
                  <Ionicons name="location-sharp" size={17} color={colors.olive[700]} />
                </View>
              ) : (
                <Ionicons name="location-sharp" size={18} color={colors.light.primary} />
              )}
              <View style={styles.locationTextWrap}>
                <Text style={styles.locationKicker}>Deliver to</Text>
                <View style={styles.locationValueRow}>
                  <Text style={styles.locationText} numberOfLines={1}>
                    {addressText ?? (user ? "Add a delivery address" : "Sign in to set address")}
                  </Text>
                  <Ionicons name="chevron-down" size={13} color={colors.light.foreground} />
                </View>
              </View>
            </TouchableOpacity>

            <View style={[styles.actions, atelier && styles.actionsAtelier]}>
              {!isNotificationsScreen && (
                <HeaderIcon
                  atelier={atelier}
                  icon="notifications-outline"
                  onPress={handleNotificationsPress}
                />
              )}
              {!isWishlistScreen && (
                <HeaderIcon
                  atelier={atelier}
                  icon="heart-outline"
                  badge={wishlistCount}
                  onPress={handleWishlistPress}
                />
              )}
              {!isCartScreen && (
                <HeaderIcon
                  atelier={atelier}
                  icon="bag-outline"
                  badge={cartCount}
                  onPress={handleCartPress}
                />
              )}
            </View>
          </View>
        </View>
      </Animated.View>

      {showSearch ? (
        <View style={[styles.searchRow, atelier && styles.searchRowAtelier]}>
          <TouchableOpacity
            style={[styles.searchBar, atelier && styles.searchBarAtelier]}
            activeOpacity={0.85}
            onPress={() => router.push("/(main)/search")}
          >
            <Ionicons
              name="search"
              size={16}
              color={colors.light.mutedForeground}
              style={styles.searchIcon}
            />
            <Text style={[styles.searchPlaceholder, atelier && styles.searchPlaceholderAtelier]}>
              {atelier ? "Search pieces, stores, brands" : "Search VESTARA"}
            </Text>
            {atelier ? (
              <View style={styles.searchSpark}>
                <Ionicons name="sparkles" size={13} color={LIME} />
              </View>
            ) : null}
          </TouchableOpacity>
          <View style={[styles.trailingSlot, atelier && styles.trailingSlotAtelier]}>
            <Animated.View
              style={[StyleSheet.absoluteFill, collapsible && accountStyle]}
              pointerEvents={collapsed ? "none" : "auto"}
            >
              <TouchableOpacity
                style={[styles.accountBtn, atelier && styles.accountBtnAtelier]}
                activeOpacity={0.8}
                onPress={() => router.push("/(main)/account")}
                accessibilityLabel="Account"
              >
                <Avatar
                  uri={avatarUrl}
                  size={atelier ? 38 : 30}
                  backgroundColor="#e9e9e4"
                  iconColor="#8f8f86"
                />
              </TouchableOpacity>
            </Animated.View>
            {collapsible && !isCartScreen ? (
              <Animated.View
                style={[StyleSheet.absoluteFill, bagStyle]}
                pointerEvents={collapsed ? "auto" : "none"}
              >
                <TouchableOpacity
                  style={[styles.accountBtn, styles.bagBtn, atelier && styles.circleAtelier]}
                  activeOpacity={0.8}
                  onPress={handleCartPress}
                  accessibilityLabel="Bag"
                >
                  <Ionicons name="bag-outline" size={18} color={colors.light.foreground} />
                  {cartCount > 0 ? (
                    <View style={[styles.badge, atelier && styles.badgeAtelier]}>
                      <Label style={[styles.badgeText, atelier && styles.badgeTextAtelier]}>{cartCount > 99 ? "99+" : String(cartCount)}</Label>
                    </View>
                  ) : null}
                </TouchableOpacity>
              </Animated.View>
            ) : null}
          </View>
        </View>
      ) : null}

      {atelier ? null : <View style={styles.hairline} />}

      {addressPicker.sheet}
    </View>
  );
}

function HeaderIcon({
  icon,
  badge,
  onPress,
  atelier,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  badge?: number;
  onPress: () => void;
  atelier?: boolean;
}) {
  return (
    <TouchableOpacity style={[styles.iconBtn, atelier && styles.circleAtelier]} onPress={onPress} activeOpacity={0.7}>
      <Ionicons
        name={icon}
        size={atelier ? 19 : 22}
        color={colors.light.foreground}
      />
      {!!badge && badge > 0 && (
        <View style={[styles.badge, atelier && styles.badgeAtelier]}>
          <Label style={[styles.badgeText, atelier && styles.badgeTextAtelier]}>{badge > 99 ? "99+" : String(badge)}</Label>
        </View>
      )}
    </TouchableOpacity>
  );
}

/** Account-screen palette, used by the "atelier" tone. */
const GLOW = C.glow;
const INK = C.ink;
const LIME = C.lime;
const GOLD_SOFT = C.goldSoft;

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: colors.light.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  wrapperAtelier: {
    backgroundColor: GLOW,
    borderBottomWidth: 0,
  },
  wrapperFestive: {
    backgroundColor: "transparent",
  },
  tickerPill: {
    marginHorizontal: 20,
    marginTop: 6,
  },
  backBtnAtelier: {
    marginRight: 6,
  },
  pinCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 4,
    shadowColor: INK,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
  },
  actionsAtelier: {
    gap: 8,
  },
  circleAtelier: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#FFFFFF",
    shadowColor: INK,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
  },
  badgeAtelier: {
    top: -3,
    right: -3,
    minWidth: 19,
    height: 19,
    borderRadius: 10,
    backgroundColor: INK,
    borderWidth: 2,
    borderColor: GLOW,
  },
  badgeTextAtelier: {
    color: LIME,
    fontSize: 9,
  },
  searchRowAtelier: {
    paddingTop: 4,
    paddingBottom: 14,
    gap: 12,
  },
  searchBarAtelier: {
    height: 48,
    paddingLeft: 18,
    paddingRight: 6,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(22,23,15,0.07)",
    shadowColor: INK,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 3,
  },
  searchPlaceholderAtelier: {
    flex: 1,
    fontSize: 14,
  },
  searchSpark: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: INK,
    alignItems: "center",
    justifyContent: "center",
  },
  trailingSlotAtelier: {
    width: 48,
    height: 48,
  },
  accountBtnAtelier: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: GOLD_SOFT,
    backgroundColor: "#FFFFFF",
  },
  masthead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  mastheadCompact: {
    paddingTop: 8,
    paddingBottom: 8,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.olive[50],
    marginRight: 4,
  },
  locationSelector: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
    marginRight: 16,
  },
  locationSelectorWithBack: {
    marginRight: 8,
  },
  collapsibleTop: {
    overflow: "hidden",
  },
  collapsibleInner: {
    flexShrink: 0,
  },
  locationTextWrap: {
    flex: 1,
  },
  locationKicker: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 11,
    color: colors.light.mutedForeground,
  },
  locationValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  locationText: {
    color: colors.light.foreground,
    fontFamily: fontFamilies.sans.bold,
    fontSize: 15,
    flexShrink: 1,
  },
  trailingSlot: {
    width: 40,
    height: 40,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: 2,
    right: 0,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.light.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: {
    color: colors.light.primaryForeground,
    fontSize: 8,
    letterSpacing: 0,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 10,
  },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.olive[50],
    borderRadius: radii.full,
    height: 40,
    paddingHorizontal: 14,
  },
  accountBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    backgroundColor: colors.paper.cream,
    borderWidth: 1,
    borderColor: colors.light.border,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  // The avatar button clips to its circle; the bag needs its count badge to overflow.
  bagBtn: {
    overflow: "visible",
  },
  searchIcon: {
    marginRight: 8,
  },
  searchPlaceholder: {
    color: colors.light.mutedForeground,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
  },
  mapBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.olive[50],
    alignItems: "center",
    justifyContent: "center",
  },
  hairline: {
    height: 1,
    backgroundColor: colors.light.border,
    opacity: 0.6,
  },
});
