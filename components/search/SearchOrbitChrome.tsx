import React from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { fontFamilies } from "@/lib/theme/fonts";
import { colors, radii, shadows, spacing } from "@/lib/theme/tokens";

const INK = "#1b1c1c";
const MUTED = "#5e5e5d";

interface SearchOrbitChromeProps {
  topInset: number;
  draft: string;
  onDraftChange: (value: string) => void;
  onSubmit: () => void;
  onClear: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  searched: boolean;
  query?: string;
  totalCount?: number;
  onImageSearch?: () => void;
  onCameraSearch?: () => void;
  style?: StyleProp<ViewStyle>;
}

/** Legacy export — background removed for flat app search. */
export function SearchOrbitBackground() {
  return null;
}

export function SearchOrbitChrome({
  topInset,
  draft,
  onDraftChange,
  onSubmit,
  onClear,
  onFocus,
  onBlur,
  searched,
  query,
  totalCount,
  onImageSearch,
  onCameraSearch,
  style,
}: SearchOrbitChromeProps) {
  const router = useRouter();
  const isTyping = draft.trim().length > 0 && !searched;

  return (
    <View style={[styles.wrap, { paddingTop: topInset + spacing[2] }, style]}>
      <View style={styles.topRow}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
          hitSlop={8}
        >
          <Ionicons name="arrow-back" size={22} color={INK} />
        </TouchableOpacity>

        <View style={styles.searchField}>
          <Ionicons name="search" size={18} color={MUTED} />
          <TextInput
            style={styles.searchInput}
            value={draft}
            onChangeText={onDraftChange}
            onSubmitEditing={onSubmit}
            onFocus={onFocus}
            onBlur={onBlur}
            returnKeyType="search"
            placeholder="Search products, brands, stores…"
            placeholderTextColor={colors.light.mutedForeground}
            autoFocus
            autoCorrect={false}
            autoCapitalize="none"
          />
          {draft.length > 0 ? (
            <TouchableOpacity onPress={onClear} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={MUTED} />
            </TouchableOpacity>
          ) : null}
        </View>

        {onCameraSearch ? (
          <TouchableOpacity style={styles.iconBtn} onPress={onCameraSearch} activeOpacity={0.7}>
            <Ionicons name="camera-outline" size={20} color={INK} />
          </TouchableOpacity>
        ) : null}
      </View>

      {searched && !isTyping ? (
        <Text style={styles.resultsMeta}>
          {totalCount && totalCount > 0
            ? `${totalCount} result${totalCount === 1 ? "" : "s"} for “${query}”`
            : `No results for “${query}”`}
        </Text>
      ) : null}

      {!searched && !isTyping && onImageSearch ? (
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.quickBtn} onPress={onImageSearch} activeOpacity={0.8}>
            <View style={styles.quickIcon}>
              <Ionicons name="image-outline" size={17} color={colors.olive[800]} />
            </View>
            <View style={styles.quickTextWrap}>
              <Text style={styles.quickBtnText}>Image search</Text>
              <Text style={styles.quickBtnMeta}>Choose a photo</Text>
            </View>
            <Ionicons name="chevron-forward" size={14} color={colors.light.mutedForeground} />
          </TouchableOpacity>
          {onCameraSearch ? (
            <TouchableOpacity style={styles.quickBtn} onPress={onCameraSearch} activeOpacity={0.8}>
              <View style={styles.quickIcon}>
                <Ionicons name="camera-outline" size={17} color={colors.olive[800]} />
              </View>
              <View style={styles.quickTextWrap}>
                <Text style={styles.quickBtnText}>Camera</Text>
                <Text style={styles.quickBtnMeta}>Scan an item</Text>
              </View>
              <Ionicons name="chevron-forward" size={14} color={colors.light.mutedForeground} />
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing[4],
    backgroundColor: colors.paper.cream,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: `${colors.olive[900]}12`,
    zIndex: 10,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    paddingBottom: spacing[3],
  },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.light.card,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  searchField: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    height: 46,
    paddingHorizontal: spacing[3],
    borderRadius: radii.xl,
    backgroundColor: colors.light.card,
    borderWidth: 1,
    borderColor: colors.light.border,
    ...shadows.soft,
  },
  searchInput: {
    flex: 1,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 16,
    color: INK,
    paddingVertical: 0,
  },
  resultsMeta: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 13,
    color: MUTED,
    paddingBottom: spacing[3],
  },
  quickActions: {
    flexDirection: "row",
    gap: spacing[2],
    paddingBottom: spacing[3],
  },
  quickBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    minHeight: 54,
    paddingHorizontal: spacing[2],
    borderRadius: radii.xl,
    backgroundColor: colors.light.card,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  quickIcon: {
    width: 32,
    height: 32,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${colors.olive[500]}12`,
  },
  quickTextWrap: {
    flex: 1,
  },
  quickBtnText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12,
    color: INK,
  },
  quickBtnMeta: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 9,
    color: colors.light.mutedForeground,
    marginTop: 1,
  },
});
