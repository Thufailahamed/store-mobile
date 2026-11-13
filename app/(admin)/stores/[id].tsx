import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  RefreshControl,
  Linking,
  TextInput,
  Switch,
  TouchableOpacity,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import {
  getAdminStoreDetail,
  approveStore,
  updateStoreStatus,
  updateAdminStore,
  reviewComplianceDocument,
} from "@/lib/api";
import { REQUIRED_COMPLIANCE_DOC_TYPES, isComplianceDocumentApproved } from "@/lib/seller-access";
import { Card, StatTile, EmptyState, Skeleton, Badge, ProgressBar, Button } from "@/components/ui";
import { colors, radii, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";
import { getComplianceDocumentSignedUrl } from "@/lib/upload";
import { themedAlert } from "@/lib/themed-alert";

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
        themedAlert("Cannot approve", res.error);
        return;
      }
      invalidate();
      themedAlert("Approved", "Store is now active.");
    },
  });

  const rejectM = useMutation({
    mutationFn: () => approveStore(id!, "rejected"),
    onSuccess: (res) => {
      if (!res.ok) {
        themedAlert("Failed", res.error);
        return;
      }
      invalidate();
    },
  });

  const suspendM = useMutation({
    mutationFn: () => updateStoreStatus(id!, "suspended"),
    onSuccess: (res) => {
      if (!res.ok) {
        themedAlert("Failed", res.error);
        return;
      }
      invalidate();
      themedAlert("Suspended", "Seller tools are now locked.");
    },
  });

  const reactivateM = useMutation({
    mutationFn: () => updateStoreStatus(id!, "approved"),
    onSuccess: (res) => {
      if (!res.ok) {
        themedAlert("Cannot reactivate", res.error);
        return;
      }
      invalidate();
      themedAlert("Reactivated", "Store is active again.");
    },
  });

  const [reviewingDocId, setReviewingDocId] = useState<string | null>(null);
  const reviewDocM = useMutation({
    mutationFn: ({ docId, status }: { docId: string; status: "approved" | "rejected" }) =>
      reviewComplianceDocument(docId, status),
    onSuccess: (res) => {
      setReviewingDocId(null);
      if (!res.ok) {
        themedAlert("Review failed", res.error);
        return;
      }
      invalidate();
    },
    onError: () => setReviewingDocId(null),
  });

  const confirm = (title: string, message: string, onConfirm: () => void) => {
    themedAlert(title, message, [
      { text: "Cancel", style: "cancel" },
      { text: "Confirm", onPress: onConfirm },
    ]);
  };

  const s = q.data?.store;
  const payout = q.data?.payout ?? null;
  const documents = q.data?.documents ?? [];
  const complianceGaps = q.data?.complianceGaps ?? [];

  const [editOpen, setEditOpen] = useState(false);
  const [formName, setFormName] = useState("");
  const [formStatus, setFormStatus] = useState("approved");
  const [formIsVerified, setFormIsVerified] = useState(false);
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formLegalName, setFormLegalName] = useState("");
  const [formTaxId, setFormTaxId] = useState("");
  const [formPickupLine1, setFormPickupLine1] = useState("");
  const [formPickupLine2, setFormPickupLine2] = useState("");
  const [formPickupCity, setFormPickupCity] = useState("");
  const [formPickupState, setFormPickupState] = useState("");
  const [formPickupPostal, setFormPickupPostal] = useState("");
  const [formBankName, setFormBankName] = useState("");
  const [formAccountName, setFormAccountName] = useState("");
  const [formAccountNumber, setFormAccountNumber] = useState("");
  const [formBranchName, setFormBranchName] = useState("");

  const openEditModal = () => {
    if (!s) return;
    setFormName(s.name ?? "");
    setFormStatus(s.status ?? "approved");
    setFormIsVerified(!!(s as any).is_verified);
    setFormEmail((s as any).email ?? (s as any).contact_email ?? "");
    setFormPhone((s as any).phone ?? (s as any).contact_phone ?? "");
    setFormLegalName(s.legal_name ?? "");
    setFormTaxId(s.tax_id ?? "");
    setFormPickupLine1(s.delivery_address_line1 ?? "");
    setFormPickupLine2(s.delivery_address_line2 ?? "");
    setFormPickupCity(s.delivery_city ?? "");
    setFormPickupState(s.delivery_state ?? "");
    setFormPickupPostal(s.delivery_postal_code ?? "");
    setFormBankName(payout?.bank_name ?? "");
    setFormAccountName(payout?.account_name ?? "");
    setFormAccountNumber((payout as any)?.account_number ?? payout?.account_number_last4 ?? "");
    setFormBranchName((payout as any)?.ifsc ?? "");
    setEditOpen(true);
  };

  const updateStoreM = useMutation({
    mutationFn: async () => {
      const patch = {
        name: formName.trim(),
        status: formStatus,
        is_verified: formIsVerified,
        email: formEmail.trim() || null,
        phone: formPhone.trim() || null,
        legal_name: formLegalName.trim() || null,
        tax_id: formTaxId.trim() || null,
        delivery_address_line1: formPickupLine1.trim() || null,
        delivery_address_line2: formPickupLine2.trim() || null,
        delivery_city: formPickupCity.trim() || null,
        delivery_state: formPickupState.trim() || null,
        delivery_postal_code: formPickupPostal.trim() || null,
        bank_name: formBankName.trim() || null,
        account_name: formAccountName.trim() || null,
        account_number: formAccountNumber.trim() || null,
        branch_name: formBranchName.trim() || null,
      };
      const res = await updateAdminStore(id!, patch);
      if (!res.ok) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      setEditOpen(false);
      invalidate();
      themedAlert("Store Updated", "Store details, pickup address and bank account updated successfully.");
    },
    onError: (err: any) => {
      themedAlert("Update Failed", err?.message || "Could not update store.");
    },
  });

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
      themedAlert("Unable to open document", "Could not generate a secure download link.");
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

  const products = s.products ?? [];
  const activeProducts = products.filter((p) => p.status === "active").length;
  const catalogueHealth =
    products.length > 0 ? Math.round((activeProducts / products.length) * 100) : null;
  const complianceOkCount = complianceItems.filter((item) => item.ok).length;
  const complianceHealth =
    complianceItems.length > 0
      ? Math.round((complianceOkCount / complianceItems.length) * 100)
      : null;
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
        <TouchableOpacity
          onPress={openEditModal}
          style={styles.headerEditBtn}
          accessibilityLabel="Edit Store"
        >
          <Ionicons name="pencil" size={15} color={colors.paper.cream} />
          <Text style={styles.headerEditText}>Edit</Text>
        </TouchableOpacity>
      </View>

      <Card style={styles.heroCard}>
        <View style={styles.statusRow}>
          <Badge variant={statusVariant(s.status)}>{s.status}</Badge>
          <Text style={styles.since}>{s.created_at ? rel(s.created_at) : "Recently"} ago</Text>
        </View>
        <Text style={styles.subtitle}>{s.description ?? "No description"}</Text>
      </Card>

      {/* Courier Pickup Address Card */}
      <Card style={styles.section}>
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Pickup Address (Domex)</Text>
          <TouchableOpacity onPress={openEditModal}>
            <Text style={{ fontFamily: fontFamilies.sans.semibold, fontSize: 12, color: colors.olive[800] }}>Edit</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.subtitle}>
          {s.delivery_address_line1
            ? [s.delivery_address_line1, s.delivery_address_line2, s.delivery_city, s.delivery_state, s.delivery_postal_code].filter(Boolean).join(", ")
            : "No courier pickup address set. Couriers cannot collect parcels until this is added."}
        </Text>
      </Card>

      {/* Bank Account / Payout Details Card */}
      <Card style={styles.section}>
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Bank Account / Payouts</Text>
          <TouchableOpacity onPress={openEditModal}>
            <Text style={{ fontFamily: fontFamilies.sans.semibold, fontSize: 12, color: colors.olive[800] }}>Edit</Text>
          </TouchableOpacity>
        </View>
        <View style={{ marginTop: 8, gap: 6 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={styles.muted}>Bank</Text>
            <Text style={styles.contact}>{payout?.bank_name || "Not configured"}</Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={styles.muted}>Account Name</Text>
            <Text style={styles.contact}>{payout?.account_name || "Not configured"}</Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={styles.muted}>Account Number</Text>
            <Text style={styles.contact}>
              {payout?.account_number_last4 ? `•••• ${payout.account_number_last4}` : (payout as any)?.account_number || "Not configured"}
            </Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={styles.muted}>Branch Code</Text>
            <Text style={styles.contact}>{(payout as any)?.ifsc || "Not configured"}</Text>
          </View>
        </View>
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
        <Text style={styles.sectionTitle}>Actions & Concierge</Text>
        <View style={styles.actions}>
          <Button
            variant="brand"
            size="sm"
            onPress={openEditModal}
          >
            Edit All Details
          </Button>
          <Button
            variant="outline"
            size="sm"
            onPress={() => router.push(`/(admin)/products/new?storeId=${id}` as any)}
          >
            Upload Product
          </Button>
          <Button
            variant="outline"
            size="sm"
            onPress={() => router.push(`/(admin)/products?storeId=${id}` as any)}
          >
            Catalogue
          </Button>
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
          <Health
            label="Catalogue active"
            value={catalogueHealth == null ? "—" : `${catalogueHealth}%`}
            progress={catalogueHealth ?? 0}
          />
          <Health
            label="Compliance complete"
            value={complianceHealth == null ? "—" : `${complianceHealth}%`}
            progress={complianceHealth ?? 0}
          />
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

      {/* Edit Store Modal */}
      <Modal visible={editOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEditOpen(false)}>
        <View style={styles.editModalContent}>
          <Text style={styles.editModalTitle}>Edit Store & Bank Details</Text>
          <Text style={styles.editModalSub}>
            Concierge updates: fill in WhatsApp onboarding data, approve or suspend.
          </Text>

          <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
            <Text style={styles.formHeader}>STORE PROFILE</Text>
            <View style={styles.formField}>
              <Text style={styles.formLabel}>Store Name</Text>
              <TextInput value={formName} onChangeText={setFormName} style={styles.formInput} />
            </View>

            <View style={styles.formField}>
              <Text style={styles.formLabel}>Status (approved / pending / suspended / rejected)</Text>
              <TextInput value={formStatus} onChangeText={setFormStatus} autoCapitalize="none" style={styles.formInput} />
            </View>

            <View style={styles.formToggleRow}>
              <Text style={styles.formToggleLabel}>Verified Seller Badge</Text>
              <Switch value={formIsVerified} onValueChange={setFormIsVerified} />
            </View>

            <Text style={styles.formHeader}>CONTACT & BUSINESS</Text>
            <View style={styles.formField}>
              <Text style={styles.formLabel}>Email</Text>
              <TextInput value={formEmail} onChangeText={setFormEmail} keyboardType="email-address" autoCapitalize="none" style={styles.formInput} />
            </View>

            <View style={styles.formField}>
              <Text style={styles.formLabel}>Phone</Text>
              <TextInput value={formPhone} onChangeText={setFormPhone} keyboardType="phone-pad" style={styles.formInput} />
            </View>

            <View style={styles.formField}>
              <Text style={styles.formLabel}>Legal Business Name</Text>
              <TextInput value={formLegalName} onChangeText={setFormLegalName} style={styles.formInput} />
            </View>

            <View style={styles.formField}>
              <Text style={styles.formLabel}>Tax ID / Business Reg No</Text>
              <TextInput value={formTaxId} onChangeText={setFormTaxId} style={styles.formInput} />
            </View>

            <Text style={styles.formHeader}>PICKUP ADDRESS (COURIER DOMEX)</Text>
            <View style={styles.formField}>
              <Text style={styles.formLabel}>Address Line 1</Text>
              <TextInput value={formPickupLine1} onChangeText={setFormPickupLine1} placeholder="Shop / Warehouse street address" style={styles.formInput} />
            </View>

            <View style={styles.formField}>
              <Text style={styles.formLabel}>Address Line 2 (Optional)</Text>
              <TextInput value={formPickupLine2} onChangeText={setFormPickupLine2} style={styles.formInput} />
            </View>

            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={[styles.formField, { flex: 1 }]}>
                <Text style={styles.formLabel}>City</Text>
                <TextInput value={formPickupCity} onChangeText={setFormPickupCity} placeholder="e.g. Colombo" style={styles.formInput} />
              </View>
              <View style={[styles.formField, { flex: 1 }]}>
                <Text style={styles.formLabel}>Postal Code</Text>
                <TextInput value={formPickupPostal} onChangeText={setFormPickupPostal} placeholder="00100" style={styles.formInput} />
              </View>
            </View>

            <Text style={styles.formHeader}>BANK ACCOUNT / PAYOUTS</Text>
            <View style={styles.formField}>
              <Text style={styles.formLabel}>Bank Name</Text>
              <TextInput value={formBankName} onChangeText={setFormBankName} placeholder="Commercial Bank, BOC, etc." style={styles.formInput} />
            </View>

            <View style={styles.formField}>
              <Text style={styles.formLabel}>Account Holder Name</Text>
              <TextInput value={formAccountName} onChangeText={setFormAccountName} style={styles.formInput} />
            </View>

            <View style={styles.formField}>
              <Text style={styles.formLabel}>Account Number</Text>
              <TextInput value={formAccountNumber} onChangeText={setFormAccountNumber} keyboardType="number-pad" style={styles.formInput} />
            </View>

            <View style={styles.formField}>
              <Text style={styles.formLabel}>Branch Name / Code</Text>
              <TextInput value={formBranchName} onChangeText={setFormBranchName} placeholder="e.g. Kollupitiya" style={styles.formInput} />
            </View>
          </ScrollView>

          <View style={styles.modalBtnRow}>
            <TouchableOpacity onPress={() => setEditOpen(false)} style={styles.modalCancelBtn}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => updateStoreM.mutate()}
              disabled={updateStoreM.isPending}
              style={[styles.modalSaveBtn, updateStoreM.isPending && { opacity: 0.6 }]}
            >
              <Text style={styles.modalSaveText}>
                {updateStoreM.isPending ? "Saving..." : "Save details"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  headerEditBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.olive[800],
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 18,
  },
  headerEditText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: colors.paper.cream,
  },
  editModalContent: {
    padding: 20,
    backgroundColor: colors.light.card,
    borderRadius: 16,
    maxHeight: "90%",
  },
  editModalTitle: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 18,
    color: colors.light.foreground,
    marginBottom: 4,
  },
  editModalSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: colors.light.mutedForeground,
    marginBottom: 16,
    lineHeight: 16,
  },
  formHeader: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 11,
    color: colors.olive[700],
    letterSpacing: 1,
    marginTop: 14,
    marginBottom: 8,
  },
  formField: {
    marginBottom: 10,
  },
  formLabel: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 12,
    color: colors.light.foreground,
    marginBottom: 4,
  },
  formInput: {
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: colors.light.foreground,
    backgroundColor: colors.light.background,
    fontFamily: fontFamilies.sans.regular,
  },
  formToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.light.border,
    marginBottom: 6,
  },
  formToggleLabel: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 13,
    color: colors.light.foreground,
  },
  modalBtnRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.light.border,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.light.muted,
  },
  modalCancelText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 14,
    color: colors.light.foreground,
  },
  modalSaveBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.olive[800],
  },
  modalSaveText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 14,
    color: colors.paper.cream,
  },
});
