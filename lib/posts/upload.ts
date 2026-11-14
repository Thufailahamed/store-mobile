/**
 * Seller Posts uploads (mobile).
 *   images → presigned PUT to R2 via expo-file-system upload task (progress, binary)
 *   reels  → R2 (default): the phone makes a cover frame + 3 moderation frames
 *            (expo-video-thumbnails), PUTs them, then PUTs the 720p video.
 *            Stream (POSTS_VIDEO_STORAGE=stream): resumable tus upload.
 *
 * Pending uploads are persisted (AsyncStorage) so an interrupted upload can be
 * retried when the draft is reopened: R2 re-sends the file (frames are
 * regenerated from the original video); tus continues from Stream's offset.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import * as VideoThumbnails from "expo-video-thumbnails";
import { POST_LIMITS, type PostKind } from "./limits";
import { sellerPostsApi } from "./api";
import type { PostUploadTarget, SellerPostMedia } from "./types";

export interface PickedMedia {
  uri: string;
  kind: "image" | "video";
  fileName: string;
  mimeType: string;
  bytes: number;
  width: number;
  height: number;
  durationMs: number | null;
}

export type UploadProgress = (fraction: number) => void;

const PENDING_KEY = "luxe-post-pending-uploads-v1";
const TUS_CHUNK = 10 * 1024 * 1024; // Stream: ≥ 5 MiB and a multiple of 256 KiB

interface PendingUpload {
  postId: string;
  mediaId: string;
  kind: "image" | "video";
  uri: string;
  uploadUrl: string;
  headers?: Record<string, string>;
  expiresAt?: string;
  createdAt: number;
  /** R2 reels: where the cover frame and moderation frames go. */
  poster?: PostUploadTarget;
  frames?: PostUploadTarget[];
  durationMs?: number | null;
}

/* ── Picking ────────────────────────────────────────────────────────────── */

async function ensureLibraryPermission() {
  const p = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!p.granted) throw new Error("Allow photo library access to upload posts.");
}

function toPicked(a: ImagePicker.ImagePickerAsset): PickedMedia {
  const isVideo = a.type === "video";
  const ext = (a.fileName ?? a.uri).split(".").pop()?.toLowerCase() ?? (isVideo ? "mp4" : "jpg");
  const mimeType = a.mimeType
    ?? (isVideo ? (ext === "mov" ? "video/quicktime" : "video/mp4") : ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg");
  return {
    uri: a.uri,
    kind: isVideo ? "video" : "image",
    fileName: a.fileName ?? `post-${Date.now()}.${ext}`,
    mimeType,
    bytes: a.fileSize ?? 0,
    width: a.width,
    height: a.height,
    durationMs: isVideo ? (a.duration ?? null) : null,
  };
}

/** Pick 1–10 images (poster / carousel). JPEG output, so HEIC is converted on iOS. */
export async function pickPostImages(limit: number = POST_LIMITS.mediaMax): Promise<PickedMedia[]> {
  await ensureLibraryPermission();
  const r = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: limit > 1,
    selectionLimit: limit,
    orderedSelection: true,
    quality: 0.85,
    preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    exif: false,
  });
  return r.canceled ? [] : r.assets.map(toPicked);
}

/** Pick one reel video (≤ 90 s). iOS exports at 720p to keep uploads small on mobile data. */
export async function pickPostVideo(): Promise<PickedMedia | null> {
  await ensureLibraryPermission();
  const r = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["videos"],
    allowsEditing: true, // lets sellers trim on both platforms
    videoMaxDuration: POST_LIMITS.videoMaxDurationMs / 1000,
    videoQuality: ImagePicker.UIImagePickerControllerQualityType.IFrame1280x720,
    videoExportPreset: ImagePicker.VideoExportPreset.H264_1280x720,
    preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
  });
  return r.canceled ? null : toPicked(r.assets[0]);
}

