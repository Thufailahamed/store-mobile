import React from "react";
import {
  Modal,
  View,
  ScrollView,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@/components/ui/Icon";
import { Display, Body, Label } from "@/components/ui/Typography";
import { Button } from "@/components/ui";
import { useCart } from "@/lib/stores/cart-store";
import { useUI } from "@/lib/stores/ui-store";
import { colors, radii, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";

export function CartDrawer() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const open = useUI((s) => s.cartDrawerOpen);
  const setCartDrawer = useUI((s) => s.setCartDrawer);
  const items = useCart((s) => s.items);
  const lines = Object.values(items).filter((i) => !i.is_unavailable);
  const sub = useCart((s) => s.subtotal());

  const close = () => setCartDrawer(false);

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={styles.overlay} onPress={close}>
        <Pressable
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.handle} />
          <View style={styles.header}>
            <Display size="lg">Your bag</Display>
            <TouchableOpacity onPress={close} style={styles.closeBtn} accessibilityLabel="Close bag">
              <Ionicons name="close" size={20} color={colors.light.foreground} />
            </TouchableOpacity>
          </View>

          {lines.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="bag-outline" size={32} color={colors.light.mutedForeground} />
              <Body muted>Your bag is empty</Body>
            </View>
          ) : (
            <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
              {lines.map((item) => (
                <View key={`${item.storeId}-${item.productId}-${item.variantId}`} style={styles.line}>
                  {item.image ? (
                    <Image source={{ uri: item.image }} style={styles.thumb} />
                  ) : (
                    <View style={[styles.thumb, styles.thumbPh]}>
                      <Ionicons name="image-outline" size={16} color={colors.light.mutedForeground} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Body size="sm" numberOfLines={2}>{item.name}</Body>
                    {item.variantLabel ? <Body muted size="xs">{item.variantLabel}</Body> : null}
                    <Body size="xs">Qty {item.quantity} · {formatPrice(item.price * item.quantity)}</Body>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}

          <View style={styles.footer}>
            {lines.length > 0 ? (
              <View style={styles.subRow}>
                <Label>Subtotal</Label>
                <Body size="sm" style={{ fontFamily: fontFamilies.sans.semibold }}>{formatPrice(sub)}</Body>
              </View>
            ) : null}
            <Button
              variant="outline"
              onPress={() => {
                close();
                router.push("/(main)/cart");
              }}
            >
              View full cart
            </Button>
            {lines.length > 0 ? (
              <Button
                variant="brand"
                onPress={() => {
                  close();
                  router.push("/(main)/cart");
                }}
              >
                Checkout
              </Button>
            ) : null}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.light.card,
    borderTopLeftRadius: radii["3xl"],
    borderTopRightRadius: radii["3xl"],
    padding: 20,
    maxHeight: "80%",
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.light.border,
    alignSelf: "center",
    marginBottom: 12,
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.olive[50],
  },
  empty: { alignItems: "center", paddingVertical: 40, gap: 8 },
  list: { maxHeight: 320, marginBottom: 12 },
  line: { flexDirection: "row", gap: 12, marginBottom: 12, alignItems: "center" },
  thumb: { width: 56, height: 56, borderRadius: 8, backgroundColor: colors.olive[50] },
  thumbPh: { alignItems: "center", justifyContent: "center" },
  footer: { gap: 8 },
  subRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
});
