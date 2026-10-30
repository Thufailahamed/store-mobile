import React from "react";
import { View, TouchableOpacity, StyleSheet, Text, ScrollView, ActivityIndicator, Pressable } from "react-native";
import { Modal } from "@/components/ui/Modal";
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
import { Avatar, useToast } from "@/components/ui";
import { LiveTicker } from "./LiveTicker";
import { useCart, useWishlist, useUI } from "@/lib/stores";
import { colors, radii, typography } from "@/lib/theme/tokens";
import { useAuth } from "@/lib/supabase/auth";
import { getAddresses, updateAddress } from "@/lib/api";
import { fontFamilies } from "@/lib/theme/fonts";
import type { Address } from "@/lib/types";
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
  tone?: "default" | "atelier";
}

/** Open Location Codes ("7C3X+RXR") are what map pins save — not something to show a shopper. */
const PLUS_CODE_RE = /^[23456789CFGHJMPQRVWX]{2,8}\+[23456789CFGHJMPQRVWX]{0,3}$/i;

/** Scroll-up distance needed to unfold the header; scroll-down folds it. */
const HEADER_DIR_THRESHOLD = 6;
/** Always keep the header fully expanded near the top of the list. */
const HEADER_TOP_REVEAL = 24;
const HEADER_COLLAPSE_MS = 220;

function addressLabel(a: Pick<Address, "type" | "line1" | "city">): string {
  const line1 = (a.line1 ?? "").trim();
  const type = a.type ? a.type.charAt(0).toUpperCase() + a.type.slice(1) : "";
  if (!line1 || PLUS_CODE_RE.test(line1.split(/[\s,]/)[0])) {
    return [type, a.city].filter(Boolean).join(" · ") || "Saved address";
  }
  return a.city ? `${line1}, ${a.city}` : line1;
}

function addressTypeLabel(type: Address["type"]): string {
  return type === "home" ? "Home" : type === "work" ? "Work" : "Other";
}

/** Full address for the picker, with any plus code swapped for "Pinned location". */
function addressLines(a: Address): string {
  const line1 = (a.line1 ?? "").trim();
  const first = PLUS_CODE_RE.test(line1.split(/[\s,]/)[0]) ? "Pinned location" : line1;
  return [first, a.line2, a.city, a.state].filter((p) => p && String(p).trim()).join(", ");
}

/** 0773077446 → 077 307 7446 (Sri Lankan mobile); anything else is shown as entered. */
function formatPhone(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (d.length === 10 && d.startsWith("0")) return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
  return phone;
}

