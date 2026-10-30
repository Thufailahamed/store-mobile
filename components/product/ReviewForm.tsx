import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  Animated,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Modal } from "@/components/ui/Modal";
import { Ionicons } from "@/components/ui/Icon";
import { useAuth } from "@/lib/supabase/auth";
import { pickImage, uploadReviewPhoto } from "@/lib/upload";
import { useToast } from "@/components/ui";
import { colors, typography, radii } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { getEligibleReviewOrders } from "@/lib/api";
import type { EligibleReviewOrder } from "@/lib/types";
import { friendlyReviewError, formatReviewDate } from "@/lib/review-error";
import { addReviewBackend } from "@/lib/api/backend";

interface ReviewFormProps {
  visible: boolean;
  onClose: () => void;
  productId: string;
  productName: string;
  /** Optional hero thumbnail + eyebrow shown in the product card. */
  productImage?: string | null;
  brandName?: string | null;
  onSubmitted?: () => void;
}

const RATING_WORDS = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];
const RATING_HINTS = [
  "Tap a star to rate",
  "Not for me",
  "Could be better",
  "Does the job",
  "Really liked it",
  "Absolutely love it",
];
const STAR_GOLD = colors.accent2.ochre;
const MAX_PHOTOS = 5;

/** A single star that springs when tapped. */
function Star({ filled, onPress, index }: { filled: boolean; onPress: () => void; index: number }) {
  const scale = useRef(new Animated.Value(1)).current;
  const bounce = () => {
    scale.setValue(0.7);
    Animated.spring(scale, { toValue: 1, friction: 3, tension: 220, useNativeDriver: true }).start();
  };
  return (
    <Pressable
      onPress={() => { bounce(); onPress(); }}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={`Rate ${index} star${index > 1 ? "s" : ""}`}
      style={s.starBtn}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <Ionicons
          name={filled ? "star" : "star-outline"}
          size={40}
          color={filled ? STAR_GOLD : colors.light.border}
        />
      </Animated.View>
    </Pressable>
  );
}

const TITLE_MIN = 4;
const TITLE_MAX = 120;
const CONTENT_MIN = 20;
const CONTENT_MAX = 1000;

