import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { Display, Body, Label } from "@/components/ui/Typography";
import { Skeleton, useToast } from "@/components/ui";
import { useAuth } from "@/lib/supabase/auth";
import { listProductQuestions, addProductQuestion } from "@/lib/api";
import type { Question } from "@/lib/api/backend";
import { colors, radii, spacing, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

const QUESTION_MIN = 5;
const QUESTION_MAX = 500;

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

function initials(name?: string): string {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

export function ProductQA({ productId }: { productId: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const res = await listProductQuestions(productId);
    if (res.ok) {
      setQuestions(res.data);
      setLoadError(null);
    } else {
      setLoadError(res.error);
    }
    setLoading(false);
  }, [productId]);

  useEffect(() => {
    load();
  }, [load]);

  const openComposer = () => {
    if (!user) {
      toast("Sign in to ask a question", "info");
      router.push("/(auth)/login");
      return;
    }
    setComposerOpen(true);
  };

  const visible = showAll ? questions : questions.slice(0, 3);
  const answeredCount = questions.filter((q) => q.answer).length;

  return (
    <View style={s.card}>
      <View style={s.header}>
        <View style={s.headerIcon}>
          <Ionicons name="chatbubbles-outline" size={16} color={colors.olive[800]} />
        </View>
        <View style={{ flex: 1 }}>
          <Label style={s.eyebrow}>QUESTIONS & ANSWERS</Label>
          <Display size="sm" style={s.title}>Ask about this piece</Display>
        </View>
        {!loading && !loadError && questions.length > 0 && (
          <View style={s.countPill}>
            <Label style={s.countPillText}>{questions.length}</Label>
          </View>
        )}
      </View>

      {loading ? (
        <View style={s.list}>
          <Skeleton height={76} borderRadius={radii.lg} />
          <Skeleton height={76} borderRadius={radii.lg} />
        </View>
      ) : loadError ? (
        <View style={s.stateCard}>
          <Ionicons name="cloud-offline-outline" size={22} color={colors.accent2.rust} />
          <Body size="sm" style={s.stateTitle}>Couldn't load questions</Body>
          <Body size="xs" muted style={s.stateSub}>
            {loadError}
          </Body>
          <TouchableOpacity style={s.retryBtn} onPress={load} activeOpacity={0.8}>
            <Ionicons name="refresh" size={13} color={colors.paper.cream} />
            <Text style={s.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : questions.length === 0 ? (
        <View style={s.stateCard}>
          <View style={s.emptyIcon}>
            <Ionicons name="help" size={20} color={colors.olive[800]} />
          </View>
          <Body size="sm" style={s.stateTitle}>No questions yet</Body>
          <Body size="xs" muted style={s.stateSub}>
            Sizing, fabric, delivery — ask anything and the seller will reply.
          </Body>
        </View>
      ) : (
        <View style={s.list}>
          {answeredCount > 0 && (
            <Label style={s.answeredMeta}>
              {answeredCount} of {questions.length} answered by the seller
            </Label>
          )}
          {visible.map((q) => (
            <QuestionRow key={q.id} question={q} />
          ))}
          {questions.length > 3 && (
            <TouchableOpacity
              style={s.showMoreBtn}
              onPress={() => setShowAll((v) => !v)}
              activeOpacity={0.7}
            >
              <Label style={s.showMoreText}>
                {showAll ? "Show less" : `Show all ${questions.length} questions`}
              </Label>
              <Ionicons
                name={showAll ? "chevron-up" : "chevron-down"}
                size={13}
                color={colors.olive[700]}
              />
            </TouchableOpacity>
          )}
        </View>
      )}

      <TouchableOpacity
        style={s.askBtn}
        onPress={openComposer}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Ask a question"
      >
        <Ionicons name="chatbubble-ellipses-outline" size={15} color={colors.paper.cream} />
        <Text style={s.askBtnText}>Ask a question</Text>
      </TouchableOpacity>

      <AskQuestionModal
        visible={composerOpen}
        productId={productId}
        onClose={() => setComposerOpen(false)}
        onSubmitted={(q) => setQuestions((prev) => [q, ...prev])}
      />
    </View>
  );
}

function QuestionRow({ question: q }: { question: Question }) {
  return (
    <View style={s.qRow}>
      <View style={s.qHeader}>
        <View style={s.avatar}>
          <Label style={s.avatarText}>{initials(q.user?.full_name)}</Label>
        </View>
        <View style={{ flex: 1 }}>
          <Body size="sm" style={s.qText}>{q.question}</Body>
          <Body size="xs" muted>
            {(q.user?.full_name ?? "Shopper") + (q.created_at ? ` · ${timeAgo(q.created_at)}` : "")}
          </Body>
        </View>
      </View>
      {q.answer ? (
        <View style={s.aBlock}>
          <View style={s.aBadge}>
            <Ionicons name="storefront-outline" size={10} color={colors.olive[800]} />
            <Label style={s.aBadgeText}>SELLER ANSWER</Label>
          </View>
          <Body size="sm" style={s.aText}>{q.answer}</Body>
          {q.answered_at ? (
            <Body size="xs" muted>{timeAgo(q.answered_at)}</Body>
          ) : null}
        </View>
      ) : (
        <View style={s.pendingRow}>
          <Ionicons name="time-outline" size={11} color={colors.accent2.ochre} />
          <Body size="xs" style={s.pendingText}>Awaiting answer</Body>
        </View>
      )}
    </View>
  );
}

function AskQuestionModal({
  visible,
  productId,
  onClose,
  onSubmitted,
}: {
  visible: boolean;
  productId: string;
  onClose: () => void;
  onSubmitted: (q: Question) => void;
}) {
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const trimmed = text.trim();
  const valid = trimmed.length >= QUESTION_MIN && trimmed.length <= QUESTION_MAX;

  const dismiss = () => {
    if (submitting) return;
    setText("");
    onClose();
  };

  const submit = async () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    const res = await addProductQuestion(productId, trimmed);
    if (!mountedRef.current) return;
    setSubmitting(false);
    if (!res.ok) {
      toast(res.error || "Couldn't post your question", "error");
      return;
    }
    toast("Question posted — we'll notify you when it's answered", "success");
    setText("");
    onClose();
    onSubmitted(res.data);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={dismiss}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={ms.container}>
          <View style={ms.header}>
            <TouchableOpacity onPress={dismiss} hitSlop={8}>
              <Text style={ms.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={ms.headerTitle}>Ask a question</Text>
            <TouchableOpacity
              onPress={submit}
              disabled={!valid || submitting}
              hitSlop={8}
            >
              <Text style={[ms.submitText, (!valid || submitting) && { opacity: 0.4 }]}>
                {submitting ? "Posting…" : "Post"}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={ms.content}>
            <Label style={ms.eyebrow}>ASK THE SELLER</Label>
            <TextInput
              style={ms.input}
              value={text}
              onChangeText={setText}
              placeholder="e.g. Does this run small? Is the fabric stretchy?"
              placeholderTextColor={colors.light.mutedForeground}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              maxLength={QUESTION_MAX}
              autoFocus
            />
            <View style={ms.metaRow}>
              <Body size="xs" muted>
                Answers are public and posted by the seller.
              </Body>
              <Body size="xs" muted>{trimmed.length}/{QUESTION_MAX}</Body>
            </View>
            {trimmed.length > 0 && trimmed.length < QUESTION_MIN && (
              <Body size="xs" style={ms.hint}>
                At least {QUESTION_MIN} characters
              </Body>
            )}
            {submitting && (
              <ActivityIndicator
                size="small"
                color={colors.olive[700]}
                style={{ marginTop: spacing[4] }}
              />
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  card: {
    marginHorizontal: spacing[5],
    marginBottom: spacing[5],
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.light.card,
    padding: spacing[5],
    ...shadows.soft,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    marginBottom: spacing[4],
  },
  headerIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.olive[50],
    borderWidth: 1,
    borderColor: colors.olive[100],
  },
  eyebrow: {
    fontSize: 9,
    letterSpacing: 1.4,
    color: colors.olive[700],
    fontFamily: fontFamilies.sans.semibold,
  },
  title: { marginTop: 2 },
  countPill: {
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.olive[800],
  },
  countPillText: { color: colors.paper.cream, fontSize: 11 },

  list: { gap: spacing[3] },
  answeredMeta: {
    fontSize: 9,
    letterSpacing: 1,
    color: colors.light.mutedForeground,
    marginBottom: -spacing[1],
  },
  qRow: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.light.background,
    padding: spacing[4],
    gap: spacing[2],
  },
  qHeader: { flexDirection: "row", gap: spacing[3] },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.olive[100],
  },
  avatarText: {
    fontSize: 10,
    fontFamily: fontFamilies.sans.bold,
    color: colors.olive[800],
  },
  qText: { color: colors.light.foreground, fontWeight: "500", marginBottom: 2 },
  aBlock: {
    marginLeft: 42,
    borderLeftWidth: 2,
    borderLeftColor: colors.olive[300],
    paddingLeft: spacing[3],
    gap: 4,
  },
  aBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  aBadgeText: {
    fontSize: 8,
    letterSpacing: 1.2,
    color: colors.olive[800],
    fontFamily: fontFamilies.sans.bold,
  },
  aText: { color: colors.light.foreground },
  pendingRow: {
    marginLeft: 42,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  pendingText: { color: colors.accent2.ochre, fontWeight: "500" },

  showMoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: spacing[2],
  },
  showMoreText: { color: colors.olive[700], fontSize: 11 },

  stateCard: {
    alignItems: "center",
    gap: spacing[2],
    paddingVertical: spacing[5],
    paddingHorizontal: spacing[4],
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.light.background,
  },
  emptyIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.olive[50],
    borderWidth: 1,
    borderColor: colors.olive[100],
  },
  stateTitle: { fontWeight: "600", color: colors.light.foreground },
  stateSub: { textAlign: "center", lineHeight: 17 },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: spacing[2],
    paddingHorizontal: spacing[4],
    height: 34,
    borderRadius: radii.full,
    backgroundColor: colors.olive[800],
  },
  retryBtnText: {
    color: colors.paper.cream,
    fontSize: 12,
    fontFamily: fontFamilies.sans.semibold,
  },

  askBtn: {
    marginTop: spacing[4],
    height: 46,
    borderRadius: radii.full,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[2],
    backgroundColor: colors.olive[800],
  },
  askBtnText: {
    color: colors.paper.cream,
    fontSize: 13,
    letterSpacing: 0.6,
    fontFamily: fontFamilies.sans.bold,
    textTransform: "uppercase",
  },
});

const ms = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  headerTitle: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 17,
    color: colors.light.foreground,
  },
  cancelText: { fontSize: 15, color: colors.light.mutedForeground },
  submitText: {
    fontSize: 15,
    fontFamily: fontFamilies.sans.bold,
    color: colors.olive[700],
  },
  content: { padding: spacing[5] },
  eyebrow: {
    fontSize: 10,
    letterSpacing: 1.4,
    color: colors.olive[700],
    marginBottom: spacing[3],
  },
  input: {
    minHeight: 140,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.light.card,
    padding: spacing[4],
    fontSize: 15,
    color: colors.light.foreground,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing[2],
  },
  hint: { color: colors.accent2.ochre, marginTop: spacing[2] },
});