/** Shoot a photo or record a reel with the camera (same output settings as the library pickers). */
export async function capturePostMedia(kind: "image" | "video"): Promise<PickedMedia | null> {
  const p = await ImagePicker.requestCameraPermissionsAsync();
  if (!p.granted) throw new Error("Allow camera access to shoot posts.");
  const r = await ImagePicker.launchCameraAsync(kind === "video"
    ? {
      mediaTypes: ["videos"],
      videoMaxDuration: POST_LIMITS.videoMaxDurationMs / 1000,
      videoQuality: ImagePicker.UIImagePickerControllerQualityType.IFrame1280x720,
    }
    : { mediaTypes: ["images"], quality: 0.85, exif: false });
  return r.canceled ? null : toPicked(r.assets[0]);
}

/** Fill in the byte size when the picker didn't report it. */
async function withSize(m: PickedMedia): Promise<PickedMedia> {
  if (m.bytes > 0) return m;
  const info = await FileSystem.getInfoAsync(m.uri);
  return { ...m, bytes: info.exists && "size" in info ? (info.size ?? 0) : 0 };
}

export function validatePicked(m: PickedMedia): string | null {
  if (m.kind === "video") {
    if (m.bytes > POST_LIMITS.videoMaxBytes) return "Videos can be up to 200 MB. Trim it or export at a lower quality.";
    if (m.durationMs != null && m.durationMs > POST_LIMITS.videoMaxDurationMs + 500) return "Reels can be up to 90 seconds. Trim it and try again.";
    if (m.durationMs != null && m.durationMs < POST_LIMITS.videoMinDurationMs) return "Reels must be at least 3 seconds.";
    return null;
  }
  if (m.bytes > POST_LIMITS.imageMaxBytes) return "Images can be up to 10 MB.";
  return null;
}

export function aspectFor(kind: PostKind, first: PickedMedia): "1:1" | "4:5" | "9:16" {
  if (kind === "reel") return "9:16";
  return first.width && first.height && first.width / first.height >= 0.9 ? "1:1" : "4:5";
}

/* ── Pending (resumable) uploads ────────────────────────────────────────── */

async function readPending(): Promise<PendingUpload[]> {
  try {
    return JSON.parse((await AsyncStorage.getItem(PENDING_KEY)) ?? "[]") as PendingUpload[];
  } catch {
    return [];
  }
}

async function writePending(list: PendingUpload[]) {
  try {
    // Drop anything older than 2 days.
    const fresh = list.filter((p) => Date.now() - p.createdAt < 2 * 86_400_000);
    await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(fresh));
  } catch {
    /* best effort */
  }
}

async function addPending(p: PendingUpload) {
  const list = (await readPending()).filter((x) => x.mediaId !== p.mediaId);
  await writePending([...list, p]);
}

async function removePending(mediaId: string) {
  await writePending((await readPending()).filter((x) => x.mediaId !== mediaId));
}

export async function pendingUploadsFor(postId: string): Promise<PendingUpload[]> {
  return (await readPending()).filter((p) => p.postId === postId);
}

/* ── Transfers ──────────────────────────────────────────────────────────── */

async function putImage(p: PendingUpload, onProgress?: UploadProgress) {
  const task = FileSystem.createUploadTask(
    p.uploadUrl,
    p.uri,
    { httpMethod: "PUT", uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT, headers: p.headers },
    (e) => e.totalBytesExpectedToSend > 0 && onProgress?.(e.totalBytesSent / e.totalBytesExpectedToSend),
  );
  const res = await task.uploadAsync();
  if (!res || res.status < 200 || res.status >= 300) throw new Error(`Upload failed (${res?.status ?? "network"})`);
}

async function tusVideo(p: PendingUpload, onProgress?: UploadProgress) {
  const { Upload } = await import("tus-js-client");
  await new Promise<void>((resolve, reject) => {
    const upload = new Upload({ uri: p.uri } as unknown as Blob, {
      uploadUrl: p.uploadUrl,
      chunkSize: TUS_CHUNK,
      retryDelays: [0, 3000, 10000, 30000, 60000],
      storeFingerprintForResuming: false,
      onProgress: (sent, total) => onProgress?.(total ? sent / total : 0),
      onSuccess: () => resolve(),
      onError: (err) => reject(err),
    });
    upload.start();
  });
}

