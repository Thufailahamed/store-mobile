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
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@/components/ui/Icon";
import { useToast } from "@/components/ui";
import { fetchJson } from "@/lib/api/backend";
import { colors, radii, shadows, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

const CATEGORIES = [
  { id: "order_issue", label: "Order Adjustment", icon: "cube-outline" as const },
  { id: "bespoke_sizing", label: "Bespoke Sizing", icon: "cut-outline" as const },
  { id: "freight_logistics", label: "Freight & Delivery", icon: "airplane-outline" as const },
  { id: "invoice_tax", label: "VAT & Customs", icon: "receipt-outline" as const },
  { id: "general_inquiry", label: "Concierge Inquiry", icon: "headset-outline" as const },
];

export default function NewTicketScreen() {
  const router = useRouter();
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
    toast("Inquiry transmitted to concierge", "success");
    const id = res.data.ticket?.id;
    router.replace(
      (id
        ? { pathname: "/(main)/account/tickets/[id]", params: { id } }
        : "/(main)/account/tickets") as never,
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      {/* Top Header */}
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
          <Text style={styles.headerEyebrow}>CONCIERGE INTAKE</Text>
          <Text style={styles.headerTitle}>New Inquiry</Text>
        </View>

        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Order Association Badge if opened from order */}
          {params.orderId && (
            <View style={styles.orderPill}>
              <Ionicons name="link-outline" size={13} color="#85651B" />
              <Text style={styles.orderPillText}>Linked Order Ref: {params.orderId}</Text>
            </View>
          )}

          {/* Category Selector */}
          <View style={styles.sectionBlock}>
            <Text style={styles.fieldLabel}>SELECT INQUIRY CLASSIFICATION</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoriesRow}
            >
              {CATEGORIES.map((cat) => {
                const active = selectedCategory === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[styles.categoryChip, active && styles.categoryChipActive]}
                    onPress={() => setSelectedCategory(cat.id)}
                  >
                    <Ionicons
                      name={cat.icon}
                      size={13}
                      color={active ? "#E8CF8F" : "#787469"}
                    />
                    <Text
                      style={[
                        styles.categoryChipText,
                        active && styles.categoryChipTextActive,
                      ]}
                    >
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Form Card */}
          <View style={styles.formCard}>
            {/* Subject */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>INQUIRY SUMMARY / SUBJECT</Text>
              <TextInput
                style={styles.input}
                value={subject}
                onChangeText={setSubject}
                placeholder="e.g. Delivery address modification prior to air freight dispatch"
                placeholderTextColor="#9C988F"
              />
            </View>

            {/* Message Body */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>DETAILED SPECIFICATION</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={body}
                onChangeText={setBody}
                placeholder="Describe your request in detail. Mention specific item sizes, preferred delivery timeframes, or invoice particulars..."
                placeholderTextColor="#9C988F"
                multiline
              />
            </View>

            {/* Transmit Button */}
            <TouchableOpacity
              style={[
                styles.submitButton,
                (!subject.trim() || !body.trim() || saving) && { opacity: 0.6 },
              ]}
              disabled={!subject.trim() || !body.trim() || saving}
              onPress={submit}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={["#1E1C18", "#141311"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.submitGradient}
              >
                {saving ? (
                  <ActivityIndicator color="#E8CF8F" size="small" />
                ) : (
                  <>
                    <Text style={styles.submitButtonText}>Transmit Concierge Inquiry</Text>
                    <Ionicons name="arrow-forward" size={15} color="#E8CF8F" />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* SLA Guarantee */}
          <View style={styles.slaCard}>
            <Ionicons name="shield-checkmark-outline" size={18} color="#85651B" />
            <View style={styles.slaTextCol}>
              <Text style={styles.slaTitle}>Atelier White-Glove Response Protocol</Text>
              <Text style={styles.slaDesc}>
                Inquiries are triaged directly by senior atelier specialists. You will receive
                in-app updates and dispatch email notifications within 120 minutes.
              </Text>
            </View>
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
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  orderPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F7F5EE",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E6E2D4",
    marginBottom: 16,
    alignSelf: "flex-start",
  },
  orderPillText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 11,
    color: "#85651B",
  },
  sectionBlock: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    letterSpacing: 1.4,
    color: "#85651B",
    marginBottom: 8,
  },
  categoriesRow: {
    gap: 8,
  },
  categoryChip: {
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
  categoryChipActive: {
    backgroundColor: "#141311",
    borderColor: "#141311",
  },
  categoryChipText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 12,
    color: "#6B675E",
  },
  categoryChipTextActive: {
    fontFamily: fontFamilies.sans.semibold,
    color: "#FAF8F5",
  },
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
    marginBottom: 16,
  },
  input: {
    backgroundColor: "#FAF9F5",
    borderWidth: 1,
    borderColor: "#E5E1D4",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 14,
    color: "#141311",
  },
  textArea: {
    minHeight: 140,
    textAlignVertical: "top",
    lineHeight: 20,
  },
  submitButton: {
    borderRadius: 12,
    overflow: "hidden",
    marginTop: 6,
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
  slaCard: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: "#FAF9F5",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#EAE6DB",
    padding: 14,
    alignItems: "flex-start",
  },
  slaTextCol: {
    flex: 1,
  },
  slaTitle: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12,
    color: "#141311",
    marginBottom: 2,
  },
  slaDesc: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    lineHeight: 16,
    color: "#787469",
  },
});
