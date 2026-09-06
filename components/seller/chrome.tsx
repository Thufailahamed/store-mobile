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
import { Ionicons } from "@/components/ui/Icon";
import { colors, typography, radii, spacing } from "@/lib/theme/tokens";
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

/** Consistent top chrome: optional back, editorial kicker/title, meta, actions. */
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
  return (
    <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) + 6 }, style]}>
      {backLabel ? (
        <SellerBackButton
          label={backLabel}
          fallbackHref={backHref}
          onPress={onBack}
          style={styles.headerBack}
        />
      ) : null}
      <View style={styles.headerRow}>
        <View style={styles.headerTextCol}>
          <Text style={styles.kicker}>{kicker}</Text>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        </View>
        {(meta || right) && (
          <View style={styles.headerRight}>
            {meta ? <Text style={styles.meta}>{meta}</Text> : null}
            {right}
          </View>
        )}
      </View>
      <View style={styles.goldRule} />
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
      <Ionicons name="search" size={16} color={colors.ink.mute} />
      <TextInput
        style={styles.searchInput}
        placeholder={placeholder}
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor={colors.ink.mute}
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
          <Ionicons name="close-circle" size={18} color={colors.ink.mute} />
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
      style={[styles.filterTab, active && styles.filterTabActive]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${label}${count ? `, ${count}` : ""}`}
      activeOpacity={0.75}
    >
      <Text style={[styles.filterTabText, active && styles.filterTabTextActive]}>{label}</Text>
      {typeof count === "number" && count > 0 ? (
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
              : sellerBorder;
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
              <Ionicons name={item.icon} size={20} color={colors.olive[800]} />
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

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[2],
    backgroundColor: colors.light.background,
  },
  headerBack: { marginBottom: 4 },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
  },
  headerTextCol: { flex: 1, minWidth: 0 },
  headerRight: {
    alignItems: "flex-end",
    gap: 8,
    paddingBottom: 4,
  },
  kicker: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: typography.letterSpacing.editorial,
    textTransform: "uppercase",
    color: colors.olive[700],
    marginBottom: 2,
  },
  title: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 28,
    color: SELLER_INK,
    letterSpacing: -0.45,
  },
  meta: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 11,
    letterSpacing: 0.35,
    color: colors.olive[700],
  },
  goldRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(200,164,74,0.55)",
    marginTop: spacing[3],
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 46,
    paddingHorizontal: 14,
    gap: 10,
    backgroundColor: SELLER_CREAM,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: sellerBorderStrong,
  },
  searchInput: {
    flex: 1,
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.sm,
    color: SELLER_INK,
    paddingVertical: 11,
  },
  filterTab: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 38,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.full,
    backgroundColor: SELLER_CREAM,
    borderWidth: 1,
    borderColor: sellerBorderStrong,
    gap: 6,
  },
  filterTabActive: {
    backgroundColor: colors.olive[900],
    borderColor: colors.olive[900],
  },
  filterTabText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: typography.fontSizes.xs,
    color: colors.olive[800],
  },
  filterTabTextActive: {
    color: SELLER_CREAM,
    fontFamily: fontFamilies.sans.semibold,
  },
  filterCount: {
    backgroundColor: "rgba(83,94,44,0.1)",
    borderRadius: radii.full,
    paddingHorizontal: 6,
    paddingVertical: 1,
    minWidth: 20,
    alignItems: "center",
  },
  filterCountActive: { backgroundColor: "rgba(250,248,241,0.18)" },
  filterCountText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    color: colors.olive[800],
  },
  filterCountTextActive: { color: SELLER_CREAM },
  panel: {
    backgroundColor: SELLER_CREAM,
    borderRadius: radii["2xl"],
    borderWidth: 1,
    borderColor: sellerBorder,
    overflow: "hidden",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },
  sectionKicker: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: typography.letterSpacing.editorial,
    textTransform: "uppercase",
    color: colors.ink.mute,
    marginBottom: 2,
  },
  sectionTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 20,
    color: SELLER_INK,
    letterSpacing: -0.3,
  },
  sectionLink: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.sm,
    color: colors.olive[800],
    paddingBottom: 2,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radii.full,
    maxWidth: 140,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  statusPillText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  stateCta: {
    minHeight: 44,
    paddingHorizontal: 22,
    borderRadius: radii.full,
    backgroundColor: colors.olive[900],
    alignItems: "center",
    justifyContent: "center",
  },
  stateCtaText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.sm,
    color: SELLER_CREAM,
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
    backgroundColor: "rgba(245,244,239,0.96)",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: sellerBorder,
  },
  primaryBtn: {
    flex: 1,
    minHeight: 50,
    borderRadius: radii.full,
    backgroundColor: colors.olive[900],
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  primaryBtnDisabled: { opacity: 0.45 },
  primaryBtnText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.sm,
    color: SELLER_CREAM,
    letterSpacing: 0.15,
  },
  ghostBtn: {
    minHeight: 50,
    paddingHorizontal: 16,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: sellerBorderStrong,
    backgroundColor: SELLER_CREAM,
    alignItems: "center",
    justifyContent: "center",
  },
  ghostBtnDanger: {
    borderColor: "rgba(184,92,58,0.35)",
    backgroundColor: "rgba(184,92,58,0.06)",
  },
  ghostBtnText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.sm,
    color: colors.olive[900],
  },
  ghostBtnTextDanger: {
    color: SELLER_RUST,
  },
  shortcutGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  shortcutTile: {
    width: "47.5%",
    flexGrow: 1,
    minHeight: 88,
    backgroundColor: SELLER_CREAM,
    borderRadius: radii["2xl"],
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    justifyContent: "space-between",
    gap: 12,
  },
  shortcutIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: colors.olive[50],
    borderWidth: 1,
    borderColor: sellerBorder,
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
    backgroundColor: SELLER_RUST,
    alignItems: "center",
    justifyContent: "center",
  },
  shortcutBadgeText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    color: SELLER_CREAM,
  },
  shortcutLabel: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.sm,
    color: SELLER_INK,
  },
});
