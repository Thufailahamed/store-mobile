import React from "react";
import { View, TouchableOpacity, StyleSheet, Text } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Label } from "@/components/ui/Typography";
import { LiveTicker } from "./LiveTicker";
import { useCart } from "@/lib/stores";
import { colors, radii, typography } from "@/lib/theme/tokens";
import { useAuth } from "@/lib/supabase/auth";
import { getAddresses } from "@/lib/api";
import { fontFamilies } from "@/lib/theme/fonts";

interface AppHeaderProps {
  showTicker?: boolean;
  showSearch?: boolean;
  compact?: boolean;
}

export function AppHeader({ showTicker = true, showSearch = true, compact = false }: AppHeaderProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const cartCount = useCart((s) => s.itemCount());
  const { user } = useAuth();
  const [addressText, setAddressText] = React.useState("1226 University Dr");

  React.useEffect(() => {
    if (user?.id) {
      getAddresses(user.id).then((res) => {
        if (res.ok && res.data && res.data.length > 0) {
          const defaultAddr = res.data.find((a) => a.is_default) || res.data[0];
          const text = `${defaultAddr.line1}${defaultAddr.city ? `, ${defaultAddr.city}` : ""}`;
          setAddressText(text);
        }
      });
    }
  }, [user?.id]);

  const handleAddressPress = () => {
    if (!user) {
      router.push("/(auth)/login");
    } else {
      router.push("/(main)/account/addresses");
    }
  };

  const handleNotificationsPress = () => {
    router.push("/(main)/notifications");
  };

  const handleCartPress = () => {
    router.push("/(main)/cart");
  };

  return (
    <View style={[styles.wrapper, { paddingTop: insets.top }]}>
      {showTicker && <LiveTicker />}
      <View style={[styles.masthead, compact && styles.mastheadCompact]}>
        <TouchableOpacity
          style={styles.locationSelector}
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
          <HeaderIcon
            icon="notifications-outline"
            onPress={handleNotificationsPress}
          />
          <HeaderIcon
            icon="bag-outline"
            badge={cartCount}
            onPress={handleCartPress}
          />
        </View>
      </View>

      {showSearch && (
        <View style={styles.searchRow}>
          <TouchableOpacity
            style={styles.searchBar}
            activeOpacity={0.8}
            onPress={() => router.push("/(main)/search")}
          >
            <Ionicons
              name="search-outline"
              size={18}
              color={colors.light.mutedForeground}
              style={styles.searchIcon}
            />
            <Text style={styles.searchPlaceholder}>Search "Luxe Ateliers"...</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.mapBtn}
            activeOpacity={0.8}
            onPress={() => router.push("/(main)/products")}
          >
            <Ionicons name="map-outline" size={20} color={colors.light.foreground} />
          </TouchableOpacity>
        </View>
      )}
      <View style={styles.hairline} />
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
  locationSelector: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
    marginRight: 16,
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
