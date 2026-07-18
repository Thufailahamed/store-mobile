import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Switch,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@/components/ui/Icon";
import { useAuth } from "@/lib/supabase/auth";
import { useTheme } from "@/lib/theme/provider";
import { Button, useToast } from "@/components/ui";
import { typography, radii } from "@/lib/theme/tokens";
import { getDriverSelf, updateDriverSelf, type ProfilePatch } from "@/lib/api/driver-profile";
import type { DriverProfile, DriverType } from "@/lib/types";

const DRIVER_TYPES: { value: DriverType; label: string; sub: string }[] = [
  { value: "pickup", label: "Pickup", sub: "Collect packages from sellers" },
  { value: "last_mile", label: "Last mile", sub: "Deliver to customers" },
  { value: "both", label: "Both", sub: "Pickup + delivery" },
];

export default function DriverProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { signOut } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [capacity, setCapacity] = useState(10);
  const [driverType, setDriverType] = useState<DriverType>("both");
  const [active, setActive] = useState(true);

  const load = useCallback(async () => {
    const res = await getDriverSelf();
    if (res.ok) {
      setProfile(res.data);
      setCapacity(res.data.capacity_max);
      setDriverType(res.data.driver_type);
      setActive(res.data.is_active);
    } else {
      toast(res.error, "error");
    }
    setLoading(false);
    setRefreshing(false);
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (patch: ProfilePatch) => {
    setSaving(true);
    const res = await updateDriverSelf(patch);
    setSaving(false);
    if (res.ok) {
      toast("Profile updated", "success");
      load();
    } else {
      toast(res.error, "error");
    }
  };

  const onToggleActive = (next: boolean) => {
    setActive(next);
    save({ is_active: next });
  };

  const onChangeType = (next: DriverType) => {
    if (next === driverType) return;
    setDriverType(next);
    save({ driver_type: next });
  };

  const onChangeCapacity = (delta: number) => {
    const next = Math.max(0, Math.min(50, capacity + delta));
    setCapacity(next);
    save({ capacity_max: next });
  };

  const confirmSignOut = () => {
    Alert.alert("Sign out?", "You will stop receiving deliveries until you sign back in.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          await signOut();
        },
      },
    ]);
  };

  if (loading) {
    const styles = makeStyles(colors, isDark);
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!profile) {
    const styles = makeStyles(colors, isDark);
    return (
      <View style={[styles.center, { backgroundColor: colors.background, paddingHorizontal: 24 }]}>
        <Ionicons name="person-circle-outline" size={56} color={colors.mutedForeground} />
        <Text style={[styles.muted, { marginTop: 12, textAlign: "center" }]}>
          Could not load your driver profile. Make sure your account is linked to a delivery
          company.
        </Text>
        <Button onPress={load} variant="brand" style={{ marginTop: 16 }}>
          Retry
        </Button>
      </View>
    );
  }

  const styles = makeStyles(colors, isDark);

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />
      }
    >
      {/* Identity card */}
      <View style={styles.card}>
        <View style={styles.avatarRow}>
          <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
            <Text style={styles.avatarText}>{(profile.full_name ?? "D").slice(0, 1).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{profile.full_name ?? "Driver"}</Text>
            <Text style={styles.muted}>{profile.email}</Text>
            {profile.phone ? <Text style={styles.muted}>{profile.phone}</Text> : null}
          </View>
        </View>
        {profile.company ? (
          <View style={[styles.companyChip, { backgroundColor: colors.accent }]}>
            <Ionicons name="business-outline" size={14} color={colors.foreground} />
            <Text style={styles.companyText}>{profile.company.name}</Text>
          </View>
        ) : null}
      </View>

      {/* Active toggle */}
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={styles.rowTitle}>Accept deliveries</Text>
            <Text style={styles.muted}>
              {active ? "You will receive new assignments" : "You will not receive new assignments"}
            </Text>
          </View>
          <Switch
            value={active}
            onValueChange={onToggleActive}
            trackColor={{ true: colors.primary, false: colors.muted }}
            disabled={saving}
          />
        </View>
      </View>

      {/* Driver type */}
      <Text style={styles.sectionHeader}>Driver type</Text>
      <View style={styles.card}>
        {DRIVER_TYPES.map((opt, i) => {
          const selected = driverType === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.optionRow,
                i < DRIVER_TYPES.length - 1 && {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: colors.border,
                },
              ]}
              onPress={() => onChangeType(opt.value)}
              disabled={saving}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{opt.label}</Text>
                <Text style={styles.muted}>{opt.sub}</Text>
              </View>
              {selected ? <Ionicons name="checkmark-circle" size={22} color={colors.primary} /> : null}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Capacity */}
      <Text style={styles.sectionHeader}>Daily capacity</Text>
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>Max stops per shift</Text>
            <Text style={styles.muted}>
              {capacity === 0 ? "No new assignments" : `Up to ${capacity} deliveries`}
            </Text>
          </View>
          <View style={styles.stepper}>
            <TouchableOpacity
              style={styles.stepBtn}
              onPress={() => onChangeCapacity(-1)}
              disabled={saving || capacity <= 0}
            >
              <Ionicons name="remove" size={16} color={colors.foreground} />
            </TouchableOpacity>
            <Text style={styles.stepValue}>{capacity}</Text>
            <TouchableOpacity
              style={styles.stepBtn}
              onPress={() => onChangeCapacity(1)}
              disabled={saving || capacity >= 50}
            >
              <Ionicons name="add" size={16} color={colors.foreground} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Read-only info */}
      <Text style={styles.sectionHeader}>Account</Text>
      <View style={styles.card}>
        <InfoRow icon="home-outline" label="Home warehouse" value={profile.home_warehouse?.name ?? "Not assigned"} />
        <Divider />
        <InfoRow icon="car-outline" label="Vehicle" value={profile.vehicle_type ?? "Not set"} />
        <Divider />
        <InfoRow
          icon="location-outline"
          label="Last known location"
          value={
            profile.last_known_lat && profile.last_known_lng
              ? `${profile.last_known_lat.toFixed(4)}, ${profile.last_known_lng.toFixed(4)}`
              : "No ping yet"
          }
        />
      </View>

      <Button
        onPress={confirmSignOut}
        variant="ghost"
        style={{ marginTop: 20 }}
      >
        <Text style={{ color: colors.destructive, fontWeight: typography.fontWeights.semibold as any }}>
          Sign out
        </Text>
      </Button>

      <Text style={styles.legal}>
        Member since {profile.joined_at ? new Date(profile.joined_at).toLocaleDateString("en-LK") : "—"}
      </Text>
      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

