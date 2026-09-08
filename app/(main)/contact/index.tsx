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
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@/components/ui/Icon";
import { useToast } from "@/components/ui";
import { useAuth } from "@/lib/supabase/auth";
import { submitContactSubmission } from "@/lib/api";
import { colors, radii, shadows, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

const TOPICS = [
  { id: "Order issue", label: "Order Adjustment", icon: "cube-outline" as const },
  { id: "Return or refund", label: "Returns & Refunds", icon: "refresh-outline" as const },
  { id: "Delivery", label: "Air Freight & Delivery", icon: "airplane-outline" as const },
  { id: "Product question", label: "Bespoke Sizing & Fit", icon: "cut-outline" as const },
  { id: "Account & security", label: "Vault & Security", icon: "shield-checkmark-outline" as const },
  { id: "Other", label: "General Inquiry", icon: "chatbubble-ellipses-outline" as const },
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
      toast(res.error || "Failed to transmit message", "error");
      return;
    }

    setSent(true);
    toast("Inquiry transmitted to concierge", "success");
  };

  if (sent) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <View style={styles.topHeader}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={20} color="#141311" />
          </TouchableOpacity>
          <View style={styles.headerTitleCenter}>
            <Text style={styles.headerEyebrow}>TRANSMISSION RECORD</Text>
            <Text style={styles.headerTitle}>Inquiry Logged</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.successContainer}>
          <View style={styles.successCard}>
            <View style={styles.successMedallionOuter}>
              <View style={styles.successMedallionInner}>
                <Ionicons name="checkmark" size={32} color="#C8A44A" />
                <View style={styles.successSparkle}>
                  <Ionicons name="sparkles" size={12} color="#E8CF8F" />
                </View>
              </View>
            </View>

            <Text style={styles.successTitle}>Dispatch Received</Text>
            <Text style={styles.successBody}>
              Your inquiry has been allocated to an Atelier Concierge specialist. A formal reply
              will be dispatched to{" "}
              <Text style={styles.successEmailHighlight}>{email.trim()}</Text> within 24 hours.
            </Text>

            <TouchableOpacity
              style={styles.successPrimaryButton}
              activeOpacity={0.85}
              onPress={() => router.back()}
            >
              <LinearGradient
                colors={["#1C1A17", "#141311"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.successPrimaryGradient}
              >
                <Text style={styles.successPrimaryText}>Return to Account</Text>
                <Ionicons name="arrow-forward" size={15} color="#E8CF8F" />
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.viewTicketsButton}
              activeOpacity={0.7}
              onPress={() => {
                router.replace("/(main)/account/tickets" as never);
              }}
            >
              <Ionicons name="documents-outline" size={14} color="#85651B" />
              <Text style={styles.viewTicketsButtonText}>Review Inquiries Log</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      {/* 1. Custom Atelier Top Navigation Header */}
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
          <Text style={styles.headerEyebrow}>ATELIER DIRECT LIAISON</Text>
          <Text style={styles.headerTitle}>Contact Support</Text>
        </View>

        <View style={styles.conciergeBadgeSmall}>
          <Ionicons name="headset-outline" size={17} color="#85651B" />
        </View>
      </View>

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
          {/* 2. Velvet Obsidian Hero Card ("Direct Concierge Advisory") */}
          <LinearGradient
            colors={["#141311", "#1E1C18", "#0F0E0D"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <View style={styles.heroTopRow}>
              <View style={styles.heroTagBadge}>
                <Ionicons name="sparkles" size={10} color="#C8A44A" />
                <Text style={styles.heroTagText}>PRIVATE CLIENT LIAISON</Text>
              </View>

              {/* Headset Seal Medallion */}
              <View style={styles.headsetMedallion}>
                <View style={styles.headsetMedallionInner}>
                  <Ionicons name="headset-outline" size={18} color="#E8CF8F" />
                </View>
              </View>
            </View>

            <Text style={styles.heroTitle}>Direct Concierge Advisory</Text>
            <Text style={styles.heroSubtitle}>
              Questions regarding bespoke sizing, private showroom viewings, insured freight, or
              order adjustments — send a note to our boutique directors.
            </Text>

            {/* 3-Point Advisory Strip */}
            <View style={styles.heroMetricsStrip}>
              <View style={styles.metricItem}>
                <Text style={styles.metricValue}>&lt; 24h</Text>
                <Text style={styles.metricLabel}>DIRECT RESPONSE</Text>
              </View>
              <View style={styles.metricDivider} />
              <View style={styles.metricItem}>
                <Text style={styles.metricValue}>Priority</Text>
                <Text style={styles.metricLabel}>TRIAGE LEVEL</Text>
              </View>
              <View style={styles.metricDivider} />
              <View style={styles.metricItem}>
                <Text style={[styles.metricValue, { color: "#54B870" }]}>Active</Text>
                <Text style={styles.metricLabel}>DESK STATUS</Text>
              </View>
            </View>
          </LinearGradient>

          {/* 3. Curated Topic Selector Rail */}
          <View style={styles.topicsSection}>
            <Text style={styles.sectionLabel}>INQUIRY CLASSIFICATION</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.topicsRow}
            >
              {TOPICS.map((topic) => {
                const active = subject === topic.id;
                return (
                  <TouchableOpacity
                    key={topic.id}
                    style={[styles.topicChip, active && styles.topicChipActive]}
                    onPress={() => handleSelectTopic(topic.id)}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={topic.icon}
                      size={13}
                      color={active ? "#E8CF8F" : "#787469"}
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

          {/* 4. Bespoke Patron Intake Form */}
          <View style={styles.formCard}>
            {/* Full Name */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>
                PATRON NAME <Text style={styles.requiredAsterisk}>*</Text>
              </Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="person-outline" size={16} color="#85651B" style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  value={name}
                  onChangeText={setName}
                  placeholder="Your full name"
                  placeholderTextColor="#9C988F"
                  autoCapitalize="words"
                />
              </View>
            </View>

            {/* Email */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>
                CORRESPONDENCE EMAIL <Text style={styles.requiredAsterisk}>*</Text>
              </Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="mail-outline" size={16} color="#85651B" style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="patron@domain.com"
                  placeholderTextColor="#9C988F"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            {/* Phone */}
            <View style={styles.field}>
              <View style={styles.fieldHeaderRow}>
                <Text style={styles.fieldLabel}>DIRECT TELEPHONE</Text>
                <Text style={styles.optionalTag}>OPTIONAL</Text>
              </View>
              <View style={styles.inputWrapper}>
                <Ionicons name="call-outline" size={16} color="#85651B" style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="+94 7X XXX XXXX"
                  placeholderTextColor="#9C988F"
                  keyboardType="phone-pad"
                />
              </View>
            </View>

            {/* Subject */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>
                SUBJECT / TOPIC SUMMARY <Text style={styles.requiredAsterisk}>*</Text>
              </Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="pricetag-outline" size={16} color="#85651B" style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  value={subject}
                  onChangeText={setSubject}
                  placeholder="e.g. Order modification or bespoke fit inquiry"
                  placeholderTextColor="#9C988F"
                />
              </View>
            </View>

            {/* Message */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>
                DETAILED SPECIFICATION <Text style={styles.requiredAsterisk}>*</Text>
              </Text>
              <View style={styles.textAreaWrapper}>
                <TextInput
                  style={styles.textAreaInput}
                  value={message}
                  onChangeText={setMessage}
                  placeholder="Detail your request, referencing order numbers or specific garments if relevant..."
                  placeholderTextColor="#9C988F"
                  multiline
                  textAlignVertical="top"
                />
              </View>
            </View>

            {/* Submit Action */}
            <TouchableOpacity
              style={[
                styles.submitButton,
                (!name.trim() || !email.trim() || !subject.trim() || !message.trim() || submitting) &&
                  styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={
                !name.trim() || !email.trim() || !subject.trim() || !message.trim() || submitting
              }
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={["#1E1C18", "#141311"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.submitGradient}
              >
                {submitting ? (
                  <ActivityIndicator color="#E8CF8F" size="small" />
                ) : (
                  <>
                    <Ionicons name="send-outline" size={15} color="#E8CF8F" />
                    <Text style={styles.submitButtonText}>Transmit Concierge Dispatch</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* 5. Concierge Guarantee Banner */}
          <View style={styles.guaranteeCard}>
            <View style={styles.guaranteeHeader}>
              <Ionicons name="shield-checkmark" size={16} color="#C8A44A" />
              <Text style={styles.guaranteeTitle}>Atelier Concierge Commitments</Text>
            </View>
            <Text style={styles.guaranteeText}>
              Every dispatch is reviewed directly by a member of our senior styling and logistics
              directors. We never utilize automated chatbot replies for our patrons.
            </Text>
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
    fontSize: 20,
    color: "#141311",
    letterSpacing: -0.3,
  },
  conciergeBadgeSmall: {
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
  },

  /* Velvet Obsidian Hero Card */
  heroCard: {
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.25)",
    marginBottom: 16,
    ...shadows.glow,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  heroTagBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(200, 164, 74, 0.12)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.3)",
  },
  heroTagText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    letterSpacing: 1.4,
    color: "#E8CF8F",
  },
  headsetMedallion: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.3)",
    padding: 3,
  },
  headsetMedallionInner: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: "#201E1A",
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 22,
    color: "#FAF8F5",
    letterSpacing: -0.4,
    marginBottom: 6,
  },
  heroSubtitle: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    lineHeight: 19,
    color: "#B3AFA5",
    marginBottom: 18,
  },
  heroMetricsStrip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  metricItem: {
    flex: 1,
    alignItems: "center",
  },
  metricValue: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 15,
    color: "#FAF8F5",
    marginBottom: 2,
  },
  metricLabel: {
    fontFamily: fontFamilies.mono.regular,
    fontSize: 8,
    letterSpacing: 1.2,
    color: "#8F8B82",
  },
  metricDivider: {
    width: 1,
    height: 20,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
  },

  /* Topics Section */
  topicsSection: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    letterSpacing: 1.4,
    color: "#85651B",
    marginBottom: 8,
  },
  topicsRow: {
    gap: 8,
  },
  topicChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EAE7DF",
  },
  topicChipActive: {
    backgroundColor: "#141311",
    borderColor: "#141311",
  },
  topicChipText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 12,
    color: "#6B675E",
  },
  topicChipTextActive: {
    fontFamily: fontFamilies.sans.semibold,
    color: "#FAF8F5",
  },

  /* Form Card */
  formCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#EAE7DF",
    padding: 18,
    marginBottom: 16,
    ...shadows.soft,
  },
  field: {
    marginBottom: 14,
  },
  fieldHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  fieldLabel: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10,
    letterSpacing: 1.2,
    color: "#85651B",
    marginBottom: 6,
  },
  requiredAsterisk: {
    color: "#C0392B",
  },
  optionalTag: {
    fontFamily: fontFamilies.mono.regular,
    fontSize: 9,
    letterSpacing: 1,
    color: "#8F8B82",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FAF9F5",
    borderWidth: 1,
    borderColor: "#E5E1D4",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 46,
  },
  inputIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    color: "#141311",
  },
  textAreaWrapper: {
    backgroundColor: "#FAF9F5",
    borderWidth: 1,
    borderColor: "#E5E1D4",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 120,
  },
  textAreaInput: {
    flex: 1,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    lineHeight: 19,
    color: "#141311",
    textAlignVertical: "top",
  },
  submitButton: {
    borderRadius: 12,
    overflow: "hidden",
    marginTop: 6,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
  },
  submitButtonText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 14,
    color: "#FAF8F5",
  },

  /* Guarantee Card */
  guaranteeCard: {
    backgroundColor: "#FAF9F5",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#EAE6DB",
    padding: 14,
  },
  guaranteeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  guaranteeTitle: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12,
    color: "#141311",
  },
  guaranteeText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    lineHeight: 16,
    color: "#787469",
  },

  /* Success Screen */
  successContainer: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  successCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#EAE7DF",
    padding: 28,
    alignItems: "center",
    ...shadows.soft,
  },
  successMedallionOuter: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.35)",
    padding: 4,
    marginBottom: 16,
  },
  successMedallionInner: {
    flex: 1,
    borderRadius: 30,
    backgroundColor: "#141311",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  successSparkle: {
    position: "absolute",
    top: 6,
    right: 8,
  },
  successTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 22,
    color: "#141311",
    letterSpacing: -0.3,
    marginBottom: 8,
    textAlign: "center",
  },
  successBody: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    lineHeight: 20,
    color: "#787469",
    textAlign: "center",
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  successEmailHighlight: {
    fontFamily: fontFamilies.mono.semibold,
    color: "#141311",
  },
  successPrimaryButton: {
    width: "100%",
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 10,
    ...shadows.soft,
  },
  successPrimaryGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    gap: 8,
  },
  successPrimaryText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 14,
    color: "#FAF8F5",
  },
  viewTicketsButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  viewTicketsButtonText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 13,
    color: "#85651B",
  },
});
