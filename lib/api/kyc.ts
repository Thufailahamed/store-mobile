/**
 * KYC (identity verification) — mobile wrappers.
 *
 *   GET  /api/kyc/submissions/me   own history (latest first)
 *   POST /api/kyc/submissions      multipart: id_doc, selfie, doc_type
 *
 * The backend validates the real image type and a 5 MB cap per photo.
 */
import { fetchJson, getAccessToken, getStoreApiUrl, type ApiResult } from "./_fetch";

export type KycStatus = "pending" | "approved" | "rejected";
export type KycDocType = "nic" | "passport" | "driving_licence";

export interface KycSubmission {
  id: string;
  role: "store_owner" | "brand_owner";
  status: KycStatus;
  doc_type?: KycDocType | null;
  rejection_reason: string | null;
  submitted_at: string;
  reviewed_at: string | null;
}

export const KYC_DOC_TYPES: { id: KycDocType; label: string; hint: string; selfieHint: string }[] = [
  { id: "nic", label: "National ID (NIC)", hint: "Front of your NIC with photo and number readable.", selfieHint: "Hold your NIC next to your face." },
  { id: "passport", label: "Passport", hint: "The photo page — photo, number and signature visible.", selfieHint: "Hold the open photo page next to your face." },
  { id: "driving_licence", label: "Driving licence", hint: "Front of the card with photo and licence number.", selfieHint: "Hold your licence next to your face." },
];

export const KYC_MAX_BYTES = 5 * 1024 * 1024;

export async function getMyKyc(): Promise<ApiResult<{ submissions: KycSubmission[] }>> {
  return fetchJson("/api/kyc/submissions/me");
}

export interface KycPhoto {
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
}

/** The ID photo is required. The selfie holding the ID is optional. */
export async function submitKyc(input: { idDoc: KycPhoto; selfie?: KycPhoto | null; docType: KycDocType }): Promise<ApiResult<{ submission: KycSubmission }>> {
  const base = getStoreApiUrl();
  if (!base) return { ok: false, error: "App isn't connected to the store API" };
  const token = await getAccessToken();
  if (!token) return { ok: false, error: "Not signed in" };

  const part = (p: KycPhoto, name: string) => {
    const type = p.mimeType && /^image\/(jpeg|png|webp)$/.test(p.mimeType) ? p.mimeType : "image/jpeg";
    const ext = type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
    // React Native FormData file part.
    return { uri: p.uri, name: `${name}.${ext}`, type } as unknown as Blob;
  };
  const fd = new FormData();
  fd.append("id_doc", part(input.idDoc, "id"));
  if (input.selfie) fd.append("selfie", part(input.selfie, "selfie"));
  fd.append("doc_type", input.docType);

  try {
    const res = await fetch(`${base}/api/kyc/submissions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      body: fd,
    });
    const json = (await res.json().catch(() => null)) as
      | { ok?: boolean; data?: { submission: KycSubmission }; error?: { message?: string } | string }
      | null;
    if (!res.ok || json?.ok === false) {
      const err = typeof json?.error === "string" ? json.error : json?.error?.message;
      return { ok: false, error: err ?? `Upload failed (HTTP ${res.status})` };
    }
    return { ok: true, data: (json?.data ?? json) as { submission: KycSubmission } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error" };
  }
}
