import React, { useEffect } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@/components/ui/Icon";
import { C } from "@/components/orders/parcel-track";
import { fontFamilies } from "@/lib/theme/fonts";
import { hasPickupAddress } from "@/lib/seller-pickup-address";
import type { Store } from "@/lib/types";

/**
 * Shown over the seller area while a new store waits for admin approval.
 * Explains where the application stands and points the seller at setup
 * they can finish in the meantime (all reachable while still pending).
 */
export function PendingReviewScreen({
  store,
  onOpenSettings,
  onOpenSetup,
  onOpenPickup,
}: {
  store: Store | null;
  onOpenSettings: () => void;
  onOpenSetup: () => void;
  onOpenPickup: () => void;
}) {
  const insets = useSafeAreaInsets();
  const name = store?.name?.trim() || "Your store";
  const initial = name.charAt(0).toUpperCase();

  const submitted = store?.created_at ? formatDate(store.created_at) : null;
  const tasks = [
    {
      key: "branding",
      icon: "image-outline" as const,
      title: "Logo & banner",
      sub: "Make your storefront recognisable",
      done: Boolean(store?.logo_url || store?.banner_url),
      onPress: onOpenSetup,
    },
    {
      key: "about",
      icon: "document-text-outline" as const,
      title: "Store description",
      sub: "Tell shoppers what you sell",
      done: Boolean(store?.description?.trim()),
      onPress: onOpenSetup,
    },
    {
      key: "pickup",
      icon: "location-outline" as const,
      title: "Pickup address",
      sub: "Where couriers collect orders",
      done: hasPickupAddress(store),
      onPress: onOpenPickup,
    },
  ];
  const doneCount = tasks.filter((t) => t.done).length;

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 20, paddingBottom: Math.max(insets.bottom, 16) + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(420)}>
          <View style={styles.chip}>
            <PulseDot />
            <Text style={styles.chipText}>UNDER REVIEW</Text>
          </View>
          <Text style={styles.title} accessibilityRole="header">
            Your store is{"\n"}being reviewed
          </Text>
          <Text style={styles.lead}>
            Our team is checking <Text style={styles.leadStrong}>{name}</Text>. Most stores are approved within 48
            hours — we’ll notify you the moment you can start selling.
          </Text>
        </Animated.View>

        {/* Store preview */}
        <Animated.View entering={FadeInDown.duration(420).delay(80)} style={styles.preview}>
          <View style={styles.previewBanner}>
            {store?.banner_url ? (
              <Image source={{ uri: store.banner_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            ) : (
              <>
                <View style={[styles.blob, { left: -40, top: -50 }]} />
                <View style={[styles.blob, styles.blobGold, { right: -30, bottom: -70 }]} />
              </>
            )}
          </View>
          <View style={styles.previewBody}>
            <View style={styles.previewLogo}>
              {store?.logo_url ? (
                <Image source={{ uri: store.logo_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              ) : (
                <Text style={styles.previewInitial}>{initial}</Text>
              )}
            </View>
            <View style={{ flex: 1, paddingTop: 10 }}>
              <Text style={styles.previewName} numberOfLines={1}>{name}</Text>
              <Text style={styles.previewMeta} numberOfLines={1}>
                {store?.slug ? `@${store.slug}` : "New boutique"}
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Timeline */}
        <Animated.View entering={FadeInDown.duration(420).delay(140)} style={styles.card}>
          <TimelineStep
            state="done"
            title="Application submitted"
            sub={submitted ? `Received ${submitted}` : "We’ve received your details"}
          />
          <TimelineStep state="active" title="Team review" sub="Usually within 48 hours" />
          <TimelineStep state="todo" title="Go live" sub="List products and start taking orders" last />
        </Animated.View>

        {/* While you wait */}
        <Animated.View entering={FadeInDown.duration(420).delay(200)}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>While you wait</Text>
            <Text style={styles.sectionCount}>
              {doneCount}/{tasks.length} done
            </Text>
          </View>
          <View style={styles.taskList}>
            {tasks.map((t, i) => (
              <Pressable
                key={t.key}
                onPress={t.onPress}
                style={({ pressed }) => [styles.task, i > 0 && styles.taskBorder, pressed && { opacity: 0.7 }]}
                accessibilityRole="button"
                accessibilityLabel={`${t.title}${t.done ? ", done" : ""}`}
              >
                <View style={[styles.taskIcon, t.done && styles.taskIconDone]}>
                  <Ionicons name={t.done ? "checkmark" : t.icon} size={17} color={t.done ? C.lime : C.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.taskTitle, t.done && styles.taskTitleDone]}>{t.title}</Text>
                  <Text style={styles.taskSub}>{t.done ? "Done" : t.sub}</Text>
                </View>
                <Ionicons name="chevron-forward" size={17} color={C.faint} />
              </Pressable>
            ))}
          </View>
        </Animated.View>

        <Pressable
          onPress={onOpenSettings}
          style={({ pressed }) => [styles.cta, pressed && { opacity: 0.88, transform: [{ scale: 0.99 }] }]}
          accessibilityRole="button"
        >
          <Ionicons name="settings-outline" size={18} color={C.cream} />
          <Text style={styles.ctaText}>Open store settings</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function TimelineStep({
  state,
  title,
  sub,
  last,
}: {
  state: "done" | "active" | "todo";
  title: string;
  sub: string;
  last?: boolean;
}) {
  return (
    <View style={styles.step}>
      <View style={styles.stepRail}>
        <View
          style={[
            styles.stepDot,
            state === "done" && styles.stepDotDone,
            state === "active" && styles.stepDotActive,
          ]}
        >
          {state === "done" ? <Ionicons name="checkmark" size={12} color={C.lime} /> : null}
          {state === "active" ? <PulseDot size={8} /> : null}
        </View>
        {!last ? <View style={[styles.stepLine, state === "done" && styles.stepLineDone]} /> : null}
      </View>
      <View style={[styles.stepBody, !last && { paddingBottom: 18 }]}>
        <Text style={[styles.stepTitle, state === "todo" && styles.stepTitleTodo]}>{title}</Text>
        <Text style={styles.stepSub}>{sub}</Text>
      </View>
    </View>
  );
}

function PulseDot({ size = 7 }: { size?: number }) {
  const scale = useSharedValue(1);
  useEffect(() => {
    scale.value = withRepeat(withTiming(2.2, { duration: 1300, easing: Easing.out(Easing.quad) }), -1, false);
  }, [scale]);
  const ring = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: 1 - (scale.value - 1) / 1.2,
  }));
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Animated.View
        style={[{ position: "absolute", width: size, height: size, borderRadius: size / 2, backgroundColor: C.gold }, ring]}
      />
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: C.gold }} />
    </View>
  );
}

