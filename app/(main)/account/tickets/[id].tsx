import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@/components/ui/Icon";
import { useToast } from "@/components/ui";
import { fetchJson } from "@/lib/api/backend";
import { colors, radii, shadows, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

type Message = {
  id: string;
  body: string;
  created_at: string;
  is_internal?: boolean;
  user_id?: string;
};

function getStatusMeta(status: string) {
  const norm = status.toLowerCase().replace(/[\s_]+/g, "_");
  switch (norm) {
    case "awaiting_support":
      return {
        label: "AWAITING CONCIERGE",
        color: "#85651B",
        bg: "#FDF8E8",
        border: "#F5E4B5",
        icon: "time-outline" as const,
      };
    case "open":
      return {
        label: "ACTIVE REVIEW",
        color: "#2C5E8A",
        bg: "#EDF5FC",
        border: "#CCE3F6",
        icon: "flash-outline" as const,
      };
    case "awaiting_customer":
      return {
        label: "ACTION REQUIRED",
        color: "#734B8F",
        bg: "#F8F2FC",
        border: "#E9D5F7",
        icon: "chatbubble-ellipses-outline" as const,
      };
    case "resolved":
      return {
        label: "RESOLVED",
        color: "#2B6E3F",
        bg: "#EBF7EE",
        border: "#C5E6CC",
        icon: "checkmark-circle-outline" as const,
      };
    case "closed":
      return {
        label: "ARCHIVED",
        color: "#787469",
        bg: "#F2EFE9",
        border: "#E0DDD5",
        icon: "archive-outline" as const,
      };
    default:
      return {
        label: status.toUpperCase().replace(/_/g, " "),
        color: "#85651B",
        bg: "#F7F5EE",
        border: "#E6E2D4",
        icon: "help-circle-outline" as const,
      };
  }
}

export default function TicketDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { toast } = useToast();
  const [subject, setSubject] = useState("");
  const [status, setStatus] = useState("");
  const [ticketNumber, setTicketNumber] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (isManualRefresh = false) => {
      if (!id) return;
      if (isManualRefresh) setRefreshing(true);
      else setLoading(true);

      const res = await fetchJson<{
        ticket?: { subject: string; status: string; ticket_number?: string };
        messages?: Message[];
      }>(`/api/tickets/${id}`);

      setLoading(false);
      setRefreshing(false);

      if (!res.ok) {
        if (isManualRefresh) {
          toast(res.error ?? "Could not load ticket details", "error");
        }
        return;
      }
      setSubject(res.data.ticket?.subject ?? "Concierge Inquiry");
      setStatus(res.data.ticket?.status ?? "open");
      setTicketNumber(res.data.ticket?.ticket_number ?? id.slice(0, 9).toUpperCase());
      setMessages((res.data.messages ?? []).filter((m) => !m.is_internal));
    },
    [id, toast],
  );

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
      toast(res.error ?? "Could not transmit reply", "error");
      return;
    }
    setReply("");
    toast("Reply transmitted", "success");
    await load();
  };

  const meta = getStatusMeta(status);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      {/* Top Header */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={20} color="#141311" />
        </TouchableOpacity>

        <View style={styles.headerTitleCenter}>
          <Text style={styles.headerEyebrow}>LIAISON THREAD</Text>
          <Text style={styles.headerTitle}>{ticketNumber || "Inquiry Log"}</Text>
        </View>

        <TouchableOpacity
          onPress={() => load(true)}
          style={styles.refreshButton}
          activeOpacity={0.7}
        >
          <Ionicons
            name="refresh-outline"
            size={18}
            color={refreshing ? "#C8A44A" : "#141311"}
          />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor="#C8A44A"
              colors={["#C8A44A"]}
            />
          }
        >
          {/* Inquiry Banner Card */}
          <View style={styles.inquiryBannerCard}>
            <View style={styles.bannerTopRow}>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: meta.bg, borderColor: meta.border },
                ]}
              >
                <Ionicons name={meta.icon} size={11} color={meta.color} />
                <Text style={[styles.statusBadgeText, { color: meta.color }]}>
                  {meta.label}
                </Text>
              </View>

              <View style={styles.refPill}>
                <Ionicons name="shield-outline" size={11} color="#85651B" />
                <Text style={styles.refPillText}>ENCRYPTED LOG</Text>
              </View>
            </View>

            <Text style={styles.inquirySubject}>{subject}</Text>
          </View>

          {/* Messages Feed */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color="#C8A44A" size="large" />
              <Text style={styles.loadingText}>Synchronizing correspondence...</Text>
            </View>
          ) : (
            <View style={styles.messagesList}>
              {messages.length === 0 ? (
                <View style={styles.emptyMessagesCard}>
                  <Text style={styles.emptyMessagesText}>
                    No correspondence logged yet. Send a note to initialize dialog with the
                    concierge.
                  </Text>
                </View>
              ) : (
                messages.map((m, index) => {
                  const isFirst = index === 0;
                  return (
                    <View
                      key={m.id}
                      style={[
                        styles.messageCard,
                        isFirst ? styles.firstMessageCard : styles.replyMessageCard,
                      ]}
                    >
                      <View style={styles.messageHeader}>
                        <View style={styles.senderPill}>
                          <Ionicons
                            name={isFirst ? "person-outline" : "headset-outline"}
                            size={12}
                            color={isFirst ? "#414A23" : "#C8A44A"}
                          />
                          <Text
                            style={[
                              styles.senderPillText,
                              { color: isFirst ? "#414A23" : "#E8CF8F" },
                            ]}
                          >
                            {isFirst ? "PATRON INTAKE NOTE" : "ATELIER CONCIERGE DESK"}
                          </Text>
                        </View>

                        <Text style={styles.messageDate}>
                          {new Date(m.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {" · "}
                          {new Date(m.created_at).toLocaleDateString()}
                        </Text>
                      </View>

                      <Text style={styles.messageBody}>{m.body}</Text>
                    </View>
                  );
                })
              )}
            </View>
          )}

          {/* Reply Composition Box */}
          <View style={styles.replyBoxCard}>
            <Text style={styles.replyBoxLabel}>DISPATCH TRANSMISSION TO CONCIERGE</Text>
            <TextInput
              style={styles.replyInput}
              value={reply}
              onChangeText={setReply}
              placeholder="Draft your message or additional specifications..."
              placeholderTextColor="#9C988F"
              multiline
            />

            <TouchableOpacity
              style={[
                styles.sendButton,
                (!reply.trim() || sending) && { opacity: 0.6 },
              ]}
              disabled={!reply.trim() || sending}
              onPress={send}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={["#1E1C18", "#141311"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.sendGradient}
              >
                {sending ? (
                  <ActivityIndicator color="#E8CF8F" size="small" />
                ) : (
                  <>
                    <Text style={styles.sendButtonText}>Send Reply</Text>
                    <Ionicons name="arrow-forward" size={14} color="#E8CF8F" />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F5F4EF",
  },
  flex: {
    flex: 1,
  },
  topHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
    backgroundColor: "#F5F4EF",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E6E3DA",
    alignItems: "center",
    justifyContent: "center",
    ...shadows.soft,
  },
  headerTitleCenter: {
    alignItems: "center",
  },
  headerEyebrow: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9,
    letterSpacing: 1.8,
    color: "#85651B",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  headerTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 18,
    color: "#141311",
    letterSpacing: -0.3,
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E6E3DA",
    alignItems: "center",
    justifyContent: "center",
    ...shadows.soft,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  inquiryBannerCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#EAE7DF",
    padding: 18,
    marginBottom: 16,
    ...shadows.soft,
  },
  bannerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    letterSpacing: 0.8,
  },
  refPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F7F5EE",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  refPillText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    letterSpacing: 1,
    color: "#85651B",
  },
  inquirySubject: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 17,
    lineHeight: 23,
    color: "#141311",
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    color: "#8F8B82",
  },
  messagesList: {
    gap: 12,
    marginBottom: 16,
  },
  emptyMessagesCard: {
    padding: 24,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#EAE7DF",
    alignItems: "center",
  },
  emptyMessagesText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    lineHeight: 18,
    color: "#787469",
    textAlign: "center",
  },
  messageCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    ...shadows.soft,
  },
  firstMessageCard: {
    backgroundColor: "#FAF9F5",
    borderColor: "#E5E1D5",
  },
  replyMessageCard: {
    backgroundColor: "#FFFFFF",
    borderColor: "#EAE7DF",
  },
  messageHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  senderPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#141311",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  senderPillText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 8,
    letterSpacing: 1,
  },
  messageDate: {
    fontFamily: fontFamilies.mono.regular,
    fontSize: 10,
    color: "#8F8B82",
  },
  messageBody: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    lineHeight: 19,
    color: "#2C2A26",
  },
  replyBoxCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#EAE7DF",
    padding: 18,
    ...shadows.soft,
  },
  replyBoxLabel: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    letterSpacing: 1.4,
    color: "#85651B",
    marginBottom: 10,
  },
  replyInput: {
    minHeight: 100,
    backgroundColor: "#FAF9F5",
    borderWidth: 1,
    borderColor: "#E5E1D4",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    color: "#141311",
    textAlignVertical: "top",
    lineHeight: 19,
    marginBottom: 12,
  },
  sendButton: {
    borderRadius: 12,
    overflow: "hidden",
  },
  sendGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
  },
  sendButtonText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: "#FAF8F5",
  },
});
