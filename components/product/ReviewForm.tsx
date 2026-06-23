import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@/components/ui/Icon";
import { useAuth } from "@/lib/supabase/auth";
import { supabase } from "@/lib/supabase/client";
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
  onSubmitted?: () => void;
}

const TITLE_MIN = 4;
const TITLE_MAX = 120;
const CONTENT_MIN = 20;
const CONTENT_MAX = 1000;

export function ReviewForm({ visible, onClose, productId, productName, onSubmitted }: ReviewFormProps) {
  const { user } = useAuth();
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
    if (photos.length >= 5) {
      toast("Maximum 5 photos per review", "error");
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

    let uploadedUrls: string[] = [];
    if (photos.length > 0) {
      const uploads = await Promise.all(photos.map((uri) => uploadReviewPhoto(uri)));
      uploadedUrls = uploads.filter((u) => u.url).map((u) => u.url);
    }

    // Server is the source of truth for `is_verified_purchase` and
    // `status` — never send them. Server computes verified-purchase from
    // `order_item_id` + delivered status + ownership. Status always
    // enters as "pending" for moderation.
    const res = await addReviewBackend({
      product_id: productId,
      order_item_id: selectedOrderItemId,
      rating,
      title: title.trim() || undefined,
      content: content.trim(),
      photos: uploadedUrls,
    });

    if (!mountedRef.current) return; // unmounted mid-submit — bail
    setSubmitting(false);

    if (!res.ok) {
      toast(friendlyReviewError(res.error || "Failed to submit review"), "error");
    } else {
      toast(
        selectedOrderItemId
          ? "Your verified review has been submitted for approval"
          : "Your review has been submitted for approval",
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
          <View style={s.header}>
            <TouchableOpacity onPress={dismiss}>
              <Text style={s.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={s.headerTitle}>Write a Review</Text>
            <TouchableOpacity onPress={handleSubmit} disabled={submitting}>
              <Text style={[s.submitText, submitting && { opacity: 0.5 }]}>
                {submitting ? "Posting..." : "Post"}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
            {/* Product Name */}
            <Text style={s.productName} numberOfLines={1}>{productName}</Text>

            {/* Order picker — only when logged in & eligible rows exist */}
            {showOrderPicker && (
              <View style={s.orderPickerBox}>
                <View style={s.orderPickerHeader}>
                  <Ionicons name="cube-outline" size={16} color={colors.light.foreground} />
                  <Text style={s.orderPickerTitle}>Which order?</Text>
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
                          onPress={() => setSelectedOrderItemId(o.order_item_id)}
                          activeOpacity={0.7}
                        >
                          <View style={[s.radio, selected && s.radioSelected]}>
                            {selected && <View style={s.radioDot} />}
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={s.orderNumber}>Order #{o.order_number}</Text>
                            <Text style={s.orderMeta}>
                              {o.delivered_at
                                ? `Delivered ${formatReviewDate(o.delivered_at)}`
                                : "Delivered"}{" "}
                              · Qty {o.quantity}
                            </Text>
                          </View>
                          {selected && (
                            <Ionicons name="checkmark-circle" size={18} color={colors.olive[600]} />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
                <Text style={s.orderHint}>
                  Linking a delivered order marks this review as a Verified Purchase.
                </Text>
              </View>
            )}

            {/* Star Rating */}
            <View style={s.ratingSection}>
              <Text style={s.label}>Your Rating</Text>
              <View style={s.starsRow}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity key={star} onPress={() => setRating(star)} style={s.starBtn}>
                    <Ionicons
                      name={star <= rating ? "star" : "star-outline"}
                      size={36}
                      color={star <= rating ? "#f59e0b" : colors.light.border}
                    />
                  </TouchableOpacity>
                ))}
              </View>
              {rating > 0 && (
                <Text style={s.ratingLabel}>
                  {rating === 1 ? "Poor" : rating === 2 ? "Fair" : rating === 3 ? "Good" : rating === 4 ? "Very Good" : "Excellent"}
                </Text>
              )}
              {willBeVerified && (
                <View style={s.verifiedChip}>
                  <Ionicons name="checkmark-circle" size={14} color={colors.olive[600]} />
                  <Text style={s.verifiedChipText}>Will post as Verified Purchase</Text>
                </View>
              )}
            </View>

            {/* Title */}
            <View style={s.field}>
              <Text style={s.label}>Title (optional)</Text>
              <TextInput
                style={s.input}
                value={title}
                onChangeText={setTitle}
                placeholder="Summarize your experience"
                placeholderTextColor={colors.light.mutedForeground}
                maxLength={120}
              />
            </View>

            {/* Content */}
            <View style={s.field}>
              <Text style={s.label}>Your Review</Text>
              <TextInput
                style={[s.input, s.textArea]}
                value={content}
                onChangeText={setContent}
                placeholder="What did you like or dislike? How was the fit and quality?"
                placeholderTextColor={colors.light.mutedForeground}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
                maxLength={1000}
              />
              <Text style={s.charCount}>{content.length}/1000</Text>
            </View>

            {/* Photos */}
            <View style={s.field}>
              <Text style={s.label}>Photos (optional)</Text>
              <View style={s.photosRow}>
                {photos.map((uri, i) => (
                  <View key={i} style={s.photoThumb}>
                    <Image source={{ uri }} style={s.photoImage} />
                    <TouchableOpacity style={s.photoRemove} onPress={() => handleRemovePhoto(i)}>
                      <Ionicons name="close-circle" size={20} color={colors.light.destructive} />
                    </TouchableOpacity>
                  </View>
                ))}
                {photos.length < 5 && (
                  <TouchableOpacity style={s.addPhotoBtn} onPress={handleAddPhoto}>
                    <Ionicons name="camera-outline" size={24} color={colors.light.mutedForeground} />
                    <Text style={s.addPhotoText}>Add</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: colors.light.border,
  },
  headerTitle: {
    fontSize: typography.fontSizes.base,
    fontWeight: typography.fontWeights.semibold as any,
    color: colors.light.foreground,
  },
  cancelText: { fontSize: typography.fontSizes.base, color: colors.light.mutedForeground },
  submitText: {
    fontSize: typography.fontSizes.base,
    fontWeight: typography.fontWeights.bold as any,
    color: colors.olive[600],
  },
  content: { padding: 24 },
  productName: {
    fontFamily: fontFamilies.display.regular,
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.semibold as any,
    color: colors.light.foreground,
    marginBottom: 20,
  },

  ratingSection: { alignItems: "center", marginBottom: 24 },
  starsRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  starBtn: { padding: 4 },
  ratingLabel: {
    fontSize: typography.fontSizes.sm,
    color: colors.olive[600],
    fontWeight: typography.fontWeights.medium as any,
    marginTop: 8,
  },
  verifiedChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    marginTop: 8, paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 999, backgroundColor: colors.olive[50] ?? "#f3f4ec",
  },
  verifiedChipText: {
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.medium as any,
    color: colors.olive[700] ?? colors.olive[600],
  },

  orderPickerBox: {
    marginBottom: 20, padding: 12,
    borderRadius: radii.lg,
    borderWidth: 1, borderColor: colors.light.border,
    backgroundColor: colors.light.muted ?? "#f8f8f6",
  },
  orderPickerHeader: {
    flexDirection: "row", alignItems: "center", gap: 6,
    marginBottom: 8,
  },
  orderPickerTitle: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold as any,
    color: colors.light.foreground,
    flex: 1,
  },
  orderList: { gap: 6 },
  orderRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    padding: 10, borderRadius: radii.md,
    borderWidth: 1, borderColor: colors.light.border,
    backgroundColor: colors.light.background,
  },
  orderRowSelected: {
    borderColor: colors.olive[600],
    backgroundColor: colors.olive[50] ?? "#f3f4ec",
  },
  radio: {
    width: 18, height: 18, borderRadius: 9,
    borderWidth: 2, borderColor: colors.light.border,
    alignItems: "center", justifyContent: "center",
  },
  radioSelected: { borderColor: colors.olive[600] },
  radioDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: colors.olive[600],
  },
  orderNumber: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.medium as any,
    color: colors.light.foreground,
  },
  orderMeta: {
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
    marginTop: 2,
  },
  orderHint: {
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
    marginTop: 8,
  },

  field: { marginBottom: 20 },
  label: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.medium as any,
    color: colors.light.foreground,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.light.card,
    borderWidth: 1, borderColor: colors.light.border,
    borderRadius: radii.lg, padding: 14,
    fontSize: typography.fontSizes.base,
    color: colors.light.foreground,
  },
  textArea: { minHeight: 120 },
  charCount: {
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
    textAlign: "right", marginTop: 4,
  },

  photosRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  photoThumb: { position: "relative", width: 80, height: 80 },
  photoImage: { width: 80, height: 80, borderRadius: radii.lg },
  photoRemove: { position: "absolute", top: -6, right: -6 },
  addPhotoBtn: {
    width: 80, height: 80, borderRadius: radii.lg,
    borderWidth: 1, borderColor: colors.light.border,
    borderStyle: "dashed",
    justifyContent: "center", alignItems: "center", gap: 2,
  },
  addPhotoText: { fontSize: 10, color: colors.light.mutedForeground },
});
