import React, { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  FadeOutUp,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui";
import { supabase } from "@/lib/supabase/client";
import { FIXED_LOGIN_CODE, FIXED_LOGIN_CODE_ENABLED } from "@/lib/supabase/fixed-login-code";
import { mergeAnonSessionOnLogin } from "@/lib/recommender";
import { applyReferralCodeBackend, verifyPhoneOtpBackend } from "@/lib/api/backend";
import { acceptDriverInvite, hasStoreApi } from "@/lib/api/delivery-company-api";
import { fontFamilies } from "@/lib/theme/fonts";
import { colors } from "@/lib/theme/tokens";
import { C } from "@/components/orders/parcel-track";
import { OtpCodeInput, type OtpCodeInputHandle, type OtpStatus } from "@/components/auth/OtpCodeInput";
import { holdAuthRedirect, releaseAuthRedirect } from "@/lib/auth-redirect-hold";

/**
 * "Let's verify your number" as a bottom sheet over the sign-in / sign-up
 * screen. Owns the whole OTP step: verify (auto, on the last digit), resend,
 * and the post-signup referral / rider-invite extras. On success it holds
 * the root auth redirect until the "Verified" animation has played.
 */

const CODE_LENGTH = 6;
/** Keep the verifying shimmer up long enough to read, even on a fast reply. */
const MIN_VERIFYING_MS = 900;
/** How long "Verified successfully" holds before the app moves on. */
const SUCCESS_HOLD_MS = 1900;
const OFFSCREEN = 900;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, Math.max(0, ms)));

type Notice = { kind: "error" | "info"; text: string } | null;

