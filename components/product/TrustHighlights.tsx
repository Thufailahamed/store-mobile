import React from "react";
import { View, StyleSheet } from "react-native";
import { Ionicons } from "@/components/ui/Icon";
import { Body } from "@/components/ui/Typography";
import { spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

const INK = "#141414";
const MUTED = "#6b6b6b";

type TrustItem = { icon: React.ComponentProps<typeof Ionicons>["name"]; label: string; sub: string };

/**
 * `acceptsReturns` / `returnWindowDays` come from the product's store
 * (0357). Undefined = accepts returns, so older payloads keep the old tile.
 */
export function TrustHighlights({
  acceptsReturns = true,
  returnWindowDays,
}: {
  acceptsReturns?: boolean;
  returnWindowDays?: number | null;
} = {}) {
  const items: TrustItem[] = [
    { icon: "car-outline", label: "Free Shipping", sub: "Islandwide" },
    { icon: "shield-checkmark-outline", label: "Secure Pay", sub: "256-bit SSL" },
    acceptsReturns
      ? { icon: "refresh-outline", label: "Returns available", sub: `Within ${returnWindowDays ?? 30} days` }
      : { icon: "ban-outline", label: "Returns not available", sub: "Final sale" },
  ];
  return (
    <View style={styles.shadow}>
      <View style={styles.container}>
        {items.map((item, i) => (
          <React.Fragment key={item.label}>
            {i > 0 && <View style={styles.separator} />}
            <View style={styles.item}>
              <View style={styles.iconBadge}>
                <Ionicons name={item.icon} size={19} color={INK} />
              </View>
              <Body size="xs" style={styles.label} numberOfLines={2}>{item.label}</Body>
              <Body size="xs" style={styles.sub} numberOfLines={1}>{item.sub}</Body>
            </View>
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    marginHorizontal: spacing[4],
    borderRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 22,
    elevation: 3,
  },
  container: {
    flexDirection: "row",
    alignItems: "stretch",
    paddingVertical: spacing[5],
    paddingHorizontal: spacing[1],
    borderRadius: 24,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },
  iconBadge: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f4f4f2",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
    marginBottom: 4,
  },
  item: {
    flex: 1,
    alignItems: "center",
    gap: 2,
    paddingHorizontal: spacing[1],
  },
  separator: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(0,0,0,0.1)",
    marginVertical: spacing[2],
  },
  label: {
    marginTop: 4,
    color: INK,
    fontFamily: fontFamilies.sans.bold,
    fontSize: 12.5,
    textAlign: "center",
  },
  sub: {
    textAlign: "center",
    fontSize: 11,
    color: MUTED,
    fontFamily: fontFamilies.sans.regular,
  },
});
