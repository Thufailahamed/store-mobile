import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@/components/ui/Icon";
import { fontFamilies } from "@/lib/theme/fonts";
import { colors } from "@/lib/theme/tokens";
import { estimateDelivery } from "@/lib/delivery-estimate";

/** "Estimated delivery" row on the product page. */
export function DeliveryEstimate({ whatsapp }: { whatsapp: boolean }) {
  const estimate = useMemo(() => estimateDelivery({ whatsapp }), [whatsapp]);

  return (
    <View
      style={styles.card}
      accessible
      accessibilityLabel={`Estimated delivery ${estimate.label}`}
    >
      <View style={styles.icon}>
        <Ionicons name={whatsapp ? "airplane-outline" : "calendar-outline"} size={18} color={colors.olive[700]} />
      </View>
      <View style={styles.textWrap}>
        <Text style={styles.eyebrow}>ESTIMATED DELIVERY</Text>
        <Text style={styles.date}>{estimate.label}</Text>
        <Text style={styles.sub}>
          {whatsapp
            ? "Sourced abroad · arrives in 12–14 days"
            : "Arrives in 3 days · no Sunday deliveries"}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(65,74,35,0.18)",
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.olive[50],
  },
  textWrap: { flex: 1 },
  eyebrow: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 1.6,
    color: colors.light.mutedForeground,
  },
  date: {
    marginTop: 2,
    fontFamily: fontFamilies.sans.bold,
    fontSize: 16,
    color: colors.light.foreground,
  },
  sub: {
    marginTop: 2,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: colors.light.mutedForeground,
  },
});
