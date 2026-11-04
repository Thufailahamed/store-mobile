import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { UserPageFrame, UP as C } from "@/components/user/user-page";
import { useToast } from "@/components/ui";
import { useAuth } from "@/lib/supabase/auth";
import { submitContactSubmission } from "@/lib/api";

import { fontFamilies } from "@/lib/theme/fonts";

const TOPICS = [
  { id: "Order issue", label: "Orders", icon: "cube-outline" as const },
  { id: "Return or refund", label: "Returns & refunds", icon: "refresh-outline" as const },
  { id: "Delivery", label: "Delivery", icon: "airplane-outline" as const },
  { id: "Product question", label: "Sizing & fit", icon: "cut-outline" as const },
  { id: "Account & security", label: "Account", icon: "shield-checkmark-outline" as const },
  { id: "Other", label: "Other", icon: "chatbubble-ellipses-outline" as const },
];


export default function ContactScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { toast } = useToast();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ subject?: string; message?: string }>();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [subject, setSubject] = useState("");
  // Topic is its own field — picking one must not wipe a subject already typed.
  const [topic, setTopic] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (user) {
      setName((prev) => prev || user.user_metadata?.full_name || "");
      setEmail((prev) => prev || user.email || "");
    }
    if (params.subject) setSubject(String(params.subject));
    if (params.message) setMessage(String(params.message));
  }, [user, params.subject, params.message]);

  const handleSelectTopic = (topicId: string) => {
    setTopic((prev) => (prev === topicId ? null : topicId));
  };

  const resolvedSubject = subject.trim()
    ? topic
      ? `${topic}: ${subject.trim()}`
      : subject.trim()
    : (topic ?? "");
  const canSend =
    !!name.trim() && !!email.trim() && !!resolvedSubject && !!message.trim();

  const handleSubmit = async () => {
    if (!canSend) {
      toast("Please complete all required fields.", "error");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast("Please enter a valid email address.", "error");
      return;
    }

    setSubmitting(true);
    const res = await submitContactSubmission({
      name,
      email,
      phone,
      subject: resolvedSubject,
      message,
      userId: user?.id,
    });
    setSubmitting(false);

    if (!res.ok) {
      toast(res.error || "Failed to send message", "error");
      return;
    }

    setSent(true);
    toast("Message sent to support", "success");
  };

  if (sent) {
    return (
      <UserPageFrame title="Message sent">
          <View style={styles.successWrap}>
            <View style={styles.successIcon}>
              <Ionicons name="checkmark" size={30} color={C.accent} />
            </View>
            <Text style={styles.successTitle}>Message sent</Text>
            <Text style={styles.successSub}>
              A member of our team will reply to{" "}
              <Text style={styles.successEmail}>{email.trim()}</Text> — usually
              within 24 hours.
            </Text>

            <TouchableOpacity
              style={styles.primaryBtn}
              activeOpacity={0.88}
              onPress={() => router.back()}
              accessibilityRole="button"
            >
              <Text style={styles.primaryBtnText}>Back to account</Text>
              <View style={styles.primaryBtnArrow}>
                <Ionicons name="arrow-forward" size={17} color={C.ink} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.textLink}
              activeOpacity={0.7}
              onPress={() => {
                router.replace("/(main)/account/tickets" as never);
              }}
              hitSlop={8}
            >
              <Text style={styles.textLinkText}>View my tickets</Text>
            </TouchableOpacity>
          </View>
      </UserPageFrame>
    );
  }

  return (
    <UserPageFrame title="Contact support">
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: insets.bottom + 40 },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Heading */}
            <View style={styles.cardShadow}>
              <View style={styles.introCard}>
                <View style={styles.introIcon}>
                  <Ionicons name="headset" size={22} color={C.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.introTitle}>How can we help?</Text>
                  <Text style={styles.introSub}>
                    A real person replies within 24 hours.
                  </Text>
                </View>
              </View>
            </View>

            {/* Topics */}
            <View style={styles.topicsSection}>
              <Text style={styles.sectionLabel}>What's it about?</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.topicsRow}
                style={styles.topicsScroll}
              >
                {TOPICS.map((t) => {
                  const active = topic === t.id;
                  return (
                    <TouchableOpacity
                      key={t.id}
                      style={[styles.topicChip, active && styles.topicChipActive]}
                      onPress={() => handleSelectTopic(t.id)}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                    >
                      <Ionicons
                        name={t.icon}
                        size={15}
                        color={active ? C.lime : C.text}
                      />
                      <Text
                        style={[
                          styles.topicChipText,
                          active && styles.topicChipTextActive,
                        ]}
                      >
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Form */}
            <View style={styles.formCard}>
              <Field label="Your name" required>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Full name"
                  placeholderTextColor={C.faint}
                  autoCapitalize="words"
                />
              </Field>

              <Field label="Email" required>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  placeholderTextColor={C.faint}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </Field>

              <Field label="Phone" optional>
                <TextInput
                  style={styles.input}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="+94 7X XXX XXXX"
                  placeholderTextColor={C.faint}
                  keyboardType="phone-pad"
                />
              </Field>

              <Field label="Subject" required={!topic} optional={!!topic}>
                <TextInput
                  style={styles.input}
                  value={subject}
                  onChangeText={setSubject}
                  placeholder={topic ? "Add a short summary" : "e.g. Change my delivery address"}
                  placeholderTextColor={C.faint}
                />
              </Field>

              <Field label="Message" required>
                <TextInput
                  style={styles.textArea}
                  value={message}
                  onChangeText={setMessage}
                  placeholder="Tell us what you need — include order numbers if relevant."
                  placeholderTextColor={C.faint}
                  multiline
                  textAlignVertical="top"
                />
              </Field>

              <TouchableOpacity
                style={[styles.primaryBtn, (!canSend || submitting) && styles.primaryBtnDisabled]}
                onPress={handleSubmit}
                disabled={!canSend || submitting}
                activeOpacity={0.88}
                accessibilityRole="button"
              >
                <Text style={styles.primaryBtnText}>
                  {submitting ? "Sending…" : "Send message"}
                </Text>
                <View style={styles.primaryBtnArrow}>
                  {submitting ? (
                    <ActivityIndicator color={C.ink} size="small" />
                  ) : (
                    <Ionicons name="arrow-forward" size={17} color={C.ink} />
                  )}
                </View>
              </TouchableOpacity>
            </View>

            {/* Footnote */}
            <View style={styles.footnote}>
              <Ionicons name="shield-checkmark-outline" size={15} color={C.muted} />
              <Text style={styles.footnoteText}>
                Every message is read by a member of our team — no automated
                replies.
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
    </UserPageFrame>
  );
}

function Field({
  label,
  required,
  optional,
  children,
}: {
  label: string;
  required?: boolean;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.field}>
      <View style={styles.fieldHeader}>
        <Text style={styles.fieldLabel}>
          {label}
          {required ? <Text style={styles.fieldRequired}> *</Text> : null}
        </Text>
        {optional ? <Text style={styles.fieldOptional}>Optional</Text> : null}
      </View>
      <View style={styles.inputWrap}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 2, gap: 16 },

  cardShadow: {
    borderRadius: 26,
    backgroundColor: C.card,
    shadowColor: "#16170f",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 3,
  },
  introCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 18,
    borderRadius: 26,
    borderCurve: "continuous",
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
  },
  introIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.accentSoft,
  },
  introTitle: { fontFamily: fontFamilies.sans.bold, fontSize: 18, letterSpacing: -0.4, color: C.text },
  introSub: { fontFamily: fontFamilies.sans.regular, fontSize: 13, color: C.muted, marginTop: 2 },

  /* Topics */
  topicsSection: { gap: 10 },
  sectionLabel: { fontFamily: fontFamilies.sans.bold, fontSize: 17, letterSpacing: -0.3, color: C.text, paddingHorizontal: 2 },
  topicsScroll: { marginHorizontal: -20 },
  topicsRow: { paddingHorizontal: 20, gap: 10 },
  topicChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    height: 42,
    paddingHorizontal: 16,
    borderRadius: 21,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
  },
  topicChipActive: { backgroundColor: C.ink, borderColor: C.ink },
  topicChipText: { fontFamily: fontFamilies.sans.semibold, fontSize: 13.5, color: C.text },
  topicChipTextActive: { color: C.cream },

  /* Form */
  formCard: {
    backgroundColor: C.card,
    borderRadius: 26,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: C.line,
    padding: 18,
    gap: 16,
    shadowColor: "#16170f",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 3,
  },
  field: { gap: 7 },
  fieldHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    paddingHorizontal: 2,
  },
  fieldLabel: { fontFamily: fontFamilies.sans.semibold, fontSize: 13, color: C.text },
  fieldRequired: { color: C.rust },
  fieldOptional: { fontFamily: fontFamilies.sans.medium, fontSize: 12, color: C.muted },
  inputWrap: { backgroundColor: "#f5f3ec", borderRadius: 16, paddingHorizontal: 15 },
  input: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 15,
    color: C.text,
    height: 52,
  },
  textArea: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 15,
    lineHeight: 21,
    minHeight: 120,
    color: C.text,
    paddingTop: 14,
    paddingBottom: 14,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    height: 56,
    borderRadius: 28,
    backgroundColor: C.ink,
    paddingLeft: 22,
    paddingRight: 6,
    marginTop: 2,
  },
  primaryBtnDisabled: { opacity: 0.35 },
  primaryBtnText: { fontFamily: fontFamilies.sans.semibold, fontSize: 15.5, color: C.cream },
  primaryBtnArrow: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.lime,
    alignItems: "center",
    justifyContent: "center",
  },

  /* Footnote */
  footnote: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 4 },
  footnoteText: { flex: 1, fontFamily: fontFamilies.sans.regular, fontSize: 12.5, lineHeight: 17, color: C.muted },

  /* Success */
  successWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingBottom: 80,
  },
  successIcon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: C.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  successTitle: { fontFamily: fontFamilies.sans.bold, fontSize: 22, letterSpacing: -0.5, color: C.text },
  successSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 14,
    lineHeight: 20,
    color: C.muted,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 22,
    maxWidth: 300,
  },
  successEmail: { fontFamily: fontFamilies.sans.semibold, color: C.text },
  textLink: { marginTop: 14, paddingVertical: 4 },
  textLinkText: { fontFamily: fontFamilies.sans.semibold, fontSize: 14, color: C.accent },
});
