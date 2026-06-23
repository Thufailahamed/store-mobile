import * as FileSystem from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { Alert } from "react-native";
import { supabase } from "@/lib/supabase/client";
import Constants from "expo-constants";
import { assertSellerCanOperate } from "@/lib/api";
import { addProductImageBackend } from "@/lib/api/backend";
import type { ComplianceDocType } from "@/lib/seller-access";

export interface UploadResult {
  url: string;
  error?: string;
}

const AVATAR_BUCKET = "user-avatars";

// 8 MB cap on raw image bytes (camera shots at quality=0.85 are typically
// 1-4 MB). Without this, picking a multi-MB photo can exhaust the device
// heap and cause the upload to silently OOM before reaching storage.
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

/**
 * Explicit allow-list of extensions we will accept for uploads. We refuse
 * anything else (`.svg`, `.html`, `.exe`, ...) so an attacker can't smuggle
 * a script-bearing file into the storage bucket.
 */
const ALLOWED_EXTS = new Set(["jpg", "jpeg", "png", "webp", "heic", "heif", "pdf"]);

const ALLOWED_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
]);

function isAllowedExt(ext: string): boolean {
  return ALLOWED_EXTS.has(ext.toLowerCase());
}

function isAllowedMime(mime: string): boolean {
  const m = mime.toLowerCase();
  if (m.includes("svg")) return false;
  if (m.includes("html")) return false;
  return ALLOWED_MIMES.has(m) || m.startsWith("image/") || m === "application/pdf";
}

function normalizeExtension(ext?: string | null, mimeType?: string | null): string {
  const mime = (mimeType ?? "").toLowerCase();
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("heic") || mime.includes("heif")) return "heic";
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  if (mime.includes("pdf")) return "pdf";

  const raw = (ext ?? "jpg").toLowerCase().split("?")[0];
  if (raw === "jpeg") return "jpg";
  if (raw === "heif") return "heic";
  if (["jpg", "png", "webp", "heic", "pdf"].includes(raw)) return raw;
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

function getStoreApiHost(): string {
  const fromEnv = process.env.EXPO_PUBLIC_STORE_API_URL?.replace(/\/$/, "");
  const fromExtra = Constants.expoConfig?.extra?.storeApiUrl as string | undefined;
  return fromEnv || fromExtra?.replace(/\/$/, "") || "https://store-three-xi-58.vercel.app";
}

async function uploadImageToBucket(
  bucket: string,
  path: string,
  uri: string,
  options?: { contentType?: string; upsert?: boolean; mimeType?: string | null }
): Promise<UploadResult> {
  const rawExt = path.split(".").pop();
  const ext = normalizeExtension(rawExt, options?.mimeType);
  if (!isAllowedExt(ext)) {
    return { url: "", error: `Unsupported file type ".${ext}"` };
  }
  if (options?.mimeType && !isAllowedMime(options.mimeType)) {
    return { url: "", error: `Unsupported mime type "${options.mimeType}"` };
  }
  const contentType = options?.contentType ?? mimeForExtension(ext);
  const body = await readUriAsArrayBuffer(uri);
  if (body.byteLength > MAX_UPLOAD_BYTES) {
    return { url: "", error: `Image too large (${Math.round(body.byteLength / 1024 / 1024)} MB; max 8 MB)` };
  }

  try {
    const host = getStoreApiHost();
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      return { url: "", error: "Authentication session not found" };
    }

    const filename = path.split("/").pop() || `file.${ext}`;
    const presignedRes = await fetch(`${host}/api/storage/presigned-url`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({
        bucket,
        filename,
        contentType,
      }),
    });

    if (!presignedRes.ok) {
      const errData = await presignedRes.json().catch(() => ({}));
      return { url: "", error: errData.error || `Upload registration failed (HTTP ${presignedRes.status})` };
    }

    const { uploadUrl, publicUrl } = await presignedRes.json();

    const putRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": contentType,
      },
      body,
    });

    if (!putRes.ok) {
      return { url: "", error: `Failed to stream data to Cloudflare (HTTP ${putRes.status})` };
    }

    return { url: publicUrl };
  } catch (e: any) {
    return { url: "", error: e?.message ?? "Upload process failed" };
  }
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

    // No explicit refreshSession() — updateUser() already persists the
    // new session, and an extra refresh races with concurrent calls.

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

    const res = await addProductImageBackend(productId, {
      url: uploaded.url,
      position,
      is_primary: isPrimary,
      media_type: "image",
    });
    if (!res.ok) return { url: "", error: res.error || "image insert failed" };

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
 * Failure-evidence photo — door / address / package-condition snapshot taken
 * when the rider reports a delivery failure. Same `review-media` bucket as
 * `uploadDeliveryProof`, but a distinct `failure-{reason}-{orderId}-{ts}.{ext}`
 * path so admin dashboards can filter `failure-*` vs `delivery-*` artifacts.
 *
 * The reason slug is included in the path so reviewers can group evidence
 * photos by category without consulting the order row.
 */