/** Frame grabs for an R2 reel: cover near the start, then ~25/50/75% for moderation. */
async function grabFrame(uri: string, timeMs: number): Promise<string> {
  const { uri: out } = await VideoThumbnails.getThumbnailAsync(uri, { time: Math.max(0, Math.round(timeMs)), quality: 0.75 });
  return out;
}

async function putFile(target: PostUploadTarget, fileUri: string, onProgress?: UploadProgress) {
  await putImage({ postId: "", mediaId: "", kind: "image", uri: fileUri, uploadUrl: target.url, headers: target.headers, createdAt: 0 }, onProgress);
}

/** R2 reel: frames first (small), then the video with progress. Progress: frames 10%, video 90%. */
async function putVideoToR2(p: PendingUpload, onProgress?: UploadProgress) {
  const dur = p.durationMs ?? 0;
  const sides: { target: PostUploadTarget; at: number }[] = [];
  if (p.poster) sides.push({ target: p.poster, at: Math.min(1000, dur * 0.1) });
  (p.frames ?? []).forEach((t, i) => sides.push({ target: t, at: dur * ((i + 1) / ((p.frames?.length ?? 3) + 1)) }));
  let doneSides = 0;
  await Promise.all(sides.map(async (s) => {
    const frame = await grabFrame(p.uri, s.at).catch(() => null);
    if (frame) await putFile(s.target, frame).catch(() => undefined); // moderation copes with a missing frame
    doneSides++;
    onProgress?.(0.1 * (doneSides / Math.max(1, sides.length)));
  }));
  await putImage(p, (f) => onProgress?.(0.1 + 0.9 * f));
}

async function runTransfer(p: PendingUpload, onProgress?: UploadProgress) {
  let lastErr: unknown = null;
  const r2Video = p.kind === "video" && !!p.headers;
  for (let attempt = 0; attempt < (p.kind === "image" || r2Video ? 3 : 1); attempt++) {
    try {
      if (p.kind === "image") await putImage(p, onProgress);
      else if (r2Video) await putVideoToR2(p, onProgress);
      else await tusVideo(p, onProgress);
      lastErr = null;
      break;
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  if (lastErr) throw lastErr;
  await sellerPostsApi.uploaded(p.postId, p.mediaId);
  await removePending(p.mediaId);
}

/** Start and run one upload into a draft post. */
export async function uploadPostMedia(postId: string, picked: PickedMedia, onProgress?: UploadProgress): Promise<SellerPostMedia> {
  const m = await withSize(picked);
  const problem = validatePicked(m);
  if (problem) throw new Error(problem);
  if (m.kind === "video" && m.durationMs == null) throw new Error("Couldn't read the video length. Try another file.");

  const ticket = m.kind === "image"
    ? await sellerPostsApi.startImage(postId, { filename: m.fileName, contentType: m.mimeType, bytes: m.bytes })
    : await sellerPostsApi.startVideo(postId, { contentType: m.mimeType, bytes: m.bytes, durationMs: m.durationMs! });

  const pending: PendingUpload = {
    postId,
    mediaId: ticket.media.id,
    kind: m.kind,
    uri: m.uri,
    uploadUrl: ticket.upload.url,
    headers: ticket.upload.method === "PUT" ? ticket.upload.headers : undefined,
    expiresAt: ticket.upload.expires_at,
    createdAt: Date.now(),
    poster: ticket.poster,
    frames: ticket.frames,
    durationMs: m.durationMs,
  };
  await addPending(pending);
  await runTransfer(pending, onProgress);
  return ticket.media;
}

/** Resume an interrupted upload (same media row, same upload URL). */
export async function resumePendingUpload(p: PendingUpload, onProgress?: UploadProgress) {
  if (p.expiresAt && new Date(p.expiresAt).getTime() < Date.now()) {
    await removePending(p.mediaId);
    throw new Error("This upload expired. Remove it and add the video again.");
  }
  const info = await FileSystem.getInfoAsync(p.uri).catch(() => null);
  if (!info?.exists) {
    await removePending(p.mediaId);
    throw new Error("The original file is no longer on this phone. Remove it and pick it again.");
  }
  await runTransfer(p, onProgress);
}

export async function forgetPendingUpload(mediaId: string) {
  await removePending(mediaId);
}

export type { PendingUpload };
