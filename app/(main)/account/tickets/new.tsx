import React, { useState } from "react";
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
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@/components/ui/Icon";
import { PaperBackground } from "@/components/layout";
import { useToast } from "@/components/ui";
import { fetchJson } from "@/lib/api/backend";
import { colors, radii, shadows, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

const CATEGORIES = [
  { id: "order_issue", label: "Orders", icon: "cube-outline" as const },
  { id: "bespoke_sizing", label: "Sizing", icon: "cut-outline" as const },
  { id: "freight_logistics", label: "Delivery", icon: "airplane-outline" as const },
  { id: "invoice_tax", label: "Invoices & tax", icon: "receipt-outline" as const },
  { id: "general_inquiry", label: "Other", icon: "chatbubble-ellipses-outline" as const },
];

const GOLD_DEEP = "#85651b";
const HAIRLINE = "rgba(22, 23, 15, 0.08)";

export default function NewTicketScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { toast } = useToast();
  const params = useLocalSearchParams<{ orderId?: string }>();
  const [selectedCategory, setSelectedCategory] = useState("order_issue");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!subject.trim() || !body.trim()) {
      toast("Subject and message are required", "error");
      return;
    }
    setSaving(true);
    const res = await fetchJson<{ ticket?: { id: string } }>("/api/tickets", {
      method: "POST",
      body: {
        subject: subject.trim(),
        category: selectedCategory,
        priority: "normal",
        body: body.trim(),
        order_id: params.orderId || undefined,
      },
    });
    setSaving(false);
    if (!res.ok) {
      toast(res.error ?? "Could not open inquiry", "error");
      return;
    }
    toast("Inquiry sent to support", "success");
    const id = res.data.ticket?.id;
    router.replace(
      (id
        ? { pathname: "/(main)/account/tickets/[id]", params: { id } }
        : "/(main)/account/tickets") as never,
    );
  };

  const canSubmit = !!subject.trim() && !!body.trim() && !saving;

  return (
    <PaperBackground>
      <SafeAreaView style={styles.container} edges={["top"]}>
        {/* Navigation */}
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

          <Text style={styles.navTitle}>New inquiry</Text>

          <View style={{ width: 40 }} />
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
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Heading */}
            <View style={styles.pageHead}>
              <Text style={styles.eyebrow}>Help &amp; concierge</Text>
              <Text style={styles.pageTitle}>
                New <Text style={styles.pageTitleAccent}>inquiry.</Text>
              </Text>
              <Text style={styles.pageSub}>
                Tell us what you need — we'll reply in-app and by email.
              </Text>
            </View>

            {/* Linked order */}
            {params.orderId && (
              <View style={styles.orderChip}>
                <Ionicons name="link-outline" size={13} color={GOLD_DEEP} />
                <Text style={styles.orderChipText}>
                  Linked to order {params.orderId}
                </Text>
              </View>
            )}

            {/* Category */}
            <View style={styles.topicsSection}>
              <Text style={styles.sectionLabel}>What's it about?</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.topicsRow}
                style={styles.topicsScroll}
              >
                {CATEGORIES.map((cat) => {
                  const active = selectedCategory === cat.id;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={[styles.topicChip, active && styles.topicChipActive]}
                      onPress={() => setSelectedCategory(cat.id)}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                    >
                      <Ionicons
                        name={cat.icon}
                        size={13}
                        color={active ? colors.paper.cream : GOLD_DEEP}
                      />
                      <Text
                        style={[
                          styles.topicChipText,
                          active && styles.topicChipTextActive,
                        ]}
                      >
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Form */}
            <View style={styles.formCard}>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Subject</Text>
                <View style={styles.inputWrap}>
                  <TextInput
                    style={styles.input}
                    value={subject}
                    onChangeText={setSubject}
                    placeholder="e.g. Change my delivery address"
                    placeholderTextColor={colors.light.mutedForeground}
                  />
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Message</Text>
                <View style={styles.inputWrap}>
                  <TextInput
                    style={styles.textArea}
                    value={body}
                    onChangeText={setBody}
                    placeholder="Describe what you need — include order numbers, sizes or dates if relevant."
                    placeholderTextColor={colors.light.mutedForeground}
                    multiline
                    textAlignVertical="top"
                  />
                </View>
              </View>

              <TouchableOpacity
                style={[styles.primaryBtn, !canSubmit && { opacity: 0.5 }]}
                disabled={!canSubmit}
                onPress={submit}
                activeOpacity={0.88}
                accessibilityRole="button"
              >
                {saving ? (
                  <ActivityIndicator color={colors.paper.cream} size="small" />
                ) : (
                  <>
                    <Text style={styles.primaryBtnText}>Send inquiry</Text>
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
                Inquiries are handled by our support team — you'll get in-app
                updates and an email reply within 2 hours.
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </PaperBackground>
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

  /* Linked order */
  orderChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: "rgba(200, 164, 74, 0.12)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.full,
  },
  orderChipText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12,
    color: GOLD_DEEP,
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
  fieldLabel: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.light.mutedForeground,
    paddingHorizontal: 4,
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
    minHeight: 130,
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
});
