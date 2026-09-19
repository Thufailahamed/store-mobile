import React, { useState } from "react";
import { View, Text, TextInput, Switch, StyleSheet } from "react-native";
import { Ionicons } from "@/components/ui/Icon";
import { fontFamilies } from "@/lib/theme/fonts";
import { colors, radii } from "@/lib/theme/tokens";
import { GIFT_WRAP_FEE } from "@/lib/cart-pricing";
import { formatPrice } from "@/lib/utils";

const INK = "#161823";
const MUTED = "#8A8B91";

interface GiftWrapToggleProps {
  isGift: boolean;
  message?: string | null;
  onChange: (isGift: boolean, message: string) => void;
}

export function GiftWrapToggle({ isGift, message, onChange }: GiftWrapToggleProps) {
  const [draft, setDraft] = useState(message ?? "");

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={styles.giftIcon}>
          <Ionicons name="gift-outline" size={16} color={colors.olive[700]} />
        </View>
        <View style={styles.textWrap}>
          <Text style={styles.title}>Add gift wrap</Text>
          <Text style={styles.sub}>+{formatPrice(GIFT_WRAP_FEE)} · include an optional note</Text>
        </View>
        <Switch
          value={isGift}
          onValueChange={(v) => onChange(v, draft)}
          trackColor={{ false: "#E5E7EB", true: "#97A85E" }}
        />
      </View>
      {isGift ? (
        <TextInput
          value={draft}
          onChangeText={(t) => {
            const next = t.slice(0, 200);
            setDraft(next);
            onChange(true, next);
          }}
          placeholder="Gift message (optional)"
          placeholderTextColor={MUTED}
          style={styles.input}
          maxLength={200}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.light.border,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  giftIcon: {
    width: 32,
    height: 32,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${colors.olive[500]}12`,
  },
  textWrap: { flex: 1 },
  title: { fontFamily: fontFamilies.sans.semibold, fontSize: 13, color: INK },
  sub: { fontFamily: fontFamilies.sans.regular, fontSize: 11, color: MUTED, marginTop: 2 },
  input: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.lg,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    color: INK,
  },
});
