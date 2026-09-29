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
            placeholder="Search products & brands"
            placeholderTextColor={colors.light.mutedForeground}
            autoFocus
            autoCorrect={false}
            autoCapitalize="none"
          />
          {draft.length > 0 ? (
            <TouchableOpacity onPress={onClear} hitSlop={8} accessibilityLabel="Clear search">
              <Ionicons name="close-circle" size={18} color={MUTED} />
            </TouchableOpacity>
          ) : (
            <View style={styles.fieldActions}>
              {onImageSearch ? (
                <TouchableOpacity
                  onPress={onImageSearch}
                  hitSlop={6}
                  style={styles.fieldActionBtn}
                  accessibilityLabel="Search with a photo"
                >
                  <Ionicons name="image-outline" size={19} color={INK} />
                </TouchableOpacity>
              ) : null}
              {onCameraSearch ? (
                <TouchableOpacity
                  onPress={onCameraSearch}
                  hitSlop={6}
                  style={styles.fieldActionBtn}
                  accessibilityLabel="Scan an item with the camera"
                >
                  <Ionicons name="camera-outline" size={20} color={INK} />
                </TouchableOpacity>
              ) : null}
            </View>
          )}
        </View>
      </View>

      {searched && !isTyping && typeof totalCount === "number" && totalCount > 0 ? (
        <View style={styles.resultsMetaRow}>
          <View style={styles.resultsMetaDot} />
          <Text style={styles.resultsMeta}>
            Showing <Text style={styles.resultsMetaBold}>{totalCount}</Text> {totalCount === 1 ? "result" : "results"} for{" "}
            <Text style={styles.resultsMetaQuery}>“{query}”</Text>
          </Text>
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
  fieldActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginRight: -spacing[1],
  },
  fieldActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  searchInput: {
    flex: 1,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 16,
    color: INK,
    paddingVertical: 0,
  },
  resultsMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    paddingBottom: spacing[3],
    paddingHorizontal: spacing[1],
  },
  resultsMetaDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.olive[600],
  },
  resultsMeta: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    color: MUTED,
  },
  resultsMetaBold: {
    fontFamily: fontFamilies.sans.semibold,
    color: INK,
  },
  resultsMetaQuery: {
    fontFamily: fontFamilies.sans.medium,
    color: INK,
  },
});