function InfoRow({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 12, gap: 12 }}>
      <Ionicons name={icon} size={18} color={colors.mutedForeground} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: typography.fontSizes.xs, color: colors.mutedForeground }}>{label}</Text>
        <Text style={{ fontSize: typography.fontSizes.sm, color: colors.foreground, marginTop: 2 }}>{value}</Text>
      </View>
    </View>
  );
}

function Divider() {
  const { colors } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border }} />;
}

function makeStyles(colors: ReturnType<typeof useTheme>["colors"], isDark: boolean) {
  return StyleSheet.create({
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    content: { paddingHorizontal: 16, paddingBottom: 24 },
    card: {
      backgroundColor: colors.card,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      marginBottom: 12,
    },
    avatarRow: { flexDirection: "row", alignItems: "center", gap: 14 },
    avatar: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: {
      fontSize: typography.fontSizes["2xl"],
      fontWeight: typography.fontWeights.bold as any,
      color: colors.foreground,
      fontFamily: "monospace",
    },
    name: {
      fontSize: typography.fontSizes.lg,
      fontWeight: typography.fontWeights.bold as any,
      color: colors.foreground,
    },
    muted: { fontSize: typography.fontSizes.xs, color: colors.mutedForeground, marginTop: 2 },
    companyChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: radii.full,
      alignSelf: "flex-start",
      marginTop: 12,
    },
    companyText: {
      fontSize: typography.fontSizes.xs,
      fontWeight: typography.fontWeights.semibold as any,
      color: colors.foreground,
    },
    sectionHeader: {
      fontSize: typography.fontSizes.xs,
      fontWeight: typography.fontWeights.semibold as any,
      color: colors.mutedForeground,
      textTransform: "uppercase",
      letterSpacing: 1,
      marginTop: 8,
      marginBottom: 8,
      marginLeft: 4,
    },
    rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    rowTitle: {
      fontSize: typography.fontSizes.base,
      fontWeight: typography.fontWeights.semibold as any,
      color: colors.foreground,
    },
    optionRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 14,
      gap: 12,
    },
    stepper: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
    },
    stepBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    stepValue: {
      fontSize: typography.fontSizes.lg,
      fontWeight: typography.fontWeights.bold as any,
      color: colors.foreground,
      minWidth: 28,
      textAlign: "center",
      fontFamily: "monospace",
    },
    legal: {
      fontSize: typography.fontSizes.xs,
      color: colors.mutedForeground,
      textAlign: "center",
      marginTop: 16,
    },
  });
}
