import React, { useState } from "react";
import { View, Text, FlatList, Pressable, RefreshControl, StyleSheet, Alert, Modal } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@/components/ui/Icon";
import { getAdminBroadcasts, sendBroadcast } from "@/lib/api";
import { Card, EmptyState, Badge, Skeleton, Input, Button } from "@/components/ui";
import { colors, typography, radii, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

function rel(s: string) {
  const d = new Date(s).getTime();
  const m = Math.floor((Date.now() - d) / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default function AdminNotifications() {
  const qc = useQueryClient();
  const [showSend, setShowSend] = useState(false);
  const q = useQuery({
    queryKey: ["admin-broadcasts"],
    queryFn: async () => {
      const r = await getAdminBroadcasts();
      return r.ok ? r.data : [];
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>BROADCASTS</Text>
          <Text style={styles.title}>Notifications</Text>
        </View>
        <Pressable onPress={() => setShowSend(true)} style={styles.addBtn}>
          <Ionicons name="send" size={16} color="#fff" />
        </Pressable>
      </View>

      <FlatList
        data={q.data ?? []}
        keyExtractor={(b: any) => b.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} />}
        ListEmptyComponent={q.isLoading ? <Skeleton height={80} /> : <EmptyState icon="notifications-outline" title="No broadcasts" description="Tap send above to start a campaign." />}
        renderItem={({ item, index }: any) => (
          <Card style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.index}>{String(index + 1).padStart(2, "0")}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.title2}>{item.title}</Text>
                <Text style={styles.body} numberOfLines={2}>{item.body}</Text>
                <Text style={styles.meta}>
                  {item.audience} · {item.channel} · {rel(item.sent_at)}
                </Text>
              </View>
            </View>
          </Card>
        )}
      />

      <SendModal visible={showSend} onClose={() => setShowSend(false)} onSent={() => { qc.invalidateQueries({ queryKey: ["admin-broadcasts"] }); setShowSend(false); }} />
    </View>
  );
}

function SendModal({ visible, onClose, onSent }: { visible: boolean; onClose: () => void; onSent: () => void }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<"all" | "customers" | "stores" | "brands">("all");
  const [channel, setChannel] = useState<"push" | "email" | "sms">("push");
  const [loading, setLoading] = useState(false);

  const send = async () => {
    if (!title.trim() || !body.trim()) return Alert.alert("Missing fields", "Title and body required");
    setLoading(true);
    const r = await sendBroadcast({ title, body, audience, channel });
    setLoading(false);
    if (r.ok) { setTitle(""); setBody(""); onSent(); }
    else Alert.alert("Error", r.error);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modal}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>New Broadcast</Text>
          <Pressable onPress={onClose}><Ionicons name="close" size={22} color={colors.light.foreground} /></Pressable>
        </View>
        <Input label="Title" value={title} onChangeText={setTitle} placeholder="Flash sale: 24h only" />
        <View style={{ height: 12 }} />
        <Input label="Body" value={body} onChangeText={setBody} placeholder="Tap to shop the drop" multiline numberOfLines={3} />
        <View style={{ height: 12 }} />
        <Text style={styles.fieldLabel}>Audience</Text>
        <View style={styles.row2}>
          {(["all", "customers", "stores", "brands"] as const).map((a) => (
            <Pressable key={a} onPress={() => setAudience(a)} style={[styles.chip, audience === a && styles.chipActive]}>
              <Text style={[styles.chipText, audience === a && styles.chipTextActive]}>{a}</Text>
            </Pressable>
          ))}
        </View>
        <View style={{ height: 12 }} />
        <Text style={styles.fieldLabel}>Channel</Text>
        <View style={styles.row2}>
          {(["push", "email", "sms"] as const).map((c) => (
            <Pressable key={c} onPress={() => setChannel(c)} style={[styles.chip, channel === c && styles.chipActive]}>
              <Text style={[styles.chipText, channel === c && styles.chipTextActive]}>{c}</Text>
            </Pressable>
          ))}
        </View>
        <View style={{ height: 24 }} />
        <Button onPress={send} loading={loading}>Send Broadcast</Button>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  header: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", padding: 20, paddingBottom: 12 },
  eyebrow: { fontFamily: fontFamilies.mono.medium, fontSize: 10, color: colors.light.primary, letterSpacing: 1.4 },
  title: { fontFamily: fontFamilies.display.regular, fontSize: 28, color: colors.light.foreground, marginTop: 4, letterSpacing: -0.5 },
  addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.light.primary, alignItems: "center", justifyContent: "center" },
  list: { padding: 20, paddingBottom: 100, gap: 10 },
  card: { padding: 14, ...shadows.soft },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  index: { fontFamily: fontFamilies.mono.regular, fontSize: 11, color: colors.light.mutedForeground, width: 24, marginTop: 2 },
  title2: { fontFamily: fontFamilies.sans.semibold, fontSize: 14, color: colors.light.foreground },
  body: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: colors.light.mutedForeground, marginTop: 4, lineHeight: 18 },
  meta: { fontFamily: fontFamilies.mono.regular, fontSize: 10, color: colors.light.mutedForeground, marginTop: 6, letterSpacing: 0.5, textTransform: "uppercase" },
  modal: { flex: 1, backgroundColor: colors.light.background, padding: 20, paddingTop: 60 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  modalTitle: { fontFamily: fontFamilies.display.regular, fontSize: 22, color: colors.light.foreground },
  fieldLabel: { fontFamily: fontFamilies.mono.medium, fontSize: 11, color: colors.light.foreground, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8 },
  row2: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.light.card, borderWidth: 1, borderColor: colors.light.border },
  chipActive: { backgroundColor: colors.light.primary, borderColor: colors.light.primary },
  chipText: { fontFamily: fontFamilies.mono.medium, fontSize: 10, color: colors.light.mutedForeground, letterSpacing: 0.5, textTransform: "uppercase" },
  chipTextActive: { color: "#fff" },
});
