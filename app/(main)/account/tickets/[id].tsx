import React, { useCallback, useState } from "react";
import { ScrollView, StyleSheet, TextInput } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { ScreenHeader } from "@/components/layout";
import { Button, useToast } from "@/components/ui";
import { Body, Display, Label } from "@/components/ui/Typography";
import { fetchJson } from "@/lib/api/backend";
import { colors, radii, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

type Message = { id: string; body: string; created_at: string; is_internal?: boolean };

export default function TicketDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { toast } = useToast();
  const [subject, setSubject] = useState("");
  const [status, setStatus] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const res = await fetchJson<{ ticket?: { subject: string; status: string }; messages?: Message[] }>(
      `/api/tickets/${id}`,
    );
    if (!res.ok) {
      toast(res.error ?? "Could not load ticket", "error");
      return;
    }
    setSubject(res.data.ticket?.subject ?? "Ticket");
    setStatus(res.data.ticket?.status ?? "");
    setMessages((res.data.messages ?? []).filter((m) => !m.is_internal));
  }, [id, toast]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const send = async () => {
    if (!id || !reply.trim()) return;
    setSending(true);
    const res = await fetchJson(`/api/tickets/${id}/messages`, {
      method: "POST",
      body: { body: reply.trim() },
    });
    setSending(false);
    if (!res.ok) {
      toast(res.error ?? "Could not send", "error");
      return;
    }
    setReply("");
    await load();
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader title={subject || "Ticket"} />
      <ScrollView contentContainerStyle={styles.content}>
        {status ? <Label>{status.replace(/_/g, " ")}</Label> : null}
        {messages.map((m) => (
          <Body key={m.id} style={styles.msg}>
            {m.body}
          </Body>
        ))}
        <TextInput
          style={styles.input}
          value={reply}
          onChangeText={setReply}
          placeholder="Reply"
          multiline
        />
        <Button onPress={send} loading={sending}>Send reply</Button>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  content: { padding: spacing[5], gap: spacing[3] },
  msg: {
    padding: spacing[3],
    borderRadius: radii.md,
    backgroundColor: colors.light.card,
  },
  input: {
    minHeight: 100,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.light.border,
    padding: spacing[3],
    fontFamily: fontFamilies.sans.regular,
    color: colors.light.foreground,
    textAlignVertical: "top",
  },
});
