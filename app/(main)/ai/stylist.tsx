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
import { LinearGradient } from "expo-linear-gradient";
import { AiPageShell } from "@/components/ai/AiPageShell";
import { Ionicons } from "@/components/ui/Icon";
import { useAuth } from "@/lib/supabase/auth";
import {
  aiStylistChatBackend,
  type StylistChatPiece,
} from "@/lib/api/backend";
import { formatPrice } from "@/lib/utils";
import { colors, radii, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

const GOLD = colors.accent2.ochre;
const CREAM = colors.paper.cream;
const INK = colors.ink.DEFAULT;

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
    <LinearGradient
      colors={["#e6c873", GOLD, "#9c7a2c"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={s.avatar}
    >
      <Ionicons name="sparkles" size={12} color={colors.olive[950]} />
    </LinearGradient>
  );
}

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

  const empty = turns.length === 0;
  const canSend = !!input.trim() && !sending;

  return (
    <AiPageShell title="AI Stylist">
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <ScrollView
          ref={scrollRef}
          style={s.flex}
          contentContainerStyle={empty ? s.introScroll : s.thread}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          onContentSizeChange={scrollToEnd}
        >
          {empty ? (
            <>
              <View style={s.hero}>
                <Text style={s.heroEyebrow}>LUXE AI · AI STYLIST</Text>
                <Text style={s.heroTitle}>
                  Tell me the vibe.{"\n"}
                  <Text style={s.heroTitleItalic}>I'll build the look.</Text>
                </Text>
                <Text style={s.heroSub}>
                  Occasion, mood or budget — chat your way to a shoppable outfit
                  made from live pieces.
                </Text>
              </View>

              <View style={s.section}>
                <View style={s.sectionHeader}>
                  <Text style={s.eyebrow}>Inspiration</Text>
                  <Text style={s.sectionTitle}>Try asking</Text>
                </View>
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
                          <Ionicons name={p.icon} size={16} color={colors.olive[700]} />
                        </View>
                        <Ionicons
                          name="arrow-forward"
                          size={14}
                          color={colors.light.mutedForeground}
                          style={s.promptArrow}
                        />
                      </View>
                      <Text style={s.promptTag}>{p.tag}</Text>
                      <Text style={s.promptText} numberOfLines={2}>
                        “{p.text}”
                      </Text>
                    </PressableScale>
                  ))}
                </View>
              </View>

              <View style={s.section}>
                <View style={s.sectionHeader}>
                  <Text style={s.eyebrow}>How it works</Text>
                  <Text style={s.sectionTitle}>Your personal stylist</Text>
                </View>
                <View style={s.stepsCard}>
                  {STEPS.map((step, i) => (
                    <React.Fragment key={step.title}>
                      {i > 0 ? <View style={s.stepDivider} /> : null}
                      <View style={s.step}>
                        <View style={s.stepIcon}>
                          <Ionicons name={step.icon} size={17} color={GOLD} />
                          <View style={s.stepNum}>
                            <Text style={s.stepNumText}>{i + 1}</Text>
                          </View>
                        </View>
                        <Text style={s.stepTitle}>{step.title}</Text>
                        <Text style={s.stepBody}>{step.body}</Text>
                      </View>
                    </React.Fragment>
                  ))}
                </View>
                {!user && (
                  <Text style={s.signInNote}>
                    You'll be asked to sign in when you send your first message.
                  </Text>
                )}
              </View>
            </>
          ) : (
            <>
              {turns.map((t) => {
                if (t.kind === "user") {
                  return (
                    <LinearGradient
                      key={t.id}
                      colors={["#39412c", colors.olive[950]]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={s.userBubble}
                    >
                      <Text style={s.userBubbleText}>{t.text}</Text>
                    </LinearGradient>
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
                        <Text style={s.errorText}>
                          {t.text || "Something went wrong"}
                        </Text>
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
                        <Ionicons name="refresh" size={11} color={CREAM} />
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
                          {t.pieces.map((p) => (
                            <PressableScale
                              key={p.id}
                              scale={0.98}
                              style={s.pieceRow}
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
                                  <Ionicons
                                    name="shirt-outline"
                                    size={15}
                                    color={colors.light.mutedForeground}
                                  />
                                </View>
                              )}
                              <View style={{ flex: 1 }}>
                                {p.slot ? (
                                  <Text style={s.pieceSlot}>{p.slot.toUpperCase()}</Text>
                                ) : null}
                                <Text numberOfLines={1} style={s.pieceName}>
                                  {p.name}
                                </Text>
                                <Text style={s.piecePrice}>
                                  {formatPrice(p.price, p.currency ?? "LKR")}
                                </Text>
                              </View>
                              <Ionicons
                                name="chevron-forward"
                                size={14}
                                color={colors.light.mutedForeground}
                              />
                            </PressableScale>
                          ))}
                          {typeof t.total === "number" && t.total > 0 && (
                            <View style={s.totalRow}>
                              <Text style={s.totalLabel}>FULL LOOK</Text>
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
                              style={({ pressed }) => [
                                s.suggChip,
                                pressed && { opacity: 0.85 },
                              ]}
                              onPress={() => send(sg)}
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
                    <Ionicons name="sparkles" size={12} color={GOLD} />
                    <Text style={s.statusText}>Styling your look…</Text>
                  </View>
                </View>
              )}
            </>
          )}
        </ScrollView>

        <View style={s.composerShadow}>
          <LinearGradient
            colors={["#22271a", colors.olive[950], "#0b0c07"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.composerBar}
          >
            <View style={s.composerGlow} />
            {!empty && (
              <Pressable
                onPress={reset}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel="Start a new chat"
                style={({ pressed }) => [s.ghostBtn, pressed && { opacity: 0.6 }]}
              >
                <Ionicons name="add" size={18} color={CREAM} />
              </Pressable>
            )}
            <TextInput
              style={s.input}
              value={input}
              onChangeText={setInput}
              placeholder="Ask your stylist…"
              placeholderTextColor={`${CREAM}59`}
              selectionColor={GOLD}
              multiline
              maxLength={1000}
              editable={!sending}
              onSubmitEditing={() => send()}
              returnKeyType="send"
            />
            <PressableScale
              onPress={() => send()}
              disabled={!canSend}
              accessibilityRole="button"
              accessibilityLabel="Send message"
              style={[s.sendWrap, !canSend && { opacity: 0.45 }]}
            >
              <LinearGradient
                colors={["#e6c873", GOLD, "#a8862f"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.sendBtn}
              >
                <Ionicons name="arrow-up" size={16} color={colors.olive[950]} />
              </LinearGradient>
            </PressableScale>
          </LinearGradient>
        </View>
      </KeyboardAvoidingView>
    </AiPageShell>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },

  introScroll: { paddingBottom: spacing[8] },
  hero: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[5],
    gap: spacing[2],
  },
  heroEyebrow: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 11,
    letterSpacing: 2.2,
    color: colors.olive[600],
  },
  heroTitle: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -0.8,
    color: INK,
  },
  heroTitleItalic: {
    fontFamily: fontFamilies.display.italic,
    color: colors.olive[600],
  },
  heroSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.light.mutedForeground,
    maxWidth: 320,
  },

  section: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[6],
    gap: spacing[4],
  },
  sectionHeader: { gap: 3 },
  eyebrow: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 10.5,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: colors.light.mutedForeground,
  },
  sectionTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 21,
    letterSpacing: -0.3,
    color: INK,
  },
  promptGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[3],
  },
  promptCard: {
    flexBasis: "47%",
    flexGrow: 1,
    minHeight: 132,
    padding: spacing[4],
    borderRadius: radii["3xl"],
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: `${INK}0D`,
    shadowColor: INK,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 3,
  },
  promptTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: spacing[3],
  },
  promptIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.olive[50],
  },
  promptArrow: {
    transform: [{ rotate: "-45deg" }],
  },
  promptTag: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: colors.olive[600],
    marginBottom: 4,
  },
  promptText: {
    fontFamily: fontFamilies.display.italic,
    fontSize: 15,
    lineHeight: 20,
    color: INK,
  },
  stepsCard: {
    flexDirection: "row",
    alignItems: "stretch",
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[2],
    borderRadius: radii["3xl"],
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: `${INK}0D`,
    shadowColor: INK,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 18,
    elevation: 2,
  },
  step: {
    flex: 1,
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing[1],
  },
  stepDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: `${INK}1A`,
    marginVertical: spacing[2],
  },
  stepIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.olive[950],
    marginBottom: spacing[1],
  },
  stepNum: {
    position: "absolute",
    top: -3,
    right: -3,
    width: 17,
    height: 17,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: GOLD,
    borderWidth: 2,
    borderColor: "#ffffff",
  },
  stepNumText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 8.5,
    color: colors.olive[950],
  },
  stepTitle: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 13,
    color: INK,
  },
  stepBody: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    textAlign: "center",
    color: colors.light.mutedForeground,
  },
  signInNote: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    textAlign: "center",
    color: colors.light.mutedForeground,
  },

  thread: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[4],
    gap: spacing[3],
  },
  userBubble: {
    alignSelf: "flex-end",
    maxWidth: "82%",
    borderRadius: radii.xl,
    borderBottomRightRadius: radii.sm,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    shadowColor: colors.olive[950],
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 4,
  },
  userBubbleText: {
    fontFamily: fontFamilies.sans.regular,
    color: CREAM,
    fontSize: 14,
    lineHeight: 20,
  },

  assistantRow: { flexDirection: "row", gap: spacing[2], alignItems: "flex-start" },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  assistantBubble: {
    flex: 1,
    borderRadius: radii["2xl"],
    borderBottomLeftRadius: radii.sm,
    borderWidth: 1,
    borderColor: `${INK}0D`,
    backgroundColor: "#ffffff",
    padding: spacing[4],
    gap: spacing[3],
    shadowColor: INK,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 18,
    elevation: 2,
  },
  assistantText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 14,
    color: colors.light.foreground,
    lineHeight: 20,
  },

  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.full,
    backgroundColor: colors.olive[950],
  },
  statusText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 12,
    color: CREAM,
  },

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
  pieceImg: { width: 48, height: 48, borderRadius: radii.md },
  pieceImgEmpty: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.light.muted,
  },
  pieceSlot: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 8,
    letterSpacing: 1.2,
    color: colors.olive[600],
  },
  pieceName: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 13,
    color: colors.light.foreground,
  },
  piecePrice: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 12,
    color: colors.olive[800],
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing[2],
    paddingTop: spacing[1],
  },
  totalLabel: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 9,
    letterSpacing: 1.2,
    color: colors.light.mutedForeground,
  },
  totalValue: {
    fontSize: 14,
    fontFamily: fontFamilies.sans.bold,
    color: colors.light.foreground,
  },

  suggRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing[2] },
  suggChip: {
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: `${colors.olive[600]}1F`,
    backgroundColor: colors.olive[50],
    paddingHorizontal: spacing[3],
    height: 30,
    justifyContent: "center",
  },
  suggChipText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 11,
    color: colors.olive[800],
  },

  errorBubble: {
    alignSelf: "flex-start",
    maxWidth: "88%",
    borderRadius: radii["2xl"],
    borderWidth: 1,
    borderColor: "#ecc9bd",
    backgroundColor: "#fdf3ee",
    padding: spacing[3],
    gap: spacing[2],
  },
  errorRow: { flexDirection: "row", alignItems: "center", gap: spacing[2] },
  errorText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    color: colors.accent2.rust,
    flex: 1,
  },
  retryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    borderRadius: radii.full,
    backgroundColor: colors.olive[950],
    paddingHorizontal: spacing[3],
    height: 30,
  },
  retryChipText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 11,
    color: CREAM,
  },

  composerShadow: {
    marginHorizontal: spacing[5],
    marginTop: spacing[2],
    borderRadius: 26,
    shadowColor: colors.olive[950],
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.25,
    shadowRadius: 26,
    elevation: 10,
  },
  composerBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing[2],
    borderRadius: 26,
    padding: 6,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: `${GOLD}26`,
  },
  composerGlow: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    top: -80,
    right: -50,
    backgroundColor: `${GOLD}1A`,
  },
  ghostBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${CREAM}14`,
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 110,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 14,
    color: CREAM,
    paddingHorizontal: spacing[3],
    paddingTop: Platform.OS === "ios" ? 12 : 9,
    paddingBottom: Platform.OS === "ios" ? 12 : 9,
  },
  sendWrap: { borderRadius: 21 },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
});
