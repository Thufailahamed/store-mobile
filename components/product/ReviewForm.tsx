import React, { useState } from "react";
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
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useAuth } from "@/lib/supabase/auth";
import { supabase } from "@/lib/supabase/client";
import { pickImage, uploadReviewPhoto } from "@/lib/upload";
import { useToast } from "@/components/ui";
import { colors, typography, radii } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

interface ReviewFormProps {
  visible: boolean;
  onClose: () => void;
  productId: string;
  productName: string;
  onSubmitted?: () => void;
}

export function ReviewForm({ visible, onClose, productId, productName, onSubmitted }: ReviewFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

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
    if (!content.trim()) {
      toast("Please write your review", "error");
      return;
    }
    if (!user) return;

    setSubmitting(true);

    let uploadedUrls: string[] = [];
    if (photos.length > 0) {
      const uploads = await Promise.all(photos.map((uri) => uploadReviewPhoto(uri)));
      uploadedUrls = uploads.filter((u) => u.url).map((u) => u.url);
    }

    const { error } = await supabase.from("reviews").insert({
      user_id: user.id,
      product_id: productId,
      rating,
      title: title.trim() || undefined,
      content: content.trim(),
      photos: uploadedUrls,
      status: "pending",
    });

    setSubmitting(false);

    if (error) {
      toast(error.message, "error");
    } else {
      toast("Your review has been submitted for approval", "success");
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
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={s.container}>
          <View style={s.header}>
            <TouchableOpacity onPress={onClose}>
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
