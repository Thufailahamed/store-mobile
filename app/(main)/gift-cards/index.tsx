import React, { useState } from "react";
import {
  View, Text, ScrollView, TextInput, StyleSheet, Pressable,
  ActivityIndicator, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@/components/ui/Icon";
import { Button, useToast, Card } from "@/components/ui";
import { Display, Label, Body } from "@/components/ui/Typography";
import { ScreenHeader } from "@/components/layout";
import { useAuth } from "@/lib/supabase/auth";
import { purchaseGiftCard } from "@/lib/api";
import { colors, radii, shadows, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";

const AMOUNTS = [2500, 5000, 10000, 20000, 50000, 100000];

export default function GiftCardsScreen() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [amount, setAmount] = useState(5000);
  const [recipient, setRecipient] = useState({ name: "", email: "", message: "" });
  const [scheduled, setScheduled] = useState(false);
  const [scheduledHours, setScheduledHours] = useState("24");
  const [purchasing, setPurchasing] = useState(false);
  const [purchased, setPurchased] = useState<{ code: string; balance: number; currency: string; scheduled_for: string | null } | null>(null);

  const onPurchase = async () => {
    if (!user) return;
    if (!recipient.email.includes("@")) {
      Alert.alert("Recipient email required");
      return;
    }
    let scheduled_for: string | undefined;
    if (scheduled) {
      const hours = Number(scheduledHours);
      if (!Number.isFinite(hours) || hours <= 0) {
        Alert.alert("Enter hours > 0");
        return;
      }
      scheduled_for = new Date(Date.now() + hours * 3_600_000).toISOString();
    }
    setPurchasing(true);
    const res = await purchaseGiftCard({
      amount,
      currency: "LKR",
      recipient_email: recipient.email,
      recipient_name: recipient.name || undefined,
      message: recipient.message || undefined,
      scheduled_for,
    });
    setPurchasing(false);
    if (res.ok) {
      const card = res.data.card as { code: string; current_balance: number; currency: string; scheduled_for: string | null };
      setPurchased({
        code: card.code,
        balance: Number(card.current_balance),
        currency: card.currency,
        scheduled_for: card.scheduled_for,
      });
      setRecipient({ name: "", email: "", message: "" });
      toast("Card created", "success");
    } else {
      toast(res.error || "Failed", "error");
    }
  };

  if (purchased) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.light.background }}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
          <ScreenHeader title="Card ready" />
          <Card style={styles.successCard}>
            <Ionicons name="checkmark-circle" size={48} color={colors.olive[600]} style={{ alignSelf: "center" }} />
            <Display size="lg" style={{ textAlign: "center", marginTop: 12 }}>{purchased.code}</Display>
            <Body muted style={{ textAlign: "center", marginTop: 6 }}>
              Balance: {formatPrice(purchased.balance, purchased.currency)}
            </Body>
            {purchased.scheduled_for && (
              <Body size="sm" muted style={{ textAlign: "center", marginTop: 4 }}>
                Scheduled for {new Date(purchased.scheduled_for).toLocaleString()}
              </Body>
            )}
            <Button onPress={() => setPurchased(null)} style={{ marginTop: 16 }}>
              Buy another
            </Button>
          </Card>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.light.background }}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
        <ScreenHeader title="Gift cards" />

        <Card style={{ padding: 16 }}>
          <Label>Amount</Label>
          <View style={styles.amtGrid}>
            {AMOUNTS.map((a) => (
              <Pressable
                key={a}
                onPress={() => setAmount(a)}
                style={[styles.amtBtn, amount === a && styles.amtBtnActive]}
              >
                <Body style={{ fontWeight: "700", fontSize: 13 }}>{formatPrice(a)}</Body>
              </Pressable>
            ))}
          </View>
          <View style={{ marginTop: 10 }}>
            <TextInput
              style={styles.input}
              value={String(amount)}
              onChangeText={(v) => setAmount(Number(v) || 0)}
              keyboardType="numeric"
              placeholder="Custom amount"
              placeholderTextColor={colors.light.mutedForeground}
            />
          </View>
        </Card>

        <Card style={{ padding: 16, gap: 10 }}>
          <Label>Recipient</Label>
          <TextInput
            style={styles.input}
            value={recipient.name}
            onChangeText={(v) => setRecipient({ ...recipient, name: v })}
            placeholder="Name (optional)"
            placeholderTextColor={colors.light.mutedForeground}
          />
          <TextInput
            style={styles.input}
            value={recipient.email}
            onChangeText={(v) => setRecipient({ ...recipient, email: v })}
            placeholder="Email *"
            keyboardType="email-address"
            autoCapitalize="none"
            placeholderTextColor={colors.light.mutedForeground}
          />
          <TextInput
            style={[styles.input, { minHeight: 70 }]}
            value={recipient.message}
            onChangeText={(v) => setRecipient({ ...recipient, message: v })}
            placeholder="Personal message (optional)"
            placeholderTextColor={colors.light.mutedForeground}
            multiline
          />
        </Card>

        <Card style={{ padding: 16, gap: 10 }}>
          <View style={styles.row}>
            <Label>Send later</Label>
            <Pressable onPress={() => setScheduled((s) => !s)} style={styles.toggle}>
              <View style={[styles.toggleKnob, scheduled && styles.toggleKnobOn]} />
            </Pressable>
          </View>
          {scheduled && (
            <TextInput
              style={styles.input}
              value={scheduledHours}
              onChangeText={setScheduledHours}
              placeholder="Hours from now"
              keyboardType="numeric"
              placeholderTextColor={colors.light.mutedForeground}
            />
          )}
        </Card>

        <Button onPress={onPurchase} disabled={purchasing || !recipient.email}>
          {purchasing ? <ActivityIndicator color="#fff" /> : scheduled ? "Schedule card" : "Send card"}
        </Button>
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
  amtGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  amtBtn: {
    flexBasis: "31%", flexGrow: 1,
    paddingVertical: 12, paddingHorizontal: 8,
    borderRadius: radii.md,
    borderWidth: 1, borderColor: colors.light.border,
    alignItems: "center",
  },
  amtBtnActive: { borderColor: colors.olive[700], backgroundColor: colors.olive[50] },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  toggle: {
    width: 44, height: 26, borderRadius: 13,
    backgroundColor: colors.light.muted, padding: 2,
  },
  toggleKnob: { width: 22, height: 22, borderRadius: 11, backgroundColor: "#fff" },
  toggleKnobOn: { transform: [{ translateX: 18 }], backgroundColor: colors.olive[700] },
  successCard: { padding: 24, gap: 8, alignItems: "center", ...shadows.soft },
});