export async function uploadDeliveryFailureEvidence(
  userId: string,
  orderId: string,
  uri: string,
  options?: { reason?: string },
): Promise<UploadResult> {
  try {
    const ext = normalizeExtension(uri.split(".").pop(), "image/jpeg");
    const rawSlug = (options?.reason ?? "other").replace(/[^a-z0-9_]/g, "") || "other";
    const slug = rawSlug.slice(0, 32);
    const path = `${userId}/failure-${slug}-${orderId}-${Date.now()}.${ext}`;
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
    if (base64.length > 2 * 1024 * 1024) {
      return { url: "", error: "Signature payload too large (max ~1.5 MB)" };
    }
    const bytes = base64ToArrayBuffer(base64);
    if (bytes.byteLength > MAX_UPLOAD_BYTES) {
      return { url: "", error: "Signature too large after decoding" };
    }

    const host = getStoreApiHost();
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      return { url: "", error: "Authentication session not found" };
    }

    const filename = `signature-${orderId}-${Date.now()}.png`;

    const presignedRes = await fetch(`${host}/api/storage/presigned-url`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({
        bucket: "review-media",
        filename,
        contentType: "image/png",
      }),
    });

    if (!presignedRes.ok) {
      const errData = await presignedRes.json().catch(() => ({}));
      return { url: "", error: errData.error || `Upload registration failed (HTTP ${presignedRes.status})` };
    }

    const { uploadUrl, publicUrl } = await presignedRes.json();

    const putRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "image/png",
      },
      body: bytes,
    });

    if (!putRes.ok) {
      return { url: "", error: `Upload directly to R2 failed (HTTP ${putRes.status})` };
    }

    return { url: publicUrl };
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
    if (!isAllowedExt(ext)) {
      return { url: "", error: `Unsupported file type ".${ext}"` };
    }
    if (options?.mimeType && !isAllowedMime(options.mimeType)) {
      return { url: "", error: `Unsupported mime type "${options.mimeType}"` };
    }
    const contentType = options?.mimeType ?? mimeForExtension(ext);
    const body = await readUriAsArrayBuffer(uri);

    const host = getStoreApiHost();
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      return { url: "", error: "Authentication session not found" };
    }

    const filename = options?.fileName ?? `${docType}-${Date.now()}.${ext}`;

    const presignedRes = await fetch(`${host}/api/storage/presigned-url`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({
        bucket: "store-compliance",
        filename,
        contentType,
      }),
    });

    if (!presignedRes.ok) {
      const errData = await presignedRes.json().catch(() => ({}));
      return { url: "", error: errData.error || `Upload registration failed (HTTP ${presignedRes.status})` };
    }

    const { uploadUrl, key } = await presignedRes.json();

    const putRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": contentType,
      },
      body,
    });

    if (!putRes.ok) {
      return { url: "", error: `Failed to stream compliance file to Cloudflare (HTTP ${putRes.status})` };
    }

    return { url: key };
  } catch (e: any) {
    return { url: "", error: e?.message ?? "Upload failed" };
  }
}

export async function getComplianceDocumentSignedUrl(
  storagePath: string,
  expiresIn = 3600
): Promise<string | null> {
  if (!storagePath || storagePath.startsWith("http")) return storagePath;
  try {
    const host = getStoreApiHost();
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return null;

    const res = await fetch(
      `${host}/api/storage/signed-url?bucket=store-compliance&key=${encodeURIComponent(storagePath)}`,
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      }
    );
    if (!res.ok) return null;
    const { url } = await res.json();
    return url ?? null;
  } catch {
    return null;
  }
}
