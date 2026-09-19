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
import { pickImage } from "@/lib/upload";
import { colors, radii, typography } from "@/lib/theme/tokens";
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
  const handleAdd = async () => {
    const result = await pickImage({ allowsEditing: false, quality: 0.85 });
    if (!result || result.canceled || !result.assets?.[0]?.uri) return;

    const asset = result.assets[0];
    const isFirst = existing.length === 0 && pending.length === 0;
    onAddPending({
      key: `pending-${Date.now()}`,
      uri: asset.uri,
      mimeType: asset.mimeType,
      fileName: asset.fileName,
      isPrimary: isFirst,
    });
  };

  const confirmRemove = (label: string, onConfirm: () => void) => {
    Alert.alert("Remove image?", label, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: onConfirm },
    ]);
  };

  const total = existing.length + pending.length;

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Ionicons name="images-outline" size={17} color={colors.olive[800]} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.kicker}>LOOKBOOK</Text>
          <Text style={styles.title}>Product photos</Text>
          <Text style={styles.subtitle}>{total === 0 ? "Add a clear cover photo" : "Tap a photo to manage its cover"}</Text>
        </View>
        <View style={styles.countPill}>
          <Text style={styles.countText}>{total}/10</Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        <TouchableOpacity style={styles.addTile} onPress={handleAdd} activeOpacity={0.85} disabled={uploading}>
          {uploading ? (
            <ActivityIndicator color={colors.light.primary} />
          ) : (
            <>
              <View style={styles.addIcon}>
                <Ionicons name="camera-outline" size={21} color={colors.olive[800]} />
              </View>
              <Text style={styles.addText}>Add photo</Text>
              <Text style={styles.addHint}>JPG or PNG</Text>
            </>
          )}
        </TouchableOpacity>

        {existing.map((img, idx) => (
          <View key={img.id} style={styles.tile}>
            <Image source={{ uri: img.url }} style={styles.image} contentFit="cover" />
            {img.is_primary ? (
              <View style={styles.primaryBadge}>
                <Text style={styles.primaryText}>Cover</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.coverBtn}
                onPress={() => onSetPrimaryExisting(img.id)}
              >
                <Text style={styles.coverBtnText}>Set cover</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.removeBtn}
              onPress={() => confirmRemove("This photo will be removed from the product.", () => onRemoveExisting(img.id))}
              hitSlop={6}
              accessibilityLabel="Remove photo"
            >
              <Ionicons name="close" size={14} color={CREAM} />
            </TouchableOpacity>
            {onMoveExisting && existing.length > 1 ? (
              <View style={styles.reorderCol}>
                <TouchableOpacity
                  style={[styles.reorderBtn, idx === 0 && styles.reorderBtnDisabled]}
                  disabled={idx === 0}
                  onPress={() => onMoveExisting(img.id, "left")}
                  hitSlop={6}
                >
                  <Ionicons name="chevron-back" size={14} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.reorderBtn, idx === existing.length - 1 && styles.reorderBtnDisabled]}
                  disabled={idx === existing.length - 1}
                  onPress={() => onMoveExisting(img.id, "right")}
                  hitSlop={6}
                >
                  <Ionicons name="chevron-forward" size={14} color="#fff" />
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        ))}

        {pending.map((img) => (
          <View key={img.key} style={styles.tile}>
            <Image source={{ uri: img.uri }} style={styles.image} contentFit="cover" />
            {img.isPrimary ? (
              <View style={styles.primaryBadge}>
                <Text style={styles.primaryText}>Cover</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.coverBtn}
                onPress={() => onSetPrimaryPending(img.key)}
              >
                <Text style={styles.coverBtnText}>Set cover</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.removeBtn}
              onPress={() => onRemovePending(img.key)}
              hitSlop={6}
              accessibilityLabel="Remove photo"
            >
              <Ionicons name="close" size={14} color={CREAM} />
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const TILE_W = 108;
const TILE_H = 144;

const styles = StyleSheet.create({
  section: { marginBottom: 16, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "rgba(83,94,44,0.12)", borderRadius: 22, paddingVertical: 16 },
  header: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 15, paddingHorizontal: 16 },
  headerIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.olive[50], alignItems: "center", justifyContent: "center" },
  headerCopy: { flex: 1, minWidth: 0 },
  kicker: { fontFamily: fontFamilies.mono.semibold, fontSize: 8, letterSpacing: 1.1, color: colors.olive[600] },
  title: { fontFamily: fontFamilies.display.semibold, fontSize: 18, color: INK, marginTop: 2 },
  subtitle: { fontFamily: fontFamilies.sans.regular, fontSize: 10, color: colors.light.mutedForeground, marginTop: 2 },
  countPill: { minWidth: 42, height: 28, borderRadius: 14, backgroundColor: colors.paper.warm, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  countText: { fontFamily: fontFamilies.mono.semibold, fontSize: 9, color: colors.ink.mute },
  row: { gap: 10, paddingHorizontal: 16 },
  addTile: {
    width: TILE_W,
    height: TILE_H,
    borderRadius: 18,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(83,94,44,0.24)",
    backgroundColor: "#FAF9F5",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  addIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.olive[50], alignItems: "center", justifyContent: "center", marginBottom: 2 },
  addText: { fontSize: typography.fontSizes.xs, color: colors.olive[800], fontFamily: fontFamilies.sans.semibold },
  addHint: { fontSize: 8, color: colors.ink.mute, fontFamily: fontFamilies.sans.regular },
  tile: {
    width: TILE_W,
    height: TILE_H,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: colors.paper.warm,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.12)",
  },
  image: { width: "100%", height: "100%" },
  primaryBadge: {
    position: "absolute",
    left: 6,
    bottom: 6,
    backgroundColor: GOLD,
    borderRadius: radii.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  primaryText: {
    fontSize: 10,
    color: INK,
    fontFamily: fontFamilies.sans.semibold,
  },
  coverBtn: {
    position: "absolute",
    left: 6,
    bottom: 6,
    backgroundColor: "rgba(22,26,10,0.62)",
    borderRadius: radii.full,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  coverBtnText: {
    fontSize: 10,
    color: CREAM,
    fontFamily: fontFamilies.sans.medium,
  },
  removeBtn: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(22,26,10,0.62)",
    alignItems: "center",
    justifyContent: "center",
  },
  reorderCol: {
    position: "absolute",
    top: 6,
    left: 6,
    gap: 4,
  },
  reorderBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(22,26,10,0.62)",
    alignItems: "center",
    justifyContent: "center",
  },
  reorderBtnDisabled: { opacity: 0.3 },
});
