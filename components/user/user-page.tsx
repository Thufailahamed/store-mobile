/**
 * Shared chrome for buyer ("user") pages, matching the My Orders design:
 * paper background with a gold glow, round white header buttons, a large
 * serif title, and a soft mask that keeps the status bar legible.
 *
 * Pages keep their own scroll container (ScrollView / FlatList) as children.
 */
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@/components/ui/Icon";
import { fontFamilies } from "@/lib/theme/fonts";
import { colors } from "@/lib/theme/tokens";
import { C } from "@/components/orders/parcel-track";

export { C as UP };

export function HeaderButton({
  icon,
  onPress,
  label,
  loading,
  disabled,
  badge,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  label: string;
  loading?: boolean;
  disabled?: boolean;
  badge?: number;
}) {
  return (
    <TouchableOpacity
      style={s.circleBtn}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {loading ? <ActivityIndicator size="small" color={C.accent} /> : <Ionicons name={icon} size={19} color={C.text} />}
      {badge ? (
        <View style={s.badge}>
          <Text style={s.badgeText}>{badge > 99 ? "99+" : badge}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

export function UserHeader({
  title,
  onBack,
  right,
  hideBack,
}: {
  title: string;
  onBack?: () => void;
  right?: React.ReactNode;
  hideBack?: boolean;
}) {
  const router = useRouter();
  return (
    <View style={s.header}>
      {hideBack ? null : (
        <HeaderButton icon="chevron-back" label="Go back" onPress={onBack ?? (() => router.back())} />
      )}
      <Text style={s.title} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} accessibilityRole="header">
        {title}
      </Text>
      {right ? <View style={s.right}>{right}</View> : null}
    </View>
  );
}

/** Root frame: background + glow + safe-area header. Children render below the header. */
export function UserPageFrame({
  title,
  onBack,
  right,
  hideBack,
  children,
}: {
  title: string;
  onBack?: () => void;
  right?: React.ReactNode;
  hideBack?: boolean;
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={s.root}>
      <LinearGradient
        pointerEvents="none"
        colors={[C.glow, C.glowSoft, C.paper]}
        locations={[0, 0.55, 1]}
        style={s.glow}
      />
      <View style={{ paddingTop: insets.top }}>
        <UserHeader title={title} onBack={onBack} right={right} hideBack={hideBack} />
      </View>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

/* ── Content pieces ─────────────────────────────────────────────────── */

export function SectionHead({
  kicker,
  title,
  action,
  onAction,
  style,
}: {
  kicker?: string;
  title: string;
  action?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[s.sectionHead, style]}>
      <View style={{ flex: 1 }}>
        {/* The title carries the section; the kicker reads as noise in the
            Orders language, so it's kept only as an accessibility hint. */}
        <Text style={s.sectionTitle} accessibilityHint={kicker}>
          {title}
        </Text>
      </View>
      {action && onAction ? (
        <TouchableOpacity onPress={onAction} hitSlop={8} style={s.sectionAction} activeOpacity={0.75}>
          <Text style={s.sectionActionText}>{action}</Text>
          <Ionicons name="chevron-forward" size={13} color={C.accent} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export function UserCard({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[userTheme.card, style]}>{children}</View>;
}

export function MenuRow({
  icon,
  label,
  sub,
  onPress,
  first,
  right,
  danger,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub?: string;
  onPress?: () => void;
  first?: boolean;
  right?: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [s.row, !first && s.rowDivider, pressed && { opacity: 0.7 }]}
      accessibilityRole={onPress ? "button" : undefined}
    >
      <View style={[s.rowIcon, danger && { backgroundColor: "rgba(184,92,58,0.1)" }]}>
        <Ionicons name={icon} size={18} color={danger ? C.rust : C.text} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[s.rowLabel, danger && { color: C.rust }]} numberOfLines={1}>
          {label}
        </Text>
        {sub ? (
          <Text style={s.rowSub} numberOfLines={2}>
            {sub}
          </Text>
        ) : null}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={16} color={C.faint} /> : null)}
    </Pressable>
  );
}

export function FilterChips<K extends string>({
  items,
  value,
  onChange,
}: {
  items: { key: K; label: string; count?: number }[];
  value: K;
  onChange: (k: K) => void;
}) {
  return (
    <View style={s.chipsRow}>
      {items.map((t) => {
        const on = value === t.key;
        return (
          <Pressable
            key={t.key}
            onPress={() => onChange(t.key)}
            style={[s.chip, on && s.chipOn]}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
          >
            <Text style={[s.chipText, on && s.chipTextOn]}>{t.label}</Text>
            {typeof t.count === "number" ? (
              <View style={[s.chipCount, on && s.chipCountOn]}>
                <Text style={[s.chipCountText, on && s.chipCountTextOn]}>{t.count}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export function DarkCta({
  icon,
  title,
  sub,
  onPress,
  style,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  sub?: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <TouchableOpacity style={[s.darkCta, style]} onPress={onPress} activeOpacity={0.88} accessibilityRole="button">
      <View style={s.darkCtaIcon}>
        <Ionicons name={icon} size={17} color={C.ink} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.darkCtaTitle}>{title}</Text>
        {sub ? <Text style={s.darkCtaSub}>{sub}</Text> : null}
      </View>
      <Ionicons name="arrow-forward" size={17} color={C.lime} />
    </TouchableOpacity>
  );
}

export function EmptyCard({
  icon,
  title,
  sub,
  action,
  onAction,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  sub?: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={s.empty}>
      <View style={s.emptyArt}>
        <Ionicons name={icon} size={30} color={C.accent} />
      </View>
      <Text style={s.emptyTitle}>{title}</Text>
      {sub ? <Text style={s.emptySub}>{sub}</Text> : null}
      {action && onAction ? (
        <TouchableOpacity style={s.emptyBtn} onPress={onAction} activeOpacity={0.85}>
          <Text style={s.emptyBtnText}>{action}</Text>
          <Ionicons name="arrow-forward" size={15} color={C.lime} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

/**
 * Theme tokens pages spread into their own StyleSheets so existing layouts
 * pick up the orders look without rewriting their structure.
 */
export const userTheme = StyleSheet.create({
  card: {
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: C.line,
    shadowColor: "#16170f",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 3,
  },
  softBlock: {
    borderRadius: 24,
    backgroundColor: "#faf9f4",
    borderWidth: 1,
    borderColor: C.line,
  },
  darkBlock: { borderRadius: 24, backgroundColor: C.ink },
  primaryBtn: {
    height: 52,
    borderRadius: 26,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: C.ink,
  },
  primaryBtnText: { fontFamily: fontFamilies.sans.bold, fontSize: 14.5, color: C.cream },
  outlineBtn: {
    height: 50,
    borderRadius: 25,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(22,23,15,0.12)",
    backgroundColor: "#FFFFFF",
  },
  outlineBtnText: { fontFamily: fontFamilies.sans.bold, fontSize: 14, color: C.text },
  kicker: { fontFamily: fontFamilies.mono.semibold, fontSize: 10, letterSpacing: 1.8, color: C.accent },
  heading: { fontFamily: fontFamilies.sans.bold, fontSize: 19, letterSpacing: -0.4, color: C.text },
  body: { fontFamily: fontFamilies.sans.regular, fontSize: 13.5, lineHeight: 19, color: C.muted },
  field: {
    minHeight: 54,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: "#efede4",
    borderWidth: 1.5,
    borderColor: "transparent",
    fontFamily: fontFamilies.sans.medium,
    fontSize: 15,
    color: C.text,
  },
});

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.paper },
  glow: { position: "absolute", top: 0, left: 0, right: 0, height: 360 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  title: {
    flex: 1,
    fontFamily: fontFamilies.display.semibold,
    fontSize: 29,
    letterSpacing: -0.8,
    color: C.text,
  },
  right: { flexDirection: "row", gap: 8 },
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
  badge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: C.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontFamily: fontFamilies.sans.bold, fontSize: 9.5, color: C.lime },

  sectionHead: { flexDirection: "row", alignItems: "flex-end", marginTop: 24, marginBottom: 12, paddingHorizontal: 2 },
  sectionKicker: { fontFamily: fontFamilies.mono.semibold, fontSize: 10, letterSpacing: 1.8, color: C.accent },
  sectionTitle: { fontFamily: fontFamilies.sans.bold, fontSize: 19, letterSpacing: -0.4, color: C.text },
  sectionAction: { flexDirection: "row", alignItems: "center", gap: 2, paddingBottom: 2 },
  sectionActionText: { fontFamily: fontFamilies.sans.semibold, fontSize: 13.5, color: C.accent },

  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13 },
  rowDivider: { borderTopWidth: 1, borderTopColor: C.line },
  rowIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: C.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: { fontFamily: fontFamilies.sans.bold, fontSize: 15, letterSpacing: -0.2, color: C.text },
  rowSub: { fontFamily: fontFamilies.sans.regular, fontSize: 12.5, color: C.muted, marginTop: 1 },

  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 42,
    paddingHorizontal: 16,
    borderRadius: 21,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: C.line,
  },
  chipOn: { backgroundColor: C.ink, borderColor: C.ink },
  chipText: { fontFamily: fontFamilies.sans.semibold, fontSize: 13.5, color: C.text },
  chipTextOn: { color: C.cream },
  chipCount: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.accentSoft,
  },
  chipCountOn: { backgroundColor: "rgba(200,224,138,0.18)" },
  chipCountText: { fontFamily: fontFamilies.sans.semibold, fontSize: 11, color: C.muted },
  chipCountTextOn: { color: C.lime },

  darkCta: {
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

  empty: {
    alignItems: "center",
    paddingVertical: 36,
    paddingHorizontal: 26,
    borderRadius: 26,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: C.line,
    gap: 8,
  },
  emptyArt: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: C.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  emptyTitle: { fontFamily: fontFamilies.sans.bold, fontSize: 18, letterSpacing: -0.3, color: C.text, textAlign: "center" },
  emptySub: { fontFamily: fontFamilies.sans.regular, fontSize: 13.5, lineHeight: 19, color: C.muted, textAlign: "center" },
  emptyBtn: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 46,
    paddingHorizontal: 22,
    borderRadius: 23,
    backgroundColor: C.ink,
  },
  emptyBtnText: { fontFamily: fontFamilies.sans.bold, fontSize: 14, color: C.cream },
});


/* ── Theme layering for existing page StyleSheets ───────────────────── */

type Style = Record<string, unknown>;

/**
 * Per-key overrides applied on top of a page's own styles. Only visual
 * properties (colour, radius, border, type) — layout stays the page's own.
 */
const OVERRIDES: Record<string, Style> = {
  // Old header buttons now sit in the new header — render them as round white buttons.
  navBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#FFFFFF",
    borderWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#16170f",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 3,
  },
  get headerBtn() {
    return OVERRIDES.navBtn;
  },
  get headerSide() {
    return OVERRIDES.navBtn;
  },
  // The frame paints the paper + glow; page roots must stay see-through.
  container: { backgroundColor: "transparent" },
  safeArea: { backgroundColor: "transparent" },
  screen: { backgroundColor: "transparent" },
  // In-body page titles duplicate the header title, so they're hidden.
  pageTitle: { display: "none" },
  eyebrow: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    letterSpacing: 0,
    textTransform: "none",
    color: C.muted,
  },
  pageSub: { fontFamily: fontFamilies.sans.regular, fontSize: 14, lineHeight: 20, color: C.muted },
  pageHead: { paddingTop: 0, marginTop: 0 },

  card: { borderRadius: 24, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: C.line },
  cardTitle: { fontFamily: fontFamilies.sans.bold, letterSpacing: -0.3, color: C.text },
  emptyCard: { borderRadius: 26, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: C.line },
  emptyIcon: { backgroundColor: C.accentSoft },
  emptyTitle: { fontFamily: fontFamilies.sans.bold, letterSpacing: -0.3, color: C.text },
  emptySub: { fontFamily: fontFamilies.sans.regular, color: C.muted },

  primaryBtn: { borderRadius: 26, backgroundColor: C.ink },
  primaryBtnText: { fontFamily: fontFamilies.sans.bold, color: C.cream },
  primaryBtnArrow: { backgroundColor: C.lime },

  statsStrip: { borderRadius: 22, backgroundColor: C.ink, borderWidth: 0 },
  statNum: { fontFamily: fontFamilies.sans.bold, color: C.cream },
  statNumMuted: { color: "rgba(250,248,241,0.45)" },
  // statDivider is resolved in withUserTheme: pages use it either as a 1px
  // View (needs a fill) or as a border on the stat cell (must stay unfilled).

  segmented: { borderRadius: 16, backgroundColor: "#efede4", borderWidth: 0 },
  segment: { borderRadius: 12 },
  segmentActive: { backgroundColor: C.ink },
  segmentText: { fontFamily: fontFamilies.sans.semibold, color: C.muted },
  segmentTextActive: { color: C.cream },

  fieldLabel: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    letterSpacing: 0,
    textTransform: "none",
    color: C.text,
  },
  input: { borderRadius: 16, backgroundColor: "#efede4", borderColor: "transparent", fontFamily: fontFamilies.sans.medium, color: C.text },
  textLinkText: { fontFamily: fontFamilies.sans.semibold, color: C.accent },
  loadingText: { fontFamily: fontFamilies.sans.medium, color: C.muted },
};

/** Statistic labels only go light when the page uses the dark stats strip. */
const STRIP_LABEL: Style = {
  color: "rgba(250,248,241,0.6)",
  fontFamily: fontFamilies.sans.medium,
  fontSize: 12,
  letterSpacing: 0,
  textTransform: "none",
};
const STRIP_RULE = "rgba(250,248,241,0.12)";

export function withUserTheme<T extends Record<string, unknown>>(base: T): T {
  const out: Record<string, unknown> = { ...base };
  for (const key of Object.keys(base)) {
    const o = OVERRIDES[key];
    if (o) out[key] = { ...(StyleSheet.flatten(base[key] as never) as Style), ...o };
  }
  if ("statsStrip" in base && "statLabel" in base) {
    out.statLabel = { ...(StyleSheet.flatten(base.statLabel as never) as Style), ...STRIP_LABEL };
  }
  if ("statDivider" in base) {
    const d = StyleSheet.flatten(base.statDivider as never) as Style;
    // A border-style divider sits on the stat cell itself — filling it would
    // paint that whole cell a different shade from the strip.
    out.statDivider =
      "borderLeftWidth" in d || "borderTopWidth" in d
        ? { ...d, borderLeftColor: STRIP_RULE, borderColor: STRIP_RULE, backgroundColor: "transparent" }
        : { ...d, backgroundColor: STRIP_RULE };
  }
  return out as T;
}

const HEADING_SIZE: Record<string, number> = {
  xs: 13, sm: 14, base: 15, md: 16, lg: 17, xl: 18, "2xl": 21, "3xl": 24, "4xl": 28, "5xl": 32,
};

/**
 * Drop-in for Typography's serif `Display` on user pages: same props, rendered
 * in the bold sans the orders pages use for headings.
 */
export function HeadingText({
  size = "3xl",
  italic: _italic,
  style,
  ...props
}: React.ComponentProps<typeof Text> & { size?: string; italic?: boolean }) {
  return (
    <Text
      {...props}
      style={[
        {
          fontFamily: fontFamilies.sans.bold,
          fontSize: HEADING_SIZE[size] ?? 24,
          letterSpacing: -0.4,
          color: C.text,
        },
        style,
      ]}
    />
  );
}
