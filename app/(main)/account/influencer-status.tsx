import React, { useMemo, useState } from "react";
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
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@/components/ui/Icon";
import { useToast } from "@/components/ui";
import { useAuth } from "@/lib/supabase/auth";
import {
  applyInfluencerBackend,
  getInfluencerApplicationBackend,
  getInfluencerProfileBackend,
  type InfluencerApplication,
  type InfluencerProfile,
} from "@/lib/api/backend";
import { formatPrice } from "@/lib/utils";
import { shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

type SocialPlatform = "instagram" | "youtube" | "tiktok" | "twitter" | "other";

const PLATFORMS: { value: SocialPlatform; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: "instagram", label: "Instagram", icon: "logo-instagram" },
  { value: "youtube", label: "YouTube", icon: "logo-youtube" },
  { value: "tiktok", label: "TikTok", icon: "musical-notes-outline" },
  { value: "twitter", label: "X / Twitter", icon: "logo-twitter" },
  { value: "other", label: "Other", icon: "globe-outline" },
];

const CATEGORIES = [
  "Luxury Fashion",
  "Streetwear",
  "Casual",
  "Men's Fashion",
  "Women's Fashion",
  "Sustainable",
  "Accessories",
  "Footwear",
  "Activewear",
  "Vintage",
];

const STATUS_META: Record<string, { label: string; color: string; bg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  pending: { label: "Under review", color: "#85651B", bg: "rgba(200,164,74,0.14)", icon: "time-outline" },
  contacted: { label: "We reached out", color: "#5C6A4F", bg: "rgba(125,139,111,0.14)", icon: "chatbubble-ellipses-outline" },
  approved: { label: "Approved", color: "#414A23", bg: "rgba(106,118,57,0.16)", icon: "checkmark-circle-outline" },
  rejected: { label: "Not eligible", color: "#8C3A22", bg: "rgba(184,92,58,0.12)", icon: "close-circle-outline" },
};

const NEXT_STEPS = [
  { n: "01", title: "Curation & Review", body: "Every portfolio is reviewed by our editorial team within 3 business days." },
  { n: "02", title: "Private Collab Link", body: "Approved creators receive an exclusive code and trackable store link." },
  { n: "03", title: "Weekly Commission", body: "Attributed orders settle weekly in LKR directly to your atelier balance." },
];

function statusMeta(status: string) {
  return STATUS_META[status] ?? STATUS_META.pending;
}

