import * as FileSystem from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { Alert } from "react-native";
import { supabase } from "@/lib/supabase/client";
import { assertSellerCanOperate } from "@/lib/api";
import type { ComplianceDocType } from "@/lib/seller-access";

export interface UploadResult {
  url: string;
  error?: string;
}

const AVATAR_BUCKET = "user-avatars";

function normalizeExtension(ext?: string | null, mimeType?: string | null): string {
  const mime = (mimeType ?? "").toLowerCase();
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("heic") || mime.includes("heif")) return "heic";
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";

  const raw = (ext ?? "jpg").toLowerCase().split("?")[0];
  if (raw === "jpeg") return "jpg";
  if (raw === "pdf") return "pdf";
  if (["jpg", "png", "webp", "heic", "heif", "pdf"].includes(raw)) {
    return raw === "heif" ? "heic" : raw;
  }
  return "jpg";
}

function mimeForExtension(ext: string): string {
  switch (ext) {
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "heic":
      return "image/heic";
    case "pdf":
      return "application/pdf";
    default:
      return "image/jpeg";
  }
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = globalThis.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/** Read a local camera/gallery URI into bytes (works with Android content://). */
async function readUriAsArrayBuffer(uri: string): Promise<ArrayBuffer> {
  let readableUri = uri;

  if (uri.startsWith("content://")) {
    const dest = `${FileSystem.cacheDirectory}upload-${Date.now()}.jpg`;
    await FileSystem.copyAsync({ from: uri, to: dest });
    readableUri = dest;
  }

  try {
    const base64 = await FileSystem.readAsStringAsync(readableUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    if (base64) return base64ToArrayBuffer(base64);
  } catch {
    // Fall back to fetch for remote URIs.
  }

  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error(`Could not read image (${response.status})`);
  }
  return response.arrayBuffer();
}

async function uploadImageToBucket(
  bucket: string,
  path: string,
  uri: string,
  options?: { contentType?: string; upsert?: boolean; mimeType?: string | null }
): Promise<UploadResult> {
  const ext = normalizeExtension(path.split(".").pop(), options?.mimeType);
  const contentType = options?.contentType ?? mimeForExtension(ext);
  const body = await readUriAsArrayBuffer(uri);

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(path, body, { contentType, upsert: options?.upsert ?? false });

  if (uploadError) return { url: "", error: uploadError.message };

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return { url: data?.publicUrl ?? "" };
}

export async function pickComplianceFile(): Promise<{
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
} | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== "granted") return null;

  return new Promise((resolve) => {
    Alert.alert("Upload document", "Choose a file type", [
      {
        text: "Photo",
        onPress: async () => {
          const result = await pickImage({ quality: 0.85 });
          if (!result || result.canceled || !result.assets[0]) {
            resolve(null);
            return;
          }
          const asset = result.assets[0];
          resolve({
            uri: asset.uri,
            mimeType: asset.mimeType ?? "image/jpeg",
            fileName: asset.fileName ?? `document.jpg`,
          });
        },
      },
      {
        text: "PDF / File",
        onPress: async () => {
          try {
            const result = await DocumentPicker.getDocumentAsync({
              type: ["application/pdf", "image/*"],
              copyToCacheDirectory: true,
            });
            if (result.canceled || !result.assets?.[0]) {
              resolve(null);
              return;
            }
            const asset = result.assets[0];
            resolve({
              uri: asset.uri,
              mimeType: asset.mimeType ?? "application/pdf",
              fileName: asset.name,
            });
          } catch {
            Alert.alert("Document picker unavailable", "Restart the Expo app after installing dependencies.");
            resolve(null);
          }
        },
      },
      { text: "Cancel", style: "cancel", onPress: () => resolve(null) },
    ]);
  });
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
  uri: string,
  options?: { mimeType?: string | null; fileName?: string | null }
): Promise<UploadResult> {
  try {
    const ext = normalizeExtension(
      options?.fileName?.split(".").pop() ?? uri.split(".").pop(),
      options?.mimeType
    );
    const path = `${userId}/avatar-${Date.now()}.${ext}`;

    const uploaded = await uploadImageToBucket(AVATAR_BUCKET, path, uri, {
      mimeType: options?.mimeType,
      upsert: true,
    });
    if (uploaded.error || !uploaded.url) return uploaded;

    const cacheBustedUrl = `${uploaded.url}?v=${Date.now()}`;

    const { error: dbError } = await supabase
      .from("users")
      .update({ avatar_url: cacheBustedUrl })
      .eq("id", userId);
    if (dbError) return { url: "", error: dbError.message };

    const { data: authUser } = await supabase.auth.getUser();
    const { error: authError } = await supabase.auth.updateUser({
      data: {
        ...(authUser.user?.user_metadata ?? {}),
        avatar_url: cacheBustedUrl,
      },
    });
    if (authError) return { url: "", error: authError.message };

    await supabase.auth.refreshSession();

    return { url: cacheBustedUrl };
  } catch (e: any) {
    return { url: "", error: e?.message ?? "Upload failed" };
  }
}