export function VerifyOtpSheet({
  visible,
  onClose,
  phone = "",
  email = "",
  referral,
  invite,
}: {
  visible: boolean;
  onClose: () => void;
  phone?: string;
  email?: string;
  referral?: string;
  invite?: string;
}) {
  const insets = useSafeAreaInsets();
  const { toast } = useToast();
  const [mounted, setMounted] = useState(visible);

  const [code, setCode] = useState("");
  const [status, setStatus] = useState<OtpStatus>("idle");
  const [notice, setNotice] = useState<Notice>(null);
  const [timer, setTimer] = useState(30);
  const [resending, setResending] = useState(false);
  const inputRef = useRef<OtpCodeInputHandle>(null);
  const verifyingRef = useRef(false);

  const y = useSharedValue(OFFSCREEN);
  const dim = useSharedValue(0);

  // Mount + slide up when opened; reset the step for each new open.
  useEffect(() => {
    if (!visible) {
      // Closed from outside: slide away, then unmount.
      if (!mounted) return;
      dim.value = withTiming(0, { duration: 260 });
      y.value = withTiming(OFFSCREEN, { duration: 300, easing: Easing.in(Easing.cubic) }, (done) => {
        if (done) runOnJS(setMounted)(false);
      });
      return;
    }
    setMounted(true);
    setCode("");
    setStatus("idle");
    setNotice(null);
    setTimer(30);
    verifyingRef.current = false;
    y.value = OFFSCREEN;
    y.value = withSpring(0, { damping: 22, stiffness: 190, mass: 0.9 });
    dim.value = withTiming(1, { duration: 320 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    if (!mounted || timer <= 0) return;
    const t = setTimeout(() => setTimer((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [timer, mounted]);

  // Never leave the root redirect held if the sheet goes away mid-animation.
  useEffect(() => () => releaseAuthRedirect(), []);

  const locked = status === "verifying" || status === "success";

  const finishClose = () => {
    setMounted(false);
    onClose();
  };
  const requestClose = () => {
    if (locked) return;
    inputRef.current?.blur();
    dim.value = withTiming(0, { duration: 260 });
    y.value = withTiming(OFFSCREEN, { duration: 300, easing: Easing.in(Easing.cubic) }, (done) => {
      if (done) runOnJS(finishClose)();
    });
  };

  // Drag the sheet down to dismiss it.
  const drag = Gesture.Pan()
    .enabled(!locked)
    .activeOffsetY(8)
    .onUpdate((e) => {
      y.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (e.translationY > 130 || e.velocityY > 900) {
        runOnJS(requestClose)();
      } else {
        y.value = withSpring(0, { damping: 20, stiffness: 220 });
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  const dimStyle = useAnimatedStyle(() => ({ opacity: dim.value * Math.max(0, 1 - y.value / 600) }));

  // The code auto-verifies the moment the last digit lands.
  const handleChange = (next: string) => {
    if (verifyingRef.current) return;
    if (status === "error") setStatus("idle");
    setNotice(null);
    setCode(next);
    if (next.length === CODE_LENGTH) void handleVerify(next);
  };

  const handleVerify = async (token: string) => {
    if (verifyingRef.current) return;
    verifyingRef.current = true;
    setStatus("verifying");
    const startedAt = Date.now();
    // Signing in flips the root layout straight to the app — hold that until
    // the "Verified" moment has played.
    holdAuthRedirect();

    let error;
    if (phone) {
      // Fixed login code (backend flag): exchange a magic-link token instead.
      const fixed = await verifyPhoneOtpBackend(phone, token);
      const { error: err } = fixed.ok
        ? await supabase.auth.verifyOtp({ token_hash: fixed.data.token_hash, type: "magiclink" })
        : await supabase.auth.verifyOtp({ phone, token, type: "sms" });
      error = err;
    } else {
      const { error: err } = await supabase.auth.verifyOtp({ email, token, type: "email" });
      error = err;
    }

    if (error) {
      releaseAuthRedirect();
      await sleep(MIN_VERIFYING_MS - (Date.now() - startedAt));
      setStatus("error");
      setNotice({ kind: "error", text: error.message || "That code didn’t match — try again" });
      await sleep(900);
      setCode("");
      setStatus("idle");
      verifyingRef.current = false;
      inputRef.current?.focus();
      return;
    }

    await sleep(MIN_VERIFYING_MS - (Date.now() - startedAt));
    setStatus("success");
    inputRef.current?.blur();
    const successShownAt = Date.now();
    try {
      await mergeAnonSessionOnLogin();
    } catch {
      // ignore
    }
    // Post-signup extras captured on the register screen (best-effort).
    try {
      if (referral && (await hasStoreApi())) await applyReferralCodeBackend(referral);
      if (invite && (await hasStoreApi())) {
        const accept = await acceptDriverInvite(invite);
        if (accept.ok) await supabase.auth.refreshSession();
        else toast(`Invite could not be redeemed: ${accept.error}`, "error");
      }
    } catch {
      // non-blocking
    }
    // Releasing the hold lets the auth listener in _layout.tsx redirect.
    await sleep(SUCCESS_HOLD_MS - (Date.now() - successShownAt));
    releaseAuthRedirect();
  };

  const handleResend = async () => {
    if (FIXED_LOGIN_CODE_ENABLED && phone) {
      setTimer(30);
      setCode("");
      inputRef.current?.focus();
      setNotice({ kind: "info", text: `Use the test code ${FIXED_LOGIN_CODE}` });
      return;
    }

    setResending(true);
    const { error } = phone
      ? await supabase.auth.signInWithOtp({ phone })
      : await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: "luxe://auth/callback" } });
    setResending(false);

    if (error) {
      setNotice({ kind: "error", text: error.message });
    } else {
      setTimer(30);
      setCode("");
      inputRef.current?.focus();
      setNotice({ kind: "info", text: "New code sent" });
    }
  };

  const target = email || formatPhone(phone) || "your contact details";
  const verified = status === "success";

  if (!mounted) return null;

  return (
    <Modal visible transparent statusBarTranslucent animationType="none" onRequestClose={requestClose}>
      <GestureHandlerRootView style={styles.fill}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.dim, dimStyle]}>
          <Pressable style={styles.fill} onPress={requestClose} accessibilityLabel="Close verification" />
        </Animated.View>

        <KeyboardAvoidingView
          style={styles.dock}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          pointerEvents="box-none"
        >
          <GestureDetector gesture={drag}>
            <Animated.View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 14) + 10 }, sheetStyle]}>
              <View style={styles.grabber} />

              <View style={styles.header}>
                {verified ? (
                  <Animated.View key="done" exiting={FadeOut.duration(200)} style={styles.headerInner}>
                    <Animated.View entering={FadeIn.duration(400).delay(900)} style={[styles.kicker, styles.kickerDone]}>
                      <View style={[styles.kickerDot, styles.kickerDotDone]} />
                      <Text style={[styles.kickerText, styles.kickerTextDone]}>ACCOUNT VERIFIED</Text>
                    </Animated.View>
                    <StaggerTitle words={["Verified"]} accent="successfully" baseDelay={1000} />
                    <Animated.View entering={FadeInDown.duration(600).delay(1250)} style={styles.signingRow}>
                      <Text style={styles.subtitle}>Signing you in to LUXE</Text>
                      <Dots />
                    </Animated.View>
                  </Animated.View>
                ) : (
                  <Animated.View
                    key="ask"
                    entering={FadeIn.duration(300)}
                    exiting={FadeOutUp.duration(260)}
                    style={styles.headerInner}
                  >
                    <View style={styles.kicker}>
                      <View style={styles.kickerDot} />
                      <Text style={styles.kickerText}>{phone ? "PHONE VERIFICATION" : "EMAIL VERIFICATION"}</Text>
                    </View>
                    <StaggerTitle words={["Let’s", "verify", "your"]} accent={phone ? "number" : "email"} baseDelay={120} />
                    <Animated.Text entering={FadeInDown.duration(600).delay(380)} style={styles.subtitle}>
                      We’ve sent a {CODE_LENGTH}-digit code to <Text style={styles.strong}>{target}</Text>
                      {"\n"}It’ll verify on its own once entered.
                    </Animated.Text>
                  </Animated.View>
                )}
              </View>

              <View style={styles.codeWrap}>
                <OtpCodeInput
                  ref={inputRef}
                  value={code}
                  onChange={handleChange}
                  length={CODE_LENGTH}
                  status={status}
                  autoFocus
                />
              </View>

              <View style={styles.statusSlot}>
                {status === "verifying" ? (
                  <Animated.Text key="v" entering={FadeIn.duration(250)} exiting={FadeOut.duration(200)} style={styles.statusText}>
                    VERIFYING…
                  </Animated.Text>
                ) : notice && !verified ? (
                  <Animated.Text
                    key={notice.text}
                    entering={FadeIn.duration(220)}
                    exiting={FadeOut.duration(180)}
                    style={notice.kind === "error" ? styles.statusError : styles.statusInfo}
                    numberOfLines={2}
                  >
                    {notice.text}
                  </Animated.Text>
                ) : null}
              </View>

              <View style={[styles.resend, verified && styles.hidden]}>
                <Text style={styles.resendPrompt}>Didn’t receive the code? </Text>
                {timer > 0 ? (
                  <Text style={styles.resendTimer}>Resend in 0:{String(timer).padStart(2, "0")}</Text>
                ) : (
                  <Pressable
                    onPress={handleResend}
                    disabled={resending || locked}
                    hitSlop={8}
                    accessibilityRole="button"
                  >
                    <Text style={styles.resendAction}>{resending ? "Sending…" : "Resend"}</Text>
                  </Pressable>
                )}
              </View>
            </Animated.View>
          </GestureDetector>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}

/** "+94771234567" → "+94 77 123 4567" for display. */
function formatPhone(e164: string): string {
  const m = /^\+94(\d{2})(\d{3})(\d{4})$/.exec(e164);
  return m ? `+94 ${m[1]} ${m[2]} ${m[3]}` : e164;
}

/** Fraunces heading whose words rise in one after another; the last word is an olive italic accent. */
function StaggerTitle({ words, accent, baseDelay }: { words: string[]; accent: string; baseDelay: number }) {
  const all = [...words, accent];
  return (
    <View style={styles.titleRow} accessibilityRole="header" accessible accessibilityLabel={all.join(" ")}>
      {all.map((w, i) => (
        <Animated.Text
          key={`${w}-${i}`}
          entering={FadeInDown.duration(650).delay(baseDelay + i * 70)}
          style={[styles.title, i === all.length - 1 && styles.titleAccent]}
        >
          {w}
        </Animated.Text>
      ))}
    </View>
  );
}

/** Three dots that breathe in sequence — "signing you in…". */
function Dots() {
  return (
    <View style={styles.dots}>
      {[0, 1, 2].map((i) => (
        <Dot key={i} delay={i * 160} />
      ))}
    </View>
  );
}

function Dot({ delay }: { delay: number }) {
  const o = useSharedValue(0.25);
  useEffect(() => {
    o.value = withDelay(delay, withRepeat(withSequence(withTiming(1, { duration: 360 }), withTiming(0.25, { duration: 460 })), -1, false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const style = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ translateY: -2 * (o.value - 0.25) }] }));
  return <Animated.View style={[styles.dot, style]} />;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  dim: { backgroundColor: "rgba(22,23,15,0.42)" },
  dock: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    backgroundColor: C.paper,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 22,
    paddingTop: 10,
    shadowColor: "#16170f",
    shadowOpacity: 0.18,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: -8 },
    elevation: 24,
    overflow: "visible",
  },
  grabber: {
    alignSelf: "center",
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(22,23,15,0.14)",
  },
  header: { minHeight: 148, justifyContent: "flex-end", marginTop: 14 },
  headerInner: { alignItems: "center" },
  kicker: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.olive[50],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(83,94,44,0.25)",
    marginBottom: 14,
  },
  kickerDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.olive[600] },
  kickerText: { fontFamily: fontFamilies.mono.medium, fontSize: 10, letterSpacing: 1.8, color: colors.olive[700] },
  titleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    columnGap: 8,
  },
  title: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 31,
    lineHeight: 38,
    letterSpacing: -0.8,
    color: C.text,
  },
  titleAccent: {
    fontFamily: fontFamilies.display.italic,
    color: colors.olive[600],
  },
  signingRow: { flexDirection: "row", alignItems: "flex-end" },
  dots: { flexDirection: "row", gap: 3, marginLeft: 4, marginBottom: 6 },
  dot: { width: 3.5, height: 3.5, borderRadius: 2, backgroundColor: colors.olive[600] },
  kickerDone: { backgroundColor: colors.olive[600], borderColor: colors.olive[700] },
  kickerDotDone: { backgroundColor: colors.paper.cream },
  kickerTextDone: { color: colors.paper.cream },
  subtitle: {
    marginTop: 10,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 14,
    lineHeight: 21,
    color: C.muted,
    textAlign: "center",
  },
  strong: { fontFamily: fontFamilies.sans.semibold, color: C.text, letterSpacing: 0.2 },
  codeWrap: { marginTop: 30 },
  statusSlot: { height: 44, alignItems: "center", justifyContent: "center", marginTop: 10, paddingHorizontal: 12 },
  statusText: { fontFamily: fontFamilies.mono.regular, fontSize: 11, letterSpacing: 2, color: C.muted },
  statusError: { fontFamily: fontFamilies.sans.medium, fontSize: 13.5, color: colors.accent2.rust, textAlign: "center" },
  statusInfo: { fontFamily: fontFamilies.sans.medium, fontSize: 13.5, color: colors.olive[700], textAlign: "center" },
  resend: { flexDirection: "row", justifyContent: "center", alignItems: "center", paddingVertical: 8 },
  hidden: { opacity: 0 },
  resendPrompt: { fontFamily: fontFamilies.sans.regular, fontSize: 14, color: C.text },
  resendTimer: { fontFamily: fontFamilies.sans.semibold, fontSize: 14, color: C.muted },
  resendAction: { fontFamily: fontFamilies.sans.bold, fontSize: 14, color: colors.olive[600] },
});
