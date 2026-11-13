import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  ScrollView,
  StyleSheet,
  Image,
  ActivityIndicator,
  Alert,
  type LayoutChangeEvent,
} from "react-native";
import { Ionicons } from "@/components/ui/Icon";
import { colors } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { SIZE_SYSTEM_LABELS, type SizeSystem } from "@/lib/size-presets";
import type { SizeGuideGrid } from "@/lib/api/backend";
import { pickImages, uploadSizeChartImage } from "@/lib/upload";
import { EditorCard, INK, RUST, FIELD_BG } from "./product-editor/primitives";

type Props = {
  sizeSystem: SizeSystem;
  /** Standard chart for the size system, or null when none is saved. */
  standard: SizeGuideGrid | null;
  /** The product's own chart. Empty columns mean "use the standard chart". */
  value: SizeGuideGrid;
  onChange: (grid: SizeGuideGrid) => void;
  onLayout?: (e: LayoutChangeEvent) => void;
};

const EMPTY: SizeGuideGrid = { columns: [], rows: [] };

/** Editable size chart: first column is the size label, the rest measurements. */
function GridEditor({ grid, onChange }: { grid: SizeGuideGrid; onChange: (g: SizeGuideGrid) => void }) {
  const { columns, rows } = grid;

  const setHeader = (c: number, v: string) =>
    onChange({ columns: columns.map((h, i) => (i === c ? v : h)), rows });
  const setCell = (r: number, c: number, v: string) =>
    onChange({
      columns,
      rows: rows.map((row, ri) => (ri === r ? row.map((cell, ci) => (ci === c ? v : cell)) : row)),
    });
  const addColumn = () =>
    onChange({
      columns: [...columns, `Measurement ${columns.length}`],
      rows: rows.map((row) => [...row, ""]),
    });
  const removeColumn = (c: number) =>
    onChange({
      columns: columns.filter((_, i) => i !== c),
      rows: rows.map((row) => row.filter((_, i) => i !== c)),
    });
  const addRow = () => onChange({ columns, rows: [...rows, columns.map(() => "")] });
  const removeRow = (r: number) => onChange({ columns, rows: rows.filter((_, i) => i !== r) });

  return (
    <View style={{ gap: 10 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <View style={styles.row}>
            {columns.map((h, c) => (
              <View key={c} style={styles.cell}>
                <TextInput
                  value={h}
                  onChangeText={(v) => setHeader(c, v)}
                  maxLength={40}
                  style={[styles.input, styles.headerInput]}
                  accessibilityLabel={`Column ${c + 1} heading`}
                />
                {columns.length > 1 ? (
                  <Pressable
                    onPress={() => removeColumn(c)}
                    hitSlop={8}
                    style={styles.iconBtn}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove column ${h || c + 1}`}
                  >
                    <Ionicons name="close-circle-outline" size={16} color={RUST} />
                  </Pressable>
                ) : null}
              </View>
            ))}
            <View style={styles.iconSpacer} />
          </View>
          {rows.map((row, r) => (
            <View key={r} style={styles.row}>
              {row.map((cell, c) => (
                <View key={c} style={styles.cell}>
                  <TextInput
                    value={cell}
                    onChangeText={(v) => setCell(r, c, v)}
                    maxLength={40}
                    placeholder={c === 0 ? "Size" : "—"}
                    placeholderTextColor="rgba(22,23,15,0.35)"
                    style={[styles.input, c === 0 && styles.sizeInput]}
                    accessibilityLabel={`${columns[c]} for row ${r + 1}`}
                  />
                </View>
              ))}
              <Pressable
                onPress={() => removeRow(r)}
                hitSlop={8}
                style={styles.iconSpacer}
                accessibilityRole="button"
                accessibilityLabel={`Remove row ${row[0] || r + 1}`}
              >
                <Ionicons name="trash-outline" size={16} color={RUST} />
              </Pressable>
            </View>
          ))}
        </View>
      </ScrollView>
      <View style={styles.actions}>
        <TouchableOpacity onPress={addRow} style={styles.addBtn} accessibilityRole="button">
          <Ionicons name="add" size={14} color={colors.olive[900]} />
          <Text style={styles.addBtnText}>Add size</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={addColumn} style={styles.addBtn} accessibilityRole="button">
          <Ionicons name="add" size={14} color={colors.olive[900]} />
          <Text style={styles.addBtnText}>Add column</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/** Read-only view of a chart, scrolling sideways when it has many columns. */
function GridView({ grid }: { grid: SizeGuideGrid }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View>
        <View style={styles.row}>
          {grid.columns.map((h, c) => (
            <View key={c} style={[styles.viewCell, styles.viewHeader]}>
              <Text style={styles.viewHeaderText}>{h}</Text>
            </View>
          ))}
        </View>
        {grid.rows.map((row, r) => (
          <View key={r} style={styles.row}>
            {row.map((cell, c) => (
              <View key={c} style={styles.viewCell}>
                <Text style={[styles.viewText, c === 0 && styles.viewSize]}>{cell || "—"}</Text>
              </View>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

export function ProductSizeChartSection({ sizeSystem, standard, value, onChange, onLayout }: Props) {
  const [uploading, setUploading] = useState(false);
  const images = Array.isArray(value.images) ? value.images : [];
  const custom = value.columns.length > 0;
  const label = SIZE_SYSTEM_LABELS[sizeSystem];

  const handlePickImages = async () => {
    try {
      const res = await pickImages({ limit: 6 });
      if (!res || res.canceled || !res.assets || res.assets.length === 0) return;
      setUploading(true);
      const newUrls: string[] = [];
      for (const asset of res.assets) {
        const up = await uploadSizeChartImage(asset.uri, { mimeType: asset.mimeType });
        if (up.url) {
          newUrls.push(up.url);
        } else if (up.error) {
          Alert.alert("Upload Failed", up.error);
        }
      }
      if (newUrls.length > 0) {
        onChange({
          ...value,
          images: [...images, ...newUrls],
        });
      }
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to pick images");
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = (index: number) => {
    onChange({
      ...value,
      images: images.filter((_, i) => i !== index),
    });
  };

  return (
    <EditorCard
      icon="resize-outline"
      title="Size chart"
      hint={label}
      onLayout={onLayout}
    >
      <View style={{ gap: 16 }}>
        {/* Images uploader */}
        <View style={styles.imageBlock}>
          <View style={styles.imageHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.imageTitle}>Size chart image(s)</Text>
              <Text style={styles.imageSubtitle}>
                Upload single or multiple size chart diagrams
              </Text>
            </View>
            <TouchableOpacity
              onPress={handlePickImages}
              disabled={uploading}
              style={styles.uploadBtn}
              accessibilityRole="button"
              accessibilityLabel="Upload size chart image"
            >
              {uploading ? (
                <ActivityIndicator size="small" color={colors.olive[900]} />
              ) : (
                <Ionicons name="camera-outline" size={15} color={colors.olive[900]} />
              )}
              <Text style={styles.uploadBtnText}>
                {uploading ? "Uploading..." : "Upload image"}
              </Text>
            </TouchableOpacity>
          </View>

          {images.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbScroll}>
              <View style={styles.thumbRow}>
                {images.map((url, idx) => (
                  <View key={idx} style={styles.thumbWrap}>
                    <Image source={{ uri: url }} style={styles.thumb} resizeMode="contain" />
                    <TouchableOpacity
                      onPress={() => handleRemoveImage(idx)}
                      style={styles.thumbRemove}
                      hitSlop={6}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove image ${idx + 1}`}
                    >
                      <Ionicons name="close" size={13} color="#FFFFFF" />
                    </TouchableOpacity>
                    <View style={styles.thumbBadge}>
                      <Text style={styles.thumbBadgeText}>#{idx + 1}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </ScrollView>
          ) : (
            <Text style={styles.imageEmpty}>
              No size chart images uploaded yet. Buyers can view your size chart photo on the product page.
            </Text>
          )}
        </View>

        {/* Tabular measurement section */}
        <View style={styles.tableBlock}>
          <Text style={styles.sectionHeader}>Measurements table</Text>
          {custom ? (
            <View style={{ gap: 12 }}>
              <Text style={styles.note}>Custom measurements for this product.</Text>
              <GridEditor
                grid={value}
                onChange={(g) => onChange({ ...g, images })}
              />
              <TouchableOpacity
                onPress={() => onChange({ columns: [], rows: [], images })}
                accessibilityRole="button"
              >
                <Text style={styles.link}>Use the standard chart instead</Text>
              </TouchableOpacity>
            </View>
          ) : standard ? (
            <View style={{ gap: 12 }}>
              <Text style={styles.note}>
                Standard chart for {label}. Shoppers see it unless you customise it.
              </Text>
              <GridView grid={standard} />
              <TouchableOpacity
                style={styles.customiseBtn}
                onPress={() =>
                  onChange({
                    columns: [...standard.columns],
                    rows: standard.rows.map((r) => [...r]),
                    images,
                  })
                }
                accessibilityRole="button"
              >
                <Text style={styles.customiseText}>Customise for this product</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.note}>No standard chart for {label} yet. Ask an admin to add one.</Text>
          )}
        </View>
      </View>
    </EditorCard>
  );
}

const styles = StyleSheet.create({
  imageBlock: {
    backgroundColor: "rgba(83,94,44,0.04)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(22,23,15,0.08)",
    padding: 12,
    gap: 10,
  },
  imageHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  imageTitle: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: INK,
  },
  imageSubtitle: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11.5,
    color: "rgba(22,23,15,0.55)",
    marginTop: 1,
  },
  uploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(22,23,15,0.15)",
  },
  uploadBtnText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12,
    color: colors.olive[900],
  },
  thumbScroll: {
    marginTop: 4,
  },
  thumbRow: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 2,
  },
  thumbWrap: {
    width: 90,
    height: 75,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(22,23,15,0.12)",
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },
  thumb: {
    width: "100%",
    height: "100%",
  },
  thumbRemove: {
    position: "absolute",
    top: 3,
    right: 3,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center",
    justifyContent: "center",
  },
  thumbBadge: {
    position: "absolute",
    bottom: 2,
    left: 2,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  thumbBadgeText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9,
    color: "#FFFFFF",
  },
  imageEmpty: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11.5,
    lineHeight: 16,
    color: "rgba(22,23,15,0.5)",
    fontStyle: "italic",
  },
  tableBlock: {
    gap: 8,
  },
  sectionHeader: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12.5,
    color: INK,
  },
  note: { fontFamily: fontFamilies.sans.regular, fontSize: 12.5, lineHeight: 18, color: "rgba(22,23,15,0.6)" },
  row: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  cell: { width: 112, gap: 2 },
  input: {
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(22,23,15,0.12)",
    paddingHorizontal: 10,
    backgroundColor: FIELD_BG,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13.5,
    color: INK,
  },
  headerInput: { fontFamily: fontFamilies.sans.semibold, fontSize: 12 },
  sizeInput: { fontFamily: fontFamilies.sans.semibold },
  iconBtn: { position: "absolute", right: -4, top: -6 },
  iconSpacer: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "rgba(22,23,15,0.12)",
    backgroundColor: "#FFFFFF",
  },
  addBtnText: { fontFamily: fontFamilies.sans.semibold, fontSize: 12.5, color: colors.olive[900] },
  link: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12.5,
    color: "rgba(22,23,15,0.7)",
    textDecorationLine: "underline",
  },
  customiseBtn: {
    alignSelf: "flex-start",
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(22,23,15,0.12)",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  customiseText: { fontFamily: fontFamilies.sans.semibold, fontSize: 13, color: "rgba(22,23,15,0.75)" },
  viewCell: { width: 112, paddingVertical: 9, paddingHorizontal: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(22,23,15,0.08)" },
  viewHeader: { backgroundColor: "rgba(83,94,44,0.08)" },
  viewHeaderText: { fontFamily: fontFamilies.sans.semibold, fontSize: 11.5, color: "rgba(22,23,15,0.7)" },
  viewText: { fontFamily: fontFamilies.sans.regular, fontSize: 13, color: INK },
  viewSize: { fontFamily: fontFamilies.sans.semibold },
});
