import React from "react";
import { View, Text, ScrollView, StyleSheet, Alert, Pressable, Modal, TextInput, KeyboardAvoidingView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { BrandScreenHeader } from "@/components/brand/BrandScreenHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Chip } from "@/components/ui/Chip";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { getBrandCampaigns, createBrandCampaign, updateBrandCampaign, deleteBrandCampaign } from "@/lib/api";
import type { BrandCampaign } from "@/lib/api/backend";
import { colors, typography, radii } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";

const TYPES = ["sponsored", "seasonal", "launch", "collaboration", "awareness"] as const;
type CampaignType = (typeof TYPES)[number];

export default function BrandCampaigns() {
  const qc = useQueryClient();
  const [editing, setEditing] = React.useState<BrandCampaign | null>(null);
  const [creating, setCreating] = React.useState(false);

  const q = useQuery({
    queryKey: ["brand-campaigns"],
    queryFn: async () => {
      const r = await getBrandCampaigns();
      return r.ok ? r.data : [];
    },
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteBrandCampaign(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["brand-campaigns"] }),
  });

  const toggle = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => updateBrandCampaign(id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["brand-campaigns"] }),
  });

  return (
    <View style={styles.root}>
      <BrandScreenHeader
        eyebrow="Marketing"
        title="Campaigns"
        subtitle={`${q.data?.length ?? 0} total`}
        back={{ onPress: () => router.back() }}
        right={<Button variant="default" onPress={() => setCreating(true)}>+ New</Button>}
      />
      {q.isLoading ? (
        <View style={styles.list}>{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} style={styles.skel} />)}</View>
      ) : !q.data || q.data.length === 0 ? (
        <EmptyState icon="megaphone-outline" title="No campaigns yet" description="Launch a sponsored or seasonal push to drive sales." action={<Button onPress={() => setCreating(true)}>Create campaign</Button>} />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {q.data.map((c) => (
            <CampaignCard
              key={c.id}
              campaign={c}
              onEdit={() => setEditing(c)}
              onToggle={() => toggle.mutate({ id: c.id, status: c.status === "active" ? "paused" : "active" })}
              onDelete={() => Alert.alert("Delete campaign?", c.name ?? "", [
                { text: "Cancel", style: "cancel" },
                { text: "Delete", style: "destructive", onPress: () => del.mutate(c.id) },
              ])}
            />
          ))}
        </ScrollView>
      )}

      {(creating || editing) ? <CampaignModal campaign={editing} onClose={() => { setCreating(false); setEditing(null); }} /> : null}
    </View>
  );
}