export async function uploadProductImage(
  storeId: string,
  productId: string,
  uri: string,
  position: number = 0,
  isPrimary: boolean = false,
  options?: { mimeType?: string | null; fileName?: string | null }
): Promise<UploadResult> {
  try {
    const guard = await assertSellerCanOperate(storeId);
    if (!guard.ok) return { url: "", error: guard.error };

    const ext = normalizeExtension(
      options?.fileName?.split(".").pop() ?? uri.split(".").pop(),
      options?.mimeType
    );
    const path = `${storeId}/${productId}-${Date.now()}.${ext}`;

    const uploaded = await uploadImageToBucket("product-images", path, uri, {
      mimeType: options?.mimeType,
    });
    if (uploaded.error || !uploaded.url) return uploaded;

    const { error: insertError } = await supabase.from("product_images").insert({
      product_id: productId,
      url: uploaded.url,
      position,
      is_primary: isPrimary,
      media_type: "image",
    });
    if (insertError) return { url: "", error: insertError.message };

    return uploaded;
  } catch (e: any) {
    return { url: "", error: e?.message ?? "Upload failed" };
  }
}

export async function uploadReviewPhoto(
  uri: string,
  options?: { mimeType?: string | null; fileName?: string | null }
): Promise<UploadResult> {
  try {
    const ext = normalizeExtension(
      options?.fileName?.split(".").pop() ?? uri.split(".").pop(),
      options?.mimeType
    );
    const path = `reviews/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    return uploadImageToBucket("review-media", path, uri, {
      mimeType: options?.mimeType,
    });
  } catch (e: any) {
    return { url: "", error: e?.message ?? "Upload failed" };
  }
}

/** Delivery proof photos — stored under review-media/{userId}/ for RLS. */
export async function uploadDeliveryProof(
  userId: string,
  orderId: string,
  uri: string,
): Promise<UploadResult> {
  try {
    const ext = normalizeExtension(uri.split(".").pop(), "image/jpeg");
    const path = `${userId}/delivery-${orderId}-${Date.now()}.${ext}`;
    return uploadImageToBucket("review-media", path, uri, { mimeType: mimeForExtension(ext) });
  } catch (e: any) {
    return { url: "", error: e?.message ?? "Upload failed" };
  }
}

/**
 * Delivery signature PNG — same RLS bucket as the proof photo.
 * Accepts the raw base64 dataURL emitted by `react-native-signature-canvas`
 * (the lib returns a `data:image/png;base64,...` string), strips the prefix,
 * and uploads the binary.
 */
export async function uploadDeliverySignature(
  userId: string,
  orderId: string,
  base64PngDataUrl: string,
): Promise<UploadResult> {
  try {
    const match = /^data:image\/png;base64,(.+)$/.exec(base64PngDataUrl.trim());
    if (!match) {
      return { url: "", error: "Signature payload is not a PNG dataURL" };
    }
    const base64 = match[1];
    const path = `${userId}/signature-${orderId}-${Date.now()}.png`;
    const bytes = base64ToArrayBuffer(base64);

    const { error: uploadError } = await supabase.storage
      .from("review-media")
      .upload(path, bytes, { contentType: "image/png", upsert: false });
    if (uploadError) return { url: "", error: uploadError.message };

    const { data } = supabase.storage.from("review-media").getPublicUrl(path);
    return { url: data?.publicUrl ?? "" };
  } catch (e: any) {
    return { url: "", error: e?.message ?? "Upload failed" };
  }
}

/** Business compliance document — private bucket; returns storage path in `url`. */
export async function uploadComplianceDocument(
  storeId: string,
  docType: ComplianceDocType,
  uri: string,
  options?: { mimeType?: string | null; fileName?: string | null }
): Promise<UploadResult> {
  try {
    const ext = normalizeExtension(
      options?.fileName?.split(".").pop() ?? uri.split(".").pop(),
      options?.mimeType
    );
    const path = `${storeId}/${docType}-${Date.now()}.${ext}`;
    const contentType = options?.mimeType ?? mimeForExtension(ext);
    const body = await readUriAsArrayBuffer(uri);

    const { error: uploadError } = await supabase.storage
      .from("store-compliance")
      .upload(path, body, { contentType, upsert: true });

    if (uploadError) return { url: "", error: uploadError.message };
    return { url: path };
  } catch (e: any) {
    return { url: "", error: e?.message ?? "Upload failed" };
  }
}

export async function getComplianceDocumentSignedUrl(
  storagePath: string,
  expiresIn = 3600
): Promise<string | null> {
  if (!storagePath || storagePath.startsWith("http")) return storagePath;
  const { data, error } = await supabase.storage
    .from("store-compliance")
    .createSignedUrl(storagePath, expiresIn);
  if (error) return null;
  return data?.signedUrl ?? null;
}
