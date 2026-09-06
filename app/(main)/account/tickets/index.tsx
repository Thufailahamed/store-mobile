import React, { useCallback, useState } from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenHeader } from "@/components/layout";
import { Button, useToast } from "@/components/ui";
import { Body, Display, Label } from "@/components/ui/Typography";
import { fetchJson } from "@/lib/api/backend";
import { colors, radii, spacing } from "@/lib/theme/tokens";

type Ticket = {
  id: string;
  ticket_number?: string;
  subject: string;
  status: string;
  created_at: string;
};

export default function TicketsScreen() {
  const router = useRouter();
  const { toast } = useToast();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetchJson<{ tickets: Ticket[] }>("/api/tickets");
    setLoading(false);
    if (!res.ok) {
      toast(res.error ?? "Could not load tickets", "error");
      return;
    }
    const payload = res.data as { tickets?: Ticket[] } | Ticket[] | undefined;
    const list = Array.isArray(payload) ? payload : payload?.tickets ?? [];
    setTickets(list);
  }, [toast]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader title="Support tickets" />
      <ScrollView contentContainerStyle={styles.content}>
        <Button onPress={() => router.push("/(main)/account/tickets/new" as never)}>New ticket</Button>
        {loading ? (
          <Body muted>Loading…</Body>
        ) : tickets.length === 0 ? (
          <Body muted>No tickets yet. Open one if you need help with an order.</Body>
        ) : (
          tickets.map((t) => (
            <TouchableOpacity
              key={t.id}
              style={styles.card}
              onPress={() =>
                router.push({ pathname: "/(main)/account/tickets/[id]", params: { id: t.id } } as never)
              }
            >
              <Label>{t.ticket_number ?? t.id.slice(0, 8)}</Label>
              <Display size="lg">{t.subject}</Display>
              <Body size="sm" muted>
                {t.status.replace(/_/g, " ")} · {new Date(t.created_at).toLocaleDateString()}
              </Body>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  content: { padding: spacing[5], gap: spacing[3] },
  card: {
    padding: spacing[4],
    borderRadius: radii.lg,
    backgroundColor: colors.light.card,
    gap: 4,
  },
});
