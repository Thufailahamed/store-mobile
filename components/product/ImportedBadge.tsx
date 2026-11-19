import React from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@/components/ui/Icon";
import { fontFamilies } from "@/lib/theme/fonts";
import { isWhatsappOrderProduct } from "@/lib/whatsapp-order";
import type { Product } from "@/lib/types";

/**
 * "Imported" pill for foreign-sourced dresses (order_channel = 'whatsapp'),
 * laid over a product card image. Renders nothing for other products.
 * Callers pass `style` to pick a free corner of their card.
 */
export function ImportedBadge({
  product,
  style,
}: {
  product: Pick<Product, "order_channel"> | null | undefined;
  style?: StyleProp<ViewStyle>;
}) {
  if (!isWhatsappOrderProduct(product)) return null;
  return (
    <View style={[styles.pill, style]} pointerEvents="none" accessible accessibilityLabel="Imported">
      <Ionicons name="airplane" size={10} color="#fff" />
      <Text style={styles.text}>IMPORTED</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    position: "absolute",
    left: 8,
    bottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 22,
    paddingHorizontal: 8,
    borderRadius: 11,
    backgroundColor: "rgba(20,20,20,0.78)",
  },
  text: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 9.5,
    letterSpacing: 1.2,
    color: "#fff",
  },
});