function formatDate(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-LK", { day: "numeric", month: "short", year: "numeric" });
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.paper },
  content: { paddingHorizontal: 22, gap: 20 },
  chip: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    height: 30,
    borderRadius: 15,
    backgroundColor: C.goldSoft,
  },
  chipText: { fontFamily: fontFamilies.mono.medium, fontSize: 11, letterSpacing: 1.6, color: "#8a6a1f" },
  title: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 34,
    lineHeight: 39,
    letterSpacing: -0.6,
    color: C.text,
    marginTop: 16,
  },
  lead: { fontFamily: fontFamilies.sans.regular, fontSize: 15, lineHeight: 22, color: C.muted, marginTop: 10 },
  leadStrong: { fontFamily: fontFamilies.sans.semibold, color: C.text },
  preview: {
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: C.line,
    overflow: "hidden",
    shadowColor: "#16170f",
    shadowOpacity: 0.07,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  previewBanner: { height: 96, backgroundColor: C.ink, overflow: "hidden" },
  blob: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(200,224,138,0.16)",
  },
  blobGold: { backgroundColor: "rgba(214,182,120,0.22)" },
  previewBody: { flexDirection: "row", gap: 14, paddingHorizontal: 16, paddingBottom: 16 },
  previewLogo: {
    width: 68,
    height: 68,
    marginTop: -30,
    borderRadius: 20,
    borderWidth: 4,
    borderColor: "#FFFFFF",
    backgroundColor: C.glow,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  previewInitial: { fontFamily: fontFamilies.display.semibold, fontSize: 26, color: C.ink },
  previewName: { fontFamily: fontFamilies.display.semibold, fontSize: 20, color: C.text, letterSpacing: -0.3 },
  previewMeta: { fontFamily: fontFamilies.sans.regular, fontSize: 13, color: C.muted, marginTop: 1 },
  card: {
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: C.line,
    padding: 18,
  },
  step: { flexDirection: "row", gap: 14 },
  stepRail: { alignItems: "center", width: 22 },
  stepDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: C.faint,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  stepDotDone: { backgroundColor: C.ink, borderColor: C.ink },
  stepDotActive: { borderColor: C.gold, backgroundColor: C.goldSoft },
  stepLine: { flex: 1, width: 1.5, backgroundColor: "rgba(22,23,15,0.1)", marginVertical: 4 },
  stepLineDone: { backgroundColor: C.ink },
  stepBody: { flex: 1, paddingTop: 1 },
  stepTitle: { fontFamily: fontFamilies.sans.semibold, fontSize: 15, color: C.text },
  stepTitleTodo: { color: C.muted },
  stepSub: { fontFamily: fontFamilies.sans.regular, fontSize: 13, color: C.muted, marginTop: 2 },
  sectionHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 },
  sectionTitle: { fontFamily: fontFamilies.display.semibold, fontSize: 20, color: C.text },
  sectionCount: { fontFamily: fontFamilies.mono.medium, fontSize: 12, color: C.accent },
  taskList: {
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: C.line,
    paddingHorizontal: 14,
  },
  task: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14 },
  taskBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(22,23,15,0.1)" },
  taskIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: C.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  taskIconDone: { backgroundColor: C.ink },
  taskTitle: { fontFamily: fontFamilies.sans.semibold, fontSize: 15, color: C.text },
  taskTitleDone: { color: C.muted },
  taskSub: { fontFamily: fontFamilies.sans.regular, fontSize: 12.5, color: C.muted, marginTop: 1 },
  cta: {
    height: 56,
    borderRadius: 18,
    backgroundColor: C.ink,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  ctaText: { fontFamily: fontFamilies.sans.bold, fontSize: 16, color: C.cream },
});
