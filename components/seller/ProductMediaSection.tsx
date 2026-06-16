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
import Ionicons from "@expo/vector-icons/Ionicons";
import { pickImage } from "@/lib/upload";
import { colors, radii, typography } from "@/lib/theme/tokens";
import type { ProductImage } from "@/lib/types";

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
        <Text style={styles.title}>Photos</Text>
        <Text style={styles.subtitle}>
          {total === 0 ? "Add at least one product photo" : `${total} photo${total === 1 ? "" : "s"}`}
        </Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        <TouchableOpacity style={styles.addTile} onPress={handleAdd} activeOpacity={0.85} disabled={uploading}>
          {uploading ? (
            <ActivityIndicator color={colors.light.primary} />
          ) : (
            <>
              <Ionicons name="camera-outline" size={22} color={colors.light.primary} />
              <Text style={styles.addText}>Add</Text>
            </>
          )}
        </TouchableOpacity>

        {existing.map((img) => (
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
            >
              <Ionicons name="close" size={14} color="#fff" />
            </TouchableOpacity>
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
            >
              <Ionicons name="close" size={14} color="#fff" />
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const TILE = 108;

const styles = StyleSheet.create({
  section: { marginBottom: 20 },
  header: { marginBottom: 10, gap: 2 },
  title: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold as any,
    color: colors.light.foreground,
  },
  subtitle: {
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
  },
  row: { gap: 10, paddingRight: 4 },
  addTile: {
    width: TILE,
    height: TILE,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderStyle: "dashed",
    backgroundColor: colors.light.card,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  addText: {
    fontSize: typography.fontSizes.xs,
    color: colors.light.primary,
    fontWeight: typography.fontWeights.medium as any,
  },
  tile: {
    width: TILE,
    height: TILE,
    borderRadius: radii.lg,
    overflow: "hidden",
    backgroundColor: colors.light.muted,
  },
  image: { width: "100%", height: "100%" },
  primaryBadge: {
    position: "absolute",
    left: 6,
    bottom: 6,
    backgroundColor: colors.light.primary,
    borderRadius: radii.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  primaryText: {
    fontSize: 10,
    color: colors.light.primaryForeground,
    fontWeight: typography.fontWeights.semibold as any,
  },
  coverBtn: {
    position: "absolute",
    left: 6,
    bottom: 6,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: radii.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  coverBtnText: {
    fontSize: 10,
    color: "#fff",
    fontWeight: typography.fontWeights.medium as any,
  },
  removeBtn: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
});