export default function InfluencerStatusScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const q = useQuery({
    queryKey: ["influencer-application", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const [appRes, profileRes] = await Promise.all([
        getInfluencerApplicationBackend(),
        getInfluencerProfileBackend(),
      ]);
      if (!appRes.ok) throw new Error(appRes.error);
      if (!profileRes.ok) throw new Error(profileRes.error);
      return { application: appRes.data.application, profile: profileRes.data.profile };
    },
  });

  const application = q.data?.application ?? null;
  const profile = q.data?.profile ?? null;
  const meta = application ? statusMeta(application.status) : null;

  /* ------------------------------- form ------------------------------- */

  const [form, setForm] = useState({
    full_name: (user?.user_metadata?.full_name as string | undefined) ?? "",
    email: user?.email ?? "",
    phone: "",
    platform: "instagram" as SocialPlatform,
    handle: "",
    follower_count: "",
    audience_region: "",
    categories: [] as string[],
    bio: "",
    sample_url: "",
  });

  const followerCount = useMemo(() => {
    const n = parseInt(form.follower_count.replace(/[^0-9]/g, ""), 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }, [form.follower_count]);

  const patch = (p: Partial<typeof form>) => setForm((f) => ({ ...f, ...p }));

  const submit = async () => {
    if (!form.full_name.trim()) return toast("Enter your full name", "error");
    if (!/^[^@]+@[^@]+\.[^@]+$/.test(form.email.trim())) return toast("Enter a valid email", "error");
    if (!form.handle.trim()) return toast("Add your handle or channel URL", "error");
    if (form.sample_url.trim() && !/^https?:\/\/.+\..+/.test(form.sample_url.trim())) {
      return toast("Sample URL must start with http(s)://", "error");
    }

    setSubmitting(true);
    try {
      const res = await applyInfluencerBackend({
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        platform: form.platform,
        handle: form.handle.trim(),
        follower_count: followerCount,
        audience_region: form.audience_region.trim() || undefined,
        categories: form.categories.length ? form.categories : undefined,
        bio: form.bio.trim() || undefined,
        sample_url: form.sample_url.trim() || undefined,
      });
      if (!res.ok) throw new Error(res.error);
      toast("Application submitted — reviewed within 3 business days", "success");
      setShowForm(false);
      await queryClient.invalidateQueries({ queryKey: ["influencer-application"] });
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not submit application", "error");
    } finally {
      setSubmitting(false);
    }
  };

  /* ------------------------------ render ------------------------------ */

  const statusLabel = !user?.id
    ? "Sign in to apply"
    : application
      ? meta!.label
      : "Open applications";

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* 1. Atelier Top Navigation Header */}
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
          <Text style={styles.headerEyebrow}>ATELIER CREATORS</Text>
          <Text style={styles.headerTitle}>Influencer program</Text>
        </View>
        <View style={styles.headerRightPlaceholder}>
          <View style={styles.headerMedallion}>
            <Ionicons name="sparkles" size={14} color="#85651B" />
          </View>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 36 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* 2. Velvet Obsidian Hero Card */}
          <LinearGradient
            colors={["#191815", "#24221C", "#12110F"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <View style={styles.heroTopRow}>
              <View style={styles.heroTagBadge}>
                <Ionicons name="sparkles" size={10} color="#C8A44A" />
                <Text style={styles.heroTagText}>LUXE CREATOR PROGRAMME</Text>
              </View>
              <View style={styles.heroSyncBadge}>
                <View
                  style={[
                    styles.heroSyncDot,
                    application?.status === "approved"
                      ? { backgroundColor: "#7D8B6F" }
                      : application?.status === "rejected"
                        ? { backgroundColor: "#8C3A22" }
                        : { backgroundColor: "#C8A44A" },
                  ]}
                />
                <Text style={styles.heroSyncText}>{statusLabel.toUpperCase()}</Text>
              </View>
            </View>
            <Text style={styles.heroTitle}>Partner with the Atelier.</Text>
            <Text style={styles.heroCopy}>
              Share LUXE with your audience. Every attributed sale pays commission weekly, in LKR,
              straight to your wallet.
            </Text>
            <View style={styles.heroStatusStrip}>
              <View style={styles.heroStatusItem}>
                <Text style={styles.heroStatusLabel}>COMMISSION</Text>
                <Text style={styles.heroStatusVal}>Weekly LKR</Text>
              </View>
              <View style={styles.heroStatusDivider} />
              <View style={styles.heroStatusItem}>
                <Text style={styles.heroStatusLabel}>REVIEW</Text>
                <Text style={styles.heroStatusVal}>3 days</Text>
              </View>
              <View style={styles.heroStatusDivider} />
              <View style={styles.heroStatusItem}>
                <Text style={styles.heroStatusLabel}>ATTRIBUTION</Text>
                <Text style={styles.heroStatusVal}>30 days</Text>
              </View>
            </View>
          </LinearGradient>

          {!user?.id ? (
            <NoticeCard
              icon="lock-closed-outline"
              title="Sign in to continue"
              body="Your influencer application is linked directly to your LUXE account."
            />
          ) : q.isLoading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color="#C8A44A" size="large" />
              <Text style={styles.loadingText}>Synchronizing creator records…</Text>
            </View>
          ) : q.isError ? (
            <NoticeCard
              icon="cloud-offline-outline"
              title="Couldn't load your application"
              body={q.error instanceof Error ? q.error.message : "Try again later."}
              action={{ label: "Retry", onPress: () => q.refetch() }}
            />
          ) : (
            <>
              {application ? (
                <ApplicationCard application={application} profile={profile} />
              ) : null}

              {application?.status === "approved" && profile ? (
                <ProfileCard profile={profile} />
              ) : null}

              {application?.status === "pending" || application?.status === "contacted" ? (
                <StepsCard />
              ) : null}

              {!application || application.status === "rejected" ? (
                showForm ? (
                  <ApplyForm
                    form={form}
                    patch={patch}
                    submitting={submitting}
                    onSubmit={submit}
                    onCancel={() => setShowForm(false)}
                  />
                ) : (
                  <TouchableOpacity
                    style={styles.applyCtaCard}
                    onPress={() => setShowForm(true)}
                    activeOpacity={0.85}
                  >
                    <LinearGradient
                      colors={["#FFFFFF", "#FAF8F5"]}
                      style={styles.applyCtaGradient}
                    >
                      <View style={styles.applyCtaIconWrap}>
                        <Ionicons name="sparkles" size={18} color="#E8CF8F" />
                      </View>
                      <View style={{ flex: 1, paddingRight: 6 }}>
                        <View style={styles.applyCtaBadge}>
                          <Text style={styles.applyCtaBadgeText}>ATELIER PARTNERSHIP</Text>
                        </View>
                        <Text style={styles.applyCtaTitle}>
                          {application?.status === "rejected"
                            ? "Re-apply as Influencer"
                            : "Apply for Creator Access"}
                        </Text>
                        <Text style={styles.applyCtaSub}>
                          Tell us about your audience and niches — takes 2 minutes.
                        </Text>
                      </View>
                      <View style={styles.applyCtaArrow}>
                        <Ionicons name="chevron-forward" size={16} color="#85651B" />
                      </View>
                    </LinearGradient>
                  </TouchableOpacity>
                )
              ) : null}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* ------------------------------ subviews ------------------------------ */

function NoticeCard({
  icon,
  title,
  body,
  action,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View style={styles.noticeCard}>
      <View style={styles.noticeIcon}>
        <Ionicons name={icon} size={22} color="#85651B" />
      </View>
      <Text style={styles.noticeTitle}>{title}</Text>
      <Text style={styles.noticeBody}>{body}</Text>
      {action ? (
        <TouchableOpacity style={styles.noticeBtn} onPress={action.onPress} activeOpacity={0.8}>
          <Ionicons name="refresh" size={13} color="#FAF8F5" />
          <Text style={styles.noticeBtnText}>{action.label}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function ApplicationCard({
  application,
  profile,
}: {
  application: InfluencerApplication;
  profile: InfluencerProfile | null;
}) {
  const meta = statusMeta(application.status);
  return (
    <View style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <View style={styles.kickerBadge}>
          <Text style={styles.kickerBadgeText}>APPLICATION STATUS</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
          <Ionicons name={meta.icon} size={12} color={meta.color} />
          <Text style={[styles.statusBadgeText, { color: meta.color }]}>{meta.label}</Text>
        </View>
      </View>

      {/* Progress Timeline */}
      <View style={styles.timelineBox}>
        <View style={styles.timelineStep}>
          <View style={[styles.timelineDot, styles.timelineDotComplete]}>
            <Ionicons name="checkmark" size={10} color="#FAF8F5" />
          </View>
          <Text style={styles.timelineLabelActive}>Submitted</Text>
        </View>
        <View
          style={[
            styles.timelineLine,
            application.status !== "pending" && styles.timelineLineActive,
          ]}
        />
        <View style={styles.timelineStep}>
          <View
            style={[
              styles.timelineDot,
              application.status === "pending"
                ? styles.timelineDotCurrent
                : application.status === "rejected"
                  ? styles.timelineDotRejected
                  : styles.timelineDotComplete,
            ]}
          >
            {application.status === "pending" ? (
              <View style={styles.pulseInner} />
            ) : application.status === "rejected" ? (
              <Ionicons name="close" size={10} color="#FAF8F5" />
            ) : (
              <Ionicons name="checkmark" size={10} color="#FAF8F5" />
            )}
          </View>
          <Text
            style={[
              styles.timelineLabel,
              application.status === "pending" && styles.timelineLabelActive,
            ]}
          >
            Editorial Review
          </Text>
        </View>
        <View
          style={[
            styles.timelineLine,
            application.status === "approved" && styles.timelineLineActive,
          ]}
        />
        <View style={styles.timelineStep}>
          <View
            style={[
              styles.timelineDot,
              application.status === "approved" && styles.timelineDotComplete,
            ]}
          >
            {application.status === "approved" ? (
              <Ionicons name="checkmark" size={10} color="#FAF8F5" />
            ) : null}
          </View>
          <Text
            style={[
              styles.timelineLabel,
              application.status === "approved" && styles.timelineLabelActive,
            ]}
          >
            Partner Code
          </Text>
        </View>
      </View>

      <DetailRow icon="person-outline" label="Full Name" value={application.full_name} />
      <DetailRow icon="mail-outline" label="Email Address" value={application.email} />
      {application.phone ? (
        <DetailRow icon="call-outline" label="Contact Phone" value={application.phone} />
      ) : null}
      {application.platform ? (
        <DetailRow
          icon="share-social-outline"
          label="Primary Channel"
          value={`${platformLabel(application.platform)} · ${application.handle ?? ""}`}
        />
      ) : null}
      {application.follower_count ? (
        <DetailRow
          icon="people-outline"
          label="Audience Reach"
          value={`${application.follower_count.toLocaleString()} followers${
            application.audience_region ? ` (${application.audience_region})` : ""
          }`}
        />
      ) : null}
      {application.categories && application.categories.length > 0 ? (
        <View style={{ marginTop: 12 }}>
          <Text style={styles.detailLabel}>NICHES & GENRES</Text>
          <View style={styles.catWrap}>
            {application.categories.map((c) => (
              <View key={c} style={styles.catChip}>
                <Ionicons name="sparkles" size={9} color="#85651B" />
                <Text style={styles.catChipText}>{c}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.cardFooterRow}>
        <Ionicons name="calendar-outline" size={12} color="#85651B" />
        <Text style={styles.cardFooterText}>
          Application registered {new Date(application.created_at).toLocaleDateString()}
          {application.status === "approved" && !profile ? " · awaiting collab generation" : ""}
        </Text>
      </View>
    </View>
  );
}

function platformLabel(value: string) {
  return PLATFORMS.find((p) => p.value === value)?.label ?? value;
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailIcon}>
        <Ionicons name={icon} size={15} color="#85651B" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue} numberOfLines={2}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function ProfileCard({ profile }: { profile: InfluencerProfile }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const copyCode = async () => {
    try {
      await Clipboard.setStringAsync(profile.code);
      setCopied(true);
      toast("Collab code copied to clipboard", "success");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast("Could not copy code", "error");
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <View style={styles.kickerBadge}>
          <Text style={styles.kickerBadgeText}>CREATOR PRIVILEGE</Text>
        </View>
        <View style={styles.activeStatusPill}>
          <View style={styles.activeStatusDot} />
          <Text style={styles.activeStatusText}>ACTIVE PARTNER</Text>
        </View>
      </View>

      <Text style={styles.dashboardTitle}>Your Atelier Collab Code</Text>
      <Text style={styles.dashboardSubtitle}>
        Share with your audience. Every attributed order rewards you with weekly commission.
      </Text>

      {/* Code Card */}
      <View style={styles.codeCard}>
        <View style={styles.codeLeft}>
          <Text style={styles.codeLabel}>CREATOR COLLAB CODE</Text>
          <Text style={styles.codeValue}>{profile.code}</Text>
        </View>
        <TouchableOpacity
          style={styles.copyBtn}
          onPress={copyCode}
          activeOpacity={0.8}
        >
          <Ionicons
            name={copied ? "checkmark-circle" : "copy-outline"}
            size={14}
            color={copied ? "#7D8B6F" : "#FAF8F5"}
          />
          <Text style={[styles.copyBtnText, copied && { color: "#7D8B6F" }]}>
            {copied ? "Copied" : "Copy Code"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Commission pill banner */}
      <View style={styles.commissionBanner}>
        <Ionicons name="sparkles" size={13} color="#C8A44A" />
        <Text style={styles.commissionBannerText}>
          Tier Rate: <Text style={{ fontFamily: fontFamilies.mono.semibold, color: "#141311" }}>{profile.commission_rate}% commission</Text> on all attributed orders.
        </Text>
      </View>

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <View style={styles.statCell}>
          <Text style={styles.statValue}>{profile.total_clicks.toLocaleString()}</Text>
          <Text style={styles.statLabel}>Clicks</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statCell}>
          <Text style={styles.statValue}>{profile.total_referrals}</Text>
          <Text style={styles.statLabel}>Collabs</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statCell}>
          <Text style={styles.statValue}>{formatPrice(profile.total_earnings)}</Text>
          <Text style={styles.statLabel}>Earned</Text>
        </View>
      </View>

      <View style={styles.payoutNotice}>
        <Ionicons name="shield-checkmark-outline" size={13} color="#7D8B6F" />
        <Text style={styles.payoutNoticeText}>
          Commissions settle weekly directly in LKR to your connected payout account.
        </Text>
      </View>
    </View>
  );
}

function StepsCard() {
  return (
    <View style={styles.card}>
      <View style={styles.kickerBadge}>
        <Text style={styles.kickerBadgeText}>WHAT HAPPENS NEXT</Text>
      </View>
      {NEXT_STEPS.map((s, i) => (
        <View key={s.n} style={[styles.stepRow, i === NEXT_STEPS.length - 1 && { borderBottomWidth: 0 }]}>
          <View style={styles.stepNum}>
            <Text style={styles.stepNumText}>{s.n}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.stepTitle}>{s.title}</Text>
            <Text style={styles.stepBody}>{s.body}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function ApplyForm({
  form,
  patch,
  submitting,
  onSubmit,
  onCancel,
}: {
  form: {
    full_name: string;
    email: string;
    phone: string;
    platform: SocialPlatform;
    handle: string;
    follower_count: string;
    audience_region: string;
    categories: string[];
    bio: string;
    sample_url: string;
  };
  patch: (p: Partial<typeof form>) => void;
  submitting: boolean;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <View style={{ gap: 16 }}>
      {/* SECTION 01: CREATOR IDENTITY */}
      <View style={styles.formSectionCard}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionKickerBadge}>
            <Text style={styles.sectionKickerText}>01</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitleText}>Creator Identity</Text>
            <Text style={styles.sectionSubtitleText}>
              Basic contact details to register your creator profile.
            </Text>
          </View>
        </View>

        <FormField label="Full name" icon="person-outline" required>
          <TextInput
            style={styles.input}
            value={form.full_name}
            onChangeText={(v) => patch({ full_name: v })}
            placeholder="Your full name"
            placeholderTextColor="#A49E93"
            autoCapitalize="words"
          />
        </FormField>

        <FormField label="Email address" icon="mail-outline" required>
          <TextInput
            style={styles.input}
            value={form.email}
            onChangeText={(v) => patch({ email: v })}
            placeholder="you@example.com"
            placeholderTextColor="#A49E93"
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </FormField>

        <FormField label="Phone number" icon="call-outline">
          <TextInput
            style={styles.input}
            value={form.phone}
            onChangeText={(v) => patch({ phone: v })}
            placeholder="+94 77 123 4567"
            placeholderTextColor="#A49E93"
            keyboardType="phone-pad"
          />
        </FormField>
      </View>

      {/* SECTION 02: AUDIENCE & REACH */}
      <View style={styles.formSectionCard}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionKickerBadge}>
            <Text style={styles.sectionKickerText}>02</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitleText}>Audience & Platforms</Text>
            <Text style={styles.sectionSubtitleText}>
              Select where you publish and your estimated reach.
            </Text>
          </View>
        </View>

        <FormField label="Primary platform" required>
          <View style={styles.platformGrid}>
            {PLATFORMS.map((p) => {
              const on = form.platform === p.value;
              return (
                <TouchableOpacity
                  key={p.value}
                  style={[styles.platformTile, on && styles.platformTileOn]}
                  onPress={() => patch({ platform: p.value })}
                  activeOpacity={0.75}
                >
                  <View style={[styles.platformIconWrap, on && styles.platformIconWrapOn]}>
                    <Ionicons
                      name={p.icon}
                      size={18}
                      color={on ? "#E8CF8F" : "#736F66"}
                    />
                  </View>
                  <Text style={[styles.platformTileLabel, on && styles.platformTileLabelOn]}>
                    {p.label}
                  </Text>
                  {on ? (
                    <View style={styles.platformCheckDot}>
                      <Ionicons name="checkmark" size={10} color="#181714" />
                    </View>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>
        </FormField>

        <FormField label="Handle or channel URL" icon="at-outline" required>
          <TextInput
            style={styles.input}
            value={form.handle}
            onChangeText={(v) => patch({ handle: v })}
            placeholder="@yourhandle or channel link"
            placeholderTextColor="#A49E93"
            autoCapitalize="none"
          />
        </FormField>

        <View style={styles.twoCol}>
          <View style={{ flex: 1 }}>
            <FormField label="Followers" icon="people-outline">
              <TextInput
                style={styles.input}
                value={form.follower_count}
                onChangeText={(v) => patch({ follower_count: v })}
                placeholder="10,000"
                placeholderTextColor="#A49E93"
                keyboardType="number-pad"
              />
            </FormField>
          </View>
          <View style={{ flex: 1 }}>
            <FormField label="Audience region" icon="earth-outline">
              <TextInput
                style={styles.input}
                value={form.audience_region}
                onChangeText={(v) => patch({ audience_region: v })}
                placeholder="Sri Lanka, Global"
                placeholderTextColor="#A49E93"
              />
            </FormField>
          </View>
        </View>
      </View>

      {/* SECTION 03: CONTENT & NICHES */}
      <View style={styles.formSectionCard}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionKickerBadge}>
            <Text style={styles.sectionKickerText}>03</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitleText}>Content & Niches</Text>
            <Text style={styles.sectionSubtitleText}>
              What you curate and a sample post for editorial review.
            </Text>
          </View>
        </View>

        <FormField
          label="Categories"
          badge={form.categories.length > 0 ? `${form.categories.length} selected` : undefined}
        >
          <View style={styles.chipRow}>
            {CATEGORIES.map((c) => {
              const on = form.categories.includes(c);
              return (
                <TouchableOpacity
                  key={c}
                  style={[styles.formChip, on && styles.formChipOn]}
                  onPress={() =>
                    patch({
                      categories: on
                        ? form.categories.filter((x) => x !== c)
                        : [...form.categories, c],
                    })
                  }
                  activeOpacity={0.75}
                >
                  {on ? (
                    <View style={styles.formChipCheck}>
                      <Ionicons name="checkmark" size={10} color="#181714" />
                    </View>
                  ) : null}
                  <Text style={[styles.formChipText, on && styles.formChipTextOn]}>{c}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </FormField>

        <FormField
          label="Creator Bio / Focus"
          icon="document-text-outline"
          badge={`${form.bio.length}/2000`}
        >
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            value={form.bio}
            onChangeText={(v) => patch({ bio: v })}
            placeholder="A brief introduction about your aesthetic, style, and content focus…"
            placeholderTextColor="#A49E93"
            multiline
            maxLength={2000}
          />
        </FormField>

        <FormField label="Sample post or reel link" icon="link-outline">
          <TextInput
            style={styles.input}
            value={form.sample_url}
            onChangeText={(v) => patch({ sample_url: v })}
            placeholder="https://instagram.com/p/... or youtube.com/..."
            placeholderTextColor="#A49E93"
            keyboardType="url"
            autoCapitalize="none"
          />
        </FormField>
      </View>

      {/* FORM ACTION BAR */}
      <View style={styles.formFooter}>
        <TouchableOpacity style={styles.formCancel} onPress={onCancel} activeOpacity={0.7}>
          <Text style={styles.formCancelText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.formSubmit, submitting && { opacity: 0.6 }]}
          onPress={onSubmit}
          disabled={submitting}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={["#262420", "#141311"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.formSubmitGradient}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#FAF8F5" />
            ) : (
              <>
                <Ionicons name="sparkles" size={14} color="#E8CF8F" />
                <Text style={styles.formSubmitText}>Submit Application</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function FormField({
  label,
  required,
  icon,
  badge,
  children,
}: {
  label: string;
  required?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.formField}>
      <View style={styles.formLabelRow}>
        <View style={styles.formLabelLeft}>
          {icon ? <Ionicons name={icon} size={12} color="#85651B" style={{ marginRight: 5 }} /> : null}
          <Text style={styles.formLabel}>
            {label}
            {required ? <Text style={{ color: "#8C3A22" }}> *</Text> : null}
          </Text>
        </View>
        {badge ? <Text style={styles.formLabelBadge}>{badge}</Text> : null}
      </View>
      {children}
    </View>
  );
}

/* -------------------------------- styles ------------------------------- */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F7F2" },
  content: { padding: 20 },

  topHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EAE7DF",
    backgroundColor: "#F8F7F2",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#EAE7DF",
    ...shadows.soft,
  },
  headerTitleCenter: { alignItems: "center", justifyContent: "center" },
  headerEyebrow: {
    fontSize: 10,
    fontFamily: fontFamilies.mono.semibold,
    color: "#85651B",
    letterSpacing: 1.8,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: fontFamilies.display.semibold,
    color: "#141311",
    letterSpacing: -0.3,
  },
  headerRightPlaceholder: { width: 40, alignItems: "flex-end" },
  headerMedallion: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#EAE7DF",
    ...shadows.soft,
  },

  /* Hero Card */
  heroCard: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.25)",
    ...shadows.soft,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
    gap: 8,
  },
  heroTagBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "rgba(200, 164, 74, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.3)",
  },
  heroTagText: {
    fontSize: 9,
    fontFamily: fontFamilies.mono.semibold,
    color: "#E8CF8F",
    letterSpacing: 1.4,
  },
  heroSyncBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  heroSyncDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#C8A44A" },
  heroSyncText: {
    fontSize: 9,
    fontFamily: fontFamilies.mono.semibold,
    color: "#E8CF8F",
    letterSpacing: 1,
  },
  heroTitle: {
    fontSize: 22,
    fontFamily: fontFamilies.display.semibold,
    color: "#FAF8F5",
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  heroCopy: {
    fontSize: 12.5,
    fontFamily: fontFamilies.sans.regular,
    color: "#A49E93",
    lineHeight: 18,
  },
  heroStatusStrip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "rgba(200, 164, 74, 0.15)",
  },
  heroStatusItem: { flex: 1, alignItems: "center" },
  heroStatusLabel: {
    fontSize: 9,
    fontFamily: fontFamilies.mono.medium,
    color: "rgba(232, 207, 143, 0.7)",
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  heroStatusVal: {
    fontSize: 11,
    fontFamily: fontFamilies.sans.semibold,
    color: "#FAF8F5",
    letterSpacing: 0.2,
  },
  heroStatusDivider: { width: 1, height: 18, backgroundColor: "rgba(200, 164, 74, 0.15)" },

  loadingWrap: { alignItems: "center", paddingVertical: 48 },
  loadingText: {
    marginTop: 12,
    fontSize: 12,
    fontFamily: fontFamilies.mono.regular,
    color: "#6B675E",
    letterSpacing: 0.5,
  },

  /* Card */
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "#EAE7DF",
    marginBottom: 16,
    ...shadows.soft,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  kickerBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: "rgba(200, 164, 74, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.25)",
    alignSelf: "flex-start",
  },
  kickerBadgeText: {
    fontSize: 10,
    fontFamily: fontFamilies.mono.semibold,
    color: "#85651B",
    letterSpacing: 1.2,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 11,
    fontFamily: fontFamilies.sans.semibold,
  },

  /* Timeline */
  timelineBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F4F1EA",
  },
  timelineStep: { alignItems: "center", gap: 5 },
  timelineDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#EAE6DC",
    alignItems: "center",
    justifyContent: "center",
  },
  timelineDotComplete: { backgroundColor: "#7D8B6F" },
  timelineDotCurrent: {
    backgroundColor: "#181714",
    borderWidth: 1.5,
    borderColor: "#C8A44A",
  },
  timelineDotRejected: { backgroundColor: "#8C3A22" },
  pulseInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#E8CF8F",
  },
  timelineLine: {
    flex: 1,
    height: 2,
    backgroundColor: "#EAE6DC",
    marginHorizontal: 8,
    marginTop: -16,
  },
  timelineLineActive: { backgroundColor: "#7D8B6F" },
  timelineLabel: {
    fontSize: 10,
    fontFamily: fontFamilies.sans.medium,
    color: "#A49E93",
  },
  timelineLabelActive: {
    fontFamily: fontFamilies.sans.semibold,
    color: "#141311",
  },

  /* Detail Rows */
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F4F1EA",
  },
  detailIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "rgba(200, 164, 74, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  detailLabel: {
    fontSize: 9.5,
    fontFamily: fontFamilies.mono.semibold,
    color: "#85651B",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 13.5,
    fontFamily: fontFamilies.sans.medium,
    color: "#141311",
  },
  catWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  catChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: "#F4F1EA",
    borderWidth: 1,
    borderColor: "#EAE6DC",
  },
  catChipText: { fontSize: 11, fontFamily: fontFamilies.sans.medium, color: "#5C6A4F" },
  cardFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F4F1EA",
  },
  cardFooterText: { fontSize: 11.5, fontFamily: fontFamilies.sans.regular, color: "#85651B" },

  /* Creator Dashboard */
  activeStatusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "rgba(125, 139, 111, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(125, 139, 111, 0.3)",
  },
  activeStatusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#7D8B6F" },
  activeStatusText: {
    fontSize: 9.5,
    fontFamily: fontFamilies.mono.semibold,
    color: "#5C6A4F",
    letterSpacing: 0.8,
  },
  dashboardTitle: {
    fontSize: 17,
    fontFamily: fontFamilies.display.semibold,
    color: "#141311",
    letterSpacing: -0.2,
    marginTop: 4,
    marginBottom: 4,
  },
  dashboardSubtitle: {
    fontSize: 12.5,
    fontFamily: fontFamilies.sans.regular,
    color: "#6B675E",
    lineHeight: 18,
    marginBottom: 16,
  },
  codeCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#181714",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.4)",
    marginBottom: 12,
    ...shadows.soft,
  },
  codeLeft: { flex: 1 },
  codeLabel: {
    fontSize: 9,
    fontFamily: fontFamilies.mono.semibold,
    color: "rgba(232, 207, 143, 0.7)",
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  codeValue: {
    fontSize: 19,
    fontFamily: fontFamilies.mono.semibold,
    color: "#FAF8F5",
    letterSpacing: 1.5,
  },
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.3)",
  },
  copyBtnText: {
    fontSize: 12,
    fontFamily: fontFamilies.sans.semibold,
    color: "#FAF8F5",
  },
  commissionBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(200, 164, 74, 0.1)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.25)",
    marginBottom: 14,
  },
  commissionBannerText: {
    fontSize: 12,
    fontFamily: fontFamilies.sans.regular,
    color: "#5C4A1E",
  },
  statsGrid: {
    flexDirection: "row",
    borderRadius: 14,
    backgroundColor: "#FAF8F5",
    borderWidth: 1,
    borderColor: "#EAE7DF",
    alignItems: "center",
    marginBottom: 12,
  },
  statCell: { flex: 1, alignItems: "center", paddingVertical: 14 },
  statDivider: { width: 1, height: 28, backgroundColor: "#EAE7DF" },
  statValue: { fontSize: 16, fontFamily: fontFamilies.display.semibold, color: "#141311" },
  statLabel: {
    fontSize: 9,
    fontFamily: fontFamilies.mono.medium,
    color: "#85651B",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginTop: 3,
  },
  payoutNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingTop: 4,
  },
  payoutNoticeText: {
    fontSize: 11.5,
    fontFamily: fontFamilies.sans.regular,
    color: "#5C6A4F",
    flex: 1,
    lineHeight: 16,
  },

  /* Steps Card */
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F4F1EA",
  },
  stepNum: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(200, 164, 74, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumText: { fontSize: 11, fontFamily: fontFamilies.mono.semibold, color: "#85651B" },
  stepTitle: { fontSize: 14, fontFamily: fontFamilies.display.semibold, color: "#141311" },
  stepBody: { fontSize: 12, fontFamily: fontFamilies.sans.regular, color: "#6B675E", lineHeight: 17, marginTop: 2 },

  /* Apply CTA */
  applyCtaCard: {
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.35)",
    marginBottom: 16,
    ...shadows.soft,
  },
  applyCtaGradient: {
    flexDirection: "row",
    alignItems: "center",
    padding: 18,
    gap: 14,
  },
  applyCtaIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#181714",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#C8A44A",
  },
  applyCtaBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
    backgroundColor: "rgba(200, 164, 74, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.25)",
    marginBottom: 4,
  },
  applyCtaBadgeText: {
    fontSize: 8.5,
    fontFamily: fontFamilies.mono.semibold,
    color: "#85651B",
    letterSpacing: 1,
  },
  applyCtaTitle: { fontSize: 15.5, fontFamily: fontFamilies.display.semibold, color: "#141311" },
  applyCtaSub: { fontSize: 12, fontFamily: fontFamilies.sans.regular, color: "#6B675E", marginTop: 2 },
  applyCtaArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FAF8F5",
    borderWidth: 1,
    borderColor: "#EAE6DC",
    alignItems: "center",
    justifyContent: "center",
  },

  /* Notice Card */
  noticeCard: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: "#EAE7DF",
    ...shadows.soft,
  },
  noticeIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(200, 164, 74, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.25)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  noticeTitle: {
    fontSize: 16.5,
    fontFamily: fontFamilies.display.semibold,
    color: "#141311",
    marginBottom: 6,
  },
  noticeBody: {
    fontSize: 12.5,
    fontFamily: fontFamilies.sans.regular,
    color: "#6B675E",
    textAlign: "center",
    lineHeight: 18,
  },
  noticeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 14,
    backgroundColor: "#181714",
  },
  noticeBtnText: { fontSize: 13, fontFamily: fontFamilies.sans.semibold, color: "#FAF8F5" },

  /* Form Sections */
  formSectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "#EAE7DF",
    ...shadows.soft,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 16,
  },
  sectionKickerBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: "rgba(200, 164, 74, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  sectionKickerText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10,
    color: "#85651B",
    letterSpacing: 1,
  },
  sectionTitleText: {
    fontSize: 16.5,
    fontFamily: fontFamilies.display.semibold,
    color: "#141311",
    letterSpacing: -0.2,
  },
  sectionSubtitleText: {
    fontSize: 12,
    fontFamily: fontFamilies.sans.regular,
    color: "#6B675E",
    marginTop: 2,
    lineHeight: 17,
  },

  formField: { marginBottom: 14 },
  formLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 7,
  },
  formLabelLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  formLabel: {
    fontSize: 10,
    fontFamily: fontFamilies.mono.semibold,
    color: "#85651B",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  formLabelBadge: {
    fontSize: 9.5,
    fontFamily: fontFamilies.mono.medium,
    color: "#A49E93",
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1,
    borderColor: "#EAE6DC",
    borderRadius: 12,
    backgroundColor: "#FAF8F5",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 13.5,
    fontFamily: fontFamilies.sans.regular,
    color: "#141311",
  },
  inputMultiline: { minHeight: 90, textAlignVertical: "top" },
  twoCol: { flexDirection: "row", gap: 10 },

  /* Platform Selector Grid */
  platformGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  platformTile: {
    flexBasis: "48%",
    flexGrow: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#FAF8F5",
    borderWidth: 1,
    borderColor: "#EAE6DC",
    position: "relative",
  },
  platformTileOn: {
    backgroundColor: "#181714",
    borderColor: "#C8A44A",
  },
  platformIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#F0ECE2",
    alignItems: "center",
    justifyContent: "center",
  },
  platformIconWrapOn: {
    backgroundColor: "rgba(200, 164, 74, 0.18)",
  },
  platformTileLabel: {
    fontSize: 12.5,
    fontFamily: fontFamilies.sans.medium,
    color: "#4A463E",
    flex: 1,
  },
  platformTileLabelOn: {
    fontFamily: fontFamilies.sans.semibold,
    color: "#FAF8F5",
  },
  platformCheckDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#C8A44A",
    alignItems: "center",
    justifyContent: "center",
  },

  /* Category Tag Cloud */
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  formChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "#FAF8F5",
    borderWidth: 1,
    borderColor: "#EAE6DC",
  },
  formChipOn: {
    backgroundColor: "#181714",
    borderColor: "#C8A44A",
  },
  formChipCheck: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#C8A44A",
    alignItems: "center",
    justifyContent: "center",
  },
  formChipText: { fontSize: 12, fontFamily: fontFamilies.sans.medium, color: "#5C584E" },
  formChipTextOn: { color: "#FAF8F5", fontFamily: fontFamilies.sans.semibold },

  /* Form Actions */
  formFooter: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
    marginBottom: 8,
  },
  formCancel: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#EAE6DC",
    backgroundColor: "#FAF8F5",
  },
  formCancelText: { fontSize: 13.5, fontFamily: fontFamilies.sans.semibold, color: "#736F66" },
  formSubmit: {
    flex: 2,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.35)",
  },
  formSubmitGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
  },
  formSubmitText: { fontSize: 13.5, fontFamily: fontFamilies.sans.semibold, color: "#FAF8F5" },
});
