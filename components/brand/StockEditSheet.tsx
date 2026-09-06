import React from "react";
import { View, Text, Modal, Pressable, StyleSheet } from "react-native";
import { Input } from "@/components/ui";
import type { BrandInventoryRow } from "@/lib/api/backend";
import { getAvailable, parseStockInput } from "@/lib/brand-inventory";
import { colors, typography, radii } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

interface Props {
  visible: boolean;
  row: BrandInventoryRow | null;
  saving: boolean;
  error?: string | null;
  onClose: () => void;
  onSave: (nextAvailable: number) => void;
}

export function StockEditSheet({ visible, row, saving, error, onClose, onSave }: Props) {
  const [text, setText] = React.useState("");
  React.useEffect(() => {
    if (row) setText(String(getAvailable(row)));
  }, [row?.id]);
  const parsed = parseStockInput(text);
  const valid = parsed !== null;
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.wrap}>
        <Text style={styles.title}>{row?.product?.name ?? "Update stock"}</Text>
        <Text style={styles.sub}>SKU {row?.sku ?? "—"} • Reserved {Math.max(0, row?.inventory?.reserved ?? 0)}</Text>
        <Input label="Available stock" keyboardType="numeric" value={text} onChangeText={setText} error={text.length > 0 && !valid ? "Enter 0–9999" : undefined} />
        <View style={styles.presets}>
          {[5, 10, 20].map((n) => (
            <Pressable key={n} onPress={() => setText(String(n))} style={styles.preset}>
              <Text style={styles.presetText}>+{n}</Text>
            </Pressable>
          ))}
          <Pressable onPress={() => setText("0")} style={styles.preset}>
            <Text style={styles.presetText}>Set 0</Text>
          </Pressable>
        </View>
        {error ? <Text style={styles.err}>{error}</Text> : null}
        <View style={styles.actions}>
          <Pressable onPress={onClose} disabled={saving} style={[styles.btn, styles.cancel]}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Pressable disabled={!valid || saving} onPress={() => parsed !== null && onSave(parsed)} style={[styles.btn, styles.save, (!valid || saving) && { opacity: 0.5 }]}>
            <Text style={styles.saveText}>{saving ? "Saving…" : "Save"}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 20, gap: 12 },
  title: { fontFamily: fontFamilies.sans.semibold, fontSize: typography.fontSizes.lg, color: colors.light.foreground },
  sub: { fontFamily: fontFamilies.mono.regular, fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground },
  presets: { flexDirection: "row", gap: 8 },
  preset: { borderWidth: 1, borderColor: colors.light.border, borderRadius: radii.full, paddingHorizontal: 14, paddingVertical: 8 },
  presetText: { fontFamily: fontFamilies.sans.semibold, fontSize: typography.fontSizes.sm, color: colors.light.foreground },
  err: { fontFamily: fontFamilies.sans.regular, fontSize: typography.fontSizes.sm, color: colors.light.destructive },
  actions: { flexDirection: "row", gap: 12, marginTop: 4 },
  btn: { flex: 1, borderRadius: radii.lg, paddingVertical: 14, alignItems: "center" },
  cancel: { borderWidth: 1, borderColor: colors.light.border },
  cancelText: { fontFamily: fontFamilies.sans.semibold, fontSize: typography.fontSizes.base, color: colors.light.foreground },
  save: { backgroundColor: colors.light.primary },
  saveText: { fontFamily: fontFamilies.sans.semibold, fontSize: typography.fontSizes.base, color: colors.light.primaryForeground },
});
