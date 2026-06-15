import React, { useEffect, useRef } from "react";
import { View, TouchableOpacity, StyleSheet, Animated } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Display, Label, Body, Price } from "@/components/ui/Typography";
import { colors, radii, spacing, shadows } from "@/lib/theme/tokens";
import { formatPrice } from "@/lib/utils";
import type { Product } from "@/lib/types";

const ROMAN = ["I", "II", "III"];
const TIMES = ["8 AM", "12 PM", "5 PM"];
const MOODS = ["Morning", "Afternoon", "Evening"];

interface TodaysEditProps {
  products: Product[];
  kicker?: string;
  title?: string;
  subtitle?: string;
  onSeeAll?: () => void;
}

export function TodaysEdit({
  products,
  kicker = "Today · 02",
  title = "Three for today.",
  subtitle = "A small, considered edit. Curated by hand, refreshed at dawn, archived at dusk.",
  onSeeAll,
}: TodaysEditProps) {
  const router = useRouter();
  const trio = products.slice(0, 3);
  if (!trio.length) return null;

  return (
    <View style={styles.wrap}>
      {/* Date stamp */}
      <View style={styles.stampRow}>
        <View style={{ alignItems: "flex-end" }}>
          <Label style={styles.stampKicker}>Edited</Label>
          <Display size="2xl" style={styles.stampDate}>
            <Display size="2xl" style={styles.stampDate}>
              {formatStampDate(new Date())}
            </Display>
          </Display>
        </View>
        <View style={styles.dawnStamp}>
          <Label style={styles.dawnStampText}>Dawn edit</Label>
        </View>
      </View>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.kickerRow}>
            <View style={styles.kickerRule} />
            <Label style={styles.kickerText}>{kicker}</Label>
          </View>
          <Display size="3xl" style={styles.title}>
            {title}
          </Display>
        </View>
        {subtitle ? (
          <Body muted size="sm" style={styles.subtitle}>
            {subtitle}
          </Body>
        ) : null}
      </View>

      {/* Trio */}
      <View style={styles.trio}>
        {trio.map((p, i) => (
          <TrioCard
            key={p.id}
            product={p}
            index={i}
            onPress={() => router.push(`/(main)/products/${p.slug}`)}
          />
        ))}
      </View>

      {/* Footer ribbon */}
      <View style={styles.footer}>
        <View style={styles.footerLeft}>
          <View style={styles.liveDot} />
          <Label style={styles.footerText}>
            Next rotation in <MonoCountdown hours={14} minutes={22} />
          </Label>
        </View>
        {onSeeAll ? (
          <TouchableOpacity activeOpacity={0.7} onPress={onSeeAll} style={styles.footerLink}>
            <Label style={styles.footerLinkText}>Browse the full editor's shelf</Label>
            <Ionicons name="arrow-up" size={12} color={colors.light.primary} />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

function TrioCard({
  product,
  index,
  onPress,
}: {
  product: Product;
  index: number;
  onPress: () => void;
}) {
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fade, {
      toValue: 1,
      duration: 600,
      delay: index * 100,
      useNativeDriver: true,
    }).start();
  }, [fade, index]);

  const img = product.images?.[0]?.url;
  const discount =
    product.mrp > product.price
      ? Math.round(((product.mrp - product.price) / product.mrp) * 100)
      : 0;
  const translateY = index === 1 ? 12 : 0; // stagger middle card

  return (
    <Animated.View
      style={[
        styles.card,
        index === 1 && styles.cardStagger,
        { opacity: fade, transform: [{ translateY }] },
      ]}
    >
      <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={styles.cardInner}>
        {/* Roman header */}
        <View style={styles.cardHeader}>
          <Display size="3xl" style={styles.romanNumeral}>
            {ROMAN[index]}
          </Display>
          <View style={styles.cardTimeRow}>
            <Ionicons name="time-outline" size={11} color={colors.light.mutedForeground} />
            <Label style={styles.cardTimeText}>{TIMES[index]}</Label>
          </View>
        </View>

        {/* Image */}
        <View style={styles.imageWrap}>
          {img ? (
            <Image source={{ uri: img }} style={StyleSheet.absoluteFill} contentFit="cover" transition={400} />
          ) : null}
          <View style={styles.imageTint} />
          <View style={styles.moodChip}>
            <Label style={styles.moodChipText}>{MOODS[index]}</Label>
          </View>
        </View>

        {/* Caption */}
        <View style={styles.cardBody}>
          <Label style={styles.cardBrand}>
            {product.brand?.name ? `Atelier · ${product.brand.name}` : "House pick"}
          </Label>
          <Display size="xl" style={styles.cardName} numberOfLines={2}>
            {product.name}
          </Display>
          <View style={styles.priceRow}>
            <Price size="base">{formatPrice(product.price)}</Price>
            {discount > 0 ? (
              <Body muted size="xs" style={styles.mrp}>
                {formatPrice(product.mrp)}
              </Body>
            ) : null}
            <View style={styles.arrowChip}>
              <Ionicons name="arrow-up" size={12} color={colors.light.primary} />
            </View>
          </View>
        </View>

        {/* Tail pull */}
        <View style={styles.tailPull} />
      </TouchableOpacity>
    </Animated.View>
  );
}

