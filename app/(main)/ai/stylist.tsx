import React, { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { AiPageShell } from "@/components/ai/AiPageShell";
import { Body, Label, Display } from "@/components/ui/Typography";
import { Ionicons } from "@/components/ui/Icon";
import { useAuth } from "@/lib/supabase/auth";
import {
  aiStylistChatBackend,
  type StylistChatPiece,
} from "@/lib/api/backend";
import { formatPrice } from "@/lib/utils";
import { colors, radii, spacing, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

type ChatTurn =
  | { kind: "user"; id: string; text: string }
  | {
      kind: "assistant";
      id: string;
      reply: string;
      pieces: StylistChatPiece[];
      total?: number;
      suggestions?: string[];
    }
  | { kind: "error"; id: string; text: string; retryPrompt: string };

const INTRO_PROMPTS = [
  "What should I wear to a beach wedding?",
  "Office look that's still comfortable",
  "Casual weekend outfit under a budget",
  "Date night — something elegant",
];

let idCounter = 0;
const nextId = () => `t${++idCounter}`;

export default function AiStylistScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }, []);

  const send = useCallback(
    async (raw?: string) => {
      const text = (raw ?? input).trim();
      if (!text || sending) return;
      if (!user) {
        router.push("/(auth)/login");
        return;
      }
      setInput("");
      setSending(true);
      setTurns((prev) => {
        const next: ChatTurn[] = [...prev, { kind: "user", id: nextId(), text }];
        return next;
      });
      scrollToEnd();

      const history = turns
        .filter((t): t is Extract<ChatTurn, { kind: "user" | "assistant" }> => t.kind !== "error")
        .map((t) => ({
          role: t.kind as "user" | "assistant",
          content: t.kind === "user" ? t.text : t.reply,
        }));

      const res = await aiStylistChatBackend(text, history);
      setSending(false);
      if (!res.ok) {
        setTurns((prev) => [
          ...prev,
          { kind: "error", id: nextId(), text: res.error, retryPrompt: text },
        ]);
      } else {
        setTurns((prev) => [
          ...prev,
          {
            kind: "assistant",
            id: nextId(),
            reply: res.data.reply ?? "Here's what I found.",
            pieces: res.data.outfit?.pieces ?? [],
            total: res.data.outfit?.total_price,
            suggestions: res.data.suggestions,
          },
        ]);
      }
      scrollToEnd();
    },
    [input, sending, turns, user, router, scrollToEnd],
  );

  const reset = () => {
    if (sending) return;
    setTurns([]);
    setInput("");
  };

  const openProduct = (slug: string) => {
    if (slug) router.push(`/(main)/products/${slug}` as never);
  };

  return (
    <AiPageShell
      title="AI Stylist"
      description="Chat with your stylist — describe the occasion and get a shoppable look."
    >
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <ScrollView
          ref={scrollRef}
          style={s.flex}
          contentContainerStyle={s.thread}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          onContentSizeChange={scrollToEnd}
        >
          {turns.length === 0 ? (
            <View style={s.intro}>
              <View style={s.introBadge}>
                <Ionicons name="sparkles" size={22} color={colors.paper.cream} />
              </View>
              <Display size="md" style={s.introTitle}>
                What are we dressing for?
              </Display>
              <Body muted size="sm" style={s.introSub}>
                Tell me the occasion, the vibe, or a budget — I'll build a look
                from live pieces you can actually buy.
              </Body>
              <View style={s.introChips}>
                {INTRO_PROMPTS.map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={s.promptChip}
                    onPress={() => send(p)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="sparkles-outline" size={12} color={colors.olive[700]} />
                    <Text style={s.promptChipText}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {!user && (
                <Body size="xs" muted style={s.signInNote}>
                  You'll be asked to sign in when you send your first message.
                </Body>
              )}
            </View>
          ) : (
            <>
              {turns.map((t) => {
                if (t.kind === "user") {
                  return (
                    <View key={t.id} style={s.userBubble}>
                      <Text style={s.userBubbleText}>{t.text}</Text>
                    </View>
                  );
                }
                if (t.kind === "error") {
                  return (
                    <View key={t.id} style={s.errorBubble}>
                      <View style={s.errorRow}>
                        <Ionicons
                          name="alert-circle-outline"
                          size={15}
                          color={colors.accent2.rust}
                        />
                        <Body size="sm" style={s.errorText}>
                          {t.text || "Something went wrong"}
                        </Body>
                      </View>
                      <TouchableOpacity
                        style={s.retryChip}
                        onPress={() => {
                          setTurns((prev) => prev.filter((x) => x.id !== t.id));
                          send(t.retryPrompt);
                        }}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="refresh" size={11} color={colors.olive[800]} />
                        <Label style={s.retryChipText}>Try again</Label>
                      </TouchableOpacity>
                    </View>
                  );
                }
                return (
                  <View key={t.id} style={s.assistantRow}>
                    <View style={s.stylistAvatar}>
                      <Ionicons name="sparkles" size={12} color={colors.paper.cream} />
                    </View>
                    <View style={s.assistantBubble}>
                      <Body size="sm" style={s.assistantText}>{t.reply}</Body>
                      {t.pieces.length > 0 && (
                        <View style={s.pieceList}>
                          {t.pieces.map((p) => (
                            <TouchableOpacity
                              key={p.id}
                              style={s.pieceRow}
                              onPress={() => openProduct(p.slug)}
                              activeOpacity={0.8}
                              accessibilityRole="button"
                              accessibilityLabel={`View ${p.name}`}
                            >
                              {p.image_url ? (
                                <Image source={{ uri: p.image_url }} style={s.pieceImg} contentFit="cover" />
                              ) : (
                                <View style={[s.pieceImg, s.pieceImgEmpty]}>
                                  <Ionicons name="shirt-outline" size={15} color={colors.light.mutedForeground} />
                                </View>
                              )}
                              <View style={{ flex: 1 }}>
                                {p.slot ? (
                                  <Label style={s.pieceSlot}>{p.slot.toUpperCase()}</Label>
                                ) : null}
                                <Body size="sm" numberOfLines={1} style={s.pieceName}>
                                  {p.name}
                                </Body>
                                <Body size="xs" style={s.piecePrice}>
                                  {formatPrice(p.price, p.currency ?? "LKR")}
                                </Body>
                              </View>
                              <Ionicons name="chevron-forward" size={14} color={colors.light.mutedForeground} />
                            </TouchableOpacity>
                          ))}
                          {typeof t.total === "number" && t.total > 0 && (
                            <View style={s.totalRow}>
                              <Label style={s.totalLabel}>FULL LOOK</Label>
                              <Text style={s.totalValue}>
                                {formatPrice(t.total, t.pieces[0]?.currency ?? "LKR")}
                              </Text>
                            </View>
                          )}
                        </View>
                      )}
                      {!!t.suggestions?.length && (
                        <View style={s.suggRow}>
                          {t.suggestions.map((sg) => (
                            <TouchableOpacity
                              key={sg}
                              style={s.suggChip}
                              onPress={() => send(sg)}
                              activeOpacity={0.8}
                            >
                              <Label style={s.suggChipText}>{sg}</Label>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
              {sending && (
                <View style={s.assistantRow}>
                  <View style={s.stylistAvatar}>
                    <Ionicons name="sparkles" size={12} color={colors.paper.cream} />
                  </View>
                  <View style={[s.assistantBubble, s.typingBubble]}>
                    <ActivityIndicator size="small" color={colors.olive[700]} />
                    <Body size="xs" muted>Styling…</Body>
                  </View>
                </View>
              )}
            </>
          )}
        </ScrollView>

        <View style={s.composer}>
          {turns.length > 0 && (
            <TouchableOpacity
              style={s.clearBtn}
              onPress={reset}
              activeOpacity={0.8}
              accessibilityLabel="Start a new chat"
            >
              <Ionicons name="add" size={20} color={colors.olive[700]} />
            </TouchableOpacity>
          )}
          <TextInput
            style={s.composerInput}
            value={input}
            onChangeText={setInput}
            placeholder="Ask your stylist…"
            placeholderTextColor={colors.light.mutedForeground}
            multiline
            maxLength={1000}
            editable={!sending}
            onSubmitEditing={() => send()}
            returnKeyType="send"
          />
          <TouchableOpacity
            style={[s.sendBtn, (!input.trim() || sending) && s.sendBtnDim]}
            onPress={() => send()}
            disabled={!input.trim() || sending}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Send message"
          >
            <Ionicons name="arrow-up" size={18} color={colors.paper.cream} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </AiPageShell>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  thread: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    paddingBottom: spacing[4],
    gap: spacing[3],
  },

  intro: { alignItems: "center", paddingTop: spacing[5], gap: spacing[3] },
  introBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.olive[800],
    ...shadows.soft,
  },
  introTitle: { textAlign: "center" },
  introSub: { textAlign: "center", lineHeight: 19, paddingHorizontal: spacing[4] },
  introChips: { gap: spacing[2], alignSelf: "stretch", marginTop: spacing[2] },
  promptChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.light.card,
    paddingHorizontal: spacing[4],
    height: 40,
  },
  promptChipText: {
    fontSize: 12,
    color: colors.light.foreground,
    fontFamily: fontFamilies.sans.medium,
  },
  signInNote: { marginTop: spacing[2] },

  userBubble: {
    alignSelf: "flex-end",
    maxWidth: "82%",
    backgroundColor: colors.olive[800],
    borderRadius: radii.xl,
    borderBottomRightRadius: radii.sm,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  userBubbleText: {
    color: colors.paper.cream,
    fontSize: 14,
    lineHeight: 20,
  },

  assistantRow: { flexDirection: "row", gap: spacing[2], alignItems: "flex-start" },
  stylistAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.olive[700],
    marginTop: 2,
  },
  assistantBubble: {
    flex: 1,
    borderRadius: radii.xl,
    borderBottomLeftRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.light.card,
    padding: spacing[4],
    gap: spacing[3],
    ...shadows.soft,
  },
  typingBubble: { flexDirection: "row", alignItems: "center", gap: spacing[2] },
  assistantText: { color: colors.light.foreground, lineHeight: 20 },

  pieceList: { gap: spacing[2] },
  pieceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.light.background,
    padding: spacing[2],
  },
  pieceImg: { width: 44, height: 44, borderRadius: radii.md },
  pieceImgEmpty: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.light.muted,
  },
  pieceSlot: {
    fontSize: 8,
    letterSpacing: 1.2,
    color: colors.olive[700],
    fontFamily: fontFamilies.sans.bold,
  },
  pieceName: { color: colors.light.foreground, fontWeight: "600" },
  piecePrice: { color: colors.olive[800], fontWeight: "700" },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing[2],
    paddingTop: spacing[1],
  },
  totalLabel: { fontSize: 9, letterSpacing: 1.2, color: colors.light.mutedForeground },
  totalValue: {
    fontSize: 14,
    fontFamily: fontFamilies.sans.bold,
    color: colors.light.foreground,
  },

  suggRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing[2] },
  suggChip: {
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.olive[200],
    backgroundColor: colors.olive[50],
    paddingHorizontal: spacing[3],
    height: 30,
    justifyContent: "center",
  },
  suggChipText: { fontSize: 10, color: colors.olive[800] },

  errorBubble: {
    alignSelf: "flex-start",
    maxWidth: "85%",
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "#ecc9bd",
    backgroundColor: "#fdf3ee",
    padding: spacing[3],
    gap: spacing[2],
  },
  errorRow: { flexDirection: "row", alignItems: "center", gap: spacing[2] },
  errorText: { color: colors.accent2.rust, flex: 1 },
  retryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.olive[200],
    backgroundColor: colors.paper.cream,
    paddingHorizontal: spacing[3],
    height: 28,
  },
  retryChipText: { fontSize: 10, color: colors.olive[800] },

  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing[2],
    paddingHorizontal: spacing[5],
    paddingTop: spacing[2],
    paddingBottom: spacing[2],
    borderTopWidth: 1,
    borderTopColor: colors.light.border,
    backgroundColor: colors.light.background,
  },
  clearBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.light.card,
  },
  composerInput: {
    flex: 1,
    minHeight: 42,
    maxHeight: 110,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.light.card,
    paddingHorizontal: spacing[4],
    paddingTop: Platform.OS === "ios" ? 11 : 9,
    paddingBottom: Platform.OS === "ios" ? 11 : 9,
    fontSize: 14,
    color: colors.light.foreground,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.olive[800],
  },
  sendBtnDim: { opacity: 0.4 },
});
