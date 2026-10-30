import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@/components/ui/Icon";
import { colors, radii } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

export const INK = colors.olive[950];
export const CREAM = colors.paper.cream;
export const GOLD = colors.accent2.ochre;
export const RUST = colors.accent2.rust;
export const OK_GREEN = "#4E8D42";
export const HAIRLINE = "rgba(83,94,44,0.12)";
export const FIELD_BG = "#FAF9F5";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

/** Card shell shared by every editor section: icon tile, title, hint, optional right action. */
export function EditorCard({
  icon,
  title,
  hint,
  required,
  action,
  collapsible,
  defaultOpen = true,
  summary,
  onLayout,
  children,
}: {
  icon: IconName;
  title: string;
  hint?: string;
  required?: boolean;
  action?: React.ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  /** Shown under the title while collapsed. */
  summary?: string;
  onLayout?: (e: LayoutChangeEvent) => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const isOpen = collapsible ? open : true;
  const header = (
    <View style={styles.header}>
      <View style={styles.iconTile}>
        <Ionicons name={icon} size={18} color={colors.olive[800]} />
      </View>
      <View style={styles.headerCopy}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{title}</Text>
          {required ? <Text style={styles.requiredTag}>Required</Text> : null}
        </View>
        {(collapsible && !isOpen ? summary || hint : hint) ? (
          <Text style={styles.hint} numberOfLines={collapsible && !isOpen ? 1 : 3}>
            {collapsible && !isOpen ? summary || hint : hint}
          </Text>
        ) : null}
      </View>
      {action}
      {collapsible ? (
        <View style={styles.chevron}>
          <Ionicons name={isOpen ? "chevron-up" : "chevron-down"} size={16} color={colors.olive[800]} />
        </View>
      ) : null}
    </View>
  );
  return (
    <View style={styles.card} onLayout={onLayout}>
      {collapsible ? (
        <TouchableOpacity
          onPress={() => setOpen((v) => !v)}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityState={{ expanded: isOpen }}
        >
          {header}
        </TouchableOpacity>
      ) : (
        header
      )}
      {isOpen ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

export function Field({
  label,
  required,
  hint,
  error,
  counter,
  right,
  style,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string | null;
  counter?: { value: number; max: number };
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const over = counter ? counter.value > counter.max : false;
  return (
    <View style={[styles.field, style]}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>
          {label}
          {required ? <Text style={styles.required}> *</Text> : null}
        </Text>
        {right}
      </View>
      {children}
      {error || hint || counter ? (
        <View style={styles.metaRow}>
          {error ? (
            <View style={styles.metaMsg}>
              <Ionicons name="alert-circle" size={13} color={RUST} />
              <Text style={[styles.metaText, styles.metaError]}>{error}</Text>
            </View>
          ) : hint ? (
            <Text style={[styles.metaText, { flex: 1 }]}>{hint}</Text>
          ) : (
            <View style={{ flex: 1 }} />
          )}
          {counter ? (
            <Text style={[styles.counter, over && styles.metaError]}>
              {counter.value}/{counter.max}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** Text input with focus ring + optional warning state. */
export function Input({
  warn,
  mono,
  multiline,
  style,
  ...props
}: React.ComponentProps<typeof TextInput> & { warn?: boolean; mono?: boolean }) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      {...props}
      multiline={multiline}
      onFocus={(e) => {
        setFocused(true);
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        props.onBlur?.(e);
      }}
      placeholderTextColor={colors.light.mutedForeground}
      style={[
        styles.input,
        multiline && styles.textArea,
        mono && styles.mono,
        focused && styles.inputFocused,
        warn && styles.inputWarn,
        style,
      ]}
    />
  );
}

/** Input with a fixed unit inside the field (LKR, %, /products/). */
export function AffixInput({
  prefix,
  suffix,
  warn,
  mono,
  ...props
}: React.ComponentProps<typeof TextInput> & { prefix?: string; suffix?: string; warn?: boolean; mono?: boolean }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.affixWrap, focused && styles.inputFocused, warn && styles.inputWarn]}>
      {prefix ? <Text style={styles.affixText}>{prefix}</Text> : null}
      <TextInput
        {...props}
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur?.(e);
        }}
        style={[styles.affixInput, mono && styles.mono]}
        placeholderTextColor={colors.light.mutedForeground}
      />
      {suffix ? <Text style={styles.affixText}>{suffix}</Text> : null}
    </View>
  );
}

/** Free-text input plus one-tap suggestion chips underneath. */
export function SuggestInput({
  value,
  onChange,
  suggestions,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  suggestions: readonly string[];
  placeholder?: string;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Input value={value} onChangeText={onChange} placeholder={placeholder} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.suggestRow}
        keyboardShouldPersistTaps="handled"
      >
        {suggestions.map((s) => {
          const on = value.trim().toLowerCase() === s.toLowerCase();
          return (
            <TouchableOpacity
              key={s}
              style={[styles.suggestChip, on && styles.suggestChipOn]}
              onPress={() => onChange(on ? "" : s)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
            >
              <Text style={[styles.suggestText, on && styles.suggestTextOn]}>{s}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { key: T; label: string; icon?: IconName }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((o) => {
        const on = value === o.key;
        return (
          <TouchableOpacity
            key={o.key}
            style={[styles.segment, on && styles.segmentActive]}
            onPress={() => onChange(o.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
          >
            {o.icon ? <Ionicons name={o.icon} size={14} color={on ? INK : colors.olive[700]} /> : null}
            <Text style={[styles.segmentText, on && styles.segmentTextActive]} numberOfLines={1}>
              {o.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function ToggleRow({
  icon,
  title,
  hint,
  value,
  onChange,
  tone = "olive",
}: {
  icon: IconName;
  title: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  tone?: "olive" | "gold";
}) {
  const onColor = tone === "gold" ? GOLD : colors.olive[800];
  return (
    <TouchableOpacity
      style={[styles.toggleRow, value && (tone === "gold" ? styles.toggleRowGold : styles.toggleRowOlive)]}
      onPress={() => onChange(!value)}
      activeOpacity={0.8}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
    >
      <View style={[styles.toggleIcon, value && { backgroundColor: "#FFFFFF" }]}>
        <Ionicons name={icon} size={16} color={value ? onColor : colors.olive[800]} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.toggleTitle}>{title}</Text>
        {hint ? <Text style={styles.toggleHint}>{hint}</Text> : null}
      </View>
      <View style={[styles.switch, value && { backgroundColor: onColor }]}>
        <View style={[styles.knob, value && styles.knobOn]} />
      </View>
    </TouchableOpacity>
  );
}

/** Tag chips with inline add — commas or return commit a tag. */
export function TagInput({
  tags,
  onChange,
  max = 20,
  suggestions = [],
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  max?: number;
  suggestions?: string[];
}) {
  const [draft, setDraft] = useState("");
  const commit = (raw: string) => {
    const parts = raw
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    if (parts.length === 0) return;
    const next = [...tags];
    for (const p of parts) {
      if (next.length >= max) break;
      if (!next.includes(p)) next.push(p.slice(0, 40));
    }
    onChange(next);
    setDraft("");
  };
  const remaining = suggestions.filter((s) => !tags.includes(s)).slice(0, 8);
  return (
    <View style={{ gap: 10 }}>
      <View style={styles.tagBox}>
        {tags.map((t) => (
          <TouchableOpacity
            key={t}
            style={styles.tag}
            onPress={() => onChange(tags.filter((x) => x !== t))}
            accessibilityRole="button"
            accessibilityLabel={`Remove tag ${t}`}
          >
            <Text style={styles.tagText}>{t}</Text>
            <Ionicons name="close" size={12} color={colors.olive[800]} />
          </TouchableOpacity>
        ))}
        {tags.length < max ? (
          <TextInput
            value={draft}
            onChangeText={(v) => (v.includes(",") ? commit(v) : setDraft(v))}
            onSubmitEditing={() => commit(draft)}
            onBlur={() => commit(draft)}
            placeholder={tags.length ? "Add tag" : "cotton, casual, summer"}
            placeholderTextColor={colors.light.mutedForeground}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            blurOnSubmit={false}
            style={styles.tagInput}
          />
        ) : null}
      </View>
      {remaining.length > 0 && tags.length < max ? (
        <View style={styles.suggestWrap}>
          {remaining.map((s) => (
            <TouchableOpacity key={s} style={styles.addTag} onPress={() => commit(s)} accessibilityRole="button">
              <Ionicons name="add" size={12} color={colors.olive[700]} />
              <Text style={styles.addTagText}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** Small tinted stat tile used for pricing + stock metrics. */
export function MetricTile({
  icon,
  label,
  value,
  hint,
  tone = "mute",
}: {
  icon: IconName;
  label: string;
  value: string;
  hint?: string;
  tone?: "olive" | "gold" | "rust" | "mute";
}) {
  const palette = {
    olive: { bg: colors.olive[50], fg: colors.olive[800] },
    gold: { bg: "#f7f1de", fg: "#8a6d1f" },
    rust: { bg: "rgba(184,92,58,0.09)", fg: RUST },
    mute: { bg: FIELD_BG, fg: INK },
  }[tone];
  return (
    <View style={[styles.metric, { backgroundColor: palette.bg }]}>
      <View style={styles.metricTop}>
        <Ionicons name={icon} size={13} color={palette.fg} />
        <Text style={styles.metricLabel}>{label}</Text>
      </View>
      <Text style={[styles.metricValue, { color: palette.fg }]} numberOfLines={1}>
        {value}
      </Text>
      {hint ? (
        <Text style={styles.metricHint} numberOfLines={1}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

export const editorStyles = StyleSheet.create({
  row: { flexDirection: "row", gap: 10 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: "rgba(83,94,44,0.16)", marginVertical: 16 },
  subLabel: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: colors.ink.mute,
    marginBottom: 10,
  },
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: HAIRLINE,
    borderRadius: 22,
    padding: 16,
    marginBottom: 14,
    shadowColor: "#2a2c1f",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconTile: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.olive[50],
    alignItems: "center",
    justifyContent: "center",
  },
  headerCopy: { flex: 1, minWidth: 0, gap: 2 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontFamily: fontFamilies.sans.bold, fontSize: 18, color: INK, letterSpacing: -0.2 },
  requiredTag: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: RUST,
    backgroundColor: "rgba(184,92,58,0.08)",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radii.full,
    overflow: "hidden",
  },
  hint: { fontFamily: fontFamilies.sans.regular, fontSize: 12.5, lineHeight: 17, color: colors.light.mutedForeground },
  chevron: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: FIELD_BG,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { marginTop: 18 },

  field: { marginBottom: 16 },
  labelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 7, gap: 8 },
  label: { fontSize: 13, fontFamily: fontFamilies.sans.medium, color: colors.olive[900] },
  required: { color: RUST, fontFamily: fontFamilies.sans.semibold },
  metaRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 6 },
  metaMsg: { flex: 1, flexDirection: "row", alignItems: "center", gap: 5 },
  metaText: { fontFamily: fontFamilies.sans.regular, fontSize: 12, lineHeight: 16, color: colors.light.mutedForeground },
  metaError: { color: RUST, fontFamily: fontFamilies.sans.medium },
  counter: { fontFamily: fontFamilies.sans.regular, fontSize: 11, color: colors.ink.mute, fontVariant: ["tabular-nums"] },

  input: {
    backgroundColor: FIELD_BG,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.14)",
    borderRadius: 14,
    paddingHorizontal: 14,
    minHeight: 50,
    fontSize: 15,
    fontFamily: fontFamilies.sans.regular,
    color: INK,
  },
  textArea: { minHeight: 104, paddingTop: 13, paddingBottom: 13, textAlignVertical: "top", lineHeight: 21 },
  mono: { fontFamily: fontFamilies.mono.regular, fontSize: 14 },
  inputFocused: { borderColor: colors.olive[700], backgroundColor: "#FFFFFF" },
  inputWarn: { borderColor: "rgba(184,92,58,0.55)", backgroundColor: "#FFF8F4" },
  affixWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: FIELD_BG,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.14)",
    borderRadius: 14,
    paddingHorizontal: 14,
    minHeight: 50,
  },
  affixText: { fontFamily: fontFamilies.sans.medium, fontSize: 13, color: colors.light.mutedForeground },
  affixInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    fontSize: 15,
    fontFamily: fontFamilies.sans.medium,
    color: INK,
    fontVariant: ["tabular-nums"],
  },

  suggestRow: { gap: 6, paddingRight: 4 },
  suggestChip: {
    paddingHorizontal: 12,
    minHeight: 32,
    justifyContent: "center",
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.16)",
    backgroundColor: "#FFFFFF",
  },
  suggestChipOn: { backgroundColor: colors.olive[900], borderColor: colors.olive[900] },
  suggestText: { fontFamily: fontFamilies.sans.medium, fontSize: 12.5, color: colors.olive[800] },
  suggestTextOn: { color: CREAM },

  segmented: { flexDirection: "row", padding: 4, gap: 4, borderRadius: 16, backgroundColor: colors.olive[50] },
  segment: {
    flex: 1,
    minHeight: 40,
    flexDirection: "row",
    gap: 5,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    paddingHorizontal: 4,
  },
  segmentActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  segmentText: { fontFamily: fontFamilies.sans.medium, fontSize: 13, color: colors.olive[700] },
  segmentTextActive: { fontFamily: fontFamilies.sans.semibold, color: INK },

  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 62,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: FIELD_BG,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.12)",
  },
  toggleRowOlive: { backgroundColor: colors.olive[50], borderColor: "rgba(83,94,44,0.28)" },
  toggleRowGold: { backgroundColor: "#f7f1de", borderColor: "rgba(200,164,74,0.55)" },
  toggleIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: colors.olive[50],
    alignItems: "center",
    justifyContent: "center",
  },
  toggleTitle: { fontFamily: fontFamilies.sans.semibold, fontSize: 14, color: INK },
  toggleHint: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: colors.light.mutedForeground, marginTop: 1 },
  switch: { width: 44, height: 26, borderRadius: 13, padding: 3, backgroundColor: "rgba(83,94,44,0.2)" },
  knob: { width: 20, height: 20, borderRadius: 10, backgroundColor: "#FFFFFF" },
  knobOn: { transform: [{ translateX: 18 }] },

  tagBox: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
    minHeight: 50,
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.14)",
    backgroundColor: FIELD_BG,
  },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingLeft: 10,
    paddingRight: 8,
    minHeight: 30,
    borderRadius: radii.full,
    backgroundColor: colors.olive[50],
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.2)",
  },
  tagText: { fontFamily: fontFamilies.sans.medium, fontSize: 13, color: colors.olive[900] },
  tagInput: {
    flexGrow: 1,
    minWidth: 100,
    minHeight: 34,
    paddingHorizontal: 6,
    fontSize: 14,
    fontFamily: fontFamilies.sans.regular,
    color: INK,
  },
  suggestWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  addTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 10,
    minHeight: 30,
    borderRadius: radii.full,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(83,94,44,0.3)",
  },
  addTagText: { fontFamily: fontFamilies.sans.medium, fontSize: 12, color: colors.olive[700] },

  metric: { flex: 1, minWidth: 0, borderRadius: 14, padding: 12, gap: 4 },
  metricTop: { flexDirection: "row", alignItems: "center", gap: 5 },
  metricLabel: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 10.5,
    letterSpacing: 0.7,
    textTransform: "uppercase",
    color: colors.ink.mute,
  },
  metricValue: { fontFamily: fontFamilies.display.semibold, fontSize: 20, fontVariant: ["tabular-nums"] },
  metricHint: { fontFamily: fontFamilies.sans.regular, fontSize: 11, color: colors.light.mutedForeground },
});