export function AppHeader({
  showTicker = true,
  showSearch = true,
  compact = false,
  showBackToHome = false,
  scrollY,
  tone = "default",
}: AppHeaderProps) {
  const atelier = tone === "atelier";
  const router = useRouter();
  const pathname = usePathname();
  const isWishlistScreen = pathname.includes("/wishlist");
  const isCartScreen = pathname.includes("/cart");
  const isNotificationsScreen = pathname.includes("/notifications");

  const insets = useSafeAreaInsets();
  const cartCount = useCart((s) => s.itemCount());
  const wishlistCount = useWishlist((s) => s.count());
  const { user } = useAuth();
  const { toast } = useToast();
  const avatarUrl = (user?.user_metadata?.avatar_url as string | undefined) ?? null;
  const [addressText, setAddressText] = React.useState<string | null>(null);
  const [currentAddressId, setCurrentAddressId] = React.useState<string | null>(null);
  const [modalVisible, setModalVisible] = React.useState(false);
  const [addresses, setAddresses] = React.useState<Address[]>([]);
  const [loadingAddresses, setLoadingAddresses] = React.useState(false);

  React.useEffect(() => {
    if (user?.id) {
      getAddresses(user.id).then((res) => {
        if (res.ok && res.data && res.data.length > 0) {
          const defaultAddr = res.data.find((a) => a.is_default) || res.data[0];
          setAddressText(addressLabel(defaultAddr));
          setCurrentAddressId(defaultAddr.id);
          setAddresses(res.data);
        }
      });
    }
  }, [user?.id]);

  const handleAddressPress = async () => {
    if (!user) {
      router.push("/(auth)/login");
      return;
    }
    setModalVisible(true);
    setLoadingAddresses(true);
    try {
      const res = await getAddresses(user.id);
      if (res.ok && res.data) {
        setAddresses(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAddresses(false);
    }
  };

  const [switchingId, setSwitchingId] = React.useState<string | null>(null);

  const handleSelectAddress = async (addr: Address) => {
    if (!user || switchingId) return;
    if (addr.id === currentAddressId) {
      setModalVisible(false);
      return;
    }
    const prev = { text: addressText, id: currentAddressId };
    setSwitchingId(addr.id);
    // Optimistic: header updates immediately, rolled back if the save fails.
    setAddressText(addressLabel(addr));
    setCurrentAddressId(addr.id);

    const unset = await Promise.all(
      addresses
        .filter((a) => a.is_default && a.id !== addr.id)
        .map((a) => updateAddress(a.id, { is_default: false })),
    );
    const set = await updateAddress(addr.id, { is_default: true });
    setSwitchingId(null);

    if (!set.ok || unset.some((r) => !r.ok)) {
      setAddressText(prev.text);
      setCurrentAddressId(prev.id);
      toast("Couldn't change delivery address. Try again.", "error");
      return;
    }
    const res = await getAddresses(user.id);
    if (res.ok && res.data) setAddresses(res.data);
    setModalVisible(false);
    toast(`Delivering to ${addressLabel(addr)}`, "success");
  };

  const goToAddresses = (query = "") => {
    setModalVisible(false);
    router.push(`/(main)/account/addresses${query}` as never);
  };

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
    <View style={[styles.wrapper, atelier && styles.wrapperAtelier, { paddingTop: insets.top }]}>
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
              {atelier ? "Search pieces, stores, brands" : "Search LUXE"}
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

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          {/* Backdrop is a sibling of the sheet, so taps inside the sheet never close it. */}
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setModalVisible(false)}
            accessibilityLabel="Close"
          />
          <View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            <View style={styles.modalHandle} />

            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalKicker}>DELIVERY ADDRESS</Text>
                <Text style={styles.modalTitle}>Deliver to</Text>
                <Text style={styles.modalSub}>Choose where your order should arrive</Text>
              </View>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={styles.modalCloseBtn}
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={18} color={C.text} />
              </TouchableOpacity>
            </View>

            {loadingAddresses && addresses.length === 0 ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={C.accent} />
              </View>
            ) : addresses.length === 0 ? (
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIcon}>
                  <Ionicons name="location-outline" size={24} color={C.text} />
                </View>
                <Text style={styles.emptyTitle}>No saved addresses yet</Text>
                <Text style={styles.emptyText}>Add one so we know where to deliver.</Text>
              </View>
            ) : (
              <ScrollView style={styles.addressList} showsVerticalScrollIndicator={false}>
                {addresses.map((a) => {
                  const isCurrent = currentAddressId ? a.id === currentAddressId : a.is_default;
                  const isSwitching = switchingId === a.id;
                  return (
                    <TouchableOpacity
                      key={a.id}
                      style={[styles.addressOption, isCurrent && styles.addressOptionActive]}
                      onPress={() => handleSelectAddress(a)}
                      activeOpacity={0.8}
                      disabled={Boolean(switchingId)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isCurrent }}
                    >
                      <View style={[styles.addrIcon, isCurrent && styles.addrIconActive]}>
                        <Ionicons
                          name={a.type === "home" ? "home-outline" : a.type === "work" ? "briefcase-outline" : "location-outline"}
                          size={18}
                          color={isCurrent ? C.lime : C.text}
                        />
                      </View>
                      <View style={styles.addressInfo}>
                        <View style={styles.nameRow}>
                          <Text style={styles.addrType}>{addressTypeLabel(a.type)}</Text>
                          {a.is_default ? (
                            <View style={styles.defaultChip}>
                              <Text style={styles.defaultChipText}>Default</Text>
                            </View>
                          ) : null}
                        </View>
                        <Text style={styles.addrDetails} numberOfLines={2}>
                          {addressLines(a)}
                        </Text>
                        <Text style={styles.addrMeta} numberOfLines={1}>
                          {a.full_name}
                          {a.phone ? ` · ${formatPhone(a.phone)}` : ""}
                        </Text>
                      </View>
                      <View style={styles.addrSide}>
                        <View style={[styles.radio, isCurrent && styles.radioActive]}>
                          {isSwitching ? (
                            <ActivityIndicator size="small" color={C.lime} />
                          ) : isCurrent ? (
                            <Ionicons name="checkmark" size={14} color={C.lime} />
                          ) : null}
                        </View>
                        <TouchableOpacity
                          style={styles.editBtn}
                          onPress={() => goToAddresses(`?edit=${a.id}`)}
                          hitSlop={8}
                          accessibilityLabel={`Edit ${addressTypeLabel(a.type)} address`}
                        >
                          <Ionicons name="create-outline" size={15} color={C.muted} />
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            <TouchableOpacity
              style={styles.addAddressBtn}
              onPress={() => goToAddresses("?action=add")}
              activeOpacity={0.85}
            >
              <View style={styles.addAddressIcon}>
                <Ionicons name="add" size={18} color={C.ink} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.addAddressBtnText}>Add a new address</Text>
                <Text style={styles.addAddressSub}>Pin it on the map or type it in</Text>
              </View>
              <Ionicons name="arrow-forward" size={17} color={C.lime} />
            </TouchableOpacity>
            {addresses.length > 0 ? (
              <TouchableOpacity style={styles.manageLink} onPress={() => goToAddresses()} hitSlop={6}>
                <Text style={styles.manageLinkText}>Manage addresses</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </Modal>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(22,23,15,0.45)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: C.paper,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 20,
    paddingTop: 10,
    maxHeight: "80%",
  },
  modalHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(22,23,15,0.12)",
    alignSelf: "center",
    marginBottom: 18,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 18,
  },
  modalKicker: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10,
    letterSpacing: 1.8,
    color: C.accent,
  },
  modalTitle: {
    marginTop: 3,
    fontFamily: fontFamilies.sans.bold,
    fontSize: 24,
    letterSpacing: -0.6,
    color: C.text,
  },
  modalSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13.5,
    color: C.muted,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    shadowColor: C.ink,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyContainer: {
    paddingVertical: 28,
    marginBottom: 12,
    alignItems: "center",
    gap: 4,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: C.line,
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: C.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  emptyTitle: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 15,
    color: C.text,
  },
  emptyText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    color: C.muted,
  },
  addressList: {
    marginBottom: 6,
  },
  addressOption: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 14,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: C.line,
    backgroundColor: "#FFFFFF",
    marginBottom: 10,
    gap: 12,
  },
  addressOptionActive: {
    borderColor: C.ink,
  },
  addrIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: C.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  addrIconActive: {
    backgroundColor: C.ink,
  },
  addrSide: {
    alignItems: "center",
    gap: 10,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.faint,
    alignItems: "center",
    justifyContent: "center",
  },
  radioActive: {
    borderColor: C.ink,
    backgroundColor: C.ink,
  },
  addressInfo: {
    flex: 1,
    gap: 3,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  addrType: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 15.5,
    letterSpacing: -0.2,
    color: C.text,
  },
  defaultChip: {
    paddingHorizontal: 8,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    backgroundColor: C.lime,
  },
  defaultChipText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 10.5,
    color: C.ink,
  },
  addrDetails: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    lineHeight: 18,
    color: C.text,
  },
  addrMeta: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 12,
    color: C.muted,
  },
  editBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.accentSoft,
  },
  addAddressBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    marginTop: 4,
    borderRadius: 22,
    backgroundColor: C.ink,
  },
  addAddressIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: C.lime,
    alignItems: "center",
    justifyContent: "center",
  },
  addAddressBtnText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 15,
    color: C.cream,
  },
  addAddressSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12.5,
    color: "rgba(250,248,241,0.6)",
    marginTop: 1,
  },
  manageLink: {
    flexDirection: "row",
    alignSelf: "center",
    paddingVertical: 14,
  },
  manageLinkText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13.5,
    color: C.accent,
  },
});
