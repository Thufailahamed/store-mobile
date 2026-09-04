import React, { useState } from "react";
import { View, Text, TextInput, Switch, StyleSheet } from "react-native";
import { fontFamilies } from "@/lib/theme/fonts";
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
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Gift wrap</Text>
          <Text style={styles.sub}>+{formatPrice(GIFT_WRAP_FEE)} · optional note</Text>
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
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E5E7EB",
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  title: { fontFamily: fontFamilies.sans.medium, fontSize: 13, color: INK },
  sub: { fontFamily: fontFamilies.sans.regular, fontSize: 11, color: MUTED, marginTop: 2 },
  input: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    color: INK,
  },
});
