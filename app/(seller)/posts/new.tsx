import { useCallback, useRef, useState } from "react";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { UploadFlow } from "@/components/seller/posts/UploadFlow";
import { SellerStateView } from "@/components/seller/chrome";
import { POSTS_ENABLED } from "@/lib/posts/api";

type Format = "poster" | "carousel" | "film";
const FORMATS: readonly Format[] = ["poster", "carousel", "film"];

export default function NewPostScreen() {
  // Opened from the Runway format sheet as ?mode=<format>&t=<nonce>. The nonce marks
  // a fresh navigation, so the format is acted on once and the params are never cleared.
  const { mode, t } = useLocalSearchParams<{ mode?: string; t?: string }>();
  const consumed = useRef<string | null>(null);
  const [visit, setVisit] = useState(0);
  const [format, setFormat] = useState<Format | undefined>(undefined);
  const [autoPick, setAutoPick] = useState<"video" | "images" | undefined>(undefined);

  // Tab screens stay mounted; start a fresh upload flow on every visit. Uploads
  // from an earlier visit keep running (they're plain promises) and finish.
  useFocusEffect(useCallback(() => {
    setVisit((v) => v + 1);
    const f = FORMATS.find((x) => x === mode);
    if (f && t && t !== consumed.current) {
      consumed.current = t;
      setFormat(f);
      setAutoPick(f === "film" ? "video" : "images");
    } else {
      setFormat(undefined);
      setAutoPick(undefined);
    }
  }, [mode, t]));

  if (!POSTS_ENABLED) return <SellerStateView variant="empty" title="Posts are coming soon" icon="film-outline" />;
  return <UploadFlow key={visit} autoPick={autoPick} format={format} />;
}
