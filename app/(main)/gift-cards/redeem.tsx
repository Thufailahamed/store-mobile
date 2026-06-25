import React, { useState } from "react";
import { View, TextInput, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@/components/ui/Icon";
import { Button, useToast, Card } from "@/components/ui";
import { Display, Label, Body } from "@/components/ui/Typography";
import { ScreenHeader } from "@/components/layout";
import { checkGiftCardByCode } from "@/lib/api";
import { colors, radii, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";

const REASONS: Record<string, string> = {
  not_found: "Code not found.",
  voided: "This card has been voided.",
  expired: "This card has expired.",
  inactive: "This card is no longer active.",
  empty: "This card has no balance left.",
  scheduled: "This card is scheduled for delivery and not yet active.",
  currency_mismatch: "Card currency doesn't match your cart.",
};

export default function RedeemGiftCardScreen() {
  const { toast } = useToast();
  const [code, setCode] = useState("");
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<{
    valid: boolean;
    card: { code: string; current_balance: number; currency: string; recipient_name: string | null; message: string | null; expires_at: string | null } | null;
    reason: string | null;
  } | null>(null);

  const onCheck = async () => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 4) {
      toast("Enter a valid code", "error");
      return;
    }
    setChecking(true);
    const res = await checkGiftCardByCode(trimmed);
    setChecking(false);
    if (!res.ok) {
      toast(res.error || "Lookup failed", "error");
      return;
    }
    setResult(res.data as typeof result);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.light.background }}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
        <ScreenHeader title="Redeem" />
        <Card style={{ padding: 16, gap: 10 }}>
          <Label>Code</Label>
          <TextInput
            style={styles.input}
            value={code}
            onChangeText={(v) => setCode(v.toUpperCase())}
            placeholder="XXXX-XXXX-XXXX"
            placeholderTextColor={colors.light.mutedForeground}
            autoCapitalize="characters"
            maxLength={40}
          />
          <Button onPress={onCheck} disabled={checking || code.length < 4}>
            {checking ? "Checking…" : "Check balance"}
          </Button>
        </Card>

        {result && (
          <Card style={{ ...styles.resultCard, borderColor: result.valid ? colors.olive[500] : "#d4a373" }}>
            {result.valid && result.card ? (
              <View style={{ gap: 6 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Ionicons name="checkmark-circle" size={20} color={colors.olive[600]} />
                  <Body style={{ fontWeight: "600" }}>{result.card.code}</Body>
                </View>
                <Display size="lg">{formatPrice(result.card.current_balance, result.card.currency)}</Display>
                {result.card.message && (
                  <Body muted style={{ marginTop: 4, fontStyle: "italic" }}>"{result.card.message}"</Body>
                )}
                {result.card.expires_at && (
                  <Body size="sm" muted style={{ marginTop: 4 }}>
                    Expires {new Date(result.card.expires_at).toLocaleDateString()}
                  </Body>
                )}
              </View>
            ) : (
              <View style={{ gap: 6 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Ionicons name="close-circle" size={20} color="#b45309" />
                  <Body style={{ fontWeight: "600" }}>Cannot be used</Body>
                </View>
                <Body muted size="sm">{result.reason ? (REASONS[result.reason] ?? result.reason) : "Unknown reason"}</Body>
              </View>
            )}
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: colors.light.card,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: fontFamilies.sans.regular,
    color: colors.light.foreground,
    fontSize: 14,
  },
  resultCard: {
    padding: 16,
    borderWidth: 1,
    ...shadows.soft,
  },
});
