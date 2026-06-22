import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Alert,
  RefreshControl,
  Linking,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@/components/ui/Icon";
import {
  getAdminStoreDetail,
  approveStore,
  updateStoreStatus,
  reviewComplianceDocument,
} from "@/lib/api";
import { REQUIRED_COMPLIANCE_DOC_TYPES, isComplianceDocumentApproved } from "@/lib/seller-access";
import { Card, StatTile, EmptyState, Skeleton, Badge, ProgressBar, Button } from "@/components/ui";
import { colors, radii, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";
import { getComplianceDocumentSignedUrl } from "@/lib/upload";

function rel(s: string) {
  const d = new Date(s).getTime();
  const m = Math.floor((Date.now() - d) / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function hasValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "boolean") return value;
  return true;
}

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "approved" || status === "active") return "default";
  if (status === "pending" || status === "draft") return "secondary";
  return "destructive";
}

export default function AdminStoreDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["admin-store", id],
    queryFn: async () => {
      const r = await getAdminStoreDetail(id!);
      return r.ok ? r.data : null;
    },
    enabled: !!id,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-store", id] });
    qc.invalidateQueries({ queryKey: ["admin-stores"] });
    qc.invalidateQueries({ queryKey: ["admin-approvals"] });
  };

  const approveM = useMutation({
    mutationFn: () => approveStore(id!, "approved"),
    onSuccess: (res) => {
      if (!res.ok) {
        Alert.alert("Cannot approve", res.error);
        return;
      }
      invalidate();
      Alert.alert("Approved", "Store is now active.");
    },
  });

  const rejectM = useMutation({
    mutationFn: () => approveStore(id!, "rejected"),
    onSuccess: (res) => {
      if (!res.ok) {
        Alert.alert("Failed", res.error);
        return;
      }
      invalidate();
    },
  });

  const suspendM = useMutation({
    mutationFn: () => updateStoreStatus(id!, "suspended"),
    onSuccess: (res) => {
      if (!res.ok) {
        Alert.alert("Failed", res.error);
        return;
      }
      invalidate();
      Alert.alert("Suspended", "Seller tools are now locked.");
    },
  });

  const reactivateM = useMutation({
    mutationFn: () => updateStoreStatus(id!, "approved"),
    onSuccess: (res) => {
      if (!res.ok) {
        Alert.alert("Cannot reactivate", res.error);
        return;
      }
      invalidate();
      Alert.alert("Reactivated", "Store is active again.");
    },
  });

  const [reviewingDocId, setReviewingDocId] = useState<string | null>(null);
  const reviewDocM = useMutation({
    mutationFn: ({ docId, status }: { docId: string; status: "approved" | "rejected" }) =>
      reviewComplianceDocument(docId, status),
    onSuccess: (res) => {
      setReviewingDocId(null);
      if (!res.ok) {
        Alert.alert("Review failed", res.error);
        return;
      }
      invalidate();
    },
    onError: () => setReviewingDocId(null),
  });

  const confirm = (title: string, message: string, onConfirm: () => void) => {
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel" },
      { text: "Confirm", onPress: onConfirm },
    ]);
  };

  const s = q.data?.store;
  const payout = q.data?.payout ?? null;
  const documents = q.data?.documents ?? [];
  const complianceGaps = q.data?.complianceGaps ?? [];

  if (q.isLoading) {
    return (
      <View style={styles.container}>
        <Skeleton height={200} style={{ margin: 20 }} />
      </View>
    );
  }

  if (!s) return <EmptyState icon="storefront-outline" title="Store not found" />;

  const handleViewDocument = async (storagePath?: string | null) => {
    if (!storagePath) return;
    const url = await getComplianceDocumentSignedUrl(storagePath);
    if (!url) {
      Alert.alert("Unable to open document", "Could not generate a secure download link.");
      return;
    }
    await Linking.openURL(url);
  };

  const complianceItems = [
    { label: "Legal name", ok: hasValue(s.legal_name), value: s.legal_name },
    { label: "Tax ID", ok: hasValue(s.tax_id), value: s.tax_id ? "••••" + String(s.tax_id).slice(-4) : null },
    { label: "Bank name", ok: hasValue(payout?.bank_name), value: payout?.bank_name },
    { label: "Account holder", ok: hasValue(payout?.account_name), value: payout?.account_name },
    {
      label: "Account number",
      ok: hasValue(payout?.account_number_last4),
      value: payout?.account_number_last4 ? `••••${payout.account_number_last4}` : null,
    },
    { label: "Tax declaration", ok: payout?.tax_form_submitted === true, value: payout?.tax_form_submitted ? "Submitted" : null },
    ...REQUIRED_COMPLIANCE_DOC_TYPES.map((required) => {
      const doc = documents.find((d) => d.doc_type === required.type) as (typeof documents)[0] & { id?: string };
      return {
        label: required.label,
        ok: isComplianceDocumentApproved(doc),
        value: doc ? `${doc.file_name ?? "Uploaded"} · ${doc.status ?? "pending"}` : null,
        docId: doc?.id,
        docStatus: doc?.status ?? null,
        filePath: doc?.file_url ?? null,
      };
    }),
  ];

  const isPending = s.status === "pending" || s.status === "draft";
  const isActive = s.status === "approved" || s.status === "active";
  const isSuspended = s.status === "suspended" || s.status === "banned";
  const isRejected = s.status === "rejected";
  const complianceComplete = complianceGaps.length === 0;
  const busy =
    approveM.isPending || rejectM.isPending || suspendM.isPending || reactivateM.isPending;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={colors.light.primary} />
      }
    >
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Ionicons name="chevron-back" size={20} color={colors.light.foreground} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>STORE</Text>
          <Text style={styles.title} numberOfLines={2}>{s.name}</Text>
          <Text style={styles.slug}>@{s.slug}</Text>
        </View>
      </View>

      <Card style={styles.heroCard}>
        <View style={styles.statusRow}>
          <Badge variant={statusVariant(s.status)}>{s.status}</Badge>
          <Text style={styles.since}>{s.created_at ? rel(s.created_at) : "Recently"} ago</Text>
        </View>
        <Text style={styles.subtitle}>{s.description ?? "No description"}</Text>
      </Card>

      <Card style={styles.section}>
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Compliance</Text>
          <Badge variant={complianceComplete ? "default" : "secondary"}>
            {complianceComplete ? "Complete" : `${complianceGaps.length} missing`}
          </Badge>
        </View>
        {!complianceComplete ? (
          <Text style={styles.warning}>
            Optional onboarding details — not required for approval. Seller can complete these after approval to unlock tools and checkout.
          </Text>
        ) : null}
        <View style={styles.complianceList}>
          {complianceItems.map((item) => (
            <View key={item.label} style={styles.complianceRow}>
              <Ionicons
                name={item.ok ? "checkmark-circle" : "close-circle"}
                size={18}
                color={item.ok ? colors.olive[600] : colors.light.destructive}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.complianceLabel}>{item.label}</Text>
                {item.value ? (
                  <Text style={styles.complianceValue} numberOfLines={1}>{item.value}</Text>
                ) : null}
              </View>
              {"filePath" in item && item.filePath ? (
                <Button
                  variant="outline"
                  size="sm"
                  onPress={() => handleViewDocument(item.filePath)}
                >
                  View
                </Button>
              ) : null}
              {"docId" in item && item.docId && item.docStatus === "pending" ? (
                <View style={styles.docReviewActions}>
                  <Button
                    variant="outline"
                    size="sm"
                    loading={reviewingDocId === item.docId && reviewDocM.isPending}
                    disabled={reviewDocM.isPending}
                    onPress={() => {
                      setReviewingDocId(item.docId!);
                      reviewDocM.mutate({ docId: item.docId!, status: "approved" });
                    }}
                  >
                    Approve
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={reviewDocM.isPending}
                    onPress={() => {
                      setReviewingDocId(item.docId!);
                      reviewDocM.mutate({ docId: item.docId!, status: "rejected" });
                    }}
                  >
                    Reject
                  </Button>
                </View>
              ) : null}
            </View>
          ))}
        </View>
      </Card>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Actions</Text>
        <View style={styles.actions}>
          {isPending ? (
            <>
              <Button
                variant="brand"
                size="sm"
                loading={approveM.isPending}
                disabled={busy}
                onPress={() =>
                  confirm("Approve store", `Approve "${s.name}"?`, () => approveM.mutate())
                }
              >
                Approve
              </Button>
              <Button
                variant="outline"
                size="sm"
                loading={rejectM.isPending}
                disabled={busy}
                onPress={() =>
                  confirm("Reject store", `Reject "${s.name}"?`, () => rejectM.mutate())
                }
              >
                Reject
              </Button>
            </>
          ) : null}
          {isActive ? (
            <Button
              variant="outline"
              size="sm"
              loading={suspendM.isPending}
              disabled={busy}
              onPress={() =>
                confirm("Suspend store", `Suspend "${s.name}"? Seller tools will be locked.`, () =>
                  suspendM.mutate()
                )
              }
            >
              Suspend
            </Button>
          ) : null}
          {isRejected && !isPending ? (
            <Button
              variant="brand"
              size="sm"
              loading={approveM.isPending}
              disabled={busy}
              onPress={() =>
                confirm("Re-approve store", `Re-approve "${s.name}"?`, () => approveM.mutate())
              }
            >
              Re-approve
            </Button>
          ) : null}
          {isSuspended && !isPending ? (
            <Button
              variant="brand"
              size="sm"
              loading={reactivateM.isPending}
              disabled={busy}
              onPress={() =>
                confirm("Reactivate store", `Reactivate "${s.name}"?`, () => reactivateM.mutate())
              }
            >
              Reactivate
            </Button>
          ) : null}
        </View>
      </Card>

      {(s as any).owner ? (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Owner</Text>
          <View style={{ marginTop: 8, gap: 4 }}>
            <Text style={styles.contact}>{(s as any).owner.full_name ?? "—"}</Text>
            {(s as any).owner.email ? <Text style={styles.muted}>{(s as any).owner.email}</Text> : null}
            {(s as any).owner.phone ? <Text style={styles.muted}>{(s as any).owner.phone}</Text> : null}
          </View>
        </Card>
      ) : null}

      <View style={styles.statRow}>
        <StatTile label="Products" value={String(s.total_products ?? 0)} sub="listed" size="md" />
        <StatTile label="Sales" value={formatPrice(s.total_sales ?? 0)} sub="lifetime" size="md" />
        <StatTile label="Rating" value={s.rating ? s.rating.toFixed(1) : "—"} sub="avg" size="md" />
      </View>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Health</Text>
        <View style={{ marginTop: 12, gap: 12 }}>
          <Health label="Fulfilment" value="95%" progress={95} />
          <Health label="On-time delivery" value="88%" progress={88} />
        </View>
      </Card>

      {s.products && s.products.length > 0 ? (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Catalogue ({s.products.length})</Text>
          {s.products.slice(0, 8).map((p) => (
            <View key={p.id} style={styles.productRow}>
              <Text style={styles.productName} numberOfLines={1}>{p.name}</Text>
              <Badge variant={p.status === "active" ? "default" : "outline"}>{p.status}</Badge>
            </View>
          ))}
        </Card>
      ) : null}
    </ScrollView>
  );
}

