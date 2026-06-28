import React from "react";
import { View, Text, ScrollView, StyleSheet, TextInput, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BrandScreenHeader } from "@/components/brand/BrandScreenHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Skeleton } from "@/components/ui/Skeleton";
import { Input } from "@/components/ui/Input";
import { getBrandByOwner, updateBrand, getBrandSettings, updateBrandSettings } from "@/lib/api";
import { useAuth } from "@/lib/supabase/auth";
import { colors, typography, radii } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

type Tab = "profile" | "socials" | "notifications" | "developer";
const TABS: ReadonlyArray<{ value: Tab; label: string }> = [
  { value: "profile", label: "Profile" },
  { value: "socials", label: "Socials" },
  { value: "notifications", label: "Alerts" },
  { value: "developer", label: "Developer" },
];

export default function BrandSettings() {
  const { user, signOut } = useAuth();
  const [tab, setTab] = React.useState<Tab>("profile");
  const profileQ = useQuery({
    queryKey: ["brand-owner", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const r = await getBrandByOwner(user!.id);
      return r.ok ? r.data : null;
    },
  });
  const settingsQ = useQuery({
    queryKey: ["brand-settings"],
    queryFn: async () => {
      const r = await getBrandSettings();
      return r.ok ? r.data : null;
    },
  });
  const brandId = (profileQ.data as { id?: string } | null)?.id;

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.content}>
        <BrandScreenHeader eyebrow="Brand HQ" title="Settings" subtitle="Profile, socials, alerts" />
        <View style={styles.tabBar}>
          {TABS.map((t) => (
            <Chip key={t.value} selected={tab === t.value} onPress={() => setTab(t.value)}>{t.label}</Chip>
          ))}
        </View>
        {tab === "profile" ? <ProfileTab brandId={brandId} initial={profileQ.data} loading={profileQ.isLoading} /> : null}
        {tab === "socials" ? <SocialsTab brandId={brandId} initial={profileQ.data} loading={profileQ.isLoading} /> : null}
        {tab === "notifications" ? <NotificationsTab loading={settingsQ.isLoading} initial={settingsQ.data} /> : null}
        {tab === "developer" ? <DeveloperTab brandId={brandId} /> : null}

        <View style={styles.signOutWrap}>
          <Button variant="outline" onPress={() => Alert.alert("Sign out?", "", [
            { text: "Cancel", style: "cancel" },
            { text: "Sign out", style: "destructive", onPress: () => signOut() },
          ])}>Sign out</Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ProfileTab({ brandId, initial, loading }: { brandId?: string; initial: unknown; loading: boolean }) {
  const qc = useQueryClient();
  const [name, setName] = React.useState("");
  const [tagline, setTagline] = React.useState("");
  const [website, setWebsite] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [country, setCountry] = React.useState("");

  React.useEffect(() => {
    if (!initial) return;
    const b = initial as { name?: string; tagline?: string; website?: string; description?: string; country?: string };
    setName(b.name ?? "");
    setTagline(b.tagline ?? "");
    setWebsite(b.website ?? "");
    setDescription(b.description ?? "");
    setCountry(b.country ?? "");
  }, [(initial as { id?: string } | null)?.id]);

  const mut = useMutation({
    mutationFn: () => updateBrand(brandId ?? "_", { name, tagline, website, description, country } as never),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["brand-owner"] }); Alert.alert("Saved", "Profile updated."); },
    onError: (e) => Alert.alert("Error", String(e)),
  });

  if (loading) return <Skeleton style={styles.skelCard} />;

  return (
    <Card style={styles.formCard}>
      <FieldLabel>Brand name</FieldLabel>
      <Input value={name} onChangeText={setName} placeholder="Acme Apparel" />
      <FieldLabel>Tagline</FieldLabel>
      <Input value={tagline} onChangeText={setTagline} placeholder="Short tagline" />
      <FieldLabel>Website</FieldLabel>
      <Input value={website} onChangeText={setWebsite} placeholder="https://example.com" autoCapitalize="none" />
      <FieldLabel>Country</FieldLabel>
      <Input value={country} onChangeText={setCountry} placeholder="Sri Lanka" />
      <FieldLabel>About</FieldLabel>
      <TextInput value={description} onChangeText={setDescription} placeholder="Brand story" multiline numberOfLines={4} style={styles.textArea} />
      <Button onPress={() => mut.mutate()} loading={mut.isPending} style={styles.saveBtn}>Save changes</Button>
    </Card>
  );
}

