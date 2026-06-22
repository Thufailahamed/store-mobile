import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { ScreenHeader } from "@/components/layout";
import { Button, useToast } from "@/components/ui";
import { Body, Display, Label } from "@/components/ui/Typography";
import { useAuth } from "@/lib/supabase/auth";
import { submitContactSubmission } from "@/lib/api";
import { colors, radii, shadows, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

const TOPICS = [
  "Order issue",
  "Return or refund",
  "Delivery",
  "Product question",
  "Account & security",
  "Other",
];

export default function ContactScreen() {
  const router = useRouter();
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

  const handleSubmit = async () => {
    if (!name.trim() || !email.trim() || !subject.trim() || !message.trim()) {
      toast("Please fill in all required fields.", "error");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast("Enter a valid email address.", "error");
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
      toast(res.error, "error");
      return;
    }

    setSent(true);
    toast("Message sent — we'll reply within 1–2 business days.", "success");
  };

  if (sent) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <ScreenHeader title="Contact support" />
        <View style={styles.successWrap}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={48} color={colors.olive[700]} />
          </View>
          <Display size="xl" style={styles.successTitle}>Message received</Display>
          <Body muted style={styles.successCopy}>
            Thanks for reaching out. Our support team will reply to {email.trim()} soon.
          </Body>
          <Button onPress={() => router.back()} style={styles.successBtn}>
            Done
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader title="Contact support" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <Ionicons name="headset-outline" size={24} color={colors.olive[700]} />
            </View>
            <Display size="lg">How can we help?</Display>
            <Body muted size="sm">
              Questions about orders, returns, or your account — send us a note and we'll respond by email.
            </Body>
          </View>

          <Label style={styles.fieldLabel}>Topic</Label>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.topicRow}
          >
            {TOPICS.map((topic) => {
              const active = subject === topic;
              return (
                <TouchableOpacity
                  key={topic}
                  style={[styles.topicChip, active && styles.topicChipActive]}
                  onPress={() => setSubject(topic)}
                  activeOpacity={0.8}
                >
                  <Label style={[styles.topicChipText, active && styles.topicChipTextActive]}>
                    {topic}
                  </Label>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <FormField label="Name" required>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor={colors.light.mutedForeground}
              autoCapitalize="words"
            />
          </FormField>

          <FormField label="Email" required>
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
          </FormField>

          <FormField label="Phone" hint="Optional">
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="+94 7X XXX XXXX"
              placeholderTextColor={colors.light.mutedForeground}
              keyboardType="phone-pad"
            />
          </FormField>

          <FormField label="Subject" required>
            <TextInput
              style={styles.input}
              value={subject}
              onChangeText={setSubject}
              placeholder="Brief summary"
              placeholderTextColor={colors.light.mutedForeground}
            />
          </FormField>

          <FormField label="Message" required>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={message}
              onChangeText={setMessage}
              placeholder="Tell us what happened and include order numbers if relevant."
              placeholderTextColor={colors.light.mutedForeground}
              multiline
              textAlignVertical="top"
            />
          </FormField>

          <TouchableOpacity
            style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color={colors.light.primaryForeground} />
            ) : (
              <>
                <Ionicons name="send-outline" size={18} color={colors.light.primaryForeground} />
                <Label style={styles.submitText}>Send message</Label>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function FormField({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.field}>
      <View style={styles.fieldHeader}>
        <Label style={styles.fieldLabel}>
          {label}
          {required ? " *" : ""}
        </Label>
        {hint ? <Body muted size="xs">{hint}</Body> : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  flex: { flex: 1 },
  content: { padding: spacing[5], paddingBottom: spacing[8] },
  hero: {
    alignItems: "center",
    gap: spacing[2],
    marginBottom: spacing[5],
    paddingVertical: spacing[2],
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: radii.xl,
    backgroundColor: colors.olive[100],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing[1],
  },
  field: { marginBottom: spacing[4] },
  fieldHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing[2],
  },
  fieldLabel: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: colors.light.foreground,
  },
  topicRow: { gap: spacing[2], paddingBottom: spacing[4] },
  topicChip: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radii.full,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  topicChipActive: {
    backgroundColor: colors.olive[100],
    borderColor: colors.olive[300],
  },
  topicChipText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 12,
    color: colors.light.mutedForeground,
  },
  topicChipTextActive: {
    color: colors.olive[800],
  },
  input: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.xl,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    fontFamily: fontFamilies.sans.regular,
    fontSize: 15,
    color: colors.light.foreground,
    ...shadows.soft,
  },
  textArea: {
    minHeight: 120,
    paddingTop: spacing[3],
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[2],
    backgroundColor: colors.light.primary,
    borderRadius: radii.full,
    paddingVertical: spacing[4],
    marginTop: spacing[2],
  },
  submitBtnDisabled: { opacity: 0.7 },
  submitText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 15,
    color: colors.light.primaryForeground,
  },
  successWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing[6],
    gap: spacing[3],
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.olive[100],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing[2],
  },
  successTitle: { textAlign: "center" },
  successCopy: { textAlign: "center", lineHeight: 22 },
  successBtn: { marginTop: spacing[4], alignSelf: "stretch" },
});