function MonoCountdown({ hours, minutes }: { hours: number; minutes: number }) {
  return (
    <Label style={styles.countdownText}>
      {String(hours).padStart(2, "0")}h {String(minutes).padStart(2, "0")}m
    </Label>
  );
}

function formatStampDate(d: Date) {
  const day = d.getDate().toString().padStart(2, "0");
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const year = (d.getFullYear() % 100).toString().padStart(2, "0");
  return `${day} · ${month} · ${year}`;
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 20,
    paddingTop: spacing[10],
    paddingBottom: spacing[8],
  },
  stampRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "flex-end",
    gap: spacing[3],
    marginBottom: spacing[3],
  },
  stampKicker: { color: colors.light.mutedForeground, textAlign: "right" },
  stampDate: { color: colors.light.foreground, opacity: 0.8, lineHeight: 28 },
  dawnStamp: {
    borderWidth: 2,
    borderColor: colors.light.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    transform: [{ rotate: "-4deg" }],
  },
  dawnStampText: { color: colors.light.primary, fontSize: 10 },
  header: { marginBottom: spacing[6] },
  headerLeft: { gap: 4 },
  kickerRow: { flexDirection: "row", alignItems: "center", gap: spacing[2], marginBottom: 6 },
  kickerRule: { width: 24, height: 1, backgroundColor: colors.light.primary },
  kickerText: { color: colors.light.primary },
  title: { color: colors.light.foreground },
  subtitle: { marginTop: spacing[2] },
  // Trio cards
  trio: { gap: spacing[4] },
  card: {
    backgroundColor: colors.light.card,
    borderRadius: radii["2xl"],
    borderWidth: 1,
    borderColor: colors.light.border,
    overflow: "hidden",
    ...shadows.soft,
  },
  cardStagger: { marginTop: 12 },
  cardInner: { paddingTop: spacing[4] },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  romanNumeral: { color: colors.light.primary, fontSize: 28, lineHeight: 28 },
  cardTimeRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  cardTimeText: { color: colors.light.mutedForeground, fontSize: 10 },
  imageWrap: {
    height: 280,
    backgroundColor: colors.olive[100],
    overflow: "hidden",
    position: "relative",
  },
  imageTint: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(22, 26, 10, 0.15)" },
  moodChip: {
    position: "absolute",
    top: spacing[3],
    left: spacing[3],
    backgroundColor: "rgba(250, 248, 241, 0.95)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  moodChipText: { color: colors.light.primary, fontSize: 10 },
  cardBody: { padding: spacing[4], gap: 6 },
  cardBrand: { color: colors.light.mutedForeground },
  cardName: { color: colors.light.foreground, fontSize: 22 },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: spacing[2],
  },
  mrp: { textDecorationLine: "line-through" },
  arrowChip: {
    marginLeft: "auto",
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.olive[50],
    alignItems: "center",
    justifyContent: "center",
  },
  tailPull: {
    position: "absolute",
    bottom: 0,
    left: 24,
    right: 24,
    height: 1,
    backgroundColor: colors.light.primary,
    opacity: 0.4,
  },
  // Footer
  footer: {
    marginTop: spacing[6],
    paddingTop: spacing[4],
    borderTopWidth: 1,
    borderTopColor: colors.light.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: spacing[2],
  },
  footerLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.light.primary,
  },
  footerText: { color: colors.light.mutedForeground },
  countdownText: { color: colors.light.foreground },
  footerLink: { flexDirection: "row", alignItems: "center", gap: 4 },
  footerLinkText: { color: colors.light.foreground },
});
