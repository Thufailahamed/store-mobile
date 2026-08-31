import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@/components/ui/Icon";
import { replyToReviewBackend } from "@/lib/api";
import { colors, radii, spacing, typography } from "@/lib/theme/tokens";
import type { Review } from "@/lib/types";

export interface ReplyModalProps {
  review: Review | null;
  visible: boolean;
  onClose: () => void;
  onReplied: (reply: { body: string }) => void;
}

const MAX_BODY = 2000;

/**
 * Reply to a customer review (seller or brand). Mirrors POST
 * /api/reviews/:id/reply. Body is 1-2000 chars per the v2 schema CHECK.
 */
export function ReplyModal({ review, visible, onClose, onReplied }: ReplyModalProps) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Reset on open / review change
  React.useEffect(() => {
    if (visible) {
      setBody("");
      setErr(null);
    }
  }, [visible, review?.id]);

  const submit = async () => {
    if (!review) return;
    const trimmed = body.trim();
    if (trimmed.length < 1) {
      setErr("Reply cannot be empty");
      return;
    }
    if (trimmed.length > MAX_BODY) {
      setErr(`Reply too long (max ${MAX_BODY} chars)`);
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await replyToReviewBackend(review.id, trimmed);
      if (!res.ok) {
        setErr(res.error ?? "Reply failed");
        setBusy(false);
        return;
      }
      onReplied({ body: trimmed });
      onClose();
    } catch (e: any) {
      setErr(e?.message ?? "Reply failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.backdrop}
      >
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Reply to review</Text>
            <TouchableOpacity onPress={onClose} accessibilityLabel="Close reply dialog">
              <Ionicons name="close" size={24} color={colors.light.foreground} />
            </TouchableOpacity>
          </View>
          {review && (
            <Text style={styles.snippet} numberOfLines={2}>
              "{review.title || review.content?.slice(0, 80) || "Review"}"
            </Text>
          )}
          <TextInput
            style={styles.input}
            placeholder="Write your reply…"
            placeholderTextColor={colors.light.mutedForeground}
            value={body}
            onChangeText={setBody}
            multiline
            maxLength={MAX_BODY}
            editable={!busy}
          />
          {err && <Text style={styles.error}>{err}</Text>}
          <TouchableOpacity
            style={[styles.submit, busy && styles.submitBusy]}
            onPress={submit}
            disabled={busy}
            accessibilityRole="button"
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitLabel}>Post reply</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing[5],
  },
  card: {
    width: "100%",
    maxWidth: 480,
    backgroundColor: colors.light.card,
    borderRadius: radii.xl,
    padding: spacing[5],
    gap: spacing[3],
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.semibold as any,
    color: colors.light.foreground,
  },
  snippet: {
    fontSize: typography.fontSizes.sm,
    color: colors.light.mutedForeground,
    fontStyle: "italic",
  },
  input: {
    minHeight: 120,
    maxHeight: 240,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.lg,
    padding: spacing[3],
    textAlignVertical: "top",
    fontSize: typography.fontSizes.base,
    color: colors.light.foreground,
    backgroundColor: colors.light.background,
  },
  error: {
    fontSize: typography.fontSizes.sm,
    color: "#b91c1c",
  },
  submit: {
    backgroundColor: colors.olive[600],
    paddingVertical: spacing[3],
    borderRadius: radii.lg,
    alignItems: "center",
  },
  submitBusy: { opacity: 0.7 },
  submitLabel: {
    color: "#fff",
    fontSize: typography.fontSizes.base,
    fontWeight: typography.fontWeights.semibold as any,
  },
});
