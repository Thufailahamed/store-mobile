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
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { fontFamilies } from "@/lib/theme/fonts";
import { radii, shadows, spacing } from "@/lib/theme/tokens";

export const ORBIT_BG_URI =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuC_ZEOpSUZdRdxnxy7DmSoRotyd83XjkG4SdZEddbxvDjCn6BbJyPBzPhfnpOn1Aro95dSf9EobnhJo_GQ4meXBA6iAl_Au_qlnSbcpDwvyuotdtCYaVvAtp-yrnSYCN0E7hKFClNtNS2aFdH_YrjexP5MQjshIE0Rurenh2s_Zf-ezMso_tnuUCNFwPzkdmB0uJpy8D61Hp4OhC1d0buPML5Kru9aFqwgmD3aouXIUBcm6dbrYcfKkV3PcGSi86miRJleKMn3Ia9Tr";

const INK = "#1b1c1c";
const MUTED = "#5e5e5d";

interface SearchOrbitChromeProps {
  topInset: number;
  draft: string;
  onDraftChange: (value: string) => void;
  onSubmit: () => void;
  onClear: () => void;
  searched: boolean;
  query?: string;
  totalCount?: number;
  style?: StyleProp<ViewStyle>;
}

export function SearchOrbitBackground() {
  return null;
}

export function SearchOrbitChrome({
  topInset,
  draft,
  onDraftChange,
  onSubmit,
  onClear,
  searched,
  query,
  totalCount,
  style,
}: SearchOrbitChromeProps) {
  const router = useRouter();

  return (
    <View style={[styles.wrap, { paddingTop: topInset + spacing[4] }, style]}>
      <View style={styles.glassHeader}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => router.replace("/(main)")}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-back" size={22} color={INK} />
        </TouchableOpacity>
        <Text style={styles.brand}>LUXE CURATED</Text>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => router.push("/(main)/cart")}
          activeOpacity={0.8}
        >
          <Ionicons name="bag-outline" size={22} color={INK} />
        </TouchableOpacity>
      </View>

      {searched ? (
        <View style={styles.resultsHero}>
          <Text style={styles.resultsTitle}>
            {totalCount && totalCount > 0
              ? `${totalCount} matches for "${query}"`
              : `Nothing for "${query}"`}
          </Text>
          <View style={styles.compactSearch}>
            <Ionicons name="search" size={18} color={MUTED} />
            <TextInput
              style={styles.compactInput}
              value={draft}
              onChangeText={onDraftChange}
              onSubmitEditing={onSubmit}
              returnKeyType="search"
              placeholder="Seek & Find..."
              placeholderTextColor="rgba(68, 71, 72, 0.5)"
            />
            {draft.length > 0 ? (
              <TouchableOpacity onPress={onClear} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={MUTED} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      ) : (
        <>
          <View style={styles.hero}>
            <Text style={styles.heroKicker}>discover</Text>
            <Text style={styles.heroTitle}>THE UNEXPECTED</Text>
          </View>

          <View style={styles.searchPill}>
            <Ionicons name="search" size={28} color={MUTED} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              value={draft}
              onChangeText={onDraftChange}
              onSubmitEditing={onSubmit}
              returnKeyType="search"
              placeholder="Seek & Find..."
              placeholderTextColor="rgba(68, 71, 72, 0.45)"
              autoFocus
            />
            {draft.length > 0 ? (
              <TouchableOpacity onPress={onClear} hitSlop={8} style={styles.clearBtn}>
                <Ionicons name="close-circle" size={20} color={MUTED} />
              </TouchableOpacity>
            ) : null}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bgOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(251, 249, 248, 0.72)",
  },
  wrap: {
    paddingHorizontal: spacing[5],
    zIndex: 10,
  },
  glassHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255, 255, 255, 0.88)",
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: "rgba(27, 28, 28, 0.08)",
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    marginBottom: spacing[6],
    ...shadows.soft,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.96)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(27, 28, 28, 0.08)",
  },
  brand: {
    flex: 1,
    textAlign: "center",
    fontFamily: fontFamilies.display.semibold,
    fontSize: 11,
    color: INK,
    letterSpacing: 3.2,
  },
  hero: {
    alignItems: "center",
    marginBottom: spacing[6],
  },
  heroKicker: {
    fontFamily: fontFamilies.display.italic,
    fontSize: 22,
    color: MUTED,
    fontStyle: "italic",
    marginBottom: -4,
  },
  heroTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 42,
    color: INK,
    letterSpacing: -1.5,
    textAlign: "center",
  },
  searchPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: "rgba(27, 28, 28, 0.08)",
    minHeight: 88,
    paddingHorizontal: spacing[6],
    marginBottom: spacing[8],
    ...shadows.editorial,
  },
  searchIcon: {
    marginRight: spacing[3],
  },
  searchInput: {
    flex: 1,
    fontFamily: fontFamilies.display.italic,
    fontSize: 28,
    color: INK,
    textAlign: "center",
    paddingVertical: spacing[3],
  },
  clearBtn: {
    marginLeft: spacing[2],
  },
  resultsHero: {
    gap: spacing[3],
    marginBottom: spacing[4],
  },
  resultsTitle: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 22,
    color: INK,
    letterSpacing: -0.3,
    textAlign: "center",
  },
  compactSearch: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: "rgba(27, 28, 28, 0.08)",
    paddingHorizontal: spacing[4],
    height: 52,
  },
  compactInput: {
    flex: 1,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 15,
    color: INK,
  },
});