export function ReviewForm({
  visible,
  onClose,
  productId,
  productName,
  productImage,
  brandName,
  onSubmitted,
}: ReviewFormProps) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [focused, setFocused] = useState<"title" | "content" | null>(null);
  const { toast } = useToast();
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [eligible, setEligible] = useState<EligibleReviewOrder[]>([]);
  const [eligibleLoading, setEligibleLoading] = useState(false);
  const [selectedOrderItemId, setSelectedOrderItemId] = useState<string | null>(null);

  // Tracks whether the component is still mounted. setState after unmount
  // warns in dev and is wasted work in prod. Set false in the cleanup.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Fetch eligible orders whenever the modal opens for a logged-in user.
  useEffect(() => {
    let cancelled = false;
    if (!visible || !user) {
      setEligible([]);
      setSelectedOrderItemId(null);
      return;
    }
    (async () => {
      setEligibleLoading(true);
      const res = await getEligibleReviewOrders(productId);
      if (cancelled || !mountedRef.current) return;
      setEligibleLoading(false);
      if (res.ok) {
        setEligible(res.data);
        // Default-select the most recent eligible order (already sorted desc).
        setSelectedOrderItemId(res.data[0]?.order_item_id ?? null);
      } else {
        setEligible([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, user, productId]);

  const handleAddPhoto = async () => {
    if (photos.length >= MAX_PHOTOS) {
      toast(`Maximum ${MAX_PHOTOS} photos per review`, "error");
      return;
    }
    const result = await pickImage({ aspect: [1, 1], quality: 0.7 });
    if (result && !result.canceled && result.assets[0]) {
      setPhotos((prev) => [...prev, result.assets[0].uri]);
    }
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      toast("Please select a star rating", "error");
      return;
    }
    if (title.trim().length > 0 && title.trim().length < TITLE_MIN) {
      toast(`Title must be at least ${TITLE_MIN} characters`, "error");
      return;
    }
    if (content.trim().length < CONTENT_MIN) {
      toast(`Review must be at least ${CONTENT_MIN} characters`, "error");
      return;
    }
    if (!user) return;

    setSubmitting(true);

    // Step 1: create review first so photo uploads use the real review id
    // (avoids orphan files under a temp id).
    const res = await addReviewBackend({
      product_id: productId,
      order_item_id: selectedOrderItemId,
      rating,
      title: title.trim() || undefined,
      content: content.trim(),
      photos: [],
    });

    if (!mountedRef.current) return;
    if (!res.ok) {
      setSubmitting(false);
      toast(friendlyReviewError(res.error || "Failed to submit review"), "error");
      return;
    }

    const reviewId = (res.data as { review?: { id?: string }; id?: string })?.review?.id
      ?? (res.data as { id?: string })?.id
      ?? null;

    // Step 2: upload photos against the real review id, then PATCH.
    if (reviewId && photos.length > 0) {
      const uploads = await Promise.all(
        photos.map((uri, i) => uploadReviewPhoto(user.id, reviewId, uri, { index: i })),
      );
      const uploadedUrls = uploads.filter((u) => u.url).map((u) => u.url);
      const failed = photos.length - uploadedUrls.length;
      if (uploadedUrls.length > 0) {
        const { supabase: sb } = await import("@/lib/supabase/client").catch(() => ({ supabase: null as never }));
        if (sb) {
          await sb.from("reviews").update({ photos: uploadedUrls }).eq("id", reviewId);
        }
      }
      if (failed > 0) {
        toast(`${failed} photo(s) failed to upload — review posted without them`, "error");
      } else {
        toast(
          selectedOrderItemId
            ? "Your verified review is live"
            : "Your review is live",
          "success"
        );
        resetForm();
        onClose();
        onSubmitted?.();
        return;
      }
    }
    setSubmitting(false);
    {
      toast(
        selectedOrderItemId
          ? "Your verified review is live"
          : "Your review is live",
        "success"
      );
      resetForm();
      onClose();
      onSubmitted?.();
    }
  };

  const resetForm = () => {
    setRating(0);
    setTitle("");
    setContent("");
    setPhotos([]);
    setSelectedOrderItemId(null);
  };

  /**
   * Single dismiss handler. Called from Cancel button AND from modal's
   * onRequestClose (back button / swipe-down). Always resets state so
   * the next open starts fresh.
   */
  const dismiss = () => {
    if (submitting) return; // don't drop the user mid-submit
    resetForm();
    onClose();
  };

  const showOrderPicker = !!user && (eligible.length > 0 || eligibleLoading);
  const willBeVerified = !!selectedOrderItemId;
  const contentLen = content.trim().length;
  const contentRemaining = Math.max(0, CONTENT_MIN - contentLen);
  const canPost = rating > 0 && contentRemaining === 0 && !submitting;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={dismiss}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={s.container}>
          {/* Header */}
          <View style={s.header}>
            <TouchableOpacity onPress={dismiss} hitSlop={10} style={s.headerSide}>
              <Text style={s.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <View style={s.headerCenter}>
              <Text style={s.headerEyebrow}>YOUR REVIEW</Text>
              <Text style={s.headerTitle}>Share your thoughts</Text>
            </View>
            <View style={s.headerSide} />
          </View>

          <ScrollView
            contentContainerStyle={s.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Product card */}
            <View style={s.productCard}>
              {productImage ? (
                <Image source={{ uri: productImage }} style={s.productImage} />
              ) : (
                <View style={[s.productImage, s.productImageFallback]}>
                  <Text style={s.productMonogram}>{productName.charAt(0).toUpperCase()}</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                {!!brandName && <Text style={s.productBrand} numberOfLines={1}>{brandName.toUpperCase()}</Text>}
                <Text style={s.productName} numberOfLines={2}>{productName}</Text>
                {willBeVerified && (
                  <View style={s.verifiedChip}>
                    <Ionicons name="shield-checkmark" size={12} color={colors.olive[700]} />
                    <Text style={s.verifiedChipText}>Verified purchase</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Star rating */}
            <View style={s.ratingCard}>
              <Text style={s.ratingQuestion}>How would you rate it?</Text>
              <View style={s.starsRow}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star key={star} index={star} filled={star <= rating} onPress={() => setRating(star)} />
                ))}
              </View>
              <Text style={[s.ratingWord, rating === 0 && s.ratingWordIdle]}>
                {rating > 0 ? RATING_WORDS[rating] : " "}
              </Text>
              <Text style={s.ratingHint}>{RATING_HINTS[rating]}</Text>
            </View>

            {/* Order picker — only when logged in & eligible rows exist */}
            {showOrderPicker && (
              <View style={s.section}>
                <View style={s.labelRow}>
                  <Text style={s.label}>Link your order</Text>
                  {eligibleLoading && <ActivityIndicator size="small" color={colors.light.primary} />}
                </View>
                {eligibleLoading ? null : (
                  <View style={s.orderList}>
                    {eligible.map((o) => {
                      const selected = selectedOrderItemId === o.order_item_id;
                      return (
                        <TouchableOpacity
                          key={o.order_item_id}
                          style={[s.orderRow, selected && s.orderRowSelected]}
                          onPress={() => setSelectedOrderItemId(selected ? null : o.order_item_id)}
                          activeOpacity={0.8}
                        >
                          <View style={[s.orderIcon, selected && s.orderIconSelected]}>
                            <Ionicons
                              name="bag-check-outline"
                              size={16}
                              color={selected ? colors.light.primaryForeground : colors.light.mutedForeground}
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={s.orderNumber}>Order #{o.order_number}</Text>
                            <Text style={s.orderMeta}>
                              {o.delivered_at
                                ? `Delivered ${formatReviewDate(o.delivered_at)}`
                                : "Delivered"}
                              {"  ·  "}Qty {o.quantity}
                            </Text>
                          </View>
                          <View style={[s.radio, selected && s.radioSelected]}>
                            {selected && <View style={s.radioDot} />}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
                <Text style={s.helper}>
                  Linking a delivered order adds a Verified Purchase badge to your review.
                </Text>
              </View>
            )}

            {/* Title */}
            <View style={s.section}>
              <View style={s.labelRow}>
                <Text style={s.label}>Headline</Text>
                <Text style={s.optional}>Optional</Text>
              </View>
              <TextInput
                style={[s.input, focused === "title" && s.inputFocused]}
                value={title}
                onChangeText={setTitle}
                onFocus={() => setFocused("title")}
                onBlur={() => setFocused(null)}
                placeholder="e.g. Beautiful drape, runs slightly large"
                placeholderTextColor={colors.light.mutedForeground + "99"}
                maxLength={TITLE_MAX}
                returnKeyType="next"
              />
            </View>

            {/* Content */}
            <View style={s.section}>
              <View style={s.labelRow}>
                <Text style={s.label}>Your review</Text>
              </View>
              <TextInput
                style={[s.input, s.textArea, focused === "content" && s.inputFocused]}
                value={content}
                onChangeText={setContent}
                onFocus={() => setFocused("content")}
                onBlur={() => setFocused(null)}
                placeholder="How was the fit, fabric and quality? Would you recommend it?"
                placeholderTextColor={colors.light.mutedForeground + "99"}
                multiline
                textAlignVertical="top"
                maxLength={CONTENT_MAX}
              />
              <View style={s.counterRow}>
                <View style={s.progressTrack}>
                  <View
                    style={[
                      s.progressFill,
                      {
                        width: `${Math.min(100, (contentLen / CONTENT_MIN) * 100)}%`,
                        backgroundColor: contentRemaining === 0 ? colors.olive[500] : STAR_GOLD,
                      },
                    ]}
                  />
                </View>
                <Text style={[s.counterText, contentRemaining === 0 && { color: colors.olive[600] }]}>
                  {contentRemaining > 0
                    ? `${contentRemaining} more character${contentRemaining === 1 ? "" : "s"}`
                    : `${content.length}/${CONTENT_MAX}`}
                </Text>
              </View>
            </View>

            {/* Photos */}
            <View style={s.section}>
              <View style={s.labelRow}>
                <Text style={s.label}>Add photos</Text>
                <Text style={s.optional}>{photos.length}/{MAX_PHOTOS}</Text>
              </View>
              <Text style={[s.helper, { marginTop: 0, marginBottom: 12 }]}>
                Reviews with photos help others see the real fit and colour.
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.photosRow}>
                {photos.length < MAX_PHOTOS && (
                  <TouchableOpacity style={s.addPhotoBtn} onPress={handleAddPhoto} activeOpacity={0.8}>
                    <View style={s.addPhotoIcon}>
                      <Ionicons name="camera-outline" size={20} color={colors.olive[700]} />
                    </View>
                    <Text style={s.addPhotoText}>{photos.length === 0 ? "Add photo" : "Add more"}</Text>
                  </TouchableOpacity>
                )}
                {photos.map((uri, i) => (
                  <View key={uri + i} style={s.photoThumb}>
                    <Image source={{ uri }} style={s.photoImage} />
                    <TouchableOpacity
                      style={s.photoRemove}
                      onPress={() => handleRemovePhoto(i)}
                      hitSlop={8}
                      accessibilityLabel="Remove photo"
                    >
                      <Ionicons name="close" size={12} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            </View>

            <View style={s.guidelines}>
              <Ionicons name="information-circle-outline" size={14} color={colors.light.mutedForeground} />
              <Text style={s.guidelinesText}>
                Reviews are checked before they go live. Keep it honest and about the product.
              </Text>
            </View>
          </ScrollView>

          {/* Sticky CTA */}
          <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={submitting}
              activeOpacity={0.85}
              style={[s.cta, !canPost && s.ctaDisabled]}
              accessibilityRole="button"
            >
              {submitting ? (
                <ActivityIndicator color={colors.light.primaryForeground} />
              ) : (
                <>
                  <Text style={s.ctaText}>Post review</Text>
                  <Ionicons name="arrow-forward" size={16} color={colors.light.primaryForeground} />
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const sans = fontFamilies.sans;
const display = fontFamilies.display;

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },

  // Header
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.light.border,
  },
  headerSide: { width: 64 },
  headerCenter: { flex: 1, alignItems: "center" },
  headerEyebrow: {
    fontFamily: sans.semibold, fontSize: 10, letterSpacing: 1.8,
    color: colors.light.mutedForeground,
  },
  headerTitle: {
    fontFamily: display.regular, fontSize: typography.fontSizes.lg,
    color: colors.light.foreground, marginTop: 2,
  },
  cancelText: { fontFamily: sans.medium, fontSize: typography.fontSizes.base, color: colors.light.mutedForeground },

  content: { padding: 20, paddingBottom: 32 },

  // Product card
  productCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    padding: 12, borderRadius: radii.xl,
    backgroundColor: colors.light.card,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.light.border,
  },
  productImage: { width: 64, height: 80, borderRadius: radii.lg, backgroundColor: colors.light.muted },
  productImageFallback: { alignItems: "center", justifyContent: "center" },
  productMonogram: { fontFamily: display.regular, fontSize: 26, color: colors.light.mutedForeground },
  productBrand: {
    fontFamily: sans.semibold, fontSize: 10, letterSpacing: 1.6,
    color: colors.light.mutedForeground, marginBottom: 4,
  },
  productName: {
    fontFamily: display.regular, fontSize: typography.fontSizes.xl, lineHeight: 26,
    color: colors.light.foreground,
  },
  verifiedChip: {
    flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start",
    marginTop: 8, paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: radii.full, backgroundColor: colors.olive[100],
  },
  verifiedChipText: { fontFamily: sans.semibold, fontSize: 11, color: colors.olive[700] },

  // Rating
  ratingCard: {
    alignItems: "center", marginTop: 16, marginBottom: 8,
    paddingVertical: 24, paddingHorizontal: 16,
    borderRadius: radii.xl, backgroundColor: colors.paper.warm,
  },
  ratingQuestion: { fontFamily: display.italic, fontSize: typography.fontSizes.xl, color: colors.light.foreground },
  starsRow: { flexDirection: "row", gap: 4, marginTop: 14 },
  starBtn: { padding: 4 },
  ratingWord: {
    fontFamily: sans.bold, fontSize: typography.fontSizes.sm, letterSpacing: 1.6,
    textTransform: "uppercase", color: colors.olive[700], marginTop: 12, minHeight: 18,
  },
  ratingWordIdle: { color: "transparent" },
  ratingHint: { fontFamily: sans.regular, fontSize: typography.fontSizes.sm, color: colors.light.mutedForeground, marginTop: 2 },

  // Sections
  section: { marginTop: 24 },
  labelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  label: { fontFamily: sans.semibold, fontSize: typography.fontSizes.base, color: colors.light.foreground },
  optional: { fontFamily: sans.medium, fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground },
  helper: {
    fontFamily: sans.regular, fontSize: typography.fontSizes.xs, lineHeight: 16,
    color: colors.light.mutedForeground, marginTop: 8,
  },

  input: {
    fontFamily: sans.regular,
    backgroundColor: colors.light.card,
    borderWidth: 1, borderColor: colors.light.input,
    borderRadius: radii.xl, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: typography.fontSizes.base,
    color: colors.light.foreground,
  },
  inputFocused: { borderColor: colors.olive[600], backgroundColor: "#fff" },
  textArea: { minHeight: 140, paddingTop: 14, lineHeight: 22 },

  counterRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 10 },
  progressTrack: { flex: 1, height: 3, borderRadius: 2, backgroundColor: colors.light.muted, overflow: "hidden" },
  progressFill: { height: 3, borderRadius: 2 },
  counterText: { fontFamily: sans.medium, fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground },

  // Order picker
  orderList: { gap: 8 },
  orderRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 12, borderRadius: radii.xl,
    borderWidth: 1, borderColor: colors.light.input,
    backgroundColor: colors.light.card,
  },
  orderRowSelected: { borderColor: colors.olive[600], backgroundColor: colors.olive[50] },
  orderIcon: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: "center", justifyContent: "center",
    backgroundColor: colors.light.muted,
  },
  orderIconSelected: { backgroundColor: colors.olive[600] },
  orderNumber: { fontFamily: sans.semibold, fontSize: typography.fontSizes.sm, color: colors.light.foreground },
  orderMeta: { fontFamily: sans.regular, fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground, marginTop: 2 },
  radio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 1.5, borderColor: colors.light.border,
    alignItems: "center", justifyContent: "center",
  },
  radioSelected: { borderColor: colors.olive[600] },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.olive[600] },

  // Photos
  photosRow: { gap: 10, paddingRight: 8, paddingTop: 6 },
  photoThumb: { width: 88, height: 110 },
  photoImage: { width: 88, height: 110, borderRadius: radii.lg, backgroundColor: colors.light.muted },
  photoRemove: {
    position: "absolute", top: -6, right: -6,
    width: 22, height: 22, borderRadius: 11,
    alignItems: "center", justifyContent: "center",
    backgroundColor: colors.ink.DEFAULT,
    borderWidth: 2, borderColor: colors.light.background,
  },
  addPhotoBtn: {
    width: 88, height: 110, borderRadius: radii.lg,
    borderWidth: 1.5, borderColor: colors.olive[300], borderStyle: "dashed",
    backgroundColor: colors.olive[50],
    justifyContent: "center", alignItems: "center", gap: 8,
  },
  addPhotoIcon: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: "center", justifyContent: "center",
    backgroundColor: colors.light.card,
  },
  addPhotoText: { fontFamily: sans.semibold, fontSize: 11, color: colors.olive[700] },

  guidelines: { flexDirection: "row", gap: 6, marginTop: 28, alignItems: "flex-start" },
  guidelinesText: {
    flex: 1, fontFamily: sans.regular, fontSize: typography.fontSizes.xs, lineHeight: 16,
    color: colors.light.mutedForeground,
  },

  // Footer CTA
  footer: {
    paddingHorizontal: 20, paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.light.border,
    backgroundColor: colors.light.background,
  },
  cta: {
    height: 52, borderRadius: radii.full,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: colors.ink.DEFAULT,
  },
  ctaDisabled: { opacity: 0.35 },
  ctaText: {
    fontFamily: sans.semibold, fontSize: typography.fontSizes.base, letterSpacing: 0.3,
    color: colors.light.primaryForeground,
  },
});
