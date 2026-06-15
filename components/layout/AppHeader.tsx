import React from "react";
import { View, TouchableOpacity, StyleSheet, Text, Modal, ScrollView, ActivityIndicator, Pressable } from "react-native";
import { useRouter, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Label, Body, Display } from "@/components/ui/Typography";
import { LiveTicker } from "./LiveTicker";
import { useCart, useWishlist } from "@/lib/stores";
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
}

export function AppHeader({
  showTicker = true,
  showSearch = true,
  compact = false,
  showBackToHome = false,
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
  const [addressText, setAddressText] = React.useState("1226 University Dr");
  const [modalVisible, setModalVisible] = React.useState(false);
  const [addresses, setAddresses] = React.useState<Address[]>([]);
  const [loadingAddresses, setLoadingAddresses] = React.useState(false);

  React.useEffect(() => {
    if (user?.id) {
      getAddresses(user.id).then((res) => {
        if (res.ok && res.data && res.data.length > 0) {
          const defaultAddr = res.data.find((a) => a.is_default) || res.data[0];
          const text = `${defaultAddr.line1}${defaultAddr.city ? `, ${defaultAddr.city}` : ""}`;
          setAddressText(text);
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

  const handleSelectAddress = async (addr: Address) => {
    const text = `${addr.line1}${addr.city ? `, ${addr.city}` : ""}`;
    setAddressText(text);
    setModalVisible(false);

    try {
      for (const a of addresses) {
        if (a.is_default && a.id !== addr.id) {
          await updateAddress(a.id, { is_default: false });
        }
      }
      await updateAddress(addr.id, { is_default: true });
      const res = await getAddresses(user!.id);
      if (res.ok && res.data) {
        setAddresses(res.data);
      }
    } catch (err) {
      console.error("Failed to update default address:", err);
    }
  };

  const handleNotificationsPress = () => {
    router.push("/(main)/notifications");
  };

  const handleWishlistPress = () => {
    router.push("/(main)/wishlist");
  };

  const handleCartPress = () => {
    router.push("/(main)/cart");
  };

  return (
    <View style={[styles.wrapper, { paddingTop: insets.top }]}>
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
        >
          <Ionicons name="location-sharp" size={18} color={colors.light.foreground} />
          <Text style={styles.locationText} numberOfLines={1}>
            {addressText}
          </Text>
          <Ionicons name="chevron-down" size={14} color={colors.light.foreground} />
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
          <TouchableOpacity
            style={styles.accountBtn}
            activeOpacity={0.8}
            onPress={() => router.push("/(main)/account")}
          >
            <Ionicons
              name="person-outline"
              size={18}
              color={colors.light.foreground}
            />
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.hairline} />

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable 
          style={styles.modalOverlay} 
          onPress={() => setModalVisible(false)}
        >
          <View style={[styles.modalSheet, { backgroundColor: colors.light.card, paddingBottom: Math.max(insets.bottom, 20) }]}>
            <View style={styles.modalHandle} />
            
            <View style={styles.modalHeader}>
              <Display size="lg" style={{ color: colors.light.foreground }}>Select Address</Display>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color={colors.light.foreground} />
              </TouchableOpacity>
            </View>

            {loadingAddresses ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={colors.light.primary} />
              </View>
            ) : addresses.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="location-outline" size={32} color={colors.light.mutedForeground} />
                <Body muted style={styles.emptyText}>No saved addresses found</Body>
              </View>
            ) : (
              <ScrollView style={styles.addressList} showsVerticalScrollIndicator={false}>
                {addresses.map((a) => {
                  const isCurrent = a.is_default || addressText.startsWith(a.line1);
                  return (
                    <TouchableOpacity
                      key={a.id}
                      style={[
                        styles.addressOption,
                        { borderColor: colors.light.border },
                        isCurrent && { borderColor: colors.light.primary, backgroundColor: colors.olive[50] }
                      ]}
                      onPress={() => handleSelectAddress(a)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.addressLeft}>
                        <View style={[styles.optionTypeIcon, { backgroundColor: colors.olive[50] }]}>
                          <Ionicons 
                            name={a.type === "home" ? "home-outline" : a.type === "work" ? "briefcase-outline" : "location-outline"} 
                            size={16} 
                            color={colors.light.primary} 
                          />
                        </View>
                        <View style={styles.addressInfo}>
                          <View style={styles.nameRow}>
                            <Label style={{ color: colors.light.foreground, fontSize: 13 }}>{a.full_name}</Label>
                            <Label style={styles.addrTypeTag}>{a.type.toUpperCase()}</Label>
                          </View>
                          <Body size="xs" muted style={styles.addrDetails} numberOfLines={2}>
                            {a.line1}{a.line2 ? `, ${a.line2}` : ""}, {a.city}, {a.state}
                          </Body>
                          <Body size="xs" muted style={styles.addrPhone}>
                            Phone: {a.phone}
                          </Body>
                        </View>
                      </View>
                      {isCurrent && (
                        <Ionicons name="checkmark-circle" size={20} color={colors.light.primary} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            <TouchableOpacity 
              style={[styles.addAddressBtn, { backgroundColor: colors.light.primary }]}
              onPress={() => {
                setModalVisible(false);
                router.push("/(main)/account/addresses");
              }}
              activeOpacity={0.85}
            >
              <Ionicons name="add" size={18} color={colors.light.primaryForeground} />
              <Label style={[styles.addAddressBtnText, { color: colors.light.primaryForeground }]}>Manage & Add Address</Label>
            </TouchableOpacity>
          </View>
        </Pressable>
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
      <Ionicons name={icon} size={22} color={colors.light.foreground} />
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
  locationText: {
    color: colors.light.foreground,
    fontFamily: fontFamilies.sans.bold,
    fontSize: 16,
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
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    borderTopLeftRadius: radii["3xl"],
    borderTopRightRadius: radii["3xl"],
    padding: 20,
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
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
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
    paddingVertical: 40,
    alignItems: "center",
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
  },
  addressList: {
    marginBottom: 16,
  },
  addressOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: radii.xl,
    borderWidth: 1,
    marginBottom: 10,
    gap: 12,
  },
  addressLeft: {
    flexDirection: "row",
    gap: 10,
    flex: 1,
  },
  optionTypeIcon: {
    width: 32,
    height: 32,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
  addressInfo: {
    flex: 1,
    gap: 2,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  addrTypeTag: {
    fontSize: 8,
    color: colors.light.mutedForeground,
    backgroundColor: colors.olive[100],
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: radii.sm,
    fontFamily: fontFamilies.mono.semibold,
  },
  addrDetails: {
    lineHeight: 16,
  },
  addrPhone: {
    marginTop: 2,
  },
  addAddressBtn: {
    flexDirection: "row",
    height: 48,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 8,
  },
  addAddressBtnText: {
    fontSize: 14,
    fontFamily: fontFamilies.sans.bold,
  },
});
