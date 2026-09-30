import React from "react";
import { View, TouchableOpacity, StyleSheet, Text, Modal, ScrollView, ActivityIndicator, Pressable } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import { useRouter, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@/components/ui/Icon";
import { Label, Display } from "@/components/ui/Typography";
import { useToast } from "@/components/ui";
import { LiveTicker } from "./LiveTicker";
import { useCart, useWishlist, useUI } from "@/lib/stores";
import { colors, radii, typography } from "@/lib/theme/tokens";
import { useAuth } from "@/lib/supabase/auth";
import { getAddresses, updateAddress } from "@/lib/api";
import { fontFamilies } from "@/lib/theme/fonts";
import type { Address } from "@/lib/types";
import { navigateHome } from "@/lib/navigation";

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
}

/** Open Location Codes ("7C3X+RXR") are what map pins save — not something to show a shopper. */
const PLUS_CODE_RE = /^[23456789CFGHJMPQRVWX]{2,8}\+[23456789CFGHJMPQRVWX]{0,3}$/i;

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
}: AppHeaderProps) {
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
  const collapsible = Boolean(scrollY) && showSearch;
  const topHeight = useSharedValue(0);
  const [collapsed, setCollapsed] = React.useState(false);
  const topStyle = useAnimatedStyle(() => {
    if (!scrollY || topHeight.value === 0) return {};
    const y = Math.max(0, scrollY.value);
    return {
      height: interpolate(y, [0, topHeight.value], [topHeight.value, 0], Extrapolation.CLAMP),
      opacity: interpolate(y, [0, topHeight.value * 0.6], [1, 0], Extrapolation.CLAMP),
    };
  });
  const accountStyle = useAnimatedStyle(() => {
    if (!scrollY || topHeight.value === 0) return { opacity: 1 };
    return { opacity: interpolate(scrollY.value, [topHeight.value * 0.5, topHeight.value], [1, 0], Extrapolation.CLAMP) };
  });
  const bagStyle = useAnimatedStyle(() => {
    if (!scrollY || topHeight.value === 0) return { opacity: 0 };
    return { opacity: interpolate(scrollY.value, [topHeight.value * 0.5, topHeight.value], [0, 1], Extrapolation.CLAMP) };
  });
  useAnimatedReaction(
    () => (scrollY && topHeight.value > 0 ? scrollY.value > topHeight.value * 0.75 : false),
    (next, prev) => {
      if (next !== prev) runOnJS(setCollapsed)(next);
    },
  );

  return (
    <View style={[styles.wrapper, { paddingTop: insets.top }]}>
      <Animated.View style={[collapsible && styles.collapsibleTop, collapsible && topStyle]}>
        <View
          onLayout={(e) => {
            if (collapsible) topHeight.value = e.nativeEvent.layout.height;
          }}
        >
          {showTicker && <LiveTicker />}
          <View style={[styles.masthead, compact && styles.mastheadCompact]}>
            {showBackToHome ? (
              <TouchableOpacity
                style={styles.backBtn}
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
              <Ionicons name="location-sharp" size={18} color={colors.light.primary} />
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

            <View style={styles.actions}>
              {!isNotificationsScreen && (
                <HeaderIcon
                  icon="notifications-outline"
                  onPress={handleNotificationsPress}
                />
              )}
              {!isWishlistScreen && (
                <HeaderIcon
                  icon="heart-outline"
                  badge={wishlistCount}
                  onPress={handleWishlistPress}
                />
              )}
              {!isCartScreen && (
                <HeaderIcon
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
        <View style={styles.searchRow}>
          <TouchableOpacity
            style={styles.searchBar}
            activeOpacity={0.85}
            onPress={() => router.push("/(main)/search")}
          >
            <Ionicons
              name="search"
              size={16}
              color={colors.light.mutedForeground}
              style={styles.searchIcon}
            />
            <Text style={styles.searchPlaceholder}>Search LUXE</Text>
          </TouchableOpacity>
          <View style={styles.trailingSlot}>
            <Animated.View
              style={[StyleSheet.absoluteFill, collapsible && accountStyle]}
              pointerEvents={collapsed ? "none" : "auto"}
            >
              <TouchableOpacity
                style={styles.accountBtn}
                activeOpacity={0.8}
                onPress={() => router.push("/(main)/account")}
                accessibilityLabel="Account"
              >
                <Ionicons name="person-outline" size={18} color={colors.light.foreground} />
              </TouchableOpacity>
            </Animated.View>
            {collapsible && !isCartScreen ? (
              <Animated.View
                style={[StyleSheet.absoluteFill, bagStyle]}
                pointerEvents={collapsed ? "auto" : "none"}
              >
                <TouchableOpacity
                  style={styles.accountBtn}
                  activeOpacity={0.8}
                  onPress={handleCartPress}
                  accessibilityLabel="Bag"
                >
                  <Ionicons name="bag-outline" size={18} color={colors.light.foreground} />
                  {cartCount > 0 ? (
                    <View style={styles.badge}>
                      <Label style={styles.badgeText}>{cartCount > 99 ? "99+" : String(cartCount)}</Label>
                    </View>
                  ) : null}
                </TouchableOpacity>
              </Animated.View>
            ) : null}
          </View>
        </View>
      ) : null}

      <View style={styles.hairline} />

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
                <Display size="lg" style={{ color: colors.light.foreground }}>Deliver to</Display>
                <Text style={styles.modalSub}>Choose where your order should arrive</Text>
              </View>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={styles.modalCloseBtn}
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={18} color={colors.light.foreground} />
              </TouchableOpacity>
            </View>

            {loadingAddresses && addresses.length === 0 ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={colors.light.primary} />
              </View>
            ) : addresses.length === 0 ? (
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIcon}>
                  <Ionicons name="location-outline" size={24} color={colors.olive[700]} />
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
                      <View style={[styles.radio, isCurrent && styles.radioActive]}>
                        {isSwitching ? (
                          <ActivityIndicator size="small" color={colors.light.primary} />
                        ) : isCurrent ? (
                          <View style={styles.radioDot} />
                        ) : null}
                      </View>
                      <View style={styles.addressInfo}>
                        <View style={styles.nameRow}>
                          <Ionicons
                            name={a.type === "home" ? "home-outline" : a.type === "work" ? "briefcase-outline" : "location-outline"}
                            size={14}
                            color={colors.olive[700]}
                          />
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
                      <TouchableOpacity
                        style={styles.editBtn}
                        onPress={() => goToAddresses(`?edit=${a.id}`)}
                        hitSlop={8}
                        accessibilityLabel={`Edit ${addressTypeLabel(a.type)} address`}
                      >
                        <Ionicons name="create-outline" size={17} color={colors.light.mutedForeground} />
                      </TouchableOpacity>
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
              <Ionicons name="add" size={18} color={colors.light.primaryForeground} />
              <Text style={styles.addAddressBtnText}>Add a new address</Text>
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
}: {
  icon: keyof typeof Ionicons.glyphMap;
  badge?: number;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.iconBtn} onPress={onPress} activeOpacity={0.7}>
      <Ionicons
        name={icon}
        size={22}
        color={colors.light.foreground}
      />
      {!!badge && badge > 0 && (
        <View style={styles.badge}>
          <Label style={styles.badgeText}>{badge > 99 ? "99+" : String(badge)}</Label>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: colors.light.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
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
    backgroundColor: colors.olive[50],
    alignItems: "center",
    justifyContent: "center",
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
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: colors.light.card,
    borderTopLeftRadius: radii["3xl"],
    borderTopRightRadius: radii["3xl"],
    paddingHorizontal: 20,
    paddingTop: 10,
    maxHeight: "80%",
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.light.border,
    alignSelf: "center",
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 16,
  },
  modalSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    color: colors.light.mutedForeground,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.olive[50],
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyContainer: {
    paddingVertical: 28,
    alignItems: "center",
    gap: 4,
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.olive[50],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  emptyTitle: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 15,
    color: colors.light.foreground,
  },
  emptyText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    color: colors.light.mutedForeground,
  },
  addressList: {
    marginBottom: 12,
  },
  addressOption: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 14,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.light.border,
    marginBottom: 10,
    gap: 12,
  },
  addressOptionActive: {
    borderColor: colors.light.primary,
    backgroundColor: colors.olive[50],
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.light.border,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  radioActive: {
    borderColor: colors.light.primary,
  },
  radioDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: colors.light.primary,
  },
  addressInfo: {
    flex: 1,
    gap: 3,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  addrType: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 15,
    color: colors.light.foreground,
  },
  defaultChip: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radii.full,
    backgroundColor: colors.olive[100],
  },
  defaultChipText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 10.5,
    color: colors.olive[800],
  },
  addrDetails: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.light.foreground,
  },
  addrMeta: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: colors.light.mutedForeground,
  },
  editBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -4,
    marginRight: -6,
  },
  addAddressBtn: {
    flexDirection: "row",
    height: 50,
    borderRadius: radii.full,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 4,
    backgroundColor: colors.light.primary,
  },
  addAddressBtnText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 15,
    color: colors.light.primaryForeground,
  },
  manageLink: {
    alignSelf: "center",
    paddingVertical: 12,
  },
  manageLinkText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: colors.light.primary,
  },
});
