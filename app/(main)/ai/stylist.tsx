import React, { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AiPageShell } from "@/components/ai/AiPageShell";
import { UP as C } from "@/components/user/user-page";
import { Ionicons } from "@/components/ui/Icon";
import { useAuth } from "@/lib/supabase/auth";
import {
  aiStylistChatBackend,
  type StylistChatPiece,
} from "@/lib/api/backend";
import { formatPrice } from "@/lib/utils";
import { fontFamilies } from "@/lib/theme/fonts";

const SOFT = "#f5f3ec";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

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

const INTRO_PROMPTS: { text: string; tag: string; icon: IconName }[] = [
  { text: "What should I wear to a beach wedding?", tag: "Occasion", icon: "sunny-outline" },
  { text: "Office look that's still comfortable", tag: "Work", icon: "briefcase-outline" },
  { text: "Casual weekend outfit under a budget", tag: "Budget", icon: "wallet-outline" },
  { text: "Date night — something elegant", tag: "Evening", icon: "moon-outline" },
];

const STEPS: { icon: IconName; title: string; body: string }[] = [
  { icon: "chatbubble-ellipses-outline", title: "Describe", body: "Occasion, mood or budget" },
  { icon: "sparkles-outline", title: "Style", body: "A look built for you" },
  { icon: "bag-handle-outline", title: "Shop", body: "Every piece is live" },
];

let idCounter = 0;
const nextId = () => `t${++idCounter}`;

function PressableScale({
  style,
  children,
  scale = 0.97,
  ...rest
}: React.ComponentProps<typeof Pressable> & { style?: StyleProp<ViewStyle>; scale?: number }) {
  return (
    <Pressable
      {...rest}
      style={({ pressed }) => [style, pressed && { transform: [{ scale }], opacity: 0.92 }]}
    >
      {children}
    </Pressable>
  );
}

function StylistAvatar() {
  return (
    <View style={s.avatar}>
      <Ionicons name="sparkles" size={14} color={C.lime} />
    </View>
  );
}

