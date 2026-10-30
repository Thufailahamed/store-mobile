import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@/components/ui/Icon";
import { pickImages, takePhoto } from "@/lib/upload";
import { colors, radii } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import type { ProductImage } from "@/lib/types";

const CREAM = colors.paper.cream;
const GOLD = colors.accent2.ochre;
const INK = colors.olive[950];

export type PendingProductImage = {
  key: string;
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
  isPrimary: boolean;
};

type Props = {
  existing: ProductImage[];
  pending: PendingProductImage[];
  uploading?: boolean;
  onAddPending: (image: PendingProductImage) => void;
  onRemoveExisting: (imageId: string) => void;
  onRemovePending: (key: string) => void;
  onSetPrimaryExisting: (imageId: string) => void;
  onSetPrimaryPending: (key: string) => void;
  onMoveExisting?: (imageId: string, direction: "left" | "right") => void;
};

export function ProductMediaSection({
  existing,
  pending,
  uploading,
  onAddPending,
  onRemoveExisting,
  onRemovePending,
  onSetPrimaryExisting,
  onSetPrimaryPending,
  onMoveExisting,
}: Props) {
  const MAX = 10;
  const total = existing.length + pending.length;
  const remaining = MAX - total;

  const addAssets = (assets: { uri: string; mimeType?: string | null; fileName?: string | null }[]) => {
    const wasEmpty = total === 0;
    assets.slice(0, Math.max(0, remaining)).forEach((asset, i) => {
      onAddPending({
        key: `pending-${Date.now()}-${i}`,
        uri: asset.uri,
        mimeType: asset.mimeType,
        fileName: asset.fileName,
        isPrimary: wasEmpty && i === 0,
      });
    });
  };

  const handleLibrary = async () => {
    const result = await pickImages({ limit: remaining, quality: 0.85 });
    if (!result) {
      Alert.alert("Photos access needed", "Allow photo access in Settings to upload product photos.");
      return;
    }
    if (result.canceled || !result.assets?.length) return;
    addAssets(result.assets);
  };

  const handleCamera = async () => {
    const result = await takePhoto({ allowsEditing: false, quality: 0.85 });
    if (!result) {
      Alert.alert("Camera access needed", "Allow camera access in Settings to take product photos.");
      return;
    }
    if (result.canceled || !result.assets?.[0]?.uri) return;
    addAssets([result.assets[0]]);
  };

  const confirmRemove = (label: string, onConfirm: () => void) => {
    Alert.alert("Remove image?", label, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: onConfirm },
    ]);
  };

  const SHOTS = [
    { icon: "shirt-outline", label: "Front" },
    { icon: "swap-horizontal-outline", label: "Back" },
    { icon: "search-outline", label: "Detail" },
    { icon: "body-outline", label: "On model" },
  ] as const;

  const renderTile = (
    key: string,
    uri: string,
    isPrimary: boolean,
    index: number,
    onCover: () => void,
    onRemove: () => void,
    move?: { canLeft: boolean; canRight: boolean; left: () => void; right: () => void },
  ) => (
    <View key={key} style={[styles.tile, isPrimary && styles.tileCover]}>
      <Image source={{ uri }} style={styles.image} contentFit="cover" transition={150} />
      <View style={styles.indexBadge}>
        <Text style={styles.indexText}>{index + 1}</Text>
      </View>
      {isPrimary ? (
        <View style={styles.primaryBadge}>
          <Ionicons name="star" size={10} color={INK} />
          <Text style={styles.primaryText}>Cover</Text>
        </View>
      ) : (
        <TouchableOpacity style={styles.coverBtn} onPress={onCover} accessibilityRole="button">
          <Text style={styles.coverBtnText}>Set cover</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity style={styles.removeBtn} onPress={onRemove} hitSlop={6} accessibilityLabel="Remove photo">
        <Ionicons name="close" size={14} color={CREAM} />
      </TouchableOpacity>
      {move ? (
        <View style={styles.reorderRow}>
          <TouchableOpacity
            style={[styles.reorderBtn, !move.canLeft && styles.reorderBtnDisabled]}
            disabled={!move.canLeft}
            onPress={move.left}
            hitSlop={6}
            accessibilityLabel="Move photo earlier"
          >
            <Ionicons name="chevron-back" size={13} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.reorderBtn, !move.canRight && styles.reorderBtnDisabled]}
            disabled={!move.canRight}
            onPress={move.right}
            hitSlop={6}
            accessibilityLabel="Move photo later"
          >
            <Ionicons name="chevron-forward" size={13} color="#fff" />
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View style={styles.iconTile}>
          <Ionicons name="images-outline" size={18} color={colors.olive[800]} />
        </View>
        <View style={styles.headerCopy}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Photos</Text>
            <Text style={styles.requiredTag}>Required</Text>
          </View>
          <Text style={styles.subtitle}>
            {total === 0 ? "The cover is what shoppers see first" : "Cover shows in listings and search"}
          </Text>
        </View>
        <View style={styles.countPill}>
          <Text style={styles.countText}>
            {total}/{MAX}
          </Text>
        </View>
      </View>

      {total === 0 ? (
        <View style={styles.emptyWrap}>
          <View style={styles.shotGrid}>
            <TouchableOpacity
              style={styles.coverSlot}
              onPress={handleLibrary}
              activeOpacity={0.85}
              disabled={uploading}
              accessibilityRole="button"
              accessibilityLabel="Add cover photo"
            >
              <View style={styles.coverSlotIcon}>
                <Ionicons name="add" size={24} color={CREAM} />
              </View>
              <Text style={styles.coverSlotTitle}>Cover photo</Text>
              <Text style={styles.coverSlotSub}>3:4 portrait works best</Text>
            </TouchableOpacity>
            <View style={styles.shotCol}>
              {SHOTS.map((shot) => (
                <View key={shot.label} style={styles.shotSlot}>
                  <Ionicons name={shot.icon} size={18} color={colors.olive[700]} />
                  <Text style={styles.shotLabel}>{shot.label}</Text>
                </View>
              ))}
            </View>
          </View>
          <View style={styles.dropActions}>
            <TouchableOpacity
              style={styles.primaryAction}
              onPress={handleLibrary}
              disabled={uploading}
              accessibilityRole="button"
              accessibilityLabel="Choose photos from library"
            >
              <Ionicons name="images-outline" size={18} color={CREAM} />
              <Text style={styles.primaryActionText}>Choose photos</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryAction}
              onPress={handleCamera}
              disabled={uploading}
              accessibilityRole="button"
              accessibilityLabel="Take a photo"
            >
              <Ionicons name="camera-outline" size={18} color={colors.olive[900]} />
              <Text style={styles.secondaryActionText}>Camera</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.tipLine}>
            <Ionicons name="bulb-outline" size={14} color={colors.accent2.ochre} />
            <Text style={styles.tipText}>Natural light · plain background · up to 10 JPG/PNG</Text>
          </View>
        </View>
      ) : null}

      {total > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {existing.map((img, idx) =>
            renderTile(
              img.id,
              img.url,
              Boolean(img.is_primary),
              idx,
              () => onSetPrimaryExisting(img.id),
              () => confirmRemove("This photo will be removed from the product.", () => onRemoveExisting(img.id)),
              onMoveExisting && existing.length > 1
                ? {
                    canLeft: idx > 0,
                    canRight: idx < existing.length - 1,
                    left: () => onMoveExisting(img.id, "left"),
                    right: () => onMoveExisting(img.id, "right"),
                  }
                : undefined,
            ),
          )}
          {pending.map((img, idx) =>
            renderTile(
              img.key,
              img.uri,
              img.isPrimary,
              existing.length + idx,
              () => onSetPrimaryPending(img.key),
              () => onRemovePending(img.key),
            ),
          )}
          {total < MAX ? (
            <View style={styles.addCol}>
              <TouchableOpacity
                style={styles.addTile}
                onPress={handleLibrary}
                activeOpacity={0.85}
                disabled={uploading}
                accessibilityRole="button"
                accessibilityLabel="Add photos from library"
              >
                {uploading ? (
                  <ActivityIndicator color={colors.light.primary} />
                ) : (
                  <>
                    <Ionicons name="images-outline" size={20} color={colors.olive[800]} />
                    <Text style={styles.addText}>Library</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.addTile}
                onPress={handleCamera}
                activeOpacity={0.85}
                disabled={uploading}
                accessibilityRole="button"
                accessibilityLabel="Take a photo"
              >
                <Ionicons name="camera-outline" size={20} color={colors.olive[800]} />
                <Text style={styles.addText}>Camera</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </ScrollView>
      ) : null}
      {total > 0 ? (
        <View style={styles.footRow}>
          <View style={styles.slotBar}>
            {Array.from({ length: MAX }).map((_, i) => (
              <View key={i} style={[styles.slotSeg, i < total && styles.slotSegOn]} />
            ))}
          </View>
          <Text style={styles.footHint}>
            {remaining} slot{remaining === 1 ? "" : "s"} left
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const TILE_W = 108;
const TILE_H = 144;
const COVER_W = 150;
const COVER_H = 200;

const styles = StyleSheet.create({
  section: {
    marginBottom: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.12)",
    borderRadius: 22,
    paddingVertical: 16,
    shadowColor: "#2a2c1f",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 18, paddingHorizontal: 16 },
  iconTile: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.olive[50], alignItems: "center", justifyContent: "center" },
  headerCopy: { flex: 1, minWidth: 0, gap: 2 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontFamily: fontFamilies.sans.bold, fontSize: 18, color: INK, letterSpacing: -0.2 },
  requiredTag: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: colors.accent2.rust,
    backgroundColor: "rgba(184,92,58,0.08)",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radii.full,
    overflow: "hidden",
  },
  subtitle: { fontFamily: fontFamilies.sans.regular, fontSize: 12.5, lineHeight: 17, color: colors.light.mutedForeground },
  countText: { fontFamily: fontFamilies.sans.semibold, fontSize: 12, color: colors.olive[800], fontVariant: ["tabular-nums"] },
  countPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radii.full, backgroundColor: colors.olive[50] },

  emptyWrap: { paddingHorizontal: 16, gap: 14 },
  shotGrid: { flexDirection: "row", gap: 10, height: 196 },
  coverSlot: {
    flex: 1.15,
    borderRadius: 18,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "rgba(83,94,44,0.35)",
    backgroundColor: "#FAF9F5",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  coverSlotIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.olive[900],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  coverSlotTitle: { fontFamily: fontFamilies.sans.bold, fontSize: 16, color: INK },
  coverSlotSub: { fontFamily: fontFamilies.sans.regular, fontSize: 11.5, color: colors.light.mutedForeground },
  shotCol: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 8, alignContent: "space-between" },
  shotSlot: {
    width: "47%",
    height: 94,
    borderRadius: 14,
    backgroundColor: "#F3F2EA",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  shotLabel: { fontFamily: fontFamilies.sans.medium, fontSize: 11, color: colors.olive[800] },
  dropActions: { flexDirection: "row", gap: 10 },
  primaryAction: {
    flex: 1.4,
    minHeight: 50,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.full,
    backgroundColor: colors.olive[900],
  },
  primaryActionText: { fontFamily: fontFamilies.sans.semibold, fontSize: 15, color: CREAM },
  secondaryAction: {
    flex: 1,
    minHeight: 50,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.full,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.28)",
  },
  secondaryActionText: { fontFamily: fontFamilies.sans.semibold, fontSize: 15, color: colors.olive[900] },
  tipLine: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  tipText: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: colors.light.mutedForeground },

  row: { gap: 10, paddingHorizontal: 16, alignItems: "flex-end" },
  tile: {
    width: TILE_W,
    height: TILE_H,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: colors.paper.warm,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.12)",
  },
  tileCover: { width: COVER_W, height: COVER_H, borderRadius: 18, borderWidth: 2, borderColor: GOLD },
  image: { width: "100%", height: "100%" },
  indexBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: "rgba(250,248,241,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  indexText: { fontFamily: fontFamilies.sans.semibold, fontSize: 11, color: INK },
  primaryBadge: {
    position: "absolute",
    left: 6,
    bottom: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: GOLD,
    borderRadius: radii.full,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  primaryText: { fontSize: 11, color: INK, fontFamily: fontFamilies.sans.semibold },
  coverBtn: {
    position: "absolute",
    left: 6,
    right: 6,
    bottom: 6,
    alignItems: "center",
    backgroundColor: "rgba(22,26,10,0.62)",
    borderRadius: radii.full,
    paddingVertical: 5,
  },
  coverBtnText: { fontSize: 11, color: CREAM, fontFamily: fontFamilies.sans.medium },
  removeBtn: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(22,26,10,0.62)",
    alignItems: "center",
    justifyContent: "center",
  },
  reorderRow: { position: "absolute", top: 34, right: 6, gap: 4 },
  reorderBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(22,26,10,0.62)",
    alignItems: "center",
    justifyContent: "center",
  },
  reorderBtnDisabled: { opacity: 0.3 },
  addCol: { gap: 8, height: TILE_H },
  addTile: {
    flex: 1,
    width: 92,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(83,94,44,0.3)",
    backgroundColor: "#FAF9F5",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  addText: { fontSize: 12, color: colors.olive[800], fontFamily: fontFamilies.sans.semibold },
  footRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, marginTop: 14 },
  slotBar: { flex: 1, flexDirection: "row", gap: 3 },
  slotSeg: { flex: 1, height: 4, borderRadius: 2, backgroundColor: "rgba(83,94,44,0.12)" },
  slotSegOn: { backgroundColor: colors.olive[700] },
  footHint: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: colors.light.mutedForeground },
});
