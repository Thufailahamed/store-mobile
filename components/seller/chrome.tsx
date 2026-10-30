import React from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  type ViewStyle,
  type TextStyle,
  type StyleProp,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { C } from "@/components/orders/parcel-track";
import { Ionicons } from "@/components/ui/Icon";
import { colors, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { EmptyState } from "@/components/ui/EmptyState";
import { SellerBackButton } from "@/components/seller/SellerBackButton";

export const SELLER_CREAM = colors.paper.cream;
export const SELLER_INK = colors.olive[950];
export const SELLER_GOLD = colors.accent2.ochre;
export const SELLER_RUST = colors.accent2.rust;

/** Hairline olive border used across seller panels. */
export const sellerBorder = "rgba(83,94,44,0.12)";
export const sellerBorderStrong = "rgba(83,94,44,0.18)";

type ScreenHeaderProps = {
  kicker: string;
  title: string;
  meta?: string;
  backLabel?: string;
  backHref?: string;
  onBack?: () => void;
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** Warm top glow behind seller headers — same wash as the Orders screens. */
export function SellerGlow({ height = 320 }: { height?: number }) {
  return (
    <LinearGradient
      pointerEvents="none"
      colors={[C.glow, C.glow, C.glowSoft, C.paper]}
      locations={[0, 0.22, 0.6, 1]}
      style={[styles.glow, { height }]}
    />
  );
}

/** White round icon button used in seller headers (back, actions). */
export function SellerCircleButton({
  icon,
  onPress,
  accessibilityLabel,
  badge,
  style,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  accessibilityLabel: string;
  badge?: number | null;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <TouchableOpacity
      style={[styles.circleBtn, style]}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Ionicons name={icon} size={19} color={C.text} />
      {badge != null && badge > 0 ? (
        <View style={styles.circleBadge}>
          <Text style={styles.circleBadgeText}>{badge > 99 ? "99+" : badge}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

/**
 * Consistent top chrome, Orders-style: round back button, large display
 * title, optional round actions on the right and a muted subtitle line.
 */
export function SellerScreenHeader({
  kicker,
  title,
  meta,
  backLabel,
  backHref = "/(seller)",
  onBack,
  right,
  style,
}: ScreenHeaderProps) {
  const insets = useSafeAreaInsets();
  const sub = [kicker, meta].filter(Boolean).join(" · ");
  return (
    <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) + 8 }, style]}>
      <SellerGlow />
      <View style={styles.headerRow}>
        {backLabel ? (
          <SellerBackButton label={backLabel} fallbackHref={backHref} onPress={onBack} />
        ) : null}
        <View style={styles.headerTextCol}>
          <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
            {title}
          </Text>
        </View>
        {right ? <View style={styles.headerRight}>{right}</View> : null}
      </View>
      {sub ? <Text style={styles.headerSub} numberOfLines={1}>{sub}</Text> : null}
    </View>
  );
}

type SearchFieldProps = {
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

export function SellerSearchField({
  value,
  onChangeText,
  placeholder,
  accessibilityLabel,
  style,
}: SearchFieldProps) {
  return (
    <View style={[styles.searchWrap, style]}>
      <Ionicons name="search-outline" size={20} color={C.muted} />
      <TextInput
        style={styles.searchInput}
        placeholder={placeholder}
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor="#A1A1A6"
        returnKeyType="search"
        accessibilityLabel={accessibilityLabel ?? placeholder}
        clearButtonMode="never"
      />
      {value.length > 0 ? (
        <TouchableOpacity
          onPress={() => onChangeText("")}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel="Clear search"
          accessibilityRole="button"
        >
          <Ionicons name="close-circle" size={18} color={C.faint} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

/** Pill filter row — use inside a horizontal ScrollView/FlatList. */
export function SellerFilterTab({
  label,
  count,
  active,
  onPress,
}: {
  label: string;
  count?: number;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.filterTab, typeof count === "number" && styles.filterTabWithCount, active && styles.filterTabActive]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${label}${count ? `, ${count}` : ""}`}
      activeOpacity={0.75}
    >
      <Text style={[styles.filterTabText, active && styles.filterTabTextActive]}>{label}</Text>
      {typeof count === "number" ? (
        <View style={[styles.filterCount, active && styles.filterCountActive]}>
          <Text style={[styles.filterCountText, active && styles.filterCountTextActive]}>
            {count > 99 ? "99+" : count}
          </Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

export function SellerPanel({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.panel, style]}>{children}</View>;
}

export function SellerSectionHeader({
  kicker,
  title,
  actionLabel,
  onAction,
  style,
}: {
  kicker?: string;
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.sectionHeader, style]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        {kicker ? <Text style={styles.sectionKicker}>{kicker}</Text> : null}
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {actionLabel && onAction ? (
        <TouchableOpacity
          onPress={onAction}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <Text style={styles.sectionLink}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export function SellerStatusPill({
  label,
  bg,
  color,
  dotted,
  style,
}: {
  label: string;
  bg: string;
  color: string;
  dotted?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.statusPill, { backgroundColor: bg }, style]}>
      {dotted ? <View style={[styles.statusDot, { backgroundColor: color }]} /> : null}
      <Text style={[styles.statusPillText, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

type StateViewProps = {
  variant: "empty" | "error";
  title: string;
  description?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  actionLabel?: string;
  onAction?: () => void;
  style?: ViewStyle;
};

export function SellerStateView({
  variant,
  title,
  description,
  icon,
  actionLabel,
  onAction,
  style,
}: StateViewProps) {
  const resolvedIcon =
    icon ?? (variant === "error" ? "cloud-offline-outline" : "leaf-outline");
  return (
    <EmptyState
      icon={resolvedIcon}
      title={title}
      description={description}
      style={style}
      action={
        actionLabel && onAction ? (
          <TouchableOpacity
            style={styles.stateCta}
            onPress={onAction}
            accessibilityRole="button"
            activeOpacity={0.85}
          >
            <Text style={styles.stateCtaText}>{actionLabel}</Text>
          </TouchableOpacity>
        ) : undefined
      }
    />
  );
}

export function SellerStickyBar({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.stickyBar,
        { paddingBottom: Math.max(insets.bottom, 12) + 8 },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function SellerPrimaryButton({
  label,
  onPress,
  disabled,
  loading,
  style,
  textStyle,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.primaryBtn,
        (disabled || loading) && styles.primaryBtnDisabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled || loading) }}
      activeOpacity={0.85}
    >
      <Text style={[styles.primaryBtnText, textStyle]}>
        {loading ? "Working…" : label}
      </Text>
    </TouchableOpacity>
  );
}

export function SellerGhostButton({
  label,
  onPress,
  disabled,
  style,
  danger,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  danger?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.ghostBtn,
        danger && styles.ghostBtnDanger,
        disabled && styles.primaryBtnDisabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      activeOpacity={0.85}
    >
      <Text style={[styles.ghostBtnText, danger && styles.ghostBtnTextDanger]}>{label}</Text>
    </TouchableOpacity>
  );
}

/** 2×2 shortcut grid for More / Home tools. */
export function SellerShortcutGrid({
  items,
}: {
  items: Array<{
    key: string;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    onPress: () => void;
    badge?: number | null;
    tone?: "default" | "warn" | "critical";
  }>;
}) {
  return (
    <View style={styles.shortcutGrid}>
      {items.map((item) => {
        const toneBorder =
          item.tone === "critical"
            ? "rgba(184,92,58,0.28)"
            : item.tone === "warn"
              ? "rgba(200,164,74,0.4)"
              : C.line;
        return (
          <TouchableOpacity
            key={item.key}
            style={[styles.shortcutTile, { borderColor: toneBorder }]}
            onPress={item.onPress}
            activeOpacity={0.78}
            accessibilityRole="button"
            accessibilityLabel={item.label}
          >
            <View style={styles.shortcutIconWrap}>
              <Ionicons name={item.icon} size={20} color={C.accent} />
              {item.badge != null && item.badge > 0 ? (
                <View style={styles.shortcutBadge}>
                  <Text style={styles.shortcutBadgeText}>
                    {item.badge > 99 ? "99+" : item.badge}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.shortcutLabel}>{item.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const cardShadow = {
  shadowColor: "#16170f",
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.06,
  shadowRadius: 20,
  elevation: 3,
} as const;

const styles = StyleSheet.create({
  glow: { position: "absolute", top: 0, left: 0, right: 0 },
  header: {
    paddingHorizontal: spacing[5],
    paddingBottom: 14,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerTextCol: { flex: 1, minWidth: 0 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerSub: {
    marginTop: 6,
    fontFamily: fontFamilies.sans.medium,
    fontSize: 13,
    color: C.muted,
  },
  title: {
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
  circleBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: C.rust,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  circleBadgeText: { fontFamily: fontFamilies.sans.bold, fontSize: 9, color: "#FFFFFF" },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    height: 56,
    paddingHorizontal: 20,
    gap: 10,
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    shadowColor: "#16170f",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 3,
  },
  searchInput: {
    flex: 1,
    fontFamily: fontFamilies.sans.medium,
    fontSize: 15,
    color: C.text,
    padding: 0,
  },
  filterTab: {
    flexDirection: "row",
    alignItems: "center",
    height: 46,
    paddingLeft: 18,
    paddingRight: 18,
    borderRadius: 23,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: C.line,
    gap: 8,
  },
  filterTabWithCount: { paddingRight: 12 },
  filterTabActive: {
    backgroundColor: C.ink,
    borderColor: C.ink,
  },
  filterTabText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 14,
    color: C.text,
  },
  filterTabTextActive: {
    color: C.cream,
  },
  filterCount: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.accentSoft,
  },
  filterCountActive: { backgroundColor: "rgba(200,224,138,0.18)" },
  filterCountText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 11.5,
    color: C.muted,
  },
  filterCountTextActive: { color: C.lime },
  panel: {
    backgroundColor: "#FFFFFF",
    borderRadius: 26,
    borderWidth: 1,
    borderColor: C.line,
    overflow: "hidden",
    ...cardShadow,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },
  sectionKicker: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: C.accent,
    marginBottom: 4,
  },
  sectionTitle: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 18,
    color: C.text,
    letterSpacing: -0.3,
  },
  sectionLink: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: C.accent,
    paddingBottom: 2,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    height: 26,
    borderRadius: 13,
    maxWidth: 160,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusPillText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  stateCta: {
    minHeight: 46,
    paddingHorizontal: 22,
    borderRadius: 23,
    backgroundColor: C.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  stateCtaText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 14,
    color: C.cream,
  },
  stickyBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: spacing[5],
    paddingTop: 12,
    backgroundColor: "rgba(255,255,255,0.96)",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.line,
  },
  primaryBtn: {
    flex: 1,
    minHeight: 52,
    borderRadius: 26,
    backgroundColor: C.ink,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  primaryBtnDisabled: { opacity: 0.45 },
  primaryBtnText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 14,
    color: C.cream,
  },
  ghostBtn: {
    minHeight: 52,
    paddingHorizontal: 18,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "rgba(22,23,15,0.12)",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  ghostBtnDanger: {
    borderColor: "rgba(184,92,58,0.3)",
    backgroundColor: "rgba(184,92,58,0.05)",
  },
  ghostBtnText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 14,
    color: C.text,
  },
  ghostBtnTextDanger: {
    color: C.rust,
  },
  shortcutGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  shortcutTile: {
    width: "47.5%",
    flexGrow: 1,
    minHeight: 96,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    justifyContent: "space-between",
    gap: 12,
    ...cardShadow,
  },
  shortcutIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: C.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  shortcutBadge: {
    position: "absolute",
    top: -5,
    right: -5,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: C.rust,
    alignItems: "center",
    justifyContent: "center",
  },
  shortcutBadgeText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 9,
    color: C.cream,
  },
  shortcutLabel: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 14.5,
    color: C.text,
  },
});