export default function AiStylistScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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

  const empty = turns.length === 0;
  const canSend = !!input.trim() && !sending;

  return (
    <AiPageShell title="AI Stylist">
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        // Header (~70) + tool tabs (~58) sit above this view.
        keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 128 : 0}
      >
        <ScrollView
          ref={scrollRef}
          style={s.flex}
          contentContainerStyle={empty ? s.introScroll : s.thread}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => {
            if (!empty) scrollToEnd();
          }}
        >
          {empty ? (
            <>
              <View style={s.cardShadow}>
                <View style={[s.card, s.introCard]}>
                  <View style={s.iconCircle}>
                    <Ionicons name="chatbubble-ellipses" size={22} color={C.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.introTitle}>Tell me the vibe</Text>
                    <Text style={s.introSub}>
                      Occasion, mood or budget — I&apos;ll build a shoppable look from live
                      pieces.
                    </Text>
                  </View>
                </View>
              </View>

              <Text style={s.sectionTitle}>Try asking</Text>
              <View style={s.promptGrid}>
                {INTRO_PROMPTS.map((p) => (
                  <PressableScale
                    key={p.text}
                    style={s.promptCard}
                    onPress={() => send(p.text)}
                    accessibilityRole="button"
                    accessibilityLabel={`Ask: ${p.text}`}
                  >
                    <View style={s.promptTop}>
                      <View style={s.promptIcon}>
                        <Ionicons name={p.icon} size={18} color={C.accent} />
                      </View>
                      <View style={s.promptArrow}>
                        <Ionicons name="arrow-forward" size={14} color={C.text} />
                      </View>
                    </View>
                    <Text style={s.promptTag}>{p.tag}</Text>
                    <Text style={s.promptText} numberOfLines={3}>
                      {p.text}
                    </Text>
                  </PressableScale>
                ))}
              </View>

              <Text style={s.sectionTitle}>How it works</Text>
              <View style={s.stepsStrip}>
                {STEPS.map((step, i) => (
                  <React.Fragment key={step.title}>
                    {i > 0 ? <View style={s.stepRule} /> : null}
                    <View style={s.step}>
                      <View style={s.stepNum}>
                        <Text style={s.stepNumText}>{i + 1}</Text>
                      </View>
                      <Text style={s.stepTitle}>{step.title}</Text>
                      <Text style={s.stepBody}>{step.body}</Text>
                    </View>
                  </React.Fragment>
                ))}
              </View>
              {!user && (
                <View style={s.signInNote}>
                  <Ionicons name="lock-closed-outline" size={14} color={C.muted} />
                  <Text style={s.signInText}>
                    You&apos;ll be asked to sign in when you send your first message.
                  </Text>
                </View>
              )}
            </>
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
                        <Ionicons name="alert-circle-outline" size={16} color={C.rust} />
                        <Text style={s.errorText}>{t.text || "Something went wrong"}</Text>
                      </View>
                      <PressableScale
                        style={s.retryChip}
                        onPress={() => {
                          setTurns((prev) => prev.filter((x) => x.id !== t.id));
                          send(t.retryPrompt);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel="Try again"
                      >
                        <Ionicons name="refresh" size={13} color={C.lime} />
                        <Text style={s.retryChipText}>Try again</Text>
                      </PressableScale>
                    </View>
                  );
                }
                return (
                  <View key={t.id} style={s.assistantRow}>
                    <StylistAvatar />
                    <View style={s.assistantBubble}>
                      <Text style={s.assistantText}>{t.reply}</Text>
                      {t.pieces.length > 0 && (
                        <View style={s.pieceList}>
                          {t.pieces.map((p, i) => (
                            <PressableScale
                              key={p.id}
                              scale={0.98}
                              style={[s.pieceRow, i === 0 && s.pieceRowFirst]}
                              onPress={() => openProduct(p.slug)}
                              accessibilityRole="button"
                              accessibilityLabel={`View ${p.name}`}
                            >
                              {p.image_url ? (
                                <Image
                                  source={{ uri: p.image_url }}
                                  style={s.pieceImg}
                                  contentFit="cover"
                                  transition={250}
                                />
                              ) : (
                                <View style={[s.pieceImg, s.pieceImgEmpty]}>
                                  <Ionicons name="shirt-outline" size={16} color={C.muted} />
                                </View>
                              )}
                              <View style={{ flex: 1, minWidth: 0 }}>
                                {p.slot ? (
                                  <Text style={s.pieceSlot}>
                                    {p.slot.charAt(0).toUpperCase() + p.slot.slice(1)}
                                  </Text>
                                ) : null}
                                <Text numberOfLines={1} style={s.pieceName}>
                                  {p.name}
                                </Text>
                                <Text style={s.piecePrice}>
                                  {formatPrice(p.price, p.currency ?? "LKR")}
                                </Text>
                              </View>
                              <Ionicons name="chevron-forward" size={15} color={C.muted} />
                            </PressableScale>
                          ))}
                          {typeof t.total === "number" && t.total > 0 && (
                            <View style={s.totalRow}>
                              <Text style={s.totalLabel}>Full look</Text>
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
                            <Pressable
                              key={sg}
                              style={({ pressed }) => [s.suggChip, pressed && { opacity: 0.7 }]}
                              onPress={() => send(sg)}
                              disabled={sending}
                              accessibilityRole="button"
                              accessibilityLabel={sg}
                            >
                              <Text style={s.suggChipText}>{sg}</Text>
                            </Pressable>
                          ))}
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
              {sending && (
                <View style={s.assistantRow}>
                  <StylistAvatar />
                  <View style={s.statusPill}>
                    <Text style={s.statusText}>Styling your look…</Text>
                  </View>
                </View>
              )}
            </>
          )}
        </ScrollView>

        <View style={s.composerWrap}>
          <View style={s.composerBar}>
            {!empty && (
              <Pressable
                onPress={reset}
                disabled={sending}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel="Start a new chat"
                style={({ pressed }) => [s.ghostBtn, (pressed || sending) && { opacity: 0.5 }]}
              >
                <Ionicons name="add" size={20} color={C.text} />
              </Pressable>
            )}
            <TextInput
              style={s.input}
              value={input}
              onChangeText={setInput}
              placeholder="Ask your stylist…"
              placeholderTextColor="#a3a39a"
              selectionColor={C.accent}
              multiline
              maxLength={1000}
              editable={!sending}
              // Multiline inputs swallow Return as a newline unless told to submit.
              submitBehavior="submit"
              onSubmitEditing={() => send()}
              returnKeyType="send"
            />
            <PressableScale
              onPress={() => send()}
              disabled={!canSend}
              accessibilityRole="button"
              accessibilityLabel="Send message"
              style={[s.sendBtn, !canSend && { opacity: 0.35 }]}
            >
              <Ionicons name="arrow-up" size={18} color={C.ink} />
            </PressableScale>
          </View>
        </View>
      </KeyboardAvoidingView>
    </AiPageShell>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  introScroll: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 24 },
  thread: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16, gap: 14 },

  cardShadow: {
    borderRadius: 26,
    shadowColor: "#16170f",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 3,
  },
  card: {
    backgroundColor: C.card,
    borderRadius: 26,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: C.line,
    padding: 16,
    overflow: "hidden",
  },
  introCard: { flexDirection: "row", alignItems: "center", gap: 14 },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: C.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  introTitle: { fontFamily: fontFamilies.sans.bold, fontSize: 18, color: C.text, letterSpacing: -0.3 },
  introSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13.5,
    lineHeight: 18,
    color: C.muted,
    marginTop: 2,
  },

  sectionTitle: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 18,
    color: C.text,
    letterSpacing: -0.3,
    marginTop: 26,
    marginBottom: 12,
  },
  promptGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  promptCard: {
    width: "48.5%",
    flexGrow: 1,
    minHeight: 150,
    padding: 14,
    borderRadius: 22,
    borderCurve: "continuous",
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
  },
  promptTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  promptIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: C.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  promptArrow: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: SOFT,
    alignItems: "center",
    justifyContent: "center",
  },
  promptTag: { fontFamily: fontFamilies.sans.medium, fontSize: 12.5, color: C.muted, marginTop: 14 },
  promptText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 14.5,
    lineHeight: 19,
    color: C.text,
    marginTop: 2,
  },
  stepsStrip: {
    flexDirection: "row",
    alignItems: "stretch",
    paddingVertical: 16,
    borderRadius: 22,
    borderCurve: "continuous",
    backgroundColor: C.ink,
  },
  stepRule: { width: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,0.16)" },
  step: { flex: 1, alignItems: "center", paddingHorizontal: 6, gap: 4 },
  stepNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.lime,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  stepNumText: { fontFamily: fontFamilies.sans.bold, fontSize: 13, color: C.ink },
  stepTitle: { fontFamily: fontFamilies.sans.bold, fontSize: 14, color: "#FFFFFF" },
  stepBody: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 12,
    color: "rgba(255,255,255,0.55)",
    textAlign: "center",
  },
  signInNote: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 16,
  },
  signInText: { fontFamily: fontFamilies.sans.medium, fontSize: 12.5, color: C.muted },

  // Thread
  userBubble: {
    alignSelf: "flex-end",
    maxWidth: "82%",
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 22,
    borderBottomRightRadius: 8,
    borderCurve: "continuous",
    backgroundColor: C.ink,
  },
  userBubbleText: { fontFamily: fontFamilies.sans.medium, fontSize: 15, lineHeight: 21, color: "#FFFFFF" },
  assistantRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.ink,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  assistantBubble: {
    flex: 1,
    padding: 14,
    borderRadius: 22,
    borderTopLeftRadius: 8,
    borderCurve: "continuous",
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
  },
  assistantText: { fontFamily: fontFamilies.sans.regular, fontSize: 15, lineHeight: 22, color: C.text },
  pieceList: { marginTop: 12 },
  pieceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: C.line,
  },
  pieceRowFirst: { borderTopWidth: 0, paddingTop: 0 },
  pieceImg: { width: 52, height: 52, borderRadius: 14, backgroundColor: SOFT },
  pieceImgEmpty: { alignItems: "center", justifyContent: "center" },
  pieceSlot: { fontFamily: fontFamilies.sans.medium, fontSize: 12, color: C.muted },
  pieceName: { fontFamily: fontFamilies.sans.semibold, fontSize: 14, color: C.text, marginTop: 1 },
  piecePrice: { fontFamily: fontFamilies.sans.bold, fontSize: 13.5, color: C.text, marginTop: 2 },
  totalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
    height: 46,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: C.ink,
  },
  totalLabel: { fontFamily: fontFamilies.sans.medium, fontSize: 13, color: "rgba(255,255,255,0.6)" },
  totalValue: { fontFamily: fontFamilies.sans.bold, fontSize: 15, color: C.lime },
  suggRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  suggChip: {
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: SOFT,
  },
  suggChipText: { fontFamily: fontFamilies.sans.semibold, fontSize: 13, color: C.text },
  statusPill: {
    height: 40,
    justifyContent: "center",
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
  },
  statusText: { fontFamily: fontFamilies.sans.medium, fontSize: 13.5, color: C.muted },
  errorBubble: {
    padding: 14,
    gap: 10,
    borderRadius: 22,
    borderCurve: "continuous",
    backgroundColor: "rgba(184,92,58,0.07)",
    borderWidth: 1,
    borderColor: "rgba(184,92,58,0.18)",
  },
  errorRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  errorText: { flex: 1, fontFamily: fontFamilies.sans.medium, fontSize: 14, lineHeight: 19, color: C.text },
  retryChip: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: C.ink,
  },
  retryChipText: { fontFamily: fontFamilies.sans.semibold, fontSize: 13, color: "#FFFFFF" },

  // Composer
  composerWrap: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 10 },
  composerBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    minHeight: 60,
    padding: 8,
    borderRadius: 30,
    borderCurve: "continuous",
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    shadowColor: "#16170f",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 4,
  },
  ghostBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: SOFT,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    paddingHorizontal: 8,
    paddingTop: 12,
    paddingBottom: 12,
    fontFamily: fontFamilies.sans.medium,
    fontSize: 15.5,
    color: C.text,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.lime,
    alignItems: "center",
    justifyContent: "center",
  },
});
