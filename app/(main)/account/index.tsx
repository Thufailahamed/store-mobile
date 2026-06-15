import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  View, ScrollView, TouchableOpacity, TextInput, StyleSheet, Alert, Share, Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
import { PaperBackground } from "@/components/layout";
import { useAuth } from "@/lib/supabase/auth";
import { supabase } from "@/lib/supabase/client";
import { useLoyalty, tierProgress } from "@/lib/hooks/useLoyalty";
import { useCart, useWishlist } from "@/lib/stores";
import { Avatar, Badge, Button } from "@/components/ui";
import { Display, Label, Body, Price } from "@/components/ui/Typography";
import { colors, radii, spacing, shadows, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import * as api from "@/lib/api";
import type { Order, Address } from "@/lib/types";
import { formatPrice } from "@/lib/utils";
import { getFollowedBrands, getFollowedStores, type FollowedBrand, type FollowedStore } from "@/lib/api";
import { getRecentlyViewed, getStoredPayments, type RecentlyViewedProduct } from "@/lib/account-local";

/* ─── Stat card config ─── */
const STAT_ICONS = {
  orders: "cube-outline" as const,
  wishlist: "heart-outline" as const,
  reviews: "star-outline" as const,
  points: "gift-outline" as const,
};

const STAT_COLORS = {
  orders: { bg: "rgba(83, 94, 44, 0.08)", accent: colors.olive[600] },
  wishlist: { bg: "rgba(184, 92, 58, 0.08)", accent: colors.accent2.rust },
  reviews: { bg: "rgba(200, 164, 74, 0.08)", accent: colors.accent2.ochre },
  points: { bg: "rgba(83, 94, 44, 0.10)", accent: colors.olive[700] },
};

/* ─── Portal entry (manual from Account — no auto-redirect on login) ─── */
const PORTAL_BY_ROLE: Record<string, {
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
  kicker: string;
} | null> = {
  admin: {
    label: "Admin portal",
    description: "Overview, approvals, orders, CMS",
    icon: "shield-outline",
    route: "/(admin)",
    kicker: "Admin",
  },
  store_owner: {
    label: "Seller portal",
    description: "Manage products, orders, and inventory",
    icon: "storefront-outline",
    route: "/(main)/account",
    kicker: "Seller",
  },
  brand_owner: {
    label: "Brand portal",
    description: "Brand catalogue, products, and orders",
    icon: "ribbon-outline",
    route: "/(main)/account",
    kicker: "Brand",
  },
};

/* ─── Quick links config ─── */
const QUICK_LINKS = [
  { key: "orders", label: "Track orders", icon: "bicycle-outline" as const, route: "/(main)/account/orders", hint: "active" },
  { key: "addresses", label: "Addresses", icon: "location-outline" as const, route: "/(main)/account/addresses", hint: "saved" },
  { key: "payments", label: "Payment methods", icon: "card-outline" as const, route: "/(main)/account/payments", hint: "saved" },
  { key: "returns", label: "Returns", icon: "refresh-outline" as const, route: "/(main)/account/returns", hint: "requests" },
  { key: "loyalty", label: "Loyalty & rewards", icon: "trophy-outline" as const, route: "/(main)/account/loyalty", hint: "tier" },
  { key: "reviews", label: "My reviews", icon: "star-outline" as const, route: "/(main)/account/reviews", hint: "written" },
  { key: "wishlist", label: "Wishlist", icon: "heart-outline" as const, route: "/(main)/wishlist", hint: "saved" },
  { key: "notifications", label: "Notifications", icon: "notifications-outline" as const, route: "/(main)/notifications", hint: "unread" },
  { key: "notifPrefs", label: "Notification prefs", icon: "options-outline" as const, route: "/(main)/account/notifications/preferences", hint: "channels" },
  { key: "settings", label: "Settings", icon: "settings-outline" as const, route: "/(main)/account/settings" as never, hint: "Preferences" },
  { key: "security", label: "Security", icon: "shield-checkmark-outline" as const, route: "/(main)/account/security" as never, hint: "2FA" },
];

/* ─── Activity config ─── */
const ACTIVITY_ICONS = {
  order: "cube-outline" as const,
  wishlist: "heart-outline" as const,
  review: "star-outline" as const,
  joined: "shield-checkmark-outline" as const,
};

/* ─── Status colors ─── */
const STATUS_COLORS: Record<string, string> = {
  pending: colors.accent2.ochre,
  confirmed: colors.olive[500],
  processing: colors.olive[400],
  shipped: colors.olive[600],
  out_for_delivery: colors.olive[700],
  delivered: colors.olive[600],
  cancelled: colors.light.destructive,
};

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, role, signOut } = useAuth();
  const loyalty = useLoyalty();
  const cartCount = useCart((s) => s.itemCount());
  const wishlistCount = useWishlist((s) => s.count());
  const tier = tierProgress(loyalty.state.lifetime_points);

  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [activeOrders, setActiveOrders] = useState(0);
  const [paymentCount, setPaymentCount] = useState(0);
  const [followedStores, setFollowedStores] = useState<FollowedStore[]>([]);
  const [followedBrands, setFollowedBrands] = useState<FollowedBrand[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<RecentlyViewedProduct[]>([]);

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    dob: "",
    bio: "",
  });

  const name = user?.user_metadata?.full_name || "Guest";
  const firstName = name.split(" ")[0];
  const restOfName = name.split(" ").slice(1).join(" ");

  /* ─── Fetch all data ─── */
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function load() {
      const [ordersRes, addrRes, notifRes] = await Promise.all([
        api.getOrders(user!.id, 10),
        api.getAddresses(user!.id),
        api.getNotifications(user!.id, 50),
      ]);

      if (cancelled) return;

      if (ordersRes.ok) {
        setRecentOrders(ordersRes.data);
        setActiveOrders(
          ordersRes.data.filter((o) =>
            ["pending", "confirmed", "processing", "shipped"].includes(o.status)
          ).length
        );
      }
      if (addrRes.ok) setAddresses(addrRes.data);
      if (notifRes.ok) setUnreadCount(notifRes.data.filter((n) => !n.read_at).length);

      const [followedStoresRes, followedBrandsRes, payments, viewed] = await Promise.all([
        user ? getFollowedStores(user.id) : Promise.resolve({ ok: true, data: [] }),
        user ? getFollowedBrands(user.id) : Promise.resolve({ ok: true, data: [] }),
        getStoredPayments(user?.id),
        getRecentlyViewed(user?.id),
      ]);

      if (followedStoresRes.ok) setFollowedStores(followedStoresRes.data);
      if (followedBrandsRes.ok) setFollowedBrands(followedBrandsRes.data);
      setPaymentCount(payments.length);
      setRecentlyViewed(viewed);

      // Reviews count
      const { count } = await supabase
        .from("reviews")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id);
      if (!cancelled) setReviewCount(count ?? 0);

      // Profile from users table
      const { data: profile } = await supabase
        .from("users")
        .select("full_name, phone, metadata")
        .eq("id", user!.id)
        .maybeSingle();

      if (!cancelled && profile) {
        setForm({
          name: profile.full_name ?? name,
          email: user!.email ?? "",
          phone: profile.phone ?? "",
          dob: (profile as any).metadata?.dob ?? "",
          bio: (profile as any).metadata?.bio ?? "",
        });
      } else if (!cancelled) {
        setForm({ name, email: user!.email ?? "", phone: "", dob: "", bio: "" });
      }

      if (!cancelled) setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [user]);

  /* ─── Save profile ─── */
  const handleSave = useCallback(async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("users")
      .update({
        full_name: form.name,
        phone: form.phone || null,
        metadata: { dob: form.dob, bio: form.bio },
      })
      .eq("id", user.id);

    setSaving(false);
    if (error) {
      Alert.alert("Error", error.message);
    } else {
      setEditing(false);
    }
  }, [user, form]);

  /* ─── Computed values ─── */
  const defaultAddress = useMemo(
    () => addresses.find((a) => a.is_default) ?? addresses[0],
    [addresses]
  );

  const joinedDate = useMemo(() => {
    const d = user?.created_at ? new Date(user.created_at) : null;
    if (!d) return "Recently";
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${months[d.getMonth()]} ${d.getFullYear()}`;
  }, [user?.created_at]);

  const nextTierName =
    tier.next === 5000 ? "Platinum" : tier.next === 2000 ? "Gold" : tier.next === 500 ? "Silver" : "";

  const completeness = useMemo(() => {
    const checks: { key: string; label: string; done: boolean; weight: number; route: string }[] = [
      { key: "name", label: "Add your full name", done: Boolean(form.name && form.name.trim().length > 1), weight: 15, route: "/(main)/account" },
      { key: "phone", label: "Add a phone for delivery updates", done: Boolean(form.phone && form.phone.trim().length > 4), weight: 15, route: "/(main)/account/settings" },
      { key: "dob", label: "Add your date of birth for a birthday surprise", done: Boolean(form.dob && form.dob.trim().length > 4), weight: 15, route: "/(main)/account" },
      { key: "bio", label: "Write a short bio", done: Boolean(form.bio && form.bio.trim().length > 5), weight: 15, route: "/(main)/account" },
      { key: "address", label: "Save a delivery address", done: addresses.length > 0, weight: 20, route: "/(main)/account/addresses" },
      { key: "payment", label: "Add a payment method", done: paymentCount > 0, weight: 20, route: "/(main)/account/payments" },
    ];
    const totalWeight = checks.reduce((s, c) => s + c.weight, 0);
    const doneWeight = checks.filter((c) => c.done).reduce((s, c) => s + c.weight, 0);
    return {
      pct: Math.round((doneWeight / totalWeight) * 100),
      done: doneWeight,
      total: totalWeight,
      missing: checks.filter((c) => !c.done),
    };
  }, [form.name, form.phone, form.dob, form.bio, addresses.length, paymentCount]);

  const handleShare = useCallback(async () => {
    try {
      await Share.share({
        title: `${name} on LUXE`,
        message: `${name} is shopping on LUXE. ${loyalty.state.points} points, ${tier.name} member.`,
      });
    } catch {}
  }, [name, loyalty.state.points, tier.name]);

  const handleAvatarPress = useCallback(() => {
    Alert.alert(
      "Profile photo",
      "Update the photo shown on your account.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Use saved initials",
          onPress: () => {
            // Without a picker installed, just toggle the metadata hint
            Alert.alert("Saved", "Your avatar reflects your initials. Add a custom URL in settings to override.");
          },
        },
        {
          text: "Reset to initials",
          style: "destructive",
          onPress: async () => {
            if (!user?.id) return;
            await supabase.from("users").update({ metadata: { ...(user?.user_metadata ?? {}), avatar_url: null } }).eq("id", user.id);
            await supabase.auth.updateUser({ data: { avatar_url: null } });
            Alert.alert("Avatar reset", "Your photo has been cleared.");
          },
        },
      ],
    );
  }, [user]);

  const handleCompletenessPress = useCallback(() => {
    const firstMissing = completeness.missing[0];
    if (!firstMissing) return;
    if (firstMissing.route === "/(main)/account") {
      setEditing(true);
    } else {
      router.push(firstMissing.route as any);
    }
  }, [completeness.missing, router]);

  const stats = useMemo(
    () => [
      { key: "orders", label: "Orders", value: recentOrders.length },
      { key: "wishlist", label: "Wishlist", value: wishlistCount },
      { key: "reviews", label: "Reviews", value: reviewCount },
      { key: "points", label: "Points", value: loyalty.state.points },
    ] as const,
    [recentOrders.length, wishlistCount, reviewCount, loyalty.state.points]
  );

  const trophies = useMemo(() => {
    const earned: { icon: keyof typeof Ionicons.glyphMap; label: string; tone: string }[] = [];
    if (recentOrders.length > 0) earned.push({ icon: "cube-outline", label: "First order", tone: colors.olive[600] });
    if (reviewCount > 0) earned.push({ icon: "star-outline", label: "First review", tone: colors.accent2.ochre });
    if (tier.name === "Silver" || tier.name === "Gold" || tier.name === "Platinum") earned.push({ icon: "medal-outline", label: "Silver tier", tone: "#737373" });
    if (tier.name === "Gold" || tier.name === "Platinum") earned.push({ icon: "trophy-outline", label: "Gold tier", tone: colors.accent2.ochre });
    if (tier.name === "Platinum") earned.push({ icon: "diamond-outline", label: "Platinum", tone: colors.light.primary });
    if (followedStores.length + followedBrands.length >= 3) earned.push({ icon: "heart-outline", label: "Curator", tone: colors.accent2.rust });
    if (earned.length === 0) earned.push({ icon: "leaf-outline", label: "Member", tone: colors.olive[500] });
    return earned.slice(0, 6);
  }, [recentOrders.length, reviewCount, tier.name, followedStores.length, followedBrands.length]);

  const activity = useMemo(() => {
    const items: {
      icon: keyof typeof ACTIVITY_ICONS;
      title: string;
      detail: string;
      time: string;
      color: string;
    }[] = [];

    if (recentOrders[0]) {
      const o = recentOrders[0];
      items.push({
        icon: "order",
        title: `Order ${o.order_number} is ${o.status.replace(/_/g, " ")}`,
        detail: `Total: ${formatPrice(o.total)} · ${new Date(o.placed_at).toLocaleDateString()}`,
        time: formatRelative(o.placed_at),
        color: STATUS_COLORS[o.status] || colors.olive[600],
      });
    }
    if (wishlistCount > 0) {
      items.push({
        icon: "wishlist",
        title: `Wishlist holds ${wishlistCount} item${wishlistCount === 1 ? "" : "s"}`,
        detail: "View and shop your curated styles.",
        time: "Active",
        color: colors.accent2.rust,
      });
    }
    if (reviewCount > 0) {
      items.push({
        icon: "review",
        title: `Written ${reviewCount} review${reviewCount === 1 ? "" : "s"}`,
        detail: "Sharing feedback on purchases.",
        time: "Contributor",
        color: colors.accent2.ochre,
      });
    }
    items.push({
      icon: "joined",
      title: "Account created",
      detail: "Your LUXE membership is active.",
      time: "Joined",
      color: colors.olive[500],
    });
    return items;
  }, [recentOrders, wishlistCount, reviewCount]);

  const portal = role ? (PORTAL_BY_ROLE[role] ?? null) : null;

  return (
    <PaperBackground>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: Math.max(insets.top, spacing[4]) },
        ]}
      >
        {/* ═══════════ HERO CARD ═══════════ */}
        <View style={styles.heroCard}>
          <View style={styles.heroWash} />
          <View style={styles.heroBlob1} />
          <View style={styles.heroBlob2} />

          <View style={styles.heroContent}>
            {/* Avatar with ring */}
            <View style={styles.avatarWrap}>
              <View style={styles.avatarRing} />
              <Avatar
                name={name}
                uri={user?.user_metadata?.avatar_url}
                size={88}
                style={styles.avatarInner}
              />
              <TouchableOpacity style={styles.avatarEditBtn} activeOpacity={0.8} onPress={handleAvatarPress}>
                <Ionicons name="camera" size={14} color={colors.light.primaryForeground} />
              </TouchableOpacity>
              <View style={styles.vipStamp}>
                <Label style={styles.vipStampText}>VIP</Label>
              </View>
            </View>

            {/* Greeting */}
            <View style={styles.greetingRow}>
              <Ionicons name="sparkles" size={12} color={colors.light.primary} />
              <Label style={styles.greetingLabel}>Hello there</Label>
            </View>

            {/* Name */}
            <View style={styles.nameRow}>
              <Display size="3xl" style={styles.nameFirst}>{firstName} </Display>
              <Display italic size="3xl" style={styles.nameRest}>{restOfName || firstName}</Display>
            </View>

            {/* Email + Phone */}
            <View style={styles.contactRow}>
              <Ionicons name="mail-outline" size={13} color={colors.light.mutedForeground} />
              <Body muted size="xs">{form.email}</Body>
              {form.phone ? (
                <>
                  <View style={styles.contactDot} />
                  <Ionicons name="call-outline" size={13} color={colors.light.mutedForeground} />
                  <Body muted size="xs">{form.phone}</Body>
                </>
              ) : null}
            </View>

            {/* Chips */}
            <View style={styles.chips}>
              <View style={styles.chip}>
                <Ionicons name="trophy-outline" size={13} color={colors.accent2.ochre} />
                <Label style={styles.chipText}>{tier.name} member</Label>
              </View>
              {defaultAddress ? (
                <View style={styles.chip}>
                  <Ionicons name="location-outline" size={13} color={colors.light.mutedForeground} />
                  <Label style={styles.chipText}>{defaultAddress.city}</Label>
                </View>
              ) : null}
              <View style={styles.chip}>
                <Ionicons name="calendar-outline" size={13} color={colors.light.mutedForeground} />
                <Label style={styles.chipText}>Joined {joinedDate}</Label>
              </View>
              <View style={styles.chip}>
                <Ionicons name="checkmark-circle" size={13} color={colors.olive[500]} />
                <Label style={[styles.chipText, { color: colors.olive[500] }]}>Verified</Label>
              </View>
            </View>

            {/* Loyalty progress */}
            <View style={styles.tierSection}>
              <View style={styles.tierHeader}>
                <Label style={styles.tierLabel}>
                  Loyalty · {tier.name} {tier.next !== Infinity ? `→ ${nextTierName}` : ""}
                </Label>
                <Label style={styles.tierPoints}>
                  {loyalty.state.lifetime_points.toLocaleString()}
                  {tier.next !== Infinity ? ` / ${tier.next.toLocaleString()} pts` : " pts"}
                </Label>
              </View>
              <View style={styles.tierTrack}>
                <View style={[styles.tierFill, { width: `${tier.pct}%` }]} />
                <View style={[styles.tierMilestone, { left: `${tier.pct}%` }]} />
              </View>
              {tier.next !== Infinity ? (
                <Body muted size="xs" style={styles.tierHint}>
                  <Body size="xs" style={{ color: colors.light.primary }}>
                    {(tier.next - loyalty.state.lifetime_points).toLocaleString()} pts
                  </Body>
                  {` to ${nextTierName} · free shipping at 2,000`}
                </Body>
              ) : (
                <Body muted size="xs" style={styles.tierHint}>
                  Platinum benefits unlocked! Free shipping on all orders.
                </Body>
              )}
            </View>

            {/* Action buttons */}
            <View style={styles.heroActions}>
              <Button
                variant={editing ? "outline" : "default"}
                size="sm"
                onPress={() => setEditing(!editing)}
              >
                <Ionicons
                  name={editing ? "close" : "create-outline"}
                  size={14}
                  color={editing ? colors.light.foreground : colors.light.primaryForeground}
                  style={{ marginRight: 6 }}
                />
                {editing ? "Cancel" : "Edit profile"}
              </Button>
              <Button variant="outline" size="sm" onPress={handleShare}>
                <Ionicons name="share-outline" size={14} color={colors.light.foreground} style={{ marginRight: 6 }} />
                Share
              </Button>
            </View>
          </View>
        </View>

        {/* ═══════════ COMPLETENESS ═══════════ */}
        {completeness.pct < 100 && (
          <TouchableOpacity
            style={styles.completenessCard}
            activeOpacity={0.85}
            onPress={handleCompletenessPress}
          >
            <View style={styles.completenessTop}>
              <View>
                <Label style={styles.completenessKicker}>Profile completeness</Label>
                <Display size="lg">{completeness.pct}%</Display>
              </View>
              <View style={styles.completenessAction}>
                <Ionicons name="arrow-forward" size={14} color={colors.olive[950]} />
              </View>
            </View>
            <View style={styles.completenessTrack}>
              <View style={[styles.completenessFill, { width: `${completeness.pct}%` }]} />
            </View>
            <Body muted size="xs" style={styles.completenessHint}>
              {completeness.missing[0]?.label ?? "All set — your profile is complete."}
            </Body>
          </TouchableOpacity>
        )}

        {/* ═══════════ STATS RAIL ═══════════ */}
        <View style={styles.section}>
          <View style={styles.sectionLabelRow}>
            <View style={styles.sectionDot} />
            <Label style={styles.sectionLabel}>At a glance</Label>
          </View>
          <View style={styles.statsGrid}>
            {stats.map((s) => {
              const cfg = STAT_COLORS[s.key as keyof typeof STAT_COLORS];
              return (
                <View key={s.key} style={[styles.statCard, { backgroundColor: cfg.bg }]}>
                  <View style={[styles.statIconWrap, { backgroundColor: cfg.accent + "18" }]}>
                    <Ionicons name={STAT_ICONS[s.key as keyof typeof STAT_ICONS]} size={18} color={cfg.accent} />
                  </View>
                  <Display size="xl">{s.value.toLocaleString()}</Display>
                  <Label style={styles.statLabel}>{s.label}</Label>
                </View>
              );
            })}
          </View>
        </View>

        {/* ═══════════ PERSONAL DETAILS ═══════════ */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={{ flex: 1 }}>
              <View style={styles.cardTitleRow}>
                <Display size="2xl">Personal </Display>
                <Display italic size="2xl" style={{ color: colors.light.primary }}>details</Display>
              </View>
              <Body muted size="xs">Update your information. Visible to stores at checkout.</Body>
            </View>
            <Badge style={{ backgroundColor: editing ? colors.accent2.ochre + "20" : colors.olive[100] }}>
              <Label style={{ color: editing ? colors.accent2.ochre : colors.olive[600], fontSize: 9 }}>
                {editing ? "Editing" : "Read only"}
              </Label>
            </Badge>
          </View>

          <View style={styles.formGrid}>
            <FormField
              label="Full name"
              icon="create-outline"
              value={form.name}
              onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
              editing={editing}
            />
            <FormField
              label="Email"
              icon="mail-outline"
              value={form.email}
              onChangeText={() => {}}
              editing={false}
              keyboardType="email-address"
            />
            <FormField
              label="Phone"
              icon="call-outline"
              value={form.phone}
              onChangeText={(v) => setForm((f) => ({ ...f, phone: v }))}
              editing={editing}
              keyboardType="phone-pad"
            />
            <FormField
              label="Date of birth"
              icon="calendar-outline"
              value={form.dob}
              onChangeText={(v) => setForm((f) => ({ ...f, dob: v }))}
              editing={editing}
              placeholder="YYYY-MM-DD"
            />
            <View style={styles.formFull}>
              <Label style={styles.fieldLabel}>
                <Ionicons name="chatbubble-outline" size={11} color={colors.light.mutedForeground} /> Bio
              </Label>
              <TextInput
                style={[styles.textArea, editing && styles.textAreaEditing]}
                value={form.bio}
                onChangeText={(v) => setForm((f) => ({ ...f, bio: v }))}
                editable={editing}
                multiline
                numberOfLines={3}
                placeholder="Tell us about yourself"
                placeholderTextColor={colors.light.mutedForeground}
              />
            </View>
          </View>

          <View style={styles.cardFooter}>
            {editing ? (
              <View style={styles.unsavedRow}>
                <View style={styles.unsavedDot} />
                <Body size="xs" style={{ color: colors.accent2.ochre }}>Unsaved changes</Body>
              </View>
            ) : (
              <View style={styles.savedRow}>
                <Ionicons name="checkmark-circle" size={13} color={colors.olive[500]} />
                <Body size="xs" style={{ color: colors.olive[500] }}>All changes saved</Body>
              </View>
            )}
            <View style={styles.footerActions}>
              {editing && (
                <Button variant="ghost" size="sm" onPress={() => setEditing(false)}>
                  Cancel
                </Button>
              )}
              <Button
                variant="default"
                size="sm"
                onPress={handleSave}
                disabled={!editing || saving}
                loading={saving}
              >
                Save changes
              </Button>
            </View>
          </View>
        </View>

        {/* ═══════════ RECENTLY VIEWED ═══════════ */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View>
              <View style={styles.cardTitleRow}>
                <Display size="2xl">Recently </Display>
                <Display italic size="2xl" style={{ color: colors.light.primary }}>viewed</Display>
              </View>
              <Body muted size="xs">Continue browsing where you left off.</Body>
            </View>
            <TouchableOpacity onPress={() => router.push("/(main)/products")}>
              <Label style={styles.seeAllLabel}>Shop</Label>
            </TouchableOpacity>
          </View>

          {recentlyViewed.length === 0 ? (
            <View style={styles.emptyMini}>
              <Ionicons name="bag-outline" size={28} color={colors.light.mutedForeground} />
              <Body muted size="xs">No recently viewed items yet.</Body>
            </View>
          ) : (
            <View style={styles.recentGrid}>
              {recentlyViewed.slice(0, 4).map((p) => {
                const img = p.images?.find((i) => i.is_primary)?.url ?? p.images?.[0]?.url;
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={styles.recentItem}
                    onPress={() => router.push(`/(main)/products/${p.slug}` as never)}
                  >
                    {img ? <Avatar uri={img} size={44} style={{ borderRadius: radii.lg }} /> : (
                      <Avatar name={p.name} size={44} style={{ borderRadius: radii.lg }} />
                    )}
                    <Body size="xs" numberOfLines={2} style={styles.recentName}>{p.name}</Body>
                    <Body muted size="xs">{formatPrice(p.price, p.currency)}</Body>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* ═══════════ ACTIVITY TIMELINE ═══════════ */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View>
              <View style={styles.cardTitleRow}>
                <Display size="2xl">Recent </Display>
                <Display italic size="2xl" style={{ color: colors.light.primary }}>activity</Display>
              </View>
              <Body muted size="xs">Your last few moves on the platform.</Body>
            </View>
            <TouchableOpacity onPress={() => router.push("/(main)/account/orders")}>
              <Label style={styles.seeAllLabel}>View all</Label>
            </TouchableOpacity>
          </View>

          <View style={styles.timeline}>
            <View style={styles.timelineLine} />
            {activity.map((a, i) => (
              <View key={i} style={styles.timelineItem}>
                <View style={[styles.timelineDot, { backgroundColor: a.color + "18" }]}>
                  <Ionicons
                    name={ACTIVITY_ICONS[a.icon]}
                    size={14}
                    color={a.color}
                  />
                </View>
                <View style={styles.timelineContent}>
                  <View style={styles.timelineTitleRow}>
                    <Body size="sm" style={{ fontWeight: typography.fontWeights.medium }}>{a.title}</Body>
                    <Body muted size="xs">· {a.time}</Body>
                  </View>
                  <Body muted size="xs">{a.detail}</Body>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* ═══════════ TROPHY CASE ═══════════ */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View>
              <View style={styles.cardTitleRow}>
                <Display size="2xl">Trophy </Display>
                <Display italic size="2xl" style={{ color: colors.light.primary }}>case</Display>
              </View>
              <Body muted size="xs">Badges earned through your activity.</Body>
            </View>
          </View>
          <View style={styles.trophyGrid}>
            {trophies.map((t, i) => (
              <View key={i} style={styles.trophyItem}>
                <View style={[styles.trophyIcon, { backgroundColor: t.tone + "20" }]}>
                  <Ionicons name={t.icon} size={18} color={t.tone} />
                </View>
                <Label style={styles.trophyLabel}>{t.label}</Label>
              </View>
            ))}
          </View>
        </View>

        {/* ═══════════ FOLLOWING FEED ═══════════ */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View>
              <View style={styles.cardTitleRow}>
                <Display size="2xl">Following </Display>
                <Display italic size="2xl" style={{ color: colors.light.primary }}>feed</Display>
              </View>
              <Body muted size="xs">Stores and brands you follow for drops and sales.</Body>
            </View>
          </View>

          {followedStores.length === 0 && followedBrands.length === 0 ? (
            <View style={styles.emptyMini}>
              <Ionicons name="heart-outline" size={28} color={colors.light.mutedForeground} />
              <Body muted size="xs">Not following anyone yet. Visit a store or brand to follow them.</Body>
            </View>
          ) : (
            <View style={styles.followingList}>
              {followedStores.length > 0 && (
                <View style={styles.followingGroup}>
                  <View style={styles.followingHeader}>
                    <Ionicons name="storefront-outline" size={14} color={colors.light.primary} />
                    <Label>Stores ({followedStores.length})</Label>
                  </View>
                  {followedStores.slice(0, 6).map((fs) => (
                    <TouchableOpacity
                      key={fs.id}
                      style={styles.followingRow}
                      onPress={() => router.push("/(main)/products")}
                    >
                      {fs.store.logo_url ? <Avatar uri={fs.store.logo_url} size={38} style={{ borderRadius: radii.lg }} /> : (
                        <Avatar name={fs.store.name} size={38} style={{ borderRadius: radii.lg }} />
                      )}
                      <View style={styles.followingInfo}>
                        <Body size="sm" numberOfLines={1} style={styles.followingName}>{fs.store.name}</Body>
                        <Body muted size="xs">{fs.store.total_products} pieces · {fs.store.total_followers.toLocaleString()} followers</Body>
                      </View>
                      <Ionicons name="arrow-forward-outline" size={14} color={colors.light.mutedForeground} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              {followedBrands.length > 0 && (
                <View style={[styles.followingGroup, followedStores.length > 0 && styles.followingGroupBorder]}>
                  <View style={styles.followingHeader}>
                    <Ionicons name="pricetag-outline" size={14} color={colors.light.primary} />
                    <Label>Brands ({followedBrands.length})</Label>
                  </View>
                  {followedBrands.slice(0, 6).map((fb) => (
                    <TouchableOpacity
                      key={fb.id}
                      style={styles.followingRow}
                      onPress={() => router.push("/(main)/products")}
                    >
                      {fb.brand.logo_url ? <Avatar uri={fb.brand.logo_url} size={38} style={{ borderRadius: radii.lg }} /> : (
                        <Avatar name={fb.brand.name} size={38} style={{ borderRadius: radii.lg }} />
                      )}
                      <View style={styles.followingInfo}>
                        <Body size="sm" numberOfLines={1} style={styles.followingName}>{fb.brand.name}</Body>
                        <Body muted size="xs">{fb.brand.total_products} products · {fb.brand.total_followers.toLocaleString()} followers</Body>
                      </View>
                      <Ionicons name="arrow-forward-outline" size={14} color={colors.light.mutedForeground} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}
        </View>

        {/* ═══════════ WORKSPACE ═══════════ */}
        {portal ? (
          <View style={styles.portalCard}>
            <View style={styles.portalIconWrap}>
              <Ionicons name={portal.icon} size={22} color={colors.light.primaryForeground} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Label style={styles.portalKicker}>{portal.kicker}</Label>
              <Body size="sm" style={[styles.portalLabel, { fontWeight: typography.fontWeights.semibold }]}>{portal.label}</Body>
              <Body size="xs" style={styles.portalDescription}>{portal.description}</Body>
            </View>
            <TouchableOpacity
              style={styles.portalBtn}
              onPress={() => router.push(portal.route as never)}
              activeOpacity={0.85}
            >
              <Label style={styles.portalBtnText}>Open portal</Label>
              <Ionicons name="arrow-forward" size={14} color={colors.olive[950]} />
            </TouchableOpacity>
          </View>
        ) : null}

        {/* ═══════════ QUICK LINKS ═══════════ */}
        <View style={styles.quickLinksHeader}>
          <Display size="2xl">Quick </Display>
          <Display italic size="2xl" style={{ color: colors.light.primary }}>links</Display>
        </View>

        <View style={styles.card}>
          <View style={styles.quickLinks}>
            {QUICK_LINKS.map((l, index) => {
              let hint = "";
              if (l.key === "orders") hint = activeOrders > 0 ? `${activeOrders} active` : "No active";
              else if (l.key === "addresses") hint = addresses.length > 0 ? `${addresses.length} saved` : "None saved";
              else if (l.key === "payments") hint = paymentCount > 0 ? `${paymentCount} saved` : "No cards saved";
              else if (l.key === "returns") hint = "Track refunds";
              else if (l.key === "reviews") hint = `${reviewCount} written`;
              else if (l.key === "notifications") hint = unreadCount > 0 ? `${unreadCount} unread` : "Up to date";
              else if (l.key === "security") hint = "Account protection";
              else hint = l.hint;

              const isLast = index === QUICK_LINKS.length - 1;

              return (
                <React.Fragment key={l.key}>
                  <TouchableOpacity
                    style={styles.quickLink}
                    onPress={() => router.push(l.route as never)}
                    activeOpacity={0.6}
                  >
                    <View style={styles.quickLinkIcon}>
                      <Ionicons name={l.icon} size={18} color={colors.light.primary} />
                    </View>
                    <View style={styles.quickLinkInfo}>
                      <Body size="sm" style={{ fontWeight: typography.fontWeights.medium }}>{l.label}</Body>
                      <Body muted size="xs">{hint}</Body>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.light.mutedForeground} />
                  </TouchableOpacity>
                  {!isLast && <View style={styles.quickLinkDivider} />}
                </React.Fragment>
              );
            })}
          </View>
        </View>

        {/* ═══════════ TIER BENEFITS CARD ═══════════ */}
        <View style={styles.tierPromo}>
          <View style={styles.tierPromoBlob1} />
          <View style={styles.tierPromoBlob2} />
          <Ionicons name="trophy" size={28} color="rgba(255,255,255,0.9)" />
          <Display size="xl" style={styles.tierPromoTitle}>
            {tier.name} Tier Benefits
          </Display>
          <Body size="sm" style={styles.tierPromoDesc}>
            {tier.next !== Infinity
              ? `Earn points on your orders. ${tier.next - loyalty.state.lifetime_points} more to unlock the next level.`
              : "Enjoy unlimited free shipping, premium support, and early access to drops."}
          </Body>
          <TouchableOpacity style={styles.tierPromoBtn} activeOpacity={0.85} onPress={() => router.push("/(main)/account/loyalty" as never)}>
            <Label style={styles.tierPromoBtnText}>See rewards</Label>
            <Ionicons name="arrow-forward" size={14} color={colors.olive[950]} />
          </TouchableOpacity>
        </View>

        {/* ═══════════ SIGN OUT ═══════════ */}
        <TouchableOpacity style={styles.signOutBtn} onPress={signOut} activeOpacity={0.7}>
          <View style={styles.signOutIcon}>
            <Ionicons name="log-out-outline" size={16} color={colors.light.destructive} />
          </View>
          <Body size="sm" style={{ color: colors.light.destructive, fontWeight: typography.fontWeights.medium }}>
            Sign out
          </Body>
        </TouchableOpacity>

        <View style={{ height: spacing[8] }} />
      </ScrollView>
    </PaperBackground>
  );
}

/* ─── Form field component ─── */
function FormField({
  label,
  icon,
  value,
  onChangeText,
  editing,
  keyboardType,
  placeholder,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  onChangeText: (v: string) => void;
  editing: boolean;
  keyboardType?: "default" | "email-address" | "phone-pad";
  placeholder?: string;
}) {
  return (
    <View style={styles.field}>
      <Label style={styles.fieldLabel}>
        <Ionicons name={icon} size={11} color={colors.light.mutedForeground} /> {label}
      </Label>
      <TextInput
        style={[styles.input, editing && styles.inputEditing]}
        value={value}
        onChangeText={onChangeText}
        editable={editing}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor={colors.light.mutedForeground}
      />
    </View>
  );
}

/* ─── Helpers ─── */
function formatRelative(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

/* ═══════════════════════════════════════════ */
/* STYLES                                     */
/* ═══════════════════════════════════════════ */

const styles = StyleSheet.create({
  scroll: {
    paddingTop: spacing[4],
    paddingBottom: spacing[16],
  },

  /* ── Hero Card ── */
  heroCard: {
    marginHorizontal: 20,
    marginBottom: spacing[6],
    borderRadius: radii["3xl"],
    overflow: "hidden",
    backgroundColor: colors.light.card,
    borderWidth: 1,
    borderColor: colors.light.border,
    ...shadows.editorial,
  },
  heroWash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.olive[100],
    opacity: 0.35,
  },
  heroBlob1: {
    position: "absolute",
    top: -40,
    right: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: colors.olive[600],
    opacity: 0.15,
  },
  heroBlob2: {
    position: "absolute",
    bottom: -30,
    left: -30,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.accent2.ochre,
    opacity: 0.15,
  },
  heroContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 36,
    alignItems: "center",
    gap: spacing[2],
  },

  /* Avatar */
  avatarWrap: { position: "relative", marginBottom: spacing[2] },
  avatarRing: {
    ...StyleSheet.absoluteFillObject,
    margin: -4,
    borderRadius: 52,
    borderWidth: 2,
    borderColor: colors.light.primary,
    opacity: 0.6,
  },
  avatarInner: {},
  avatarEditBtn: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.light.foreground,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: colors.light.card,
  },
  vipStamp: {
    position: "absolute",
    top: -8,
    left: -16,
    backgroundColor: colors.accent2.rust,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    transform: [{ rotate: "-6deg" }],
  },
  vipStampText: {
    color: "#fff",
    fontSize: 9,
    fontFamily: fontFamilies.mono.medium,
    letterSpacing: typography.letterSpacing.wide,
  },

  /* Greeting + Name */
  greetingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2,
  },
  greetingLabel: {
    color: colors.light.mutedForeground,
  },
  nameRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
  },
  nameFirst: {},
  nameRest: { color: colors.light.primary },

  /* Contact */
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  contactDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.light.mutedForeground,
    opacity: 0.4,
  },

  /* Chips */
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    marginTop: spacing[2],
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.olive[50],
    borderRadius: radii.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: colors.olive[200],
  },
  chipText: {
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
    fontFamily: fontFamilies.mono.medium,
    letterSpacing: 0,
  },

  /* Loyalty progress */
  tierSection: {
    width: "100%",
    marginTop: spacing[4],
    gap: 6,
  },
  tierHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  tierLabel: {
    color: colors.light.mutedForeground,
    fontSize: typography.fontSizes.xs,
    fontFamily: fontFamilies.mono.medium,
    letterSpacing: 0,
  },
  tierPoints: {
    color: colors.light.mutedForeground,
    fontSize: typography.fontSizes.xs,
    fontFamily: fontFamilies.mono.medium,
  },
  tierTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.olive[100],
    overflow: "visible",
    position: "relative",
  },
  tierFill: {
    position: "absolute",
    top: 0,
    left: 0,
    height: "100%",
    borderRadius: 3,
    backgroundColor: colors.light.primary,
  },
  tierMilestone: {
    position: "absolute",
    top: -3,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.light.card,
    borderWidth: 2,
    borderColor: colors.light.primary,
    marginLeft: -6,
  },
  tierHint: { marginTop: 2 },

  /* Hero actions */
  heroActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: spacing[3],
  },

  /* ── Section label ── */
  section: {
    paddingHorizontal: 20,
    marginBottom: spacing[6],
  },
  sectionLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: spacing[3],
  },
  sectionDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.light.primary,
  },
  sectionLabel: {
    color: colors.light.mutedForeground,
  },

  /* ── Stats grid ── */
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  statCard: {
    width: (SCREEN_WIDTH - 40 - 10) / 2,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.light.border,
    padding: 14,
    gap: 6,
  },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  statLabel: {
    color: colors.light.mutedForeground,
    fontSize: typography.fontSizes.xs,
  },

  /* ── Card (shared) ── */
  card: {
    marginHorizontal: 20,
    marginBottom: spacing[5],
    backgroundColor: colors.light.card,
    borderRadius: radii["2xl"],
    borderWidth: 1,
    borderColor: colors.light.border,
    overflow: "hidden",
    ...shadows.soft,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
    backgroundColor: colors.olive[50] + "40",
  },
  cardTitleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 4,
  },
  seeAllLabel: {
    color: colors.light.primary,
    marginBottom: 4,
  },

  /* ── Form ── */
  formGrid: {
    padding: 20,
    gap: 14,
  },
  field: { gap: 6 },
  fieldLabel: {
    color: colors.light.mutedForeground,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  input: {
    backgroundColor: colors.paper.cream,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: typography.fontSizes.sm,
    color: colors.light.foreground,
    fontFamily: fontFamilies.sans.regular,
  },
  inputEditing: {
    borderColor: colors.light.primary + "50",
  },
  formFull: { gap: 6 },
  textArea: {
    backgroundColor: colors.paper.cream,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: typography.fontSizes.sm,
    color: colors.light.foreground,
    fontFamily: fontFamilies.sans.regular,
    minHeight: 72,
    textAlignVertical: "top",
  },
  textAreaEditing: {
    borderColor: colors.light.primary + "50",
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.light.border,
    backgroundColor: colors.olive[50] + "40",
  },
  unsavedRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  unsavedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent2.ochre,
  },
  savedRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  footerActions: { flexDirection: "row", gap: 8 },

  /* ── Activity timeline ── */
  timeline: {
    padding: 20,
    paddingTop: 16,
    gap: 16,
    position: "relative",
  },
  timelineLine: {
    position: "absolute",
    left: 39,
    top: 32,
    bottom: 32,
    width: 1,
    backgroundColor: colors.light.border,
  },
  timelineItem: {
    flexDirection: "row",
    gap: 14,
  },
  timelineDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  timelineContent: { flex: 1, gap: 2 },
  timelineTitleRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
    flexWrap: "wrap",
  },

  /* ── Recently viewed ── */
  emptyMini: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 24,
  },
  recentGrid: {
    padding: 16,
    paddingTop: 4,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  recentItem: {
    width: "47%",
    gap: 6,
    padding: 10,
    borderRadius: radii.xl,
    backgroundColor: colors.olive[50],
  },
  recentName: {
    minHeight: 28,
  },

  /* ── Following feed ── */
  followingList: { padding: 16, paddingTop: 4 },
  followingGroup: { gap: 8 },
  followingGroupBorder: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.light.border,
  },
  followingHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  followingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
  },
  followingInfo: { flex: 1 },
  followingName: { fontWeight: typography.fontWeights.medium },

  /* ── Role portal ── */
  portalCard: {
    marginHorizontal: 20,
    marginBottom: spacing[5],
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    backgroundColor: colors.olive[800],
    borderRadius: radii["2xl"],
    padding: spacing[4],
    ...shadows.editorial,
  },
  portalIconWrap: {
    width: 44,
    height: 44,
    borderRadius: radii.xl,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  portalKicker: {
    color: colors.olive[200],
    fontSize: 9,
    letterSpacing: typography.letterSpacing.wide,
  },
  portalLabel: {
    color: colors.paper.cream,
  },
  portalDescription: {
    color: "rgba(250, 248, 241, 0.72)",
  },
  portalBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.paper.cream,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.full,
  },
  portalBtnText: {
    color: colors.olive[950],
    fontFamily: fontFamilies.mono.medium,
    fontSize: typography.fontSizes.xs,
  },

  /* ── Quick links ── */
  quickLinksHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    marginHorizontal: 20,
    marginBottom: spacing[2],
    marginTop: spacing[4],
  },
  quickLinks: {
    paddingVertical: spacing[1],
  },
  quickLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  quickLinkIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.lg,
    backgroundColor: colors.olive[50],
    alignItems: "center",
    justifyContent: "center",
  },
  quickLinkInfo: { flex: 1 },
  quickLinkDivider: {
    height: 1,
    backgroundColor: colors.light.border,
    opacity: 0.25,
    marginLeft: 68,
    marginRight: 18,
  },

  /* ── Tier promo ── */
  tierPromo: {
    marginHorizontal: 20,
    marginBottom: spacing[5],
    borderRadius: radii["2xl"],
    backgroundColor: colors.olive[950],
    padding: 24,
    overflow: "hidden",
    gap: spacing[2],
  },
  tierPromoBlob1: {
    position: "absolute",
    top: -30,
    right: -30,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  tierPromoBlob2: {
    position: "absolute",
    bottom: -24,
    left: -24,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(200, 164, 74, 0.2)",
  },
  tierPromoTitle: {
    color: colors.paper.cream,
    marginTop: spacing[2],
  },
  tierPromoDesc: {
    color: "rgba(245, 244, 239, 0.7)",
    marginBottom: spacing[2],
  },
  tierPromoBtn: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.paper.cream,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.full,
    marginTop: spacing[1],
  },
  tierPromoBtnText: {
    color: colors.olive[950],
    fontFamily: fontFamilies.mono.medium,
    fontSize: typography.fontSizes.xs,
    letterSpacing: typography.letterSpacing.editorial,
  },

  /* ── Sign out ── */
  signOutBtn: {
    marginHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.light.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.light.destructive + "30",
    padding: 14,
  },
  signOutIcon: {
    width: 32,
    height: 32,
    borderRadius: radii.lg,
    backgroundColor: colors.light.destructive + "10",
    alignItems: "center",
    justifyContent: "center",
  },

  /* ── Completeness ── */
  completenessCard: {
    marginHorizontal: 20,
    marginBottom: spacing[5],
    backgroundColor: colors.olive[50],
    borderRadius: radii["2xl"],
    borderWidth: 1,
    borderColor: colors.olive[200],
    padding: 18,
    ...shadows.soft,
  },
  completenessTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 10,
  },
  completenessKicker: { color: colors.olive[700] },
  completenessAction: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.olive[200],
  },
  completenessTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.olive[100],
    overflow: "hidden",
    marginBottom: 8,
  },
  completenessFill: {
    height: "100%",
    backgroundColor: colors.olive[700],
    borderRadius: 3,
  },
  completenessHint: { color: colors.olive[700] },

  /* ── Trophy case ── */
  trophyGrid: {
    padding: 16,
    paddingTop: 4,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  trophyItem: {
    width: "31%",
    backgroundColor: colors.olive[50] + "60",
    borderRadius: radii.xl,
    padding: 12,
    alignItems: "center",
    gap: 8,
  },
  trophyIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  trophyLabel: {
    textAlign: "center",
    color: colors.light.foreground,
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    lineHeight: 13,
  },
});
