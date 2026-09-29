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
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { PaperBackground } from "@/components/layout";
import { useToast } from "@/components/ui";
import { useAuth } from "@/lib/supabase/auth";
import { submitContactSubmission } from "@/lib/api";
import { colors, radii, shadows, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

const TOPICS = [
  { id: "Order issue", label: "Orders", icon: "cube-outline" as const },
  { id: "Return or refund", label: "Returns & refunds", icon: "refresh-outline" as const },
  { id: "Delivery", label: "Delivery", icon: "airplane-outline" as const },
  { id: "Product question", label: "Sizing & fit", icon: "cut-outline" as const },
  { id: "Account & security", label: "Account", icon: "shield-checkmark-outline" as const },
  { id: "Other", label: "Other", icon: "chatbubble-ellipses-outline" as const },
];

const GOLD = colors.accent2.ochre;
const GOLD_DEEP = "#85651b";
const HAIRLINE = "rgba(22, 23, 15, 0.08)";

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
    setSubject(topicId);
  };

  const handleSubmit = async () => {
    if (!name.trim() || !email.trim() || !subject.trim() || !message.trim()) {
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
      subject,
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

  const navBar = (title: string) => (
    <View style={styles.navBar}>
      <TouchableOpacity
        onPress={() => router.back()}
        style={styles.navBtn}
        activeOpacity={0.7}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Ionicons name="chevron-back" size={20} color={colors.light.foreground} />
      </TouchableOpacity>

      <Text style={styles.navTitle}>{title}</Text>

      <View style={styles.navBtn}>
        <Ionicons name="headset-outline" size={17} color={GOLD_DEEP} />
      </View>
    </View>
  );

  if (sent) {
    return (
      <PaperBackground>
        <SafeAreaView style={styles.container} edges={["top"]}>
          {navBar("Message sent")}
          <View style={styles.successWrap}>
            <View style={styles.successIcon}>
              <Ionicons name="checkmark" size={26} color={colors.olive[700]} />
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
                <Ionicons name="arrow-forward" size={14} color={colors.olive[900]} />
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
        </SafeAreaView>
      </PaperBackground>
    );
  }

  return (
    <PaperBackground>
      <SafeAreaView style={styles.container} edges={["top"]}>
        {navBar("Contact support")}

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
            <View style={styles.pageHead}>
              <Text style={styles.eyebrow}>Help &amp; concierge</Text>
              <Text style={styles.pageTitle}>
                How can we <Text style={styles.pageTitleAccent}>help?</Text>
              </Text>
              <Text style={styles.pageSub}>
                Send us a note — a real person replies within 24 hours.
              </Text>
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
                {TOPICS.map((topic) => {
                  const active = subject === topic.id;
                  return (
                    <TouchableOpacity
                      key={topic.id}
                      style={[styles.topicChip, active && styles.topicChipActive]}
                      onPress={() => handleSelectTopic(topic.id)}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                    >
                      <Ionicons
                        name={topic.icon}
                        size={13}
                        color={active ? colors.paper.cream : GOLD_DEEP}
                      />
                      <Text
                        style={[
                          styles.topicChipText,
                          active && styles.topicChipTextActive,
                        ]}
                      >
                        {topic.label}
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
                  placeholderTextColor={colors.light.mutedForeground}
                  autoCapitalize="words"
                />
              </Field>

              <Field label="Email" required>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  placeholderTextColor={colors.light.mutedForeground}
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
                  placeholderTextColor={colors.light.mutedForeground}
                  keyboardType="phone-pad"
                />
              </Field>

              <Field label="Subject" required>
                <TextInput
                  style={styles.input}
                  value={subject}
                  onChangeText={setSubject}
                  placeholder="e.g. Change my delivery address"
                  placeholderTextColor={colors.light.mutedForeground}
                />
              </Field>

              <Field label="Message" required>
                <TextInput
                  style={styles.textArea}
                  value={message}
                  onChangeText={setMessage}
                  placeholder="Tell us what you need — include order numbers if relevant."
                  placeholderTextColor={colors.light.mutedForeground}
                  multiline
                  textAlignVertical="top"
                />
              </Field>

              <TouchableOpacity
                style={[
                  styles.primaryBtn,
                  (!name.trim() ||
                    !email.trim() ||
                    !subject.trim() ||
                    !message.trim() ||
                    submitting) && { opacity: 0.5 },
                ]}
                onPress={handleSubmit}
                disabled={
                  !name.trim() ||
                  !email.trim() ||
                  !subject.trim() ||
                  !message.trim() ||
                  submitting
                }
                activeOpacity={0.88}
                accessibilityRole="button"
              >
                {submitting ? (
                  <ActivityIndicator color={colors.paper.cream} size="small" />
                ) : (
                  <>
                    <Text style={styles.primaryBtnText}>Send message</Text>
                    <View style={styles.primaryBtnArrow}>
                      <Ionicons name="arrow-forward" size={14} color={colors.olive[900]} />
                    </View>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Footnote */}
            <View style={styles.footnote}>
              <Ionicons name="shield-checkmark-outline" size={13} color={GOLD_DEEP} />
              <Text style={styles.footnoteText}>
                Every message is read by a member of our team — no automated
                replies.
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </PaperBackground>
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
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },

  /* Nav */
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[2.5],
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.paper.cream,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: HAIRLINE,
  },
  navTitle: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 15,
    color: colors.light.foreground,
  },

  scrollContent: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[2],
    gap: 14,
  },

  /* Heading */
  pageHead: {
    marginBottom: spacing[2],
  },
  eyebrow: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: GOLD_DEEP,
    marginBottom: 4,
  },
  pageTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 32,
    letterSpacing: -0.6,
    lineHeight: 38,
    color: colors.light.foreground,
  },
  pageTitleAccent: {
    fontFamily: fontFamilies.display.italic,
    color: GOLD_DEEP,
  },
  pageSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.light.mutedForeground,
    marginTop: 6,
    maxWidth: 300,
  },

  /* Topics */
  topicsSection: {
    gap: 10,
  },
  sectionLabel: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13.5,
    color: colors.light.foreground,
  },
  topicsScroll: {
    marginHorizontal: -spacing[5],
  },
  topicsRow: {
    paddingHorizontal: spacing[5],
    gap: 8,
  },
  topicChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radii.full,
    backgroundColor: colors.paper.cream,
    borderWidth: 1,
    borderColor: HAIRLINE,
  },
  topicChipActive: {
    backgroundColor: colors.olive[900],
    borderColor: colors.olive[900],
  },
  topicChipText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: colors.light.foreground,
  },
  topicChipTextActive: {
    color: colors.paper.cream,
  },

  /* Form */
  formCard: {
    backgroundColor: colors.paper.cream,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: HAIRLINE,
    padding: spacing[5],
    gap: spacing[4],
    ...shadows.soft,
  },
  field: {
    gap: 6,
  },
  fieldHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  fieldLabel: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.light.mutedForeground,
  },
  fieldRequired: {
    color: colors.accent2.rust,
  },
  fieldOptional: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9.5,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: colors.light.mutedForeground,
  },
  inputWrap: {
    backgroundColor: colors.paper.warm,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: HAIRLINE,
    paddingHorizontal: 14,
  },
  input: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 14,
    color: colors.light.foreground,
    paddingVertical: Platform.OS === "ios" ? 12 : 9,
  },
  textArea: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 14,
    lineHeight: 20,
    minHeight: 110,
    color: colors.light.foreground,
    paddingTop: 12,
    paddingBottom: 12,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 50,
    borderRadius: radii.full,
    backgroundColor: colors.olive[900],
    paddingRight: 6,
    marginTop: 2,
  },
  primaryBtnText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 14,
    color: colors.paper.cream,
  },
  primaryBtnArrow: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.paper.cream,
    alignItems: "center",
    justifyContent: "center",
  },

  /* Footnote */
  footnote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingHorizontal: spacing[2],
  },
  footnoteText: {
    flex: 1,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11.5,
    lineHeight: 16,
    color: colors.light.mutedForeground,
  },

  /* Success */
  successWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing[6],
  },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(200, 164, 74, 0.14)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing[5],
  },
  successTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 26,
    letterSpacing: -0.4,
    color: colors.light.foreground,
  },
  successSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.light.mutedForeground,
    textAlign: "center",
    marginTop: 8,
    maxWidth: 300,
  },
  successEmail: {
    fontFamily: fontFamilies.sans.semibold,
    color: colors.light.foreground,
  },
  textLink: {
    marginTop: spacing[3],
    paddingVertical: 4,
  },
  textLinkText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: colors.light.foreground,
    textDecorationLine: "underline",
  },
});
