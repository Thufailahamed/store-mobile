import React from "react";
import { View, Text, ScrollView, StyleSheet, Alert } from "react-native";
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
import { getBrandTeam, getBrandTeamInvites, inviteBrandTeamMember, cancelBrandInvite, resendBrandInvite, removeBrandMember, updateBrandMember } from "@/lib/api";
import type { BrandTeamMember, BrandTeamInvite } from "@/lib/api/backend";
import { colors, typography, radii } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { isValidEmail } from "@/lib/contact-validation";

const ROLES = ["manager", "staff", "viewer"] as const;
type Role = (typeof ROLES)[number];

export default function BrandTeam() {
  const qc = useQueryClient();
  const membersQ = useQuery({
    queryKey: ["brand-team"],
    queryFn: async () => { const r = await getBrandTeam(); return r.ok ? r.data : []; },
  });
  const invitesQ = useQuery({
    queryKey: ["brand-team-invites"],
    queryFn: async () => { const r = await getBrandTeamInvites(); return r.ok ? r.data : []; },
  });

  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<Role>("staff");

  const invite = useMutation({
    mutationFn: () => inviteBrandTeamMember({ email: email.trim(), role }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["brand-team-invites"] });
      setEmail("");
      Alert.alert("Invite sent", `An email was sent to ${email}.`);
    },
    onError: (e) => Alert.alert("Invite failed", String(e)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => removeBrandMember(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["brand-team"] }),
  });
  const cancel = useMutation({
    mutationFn: (id: string) => cancelBrandInvite(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["brand-team-invites"] }),
  });
  const resend = useMutation({
    mutationFn: (id: string) => resendBrandInvite(id),
    onSuccess: () => Alert.alert("Resent", "Invite email re-sent."),
  });
  const updateMember = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: { role?: Role; status?: "active" | "suspended" } }) => updateBrandMember(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["brand-team"] }),
  });

  return (
    <View style={styles.root}>
      <BrandScreenHeader eyebrow="Brand HQ" title="Team" subtitle="Members & invites" back={{ onPress: () => router.back() }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card style={styles.inviteCard}>
          <Text style={styles.section}>Invite member</Text>
          <FieldLabel>Email</FieldLabel>
          <Input value={email} onChangeText={setEmail} placeholder="teammate@example.com" autoCapitalize="none" keyboardType="email-address" />
          <FieldLabel>Role</FieldLabel>
          <View style={styles.chipsRow}>
            {ROLES.map((r) => <Chip key={r} selected={role === r} onPress={() => setRole(r)}>{r}</Chip>)}
          </View>
          <Button onPress={() => invite.mutate()} loading={invite.isPending} disabled={!isValidEmail(email)} style={styles.inviteBtn}>Send invite</Button>
        </Card>

        <Text style={styles.sectionTitle}>Pending invites</Text>
        {invitesQ.isLoading ? (
          <Skeleton style={styles.skel} />
        ) : !invitesQ.data || invitesQ.data.length === 0 ? (
          <Text style={styles.empty}>No pending invites.</Text>
        ) : (
          invitesQ.data.map((inv) => <InviteRow key={inv.id} invite={inv} onCancel={() => cancel.mutate(inv.id)} onResend={() => resend.mutate(inv.id)} />)
        )}

        <Text style={styles.sectionTitle}>Members</Text>
        {membersQ.isLoading ? (
          <Skeleton style={styles.skel} />
        ) : !membersQ.data || membersQ.data.length === 0 ? (
          <EmptyState icon="people-outline" title="No team members yet" />
        ) : (
          membersQ.data.map((m) => (
            <MemberRow
              key={m.id}
              member={m}
              onRemove={() => {
                const managerCount = (membersQ.data ?? []).filter((mm) => mm.role === "manager").length;
                if (m.role === "manager" && managerCount <= 1) {
                  Alert.alert(
                    "Can't remove the only manager",
                    "This brand needs at least one manager. Promote another member to manager before removing this one."
                  );
                  return;
                }
                Alert.alert("Remove member?", m.user?.email ?? m.user_id, [
                  { text: "Cancel", style: "cancel" },
                  { text: "Remove", style: "destructive", onPress: () => remove.mutate(m.id) },
                ]);
              }}
              onRoleChange={(r) => updateMember.mutate({ id: m.id, patch: { role: r } })}
              onSuspend={() => updateMember.mutate({ id: m.id, patch: { status: m.status === "suspended" ? "active" : "suspended" } })}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

function MemberRow({ member, onRemove, onRoleChange, onSuspend }: { member: BrandTeamMember; onRemove: () => void; onRoleChange: (r: Role) => void; onSuspend: () => void }) {
  const [open, setOpen] = React.useState(false);
  return (
    <Card style={styles.row}>
      <View style={styles.rowHeader}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{(member.user?.full_name ?? member.user?.email ?? "?").charAt(0).toUpperCase()}</Text></View>
        <View style={styles.rowBody}>
          <Text style={styles.rowTitle}>{member.user?.full_name ?? member.user?.email ?? "Unknown"}</Text>
          <Text style={styles.rowMeta}>{member.user?.email ?? member.user_id}</Text>
        </View>
        <Badge variant={member.status === "suspended" ? "secondary" : "default"}>{member.role}</Badge>
      </View>
      <View style={styles.rowActions}>
        <Chip selected={open} onPress={() => setOpen(!open)}>{open ? "Close" : "Manage"}</Chip>
        {open ? (
          <View style={styles.manageBlock}>
            <FieldLabel>Role</FieldLabel>
            <View style={styles.chipsRow}>
              {ROLES.map((r) => <Chip key={r} selected={member.role === r} onPress={() => onRoleChange(r)}>{r}</Chip>)}
            </View>
            <View style={styles.manageActions}>
              <Button variant="outline" onPress={onSuspend} style={styles.manageBtn}>{member.status === "suspended" ? "Reactivate" : "Suspend"}</Button>
              <Button variant="ghost" onPress={onRemove} style={styles.manageBtn}>Remove</Button>
            </View>
          </View>
        ) : null}
      </View>
    </Card>
  );
}

function InviteRow({ invite, onCancel, onResend }: { invite: BrandTeamInvite; onCancel: () => void; onResend: () => void }) {
  const expired = new Date(invite.expires_at).getTime() < Date.now();
  return (
    <Card style={styles.row}>
      <View style={styles.rowHeader}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{invite.email.charAt(0).toUpperCase()}</Text></View>
        <View style={styles.rowBody}>
          <Text style={styles.rowTitle}>{invite.email}</Text>
          <Text style={styles.rowMeta}>{invite.role} · {expired ? "expired" : `expires ${new Date(invite.expires_at).toLocaleDateString()}`}</Text>
        </View>
        <Badge variant={expired ? "secondary" : "default"}>{expired ? "Expired" : "Pending"}</Badge>
      </View>
      <View style={styles.rowActions}>
        <Button variant="outline" onPress={onResend} style={styles.rowBtn}>Resend</Button>
        <Button variant="ghost" onPress={onCancel} style={styles.rowBtn}>Cancel</Button>
      </View>
    </Card>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.light.background },
  content: { paddingBottom: 40, paddingHorizontal: 16, paddingTop: 12, gap: 8 },
  inviteCard: { padding: 16, gap: 4, marginBottom: 8 },
  section: { fontFamily: fontFamilies.sans.semibold, fontSize: typography.fontSizes.base, color: colors.light.foreground, marginBottom: 4 },
  label: { fontFamily: fontFamilies.mono.medium, fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground, textTransform: "uppercase", letterSpacing: typography.letterSpacing.editorial, marginTop: 8 },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  inviteBtn: { marginTop: 12 },
  skel: { height: 72, borderRadius: radii.lg },
  empty: { fontFamily: fontFamilies.sans.regular, fontSize: typography.fontSizes.sm, color: colors.light.mutedForeground, padding: 16 },
  sectionTitle: { fontFamily: fontFamilies.mono.medium, fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground, letterSpacing: typography.letterSpacing.editorial, textTransform: "uppercase", paddingTop: 16, paddingBottom: 4 },
  row: { padding: 12, gap: 8 },
  rowHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.light.muted, alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: fontFamilies.mono.medium, fontSize: typography.fontSizes.sm, color: colors.light.foreground },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { fontFamily: fontFamilies.sans.semibold, fontSize: typography.fontSizes.sm, color: colors.light.foreground },
  rowMeta: { fontFamily: fontFamilies.mono.regular, fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground },
  rowActions: { flexDirection: "row", gap: 8, marginTop: 4 },
  rowBtn: { flex: 1 },
  manageBlock: { paddingTop: 8, gap: 4, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.light.border, marginTop: 4 },
  manageActions: { flexDirection: "row", gap: 8, marginTop: 8 },
  manageBtn: { flex: 1 },
});