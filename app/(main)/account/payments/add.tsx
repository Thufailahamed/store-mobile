import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@/components/ui/Icon";
import { Button } from "@/components/ui";
import { Body, Display, Label } from "@/components/ui/Typography";
import { ScreenHeader } from "@/components/layout";
import { colors, radii, spacing } from "@/lib/theme/tokens";

/** Cards are entered on PayHere at checkout — never collected in-app. */
export default function AddPaymentMethodScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader title="Payment methods" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.iconWrap}>
          <Ionicons name="lock-closed-outline" size={28} color={colors.olive[700]} />
        </View>
        <Display size="xl">Pay securely with PayHere</Display>
        <Body muted style={styles.copy}>
          Card numbers are entered on PayHere&apos;s hosted checkout when you place an order.
          LUXE never collects or stores your full card number, CVV, or PAN.
        </Body>
        <Label style={styles.kicker}>At checkout you can</Label>
        <Body size="sm">• Pay by Visa, Mastercard, or Amex via PayHere</Body>
        <Body size="sm">• Pay cash on delivery when the store allows it</Body>
        <Button style={styles.cta} onPress={() => router.push("/(main)/checkout")}>
          Go to checkout
        </Button>
        <Button variant="outline" onPress={() => router.back()}>
          Back
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  content: { padding: spacing[5], gap: spacing[3] },
  iconWrap: {
    height: 64,
    width: 64,
    borderRadius: radii.lg,
    backgroundColor: colors.olive[100],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing[2],
  },
  copy: { lineHeight: 22 },
  kicker: { marginTop: spacing[3], color: colors.olive[700] },
  cta: { marginTop: spacing[4] },
});
