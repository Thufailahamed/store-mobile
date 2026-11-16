/**
 * Quick shop over a Runway video: pick colour / size and add to the bag
 * without leaving the reel. Loads the full product (variants, stock) by slug.
 * After adding, the sheet turns into a small confirmation with "View bag" /
 * "Keep watching". "View full details" opens the product page.
 *
 * The add is credited to the reel: the caller notes the product click
 * (notePostProductClick) and cart-store's addItem reports the add-to-cart.
 */
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, SlideInDown } from "react-native-reanimated";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { getVariantStock } from "@/components/cart/variant-utils";
import * as api from "@/lib/api";
import { useTrackEvent } from "@/lib/recommender";
import { openWhatsappOrder, useWhatsappNumber } from "@/lib/whatsapp-order";
import { useCart } from "@/lib/stores";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";
import type { Product, ProductVariant } from "@/lib/types";
import type { PublicPostProduct } from "@/lib/posts/types";

const INK = "#111114";
const MUTE = "#8a8a92";
const SURFACE = "#f4f4f5";
const sans = fontFamilies.sans;

const uniq = (xs: (string | undefined)[]) => [...new Set(xs.filter((x): x is string => !!x))];

export function QuickShopSheet({ item, onClose, onViewDetails, onViewBag }: {
  item: PublicPostProduct | null;
  onClose: () => void;
  onViewDetails: (p: PublicPostProduct) => void;
  onViewBag: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { toast } = useToast();
  const { number: whatsappNumber } = useWhatsappNumber();
  const tracker = useTrackEvent();
  const addItem = useCart((s) => s.addItem);
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [color, setColor] = useState<string | null>(null);
  const [size, setSize] = useState<string | null>(null);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (!item) return;
    let alive = true;
    setProduct(null); setFailed(false); setAdded(false); setColor(null); setSize(null); setLoading(true);
    api.getProductBySlug(item.slug || item.id).then((r) => {
      if (!alive) return;
      setLoading(false);
      if (!r.ok || !r.data) { setFailed(true); return; }
      const p = r.data;
      setProduct(p);
      const active = (p.variants ?? []).filter((v) => v.is_active);
      const firstInStock = active.find((v) => getVariantStock(v) > 0) ?? active[0];
      if (firstInStock?.color) setColor(firstInStock.color);
      const sizes = uniq(active.filter((v) => !firstInStock?.color || v.color === firstInStock.color).map((v) => v.size));
      if (sizes.length === 1) setSize(sizes[0]);
    }).catch(() => { if (alive) { setLoading(false); setFailed(true); } });
    return () => { alive = false; };
  }, [item]);

  const active = useMemo(() => (product?.variants ?? []).filter((v) => v.is_active), [product]);
  const colors = useMemo(() => uniq(active.map((v) => v.color)), [active]);
  const sizeVariants = useMemo(
    () => active.filter((v) => !colors.length || v.color === color),
    [active, colors.length, color],
  );
  const sizes = useMemo(() => uniq(sizeVariants.map((v) => v.size)), [sizeVariants]);
  const hasVariants = active.length > 0;

  const variant: ProductVariant | null = useMemo(() => {
    if (!hasVariants) return null;
    return active.find((v) =>
      (!colors.length || v.color === color) && (!sizes.length || v.size === size)) ?? null;
  }, [active, hasVariants, colors.length, sizes.length, color, size]);

  const needsSize = sizes.length > 0 && !size;
  const stock = hasVariants ? (variant ? getVariantStock(variant) : 0) : Infinity;
  const whatsappOnly = product?.order_channel === "whatsapp";
  const soldOut = !whatsappOnly && !needsSize && stock <= 0;
  const price = variant?.price ?? product?.price ?? item?.price ?? 0;
  const mrp = variant?.mrp ?? product?.mrp ?? item?.mrp ?? null;
  const cur = product?.currency || item?.currency || "LKR";
  const img = variant?.image_url
    || product?.images?.find((i) => i.is_primary)?.url
    || product?.images?.[0]?.url
    || item?.image_url
    || undefined;
  const off = mrp && mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0;

  function add() {
    if (product?.order_channel === "whatsapp") {
      if (needsSize) return;
      void openWhatsappOrder(whatsappNumber, product, { variant: variant ?? null, qty: 1 }).then((opened) => {
        if (!opened) toast("WhatsApp ordering is not available yet", "error");
      });
      return;
    }
    if (!product || needsSize || soldOut) return;
    addItem({
      productId: product.id,
      variantId: variant?.id ?? null,
      storeId: product.store_id,
      name: product.name,
      variantLabel: variant ? [variant.size, variant.color].filter(Boolean).join(" / ") || undefined : undefined,
      price,
      image: img,
      stock: hasVariants ? stock : null,
      quantity: 1,
    });
    tracker.cartAdd(product);
    setAdded(true);
    toast("Added to bag", "success", { image: img, subtitle: product.name });
  }

  const sizeStock = (s: string) => {
    const v = sizeVariants.find((x) => x.size === s);
    return v ? getVariantStock(v) : 0;
  };

  return (
    <Modal visible={!!item} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close" />
      {item ? (
        <Animated.View entering={SlideInDown.duration(280)} style={[styles.sheet, { paddingBottom: insets.bottom + 14 }]}>
          <View style={styles.grabber} />

          {added ? (
            <Animated.View entering={FadeIn.duration(200)} style={styles.done}>
              <View style={styles.doneIcon}><Ionicons name="checkmark" size={26} color="#fff" /></View>
              <Text style={styles.doneTitle}>Added to your bag</Text>
              <Text style={styles.doneSub} numberOfLines={1}>
                {product?.name}{variant ? ` · ${[variant.size, variant.color].filter(Boolean).join(" / ")}` : ""}
              </Text>
              <View style={styles.actions}>
                <Pressable onPress={onClose} style={[styles.btn, styles.btnGhost]} accessibilityRole="button">
                  <Text style={styles.btnGhostText}>Keep watching</Text>
                </Pressable>
                <Pressable onPress={onViewBag} style={[styles.btn, styles.btnInk]} accessibilityRole="button">
                  <Ionicons name="bag-handle-outline" size={16} color="#fff" />
                  <Text style={styles.btnInkText}>View bag</Text>
                </Pressable>
              </View>
            </Animated.View>
          ) : (
            <>
              {/* header */}
              <View style={styles.head}>
                <View style={styles.thumb}>
                  {img ? <Image source={{ uri: img }} style={styles.thumbImg} contentFit="cover" transition={150} /> : null}
                </View>
                <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                  <Text style={styles.name} numberOfLines={2}>{product?.name ?? item.name}</Text>
                  <View style={styles.priceRow}>
                    <Text style={styles.price}>{formatPrice(price, cur)}</Text>
                    {off >= 5 ? <Text style={styles.mrp}>{formatPrice(mrp!, cur)}</Text> : null}
                    {off >= 5 ? <Text style={styles.off}>{off}% off</Text> : null}
                  </View>
                  <Pressable onPress={() => onViewDetails(item)} hitSlop={6} accessibilityRole="link">
                    <Text style={styles.details}>View full details ›</Text>
                  </Pressable>
                </View>
                <Pressable onPress={onClose} hitSlop={10} style={styles.close} accessibilityRole="button" accessibilityLabel="Close">
                  <Ionicons name="close" size={18} color={INK} />
                </Pressable>
              </View>

              {loading ? (
                <View style={styles.loading}><ActivityIndicator color={INK} /></View>
              ) : failed ? (
                <Text style={styles.error}>Couldn’t load this piece. Open the full details instead.</Text>
              ) : (
                <View style={{ gap: 16, marginTop: 18 }}>
                  {colors.length > 1 ? (
                    <View style={{ gap: 9 }}>
                      <Text style={styles.label}>Colour <Text style={styles.labelValue}>{color ?? ""}</Text></Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                        {colors.map((c) => {
                          const on = c === color;
                          const hex = active.find((v) => v.color === c)?.color_hex;
                          return (
                            <Pressable key={c} onPress={() => { setColor(c); setSize(null); }}
                              accessibilityRole="radio" accessibilityState={{ selected: on }}
                              style={[styles.chip, on && styles.chipOn]}>
                              {hex ? <View style={[styles.swatch, { backgroundColor: hex }]} /> : null}
                              <Text style={[styles.chipText, on && styles.chipTextOn]}>{c}</Text>
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                    </View>
                  ) : null}

                  {sizes.length ? (
                    <View style={{ gap: 9 }}>
                      <Text style={styles.label}>Size {size ? <Text style={styles.labelValue}>{size}</Text> : null}</Text>
                      <View style={styles.sizes}>
                        {sizes.map((s) => {
                          const on = s === size;
                          const out = sizeStock(s) <= 0;
                          return (
                            <Pressable key={s} onPress={() => !out && setSize(s)} disabled={out}
                              accessibilityRole="radio" accessibilityState={{ selected: on, disabled: out }}
                              style={[styles.size, on && styles.chipOn, out && styles.sizeOut]}>
                              <Text style={[styles.sizeText, on && styles.chipTextOn, out && styles.sizeOutText]}>{s}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                      {!needsSize && stock > 0 && stock <= 5 ? <Text style={styles.low}>Only {stock} left</Text> : null}
                    </View>
                  ) : null}
                </View>
              )}

              <Pressable onPress={add} disabled={!product || needsSize || soldOut}
                accessibilityRole="button" accessibilityState={{ disabled: !product || needsSize || soldOut }}
                style={({ pressed }) => [styles.addBtn, (!product || needsSize || soldOut) && { opacity: 0.35 }, pressed && { opacity: 0.85 }]}>
                <Ionicons name="bag-add-outline" size={18} color="#fff" />
                <Text style={styles.addText}>
                  {soldOut ? "Sold out" : needsSize ? "Select a size" : whatsappOnly ? `Order via WhatsApp · ${formatPrice(price, cur)}` : `Add to bag · ${formatPrice(price, cur)}`}
                </Text>
              </Pressable>
            </>
          )}
        </Animated.View>
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: {
    position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: "#fff",
    borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 18, paddingTop: 10,
  },
  grabber: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: "#d4d4d8", marginBottom: 14 },

  head: { flexDirection: "row", gap: 14, alignItems: "flex-start" },
  thumb: { width: 84, height: 104 },
  thumbImg: { width: 84, height: 104, borderRadius: 14, backgroundColor: SURFACE },
  name: { fontFamily: sans.semibold, fontSize: 16, lineHeight: 21, color: INK },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 7, flexWrap: "wrap" },
  price: { fontFamily: sans.bold, fontSize: 17, color: INK },
  mrp: { fontFamily: sans.regular, fontSize: 13, color: MUTE, textDecorationLine: "line-through" },
  off: { fontFamily: sans.bold, fontSize: 12.5, color: "#2f9e5b" },
  details: { fontFamily: sans.semibold, fontSize: 13, color: INK, textDecorationLine: "underline", marginTop: 2 },
  close: { width: 32, height: 32, borderRadius: 16, backgroundColor: SURFACE, alignItems: "center", justifyContent: "center" },

  loading: { height: 90, alignItems: "center", justifyContent: "center" },
  error: { fontFamily: sans.medium, fontSize: 13.5, color: "#b85c3a", marginTop: 18 },
  label: { fontFamily: sans.semibold, fontSize: 14, color: INK },
  labelValue: { fontFamily: sans.regular, color: MUTE },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 7, height: 38, paddingHorizontal: 14, borderRadius: 999,
    borderWidth: 1.5, borderColor: "#e4e4e7", backgroundColor: "#fff",
  },
  chipOn: { borderColor: INK, backgroundColor: INK },
  chipText: { fontFamily: sans.semibold, fontSize: 13.5, color: INK },
  chipTextOn: { color: "#fff" },
  swatch: { width: 16, height: 16, borderRadius: 8, borderWidth: 1, borderColor: "rgba(0,0,0,0.12)" },
  sizes: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  size: {
    minWidth: 52, height: 44, paddingHorizontal: 12, borderRadius: 12, alignItems: "center", justifyContent: "center",
    borderWidth: 1.5, borderColor: "#e4e4e7", backgroundColor: "#fff",
  },
  sizeText: { fontFamily: sans.semibold, fontSize: 14, color: INK },
  sizeOut: { backgroundColor: SURFACE, borderColor: SURFACE },
  sizeOutText: { color: "#b4b4bb", textDecorationLine: "line-through" },
  low: { fontFamily: sans.semibold, fontSize: 12.5, color: "#c0562f" },

  addBtn: {
    marginTop: 22, height: 54, borderRadius: 16, backgroundColor: INK, flexDirection: "row",
    alignItems: "center", justifyContent: "center", gap: 9,
  },
  addText: { fontFamily: sans.semibold, fontSize: 15.5, color: "#fff" },

  done: { alignItems: "center", paddingTop: 6, gap: 6 },
  doneIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#2f9e5b", alignItems: "center", justifyContent: "center", marginBottom: 6 },
  doneTitle: { fontFamily: sans.bold, fontSize: 19, color: INK },
  doneSub: { fontFamily: sans.regular, fontSize: 13.5, color: MUTE, maxWidth: "90%" },
  actions: { flexDirection: "row", gap: 10, marginTop: 16, alignSelf: "stretch" },
  btn: { flex: 1, height: 50, borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  btnGhost: { backgroundColor: SURFACE },
  btnGhostText: { fontFamily: sans.semibold, fontSize: 15, color: INK },
  btnInk: { backgroundColor: INK },
  btnInkText: { fontFamily: sans.semibold, fontSize: 15, color: "#fff" },
});