function CampaignCard({ campaign, onEdit, onToggle, onDelete }: { campaign: BrandCampaign; onEdit: () => void; onToggle: () => void; onDelete: () => void }) {
  return (
    <Pressable onPress={onEdit} onLongPress={onDelete} android_ripple={{ color: colors.light.muted }}>
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeadLeft}>
            <Text style={styles.cardTitle}>{campaign.name ?? "Untitled"}</Text>
            <Text style={styles.cardSub}>{campaign.type ?? "sponsored"}</Text>
          </View>
          <Badge variant={campaign.status === "active" ? "default" : "secondary"}>{campaign.status ?? "draft"}</Badge>
        </View>
        {campaign.description ? <Text style={styles.cardDesc} numberOfLines={2}>{campaign.description}</Text> : null}
        <View style={styles.metaRow}>
          <Text style={styles.meta}>{formatPrice(campaign.budget ?? 0, "LKR")} budget</Text>
          <View style={styles.actions}>
            <Chip selected={campaign.status === "active"} onPress={onToggle}>{campaign.status === "active" ? "Active" : "Paused"}</Chip>
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

function CampaignModal({ campaign, onClose }: { campaign: BrandCampaign | null; onClose: () => void }) {
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const [name, setName] = React.useState(campaign?.name ?? "");
  const [description, setDescription] = React.useState(campaign?.description ?? "");
  const [type, setType] = React.useState<CampaignType>((campaign?.type as CampaignType | undefined) ?? "sponsored");
  const [budget, setBudget] = React.useState(String(campaign?.budget ?? ""));
  const [startsAt, setStartsAt] = React.useState(campaign?.starts_at ? campaign.starts_at.slice(0, 10) : "");
  const [endsAt, setEndsAt] = React.useState(campaign?.ends_at ? campaign.ends_at.slice(0, 10) : "");

  const budgetTrimmed = budget.trim();
  const budgetNum = budgetTrimmed === "" ? 0 : Number(budgetTrimmed);
  const budgetValid = Number.isFinite(budgetNum) && budgetNum >= 0;

  const save = useMutation({
    mutationFn: () => {
      const body = {
        name,
        description,
        type,
        budget: budgetNum,
        starts_at: startsAt.trim() || undefined,
        ends_at: endsAt.trim() || undefined,
      };
      return campaign ? updateBrandCampaign(campaign.id, body as never) : createBrandCampaign(body as never);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["brand-campaigns"] });
      onClose();
    },
    onError: (e) => Alert.alert("Error", String(e)),
  });

  return (
    <Modal animationType="slide" transparent visible onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.modalRoot} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <Text style={styles.modalTitle}>{campaign ? "Edit campaign" : "New campaign"}</Text>
          <ScrollView contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">
            <FieldLabel>Name</FieldLabel>
            <Input value={name} onChangeText={setName} placeholder="Spring drop" />
            <FieldLabel>Type</FieldLabel>
            <View style={styles.chipsRow}>
              {TYPES.map((t) => <Chip key={t} selected={type === t} onPress={() => setType(t)}>{t}</Chip>)}
            </View>
            <FieldLabel>Start date</FieldLabel>
            <Input value={startsAt} onChangeText={setStartsAt} placeholder="YYYY-MM-DD" />
            <FieldLabel>End date</FieldLabel>
            <Input value={endsAt} onChangeText={setEndsAt} placeholder="YYYY-MM-DD" />
            <FieldLabel>Budget</FieldLabel>
            <Input value={budget} onChangeText={setBudget} placeholder="0" keyboardType="numeric" />
            {!budgetValid ? <Text style={styles.errorText}>Enter a valid budget amount</Text> : null}
            <FieldLabel>Description</FieldLabel>
            <TextInput value={description} onChangeText={setDescription} placeholder="Campaign brief" multiline numberOfLines={4} style={styles.textArea} />
          </ScrollView>
          <View style={styles.sheetActions}>
            <Button variant="outline" onPress={onClose} style={styles.sheetBtn}>Cancel</Button>
            <Button onPress={() => save.mutate()} loading={save.isPending} disabled={!budgetValid} style={styles.sheetBtn}>{campaign ? "Save" : "Create"}</Button>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.light.background },
  list: { padding: 16, gap: 12, paddingBottom: 40 },
  skel: { height: 110, borderRadius: radii.lg },
  card: { padding: 14, gap: 8 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  cardHeadLeft: { flex: 1, gap: 2 },
  cardTitle: { fontFamily: fontFamilies.sans.semibold, fontSize: typography.fontSizes.base, color: colors.light.foreground },
  cardSub: { fontFamily: fontFamilies.mono.regular, fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground, textTransform: "uppercase", letterSpacing: typography.letterSpacing.wide },
  cardDesc: { fontFamily: fontFamilies.sans.regular, fontSize: typography.fontSizes.sm, color: colors.light.mutedForeground, lineHeight: 18 },
  metaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  meta: { fontFamily: fontFamilies.mono.medium, fontSize: typography.fontSizes.sm, color: colors.light.foreground },
  actions: { flexDirection: "row", gap: 8 },
  modalRoot: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: { backgroundColor: colors.light.background, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, padding: 20, maxHeight: "85%" },
  sheetContent: { gap: 4, paddingBottom: 8 },
  sheetActions: { flexDirection: "row", gap: 12, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.light.border },
  sheetBtn: { flex: 1 },
  modalTitle: { fontFamily: fontFamilies.display.semibold, fontSize: typography.fontSizes.xl, color: colors.light.foreground, marginBottom: 12 },
  label: { fontFamily: fontFamilies.mono.medium, fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground, textTransform: "uppercase", letterSpacing: typography.letterSpacing.editorial, marginTop: 8 },
  textArea: { fontFamily: fontFamilies.sans.regular, fontSize: typography.fontSizes.sm, color: colors.light.foreground, backgroundColor: colors.light.card, borderWidth: 1, borderColor: colors.light.border, borderRadius: radii.lg, padding: 12, minHeight: 100, textAlignVertical: "top" },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  errorText: { fontFamily: fontFamilies.sans.regular, fontSize: typography.fontSizes.xs, color: colors.light.destructive, marginTop: 4 },
});