import React, { useEffect, useState } from "react";
import { View, StyleSheet, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@/components/ui/Icon";
import { fontFamilies } from "@/lib/theme/fonts";
import { radii } from "@/lib/theme/tokens";
import { formatPrice } from "@/lib/utils";
import { useAuth } from "@/lib/supabase/auth";
import { getWardrobeOverlap } from "@/lib/api/wardrobe";
import type { WardrobeOverlapItem } from "@/lib/types";

const AMBER = "#b45309";
const AMBER_BG = "rgba(217,119,6,0.10)";
const AMBER_RING = "rgba(217,119,6,0.30)";

export function OverlapWarningBanner({
  productId,
  onOpenWardrobe,
}: {
  productId: string;
  onOpenWardrobe?: () => void;
}) {
  const { user } = useAuth();
  const [overlap, setOverlap] = useState<WardrobeOverlapItem | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!user?.id) {
      setOverlap(null);
      return;
    }
    setLoading(true);
    getWardrobeOverlap([productId])
      .then((res) => {
        if (cancelled) return;
        if (res.ok) {
          const first = (res.data.overlaps as WardrobeOverlapItem[])[0] ?? null;
          setOverlap(first);
        } else {
          setOverlap(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id, productId]);

  if (!user?.id || loading || !overlap) return null;

  const cpw = typeof overlap.cost_per_wear === "number" ? overlap.cost_per_wear : null;

  return (
    <View style={styles.banner}>
      <Ionicons name="alert-circle" size={16} color={AMBER} />
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>You already own this</Text>
        <Text style={styles.meta}>
          Worn {overlap.wear_count}×
          {cpw ? ` · CPW ${formatPrice(cpw)}` : ""}
        </Text>
      </View>
      {onOpenWardrobe && (
        <TouchableOpacity onPress={onOpenWardrobe} hitSlop={8}>
          <Text style={styles.link}>View</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles: Record<string, any> = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: AMBER_BG,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: AMBER_RING,
  },
  title: {
    fontSize: 12,
    fontFamily: fontFamilies.sans.regular,
    fontWeight: "700",
    color: AMBER,
  },
  meta: {
    fontSize: 11,
    fontFamily: fontFamilies.sans.regular,
    color: AMBER,
    marginTop: 2,
    opacity: 0.85,
  },
  link: {
    fontSize: 11,
    fontFamily: fontFamilies.sans.regular,
    fontWeight: "700",
    color: AMBER,
    textDecorationLine: "underline",
  },
});