import React, { useState } from "react";
import { ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenHeader } from "@/components/layout";
import { Button, useToast } from "@/components/ui";
import { Body, Label } from "@/components/ui/Typography";
import { fetchJson } from "@/lib/api/backend";
import { colors, radii, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

export default function NewTicketScreen() {
  const router = useRouter();
  const { toast } = useToast();
  const params = useLocalSearchParams<{ orderId?: string }>();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!subject.trim() || !body.trim()) {
      toast("Subject and message required", "error");
      return;
    }
    setSaving(true);
    const res = await fetchJson<{ ticket?: { id: string } }>("/api/tickets", {
      method: "POST",
      body: {
        subject: subject.trim(),
        category: "order_issue",
        priority: "normal",
        body: body.trim(),
        order_id: params.orderId || undefined,
      },
    });
    setSaving(false);
    if (!res.ok) {
      toast(res.error ?? "Could not open ticket", "error");
      return;
    }
    toast("Ticket opened", "success");
    const id = res.data.ticket?.id;
    router.replace(
      (id
        ? { pathname: "/(main)/account/tickets/[id]", params: { id } }
        : "/(main)/account/tickets") as never,
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader title="New ticket" />
      <ScrollView contentContainerStyle={styles.content}>
        <Label>Subject</Label>
        <TextInput style={styles.input} value={subject} onChangeText={setSubject} placeholder="What do you need help with?" />
        <Label>Message</Label>
        <TextInput
          style={[styles.input, styles.area]}
          value={body}
          onChangeText={setBody}
          placeholder="Describe the issue"
          multiline
        />
        <Button onPress={submit} loading={saving}>Submit</Button>
        <Body muted size="sm">Our team replies in-app. You can also email from Contact support.</Body>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  content: { padding: spacing[5], gap: spacing[3] },
  input: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.light.border,
    padding: spacing[3],
    fontFamily: fontFamilies.sans.regular,
    color: colors.light.foreground,
  },
  area: { minHeight: 140, textAlignVertical: "top" },
});
