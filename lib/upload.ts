import * as ImagePicker from "expo-image-picker";
import { supabase } from "./supabase/client";

export interface UploadResult {
  url: string;
  error?: string;
}

export async function pickImage(options?: {
  allowsEditing?: boolean;
  aspect?: [number, number];
  quality?: number;
}): Promise<ImagePicker.ImagePickerResult | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== "granted") return null;

  return ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: options?.allowsEditing ?? true,
    aspect: options?.aspect ?? [1, 1],
    quality: options?.quality ?? 0.8,
  });
}

export async function takePhoto(options?: {
  allowsEditing?: boolean;
  aspect?: [number, number];
  quality?: number;
}): Promise<ImagePicker.ImagePickerResult | null> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== "granted") return null;

  return ImagePicker.launchCameraAsync({
    mediaTypes: ["images"],
    allowsEditing: options?.allowsEditing ?? true,
    aspect: options?.aspect ?? [1, 1],
    quality: options?.quality ?? 0.8,
  });
}

export async function uploadAvatar(
  userId: string,
  uri: string
): Promise<UploadResult> {
  try {
    const ext = uri.split(".").pop() ?? "jpg";
    const path = `avatars/${userId}.${ext}`;

    const response = await fetch(uri);
    const blob = await response.blob();

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, blob, { contentType: `image/${ext}`, upsert: true });

    if (uploadError) return { url: "", error: uploadError.message };

    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    const publicUrl = data?.publicUrl ?? "";

    await supabase.from("users").update({ avatar_url: publicUrl }).eq("id", userId);

    // Sync with Supabase Auth metadata for real-time app update
    await supabase.auth.updateUser({
      data: { avatar_url: publicUrl }
    });

    return { url: publicUrl };
  } catch (e: any) {
    return { url: "", error: e?.message ?? "Upload failed" };
  }
}

export async function uploadProductImage(
  productId: string,
  uri: string,
  position: number = 0,
  isPrimary: boolean = false
): Promise<UploadResult> {
  try {
    const ext = uri.split(".").pop() ?? "jpg";
    const path = `products/${productId}/${Date.now()}.${ext}`;

    const response = await fetch(uri);
    const blob = await response.blob();

    const { error: uploadError } = await supabase.storage
      .from("product-images")
      .upload(path, blob, { contentType: `image/${ext}` });

    if (uploadError) return { url: "", error: uploadError.message };

    const { data } = supabase.storage.from("product-images").getPublicUrl(path);
    const publicUrl = data?.publicUrl ?? "";

    await supabase.from("product_images").insert({
      product_id: productId,
      url: publicUrl,
      position,
      is_primary: isPrimary,
      media_type: "image",
    });

    return { url: publicUrl };
  } catch (e: any) {
    return { url: "", error: e?.message ?? "Upload failed" };
  }
}

export async function uploadReviewPhoto(
  uri: string
): Promise<UploadResult> {
  try {
    const ext = uri.split(".").pop() ?? "jpg";
    const path = `reviews/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const response = await fetch(uri);
    const blob = await response.blob();

    const { error: uploadError } = await supabase.storage
      .from("review-photos")
      .upload(path, blob, { contentType: `image/${ext}` });

    if (uploadError) return { url: "", error: uploadError.message };

    const { data } = supabase.storage.from("review-photos").getPublicUrl(path);
    return { url: data?.publicUrl ?? "" };
  } catch (e: any) {
    return { url: "", error: e?.message ?? "Upload failed" };
  }
}
