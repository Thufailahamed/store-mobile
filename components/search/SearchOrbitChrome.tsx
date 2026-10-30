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
              <View style={styles.fieldDivider} />
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
    paddingTop: spacing[1],
  },
  iconBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: `${colors.ink.DEFAULT}0F`,
    ...shadows.soft,
    shadowOpacity: 0.06,
  },
  searchField: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    height: 50,
    paddingLeft: spacing[4],
    paddingRight: spacing[1.5],
    borderRadius: radii.full,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: `${colors.ink.DEFAULT}0F`,
    shadowColor: colors.ink.DEFAULT,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 4,
  },
  fieldActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  fieldDivider: {
    width: StyleSheet.hairlineWidth,
    height: 20,
    marginRight: 4,
    backgroundColor: `${colors.ink.DEFAULT}26`,
  },
  fieldActionBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.olive[50],
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
