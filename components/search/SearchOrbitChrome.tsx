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
import { colors, radii, spacing } from "@/lib/theme/tokens";

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
            <Ionicons name="image-outline" size={18} color={INK} />
            <Text style={styles.quickBtnText}>Image search</Text>
          </TouchableOpacity>
          {onCameraSearch ? (
            <TouchableOpacity style={styles.quickBtn} onPress={onCameraSearch} activeOpacity={0.8}>
              <Ionicons name="camera-outline" size={18} color={INK} />
              <Text style={styles.quickBtnText}>Camera search</Text>
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
    backgroundColor: "#ffffff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(27, 28, 28, 0.08)",
    zIndex: 10,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    paddingBottom: spacing[3],
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.light.muted,
  },
  searchField: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    height: 44,
    paddingHorizontal: spacing[3],
    borderRadius: radii.lg,
    backgroundColor: colors.light.muted,
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
    justifyContent: "center",
    gap: spacing[1.5],
    height: 40,
    borderRadius: radii.lg,
    backgroundColor: colors.light.muted,
  },
  quickBtnText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 13,
    color: INK,
  },
});