function Health({ label, value, progress }: { label: string; value: string; progress: number }) {
  return (
    <View>
      <View style={styles.healthRow}>
        <Text style={styles.healthLabel}>{label}</Text>
        <Text style={styles.healthValue}>{value}</Text>
      </View>
      <ProgressBar value={progress} fillColor={colors.olive[500]} style={{ marginTop: 6 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  content: { paddingBottom: 100 },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 20, paddingBottom: 12 },
  back: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.light.card,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
  },
  eyebrow: { fontFamily: fontFamilies.mono.medium, fontSize: 10, color: colors.light.primary, letterSpacing: 1.4 },
  title: { fontFamily: fontFamilies.display.regular, fontSize: 24, color: colors.light.foreground, marginTop: 4, letterSpacing: -0.4 },
  slug: { fontFamily: fontFamilies.mono.regular, fontSize: 12, color: colors.light.mutedForeground, marginTop: 2 },
  heroCard: { marginHorizontal: 20, padding: 16, ...shadows.soft },
  statusRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  since: { fontFamily: fontFamilies.mono.regular, fontSize: 11, color: colors.light.mutedForeground, letterSpacing: 0.5, textTransform: "uppercase" },
  subtitle: { fontFamily: fontFamilies.sans.regular, fontSize: 13, color: colors.light.mutedForeground, marginTop: 8, lineHeight: 18 },
  section: { marginHorizontal: 20, marginTop: 16, padding: 16, ...shadows.soft },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { fontFamily: fontFamilies.sans.semibold, fontSize: 14, color: colors.light.foreground, letterSpacing: 0.5 },
  warning: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: colors.light.destructive, marginTop: 10, lineHeight: 18 },
  hint: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: colors.light.mutedForeground, marginTop: 10 },
  complianceList: { marginTop: 12, gap: 10 },
  complianceRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  docReviewActions: { flexDirection: "row", gap: 6, flexShrink: 0 },
  complianceLabel: { fontFamily: fontFamilies.sans.medium, fontSize: 13, color: colors.light.foreground },
  complianceValue: { fontFamily: fontFamilies.mono.regular, fontSize: 11, color: colors.light.mutedForeground, marginTop: 2 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  statRow: { flexDirection: "row", gap: 8, padding: 20, paddingBottom: 0 },
  healthRow: { flexDirection: "row", justifyContent: "space-between" },
  healthLabel: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: colors.light.foreground },
  healthValue: { fontFamily: fontFamilies.mono.semibold, fontSize: 12, color: colors.light.foreground },
  contact: { fontFamily: fontFamilies.sans.regular, fontSize: 13, color: colors.light.foreground },
  muted: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: colors.light.mutedForeground },
  productRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10, gap: 8 },
  productName: { flex: 1, fontFamily: fontFamilies.sans.regular, fontSize: 13, color: colors.light.foreground },
});