function SocialsTab({ brandId, initial, loading }: { brandId?: string; initial: unknown; loading: boolean }) {
  const qc = useQueryClient();
  const initialSocials = (initial as { social_links?: Record<string, string> } | null)?.social_links ?? {};
  const [instagram, setInstagram] = React.useState(initialSocials.instagram ?? "");
  const [twitter, setTwitter] = React.useState(initialSocials.twitter ?? "");
  const [facebook, setFacebook] = React.useState(initialSocials.facebook ?? "");
  const [tiktok, setTiktok] = React.useState(initialSocials.tiktok ?? "");

  React.useEffect(() => {
    const s = (initial as { social_links?: Record<string, string> } | null)?.social_links ?? {};
    setInstagram(s.instagram ?? "");
    setTwitter(s.twitter ?? "");
    setFacebook(s.facebook ?? "");
    setTiktok(s.tiktok ?? "");
  }, [(initial as { id?: string } | null)?.id]);

  const mut = useMutation({
    mutationFn: () => updateBrand(brandId ?? "_", { social_links: { instagram, twitter, facebook, tiktok } } as never),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["brand-owner"] }); Alert.alert("Saved", "Social links updated."); },
    onError: (e) => Alert.alert("Error", String(e)),
  });

  if (loading) return <Skeleton style={styles.skelCard} />;

  return (
    <Card style={styles.formCard}>
      <FieldLabel>Instagram</FieldLabel>
      <Input value={instagram} onChangeText={setInstagram} placeholder="https://instagram.com/..." autoCapitalize="none" />
      <FieldLabel>X / Twitter</FieldLabel>
      <Input value={twitter} onChangeText={setTwitter} placeholder="https://x.com/..." autoCapitalize="none" />
      <FieldLabel>Facebook</FieldLabel>
      <Input value={facebook} onChangeText={setFacebook} placeholder="https://facebook.com/..." autoCapitalize="none" />
      <FieldLabel>TikTok</FieldLabel>
      <Input value={tiktok} onChangeText={setTiktok} placeholder="https://tiktok.com/@..." autoCapitalize="none" />
      <Button onPress={() => mut.mutate()} loading={mut.isPending} style={styles.saveBtn}>Save socials</Button>
    </Card>
  );
}

function NotificationsTab({ initial, loading }: { initial: unknown; loading: boolean }) {
  const qc = useQueryClient();
  const [flags, setFlags] = React.useState({
    notify_new_order: true,
    notify_low_stock: true,
    notify_review_posted: true,
    notify_weekly_digest: false,
    notify_campaign: true,
  });

  React.useEffect(() => {
    if (!initial) return;
    const s = initial as typeof flags;
    setFlags({
      notify_new_order: s.notify_new_order ?? true,
      notify_low_stock: s.notify_low_stock ?? true,
      notify_review_posted: s.notify_review_posted ?? true,
      notify_weekly_digest: s.notify_weekly_digest ?? false,
      notify_campaign: s.notify_campaign ?? true,
    });
  }, [JSON.stringify(initial)]);

  const mut = useMutation({
    mutationFn: () => updateBrandSettings(flags),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["brand-settings"] }); Alert.alert("Saved", "Alert preferences updated."); },
    onError: (e) => Alert.alert("Error", String(e)),
  });

  if (loading) return <Skeleton style={styles.skelCard} />;

  return (
    <Card style={styles.formCard}>
      <ToggleRow label="New order" value={flags.notify_new_order} onChange={(v) => setFlags((f) => ({ ...f, notify_new_order: v }))} />
      <ToggleRow label="Low stock alert" value={flags.notify_low_stock} onChange={(v) => setFlags((f) => ({ ...f, notify_low_stock: v }))} />
      <ToggleRow label="Review posted" value={flags.notify_review_posted} onChange={(v) => setFlags((f) => ({ ...f, notify_review_posted: v }))} />
      <ToggleRow label="Weekly digest" value={flags.notify_weekly_digest} onChange={(v) => setFlags((f) => ({ ...f, notify_weekly_digest: v }))} />
      <ToggleRow label="Campaign updates" value={flags.notify_campaign} onChange={(v) => setFlags((f) => ({ ...f, notify_campaign: v }))} />
      <Button onPress={() => mut.mutate()} loading={mut.isPending} style={styles.saveBtn}>Save alerts</Button>
    </Card>
  );
}

function DeveloperTab({ brandId }: { brandId?: string }) {
  const url = brandId ? `https://api.luxe.example/webhooks/brand/${brandId}` : null;
  return (
    <Card style={styles.formCard}>
      <FieldLabel>Webhook URL</FieldLabel>
      <View style={styles.codeBox}><Text style={styles.codeText} selectable>{url ?? "—"}</Text></View>
      <Text style={styles.devNote}>Brand-scoped API tokens on the roadmap. Webhook receivers configured by platform team for now.</Text>
    </Card>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Chip selected={value} onPress={() => onChange(!value)}>{value ? "On" : "Off"}</Chip>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.light.background },
  content: { paddingBottom: 40 },
  tabBar: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 20, paddingVertical: 12 },
  formCard: { marginHorizontal: 20, padding: 16, gap: 8 },
  skelCard: { height: 200, margin: 20, borderRadius: radii.xl },
  label: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: typography.letterSpacing.editorial,
    marginTop: 8,
  },
  textArea: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.sm,
    color: colors.light.foreground,
    backgroundColor: colors.light.card,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.lg,
    padding: 12,
    minHeight: 100,
    textAlignVertical: "top",
  },
  saveBtn: { marginTop: 16 },
  signOutWrap: { paddingHorizontal: 20, paddingTop: 24 },
  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.light.border },
  toggleLabel: { fontFamily: fontFamilies.sans.medium, fontSize: typography.fontSizes.base, color: colors.light.foreground },
  codeBox: { backgroundColor: colors.light.muted, padding: 12, borderRadius: radii.md },
  codeText: { fontFamily: fontFamilies.mono.regular, fontSize: typography.fontSizes.xs, color: colors.light.foreground },
  devNote: { fontFamily: fontFamilies.sans.regular, fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground, lineHeight: 16, marginTop: 8 },
});