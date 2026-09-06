import React from "react";
import { View, Text, Modal, Pressable, StyleSheet } from "react-native";
import { Input } from "@/components/ui";
import type { SellerInventoryRow } from "@/lib/seller-inventory";
import { parseStockInput } from "@/lib/brand-inventory";
import { SELLER_INK } from "./chrome";
import { colors, typography, radii } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

interface Props {
  visible: boolean;
  row: SellerInventoryRow | null;
  saving: boolean;
  onClose: () => void;
  onSave: (nextOnHand: number) => void;
}

export function SellerStockSheet({ visible, row, saving, onClose, onSave }: Props) {
  const [text, setText] = React.useState("");
  React.useEffect(() => {
    if (row) setText(String(row.onHand ?? 0));
  }, [row?.variantId]);
  const parsed = parseStockInput(text);
  const valid = parsed !== null;
  const heldBreach = row && parsed !== null && parsed < row.reserved;
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.wrap}>
        <Text style={styles.title}>{row?.productName ?? "Update stock"}</Text>
        <Text style={styles.sub}>SKU {row?.sku ?? "—"} • {row?.reserved ?? 0} held in carts</Text>
        <Input label="On-hand stock" keyboardType="numeric" value={text} onChangeText={setText} error={text.length > 0 && !valid ? "Enter 0–9999" : undefined} />
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
        {heldBreach ? (
          <Text style={styles.warn}>{row?.reserved} units are held in carts. Saving will ask for confirmation.</Text>
        ) : null}
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
  warn: { fontFamily: fontFamilies.sans.regular, fontSize: typography.fontSizes.sm, color: "#8a6a2a" },
  actions: { flexDirection: "row", gap: 12, marginTop: 4 },
  btn: { flex: 1, borderRadius: radii.lg, paddingVertical: 14, alignItems: "center" },
  cancel: { borderWidth: 1, borderColor: colors.light.border },
  cancelText: { fontFamily: fontFamilies.sans.semibold, fontSize: typography.fontSizes.base, color: colors.light.foreground },
  save: { backgroundColor: SELLER_INK },
  saveText: { fontFamily: fontFamilies.sans.semibold, fontSize: typography.fontSizes.base, color: colors.paper.cream },
});
