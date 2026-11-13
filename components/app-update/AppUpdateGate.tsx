import React from "react";
import { Modal, Platform, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Body, Button, Display, Label } from "@/components/ui";
import { Ionicons } from "@/components/ui/Icon";
import { useAppUpdate } from "@/lib/hooks/useAppUpdate";
import { colors, radii, shadows } from "@/lib/theme/tokens";

const STORE_NAME = Platform.OS === "ios" ? "App Store" : "Play Store";

/**
 * Mounted once in the root layout.
 *  - installed < min_supported → full-screen blocking "Update required"
 *  - installed < latest        → dismissible "Update available" banner
 * `suspended` holds both back while the launch animation is playing.
 */
export function AppUpdateGate({ suspended = false }: { suspended?: boolean }) {
  const { policy, installed, blocked, bannerVisible, hasStoreUrl, dismissBanner, openStore, recheck } =
    useAppUpdate();
  const insets = useSafeAreaInsets();

  if (suspended || !policy) return null;

  if (blocked) {
    return (
      <Modal visible animationType="fade" statusBarTranslucent onRequestClose={() => {}}>
        <View style={[styles.blockRoot, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
          <View style={styles.blockBody} testID="update-required">
            <View style={styles.iconWrap}>
              <Ionicons name="arrow-up-circle-outline" size={44} color={colors.olive[700]} />
            </View>
            <Label style={styles.eyebrow}>Update required</Label>
            <Display size="3xl" style={styles.title}>
              A new version of Vestara is ready
            </Display>
            <Body muted style={styles.copy}>
              {policy.message ||
                "This version is no longer supported. Update to keep shopping, tracking orders and getting your deliveries."}
            </Body>
            <Body size="sm" muted style={styles.versions}>
              Installed v{installed} · Latest v{policy.latest}
            </Body>
          </View>
          <View style={styles.blockActions}>
            {hasStoreUrl ? (
              <Button variant="brand" size="lg" onPress={() => void openStore()} testID="update-now">
                {`Update on the ${STORE_NAME}`}
              </Button>
            ) : (
              <Body size="sm" muted style={styles.copy}>
                Open the {STORE_NAME} and update Vestara to continue.
              </Body>
            )}
            <Button variant="ghost" size="md" onPress={() => void recheck()} testID="update-recheck">
              I've updated — check again
            </Button>
          </View>
        </View>
      </Modal>
    );
  }

  if (!bannerVisible) return null;

  return (
    <View pointerEvents="box-none" style={[styles.bannerWrap, { top: insets.top + 8 }]}>
      <View style={styles.banner} testID="update-banner">
        <Ionicons name="arrow-up-circle" size={22} color={colors.olive[700]} />
        <View style={styles.bannerText}>
          <Label style={styles.bannerTitle}>Update available</Label>
          <Body size="sm" muted numberOfLines={2}>
            {policy.message || `Version ${policy.latest} is out — new features and fixes.`}
          </Body>
        </View>
        {hasStoreUrl ? (
          <Button size="sm" variant="brand" onPress={() => void openStore()} testID="update-banner-cta">
            Update
          </Button>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss update notice"
          hitSlop={12}
          onPress={dismissBanner}
          testID="update-banner-dismiss"
        >
          <Ionicons name="close" size={20} color={colors.ink.mute} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  blockRoot: {
    flex: 1,
    backgroundColor: colors.light.background,
    paddingHorizontal: 28,
    justifyContent: "space-between",
  },
  blockBody: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.olive[100],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  eyebrow: { color: colors.olive[600], textAlign: "center" },
  title: { textAlign: "center" },
  copy: { textAlign: "center", lineHeight: 22 },
  versions: { textAlign: "center", marginTop: 4 },
  blockActions: { gap: 8 },
  bannerWrap: { position: "absolute", left: 12, right: 12, zIndex: 1000, elevation: 20 },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radii.lg,
    backgroundColor: colors.paper.cream,
    borderWidth: 1,
    borderColor: colors.light.border,
    ...shadows.soft,
  },
  bannerText: { flex: 1, gap: 2 },
  bannerTitle: { color: colors.olive[800] },
});
