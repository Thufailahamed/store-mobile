import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, Stack } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as api from "@/lib/api";
import { pickImage, takePhoto } from "@/lib/upload";
import { useTrackEvent } from "@/lib/recommender";
import { colors, radii, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { Body, Display, Label } from "@/components/ui/Typography";
import { Button } from "@/components/ui";

const INK = "#1b1c1c";
const MUTED = "#5e5e5d";

export default function ScanScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const tracker = useTrackEvent();
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ kind: string; slug?: string; confidence: number } | null>(null);

  const handleScan = useCallback(
    async (source: "library" | "camera") => {
      if (busy) return;
      setBusy(true);
      tracker.scan(source);
      try {
        const picker = source === "camera" ? takePhoto : pickImage;
        const pick = await picker({ allowsEditing: true, aspect: [1, 1], quality: 0.8 });
        if (!pick || pick.canceled) {
          setBusy(false);
          return;
        }
        const uri = pick.assets?.[0]?.uri;
        if (!uri) {
          setBusy(false);
          return;
        }
        setPreviewUri(uri);

        const upload = await api.uploadScanImage(uri, source);
        if (!upload.ok) {
          Alert.alert("Upload failed", upload.error);
          setBusy(false);
          return;
        }
        const match = await api.reverseImageMatch(upload.data.path);
        if (!match.ok) {
          Alert.alert("Match failed", match.error);
          setBusy(false);
          return;
        }
        if (match.data.kind === "none") {
          setResult({ kind: "none", confidence: 0 });
          setBusy(false);
          return;
        }
        setResult({
          kind: match.data.kind,
          slug: match.data.slug,
          confidence: match.data.confidence,
        });
      } catch (e: any) {
        Alert.alert("Scan error", e?.message ?? "Something went wrong");
      } finally {
        setBusy(false);
      }
    },
    [busy, tracker],
  );

  const viewResult = useCallback(() => {
    if (!result?.slug) return;
    if (result.kind === "product") {
      router.replace(`/(main)/products/${result.slug}`);
    } else if (result.kind === "store") {
      router.replace(`/(main)/stores/${result.slug}`);
    }
  }, [result, router]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false, presentation: "modal" }} />
      <View style={[styles.screen, { paddingTop: insets.top + spacing[3] }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} activeOpacity={0.8}>
            <Ionicons name="close" size={22} color={INK} />
          </TouchableOpacity>
          <Label style={styles.brand}>SCAN TO SEARCH</Label>
          <View style={styles.iconBtn} />
        </View>

        <View style={styles.body}>
          {previewUri ? (
            <View style={styles.previewWrap}>
              <Image source={{ uri: previewUri }} style={styles.preview} contentFit="cover" />
              {busy ? (
                <View style={styles.previewOverlay}>
                  <ActivityIndicator color="#fff" />
                  <Text style={styles.overlayText}>Matching against the catalogue…</Text>
                </View>
              ) : null}
            </View>
          ) : (
            <View style={styles.intro}>
              <View style={styles.introIcon}>
                <Ionicons name="scan-circle-outline" size={64} color={INK} />
              </View>
              <Display size="lg">Find it with your camera</Display>
              <Body muted style={styles.introCopy}>
                Snap a photo of any product or pick one from your library. We&apos;ll match it against our catalogue
                and take you straight to the listing.
              </Body>
            </View>
          )}

          {result && !busy ? (
            <View style={styles.resultCard}>
              {result.kind === "none" ? (
                <>
                  <Ionicons name="search-outline" size={32} color={MUTED} />
                  <Body style={styles.resultTitle}>No close matches</Body>
                  <Body muted size="sm" style={styles.resultCopy}>
                    Try a clearer photo or browse the catalogue instead.
                  </Body>
                </>
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={32} color={colors.olive[600]} />
                  <Body style={styles.resultTitle}>
                    Matched a {result.kind}
                  </Body>
                  <Body muted size="sm" style={styles.resultCopy}>
                    Confidence {Math.round((result.confidence ?? 0) * 100)}%
                  </Body>
                  <Button onPress={viewResult}>View result</Button>
                </>
              )}
            </View>
          ) : null}
        </View>

        <View style={[styles.actions, { paddingBottom: insets.bottom + spacing[4] }]}>
          <TouchableOpacity
            style={styles.action}
            activeOpacity={0.85}
            disabled={busy}
            onPress={() => handleScan("library")}
          >
            <Ionicons name="image-outline" size={22} color={INK} />
            <Text style={styles.actionText}>Image Search</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.action}
            activeOpacity={0.85}
            disabled={busy}
            onPress={() => handleScan("camera")}
          >
            <Ionicons name="camera-outline" size={22} color={INK} />
            <Text style={styles.actionText}>Camera Search</Text>
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#fbf9f8",
    paddingHorizontal: spacing[5],
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing[6],
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  brand: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 11,
    color: INK,
    letterSpacing: 3,
  },
  body: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[5],
  },
  intro: {
    alignItems: "center",
    gap: spacing[3],
    paddingHorizontal: spacing[5],
  },
  introIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  introCopy: {
    textAlign: "center",
    lineHeight: 20,
  },
  previewWrap: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: radii.xl,
    overflow: "hidden",
    backgroundColor: "#000",
  },
  preview: {
    width: "100%",
    height: "100%",
  },
  previewOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[3],
  },
  overlayText: {
    color: "#fff",
    fontFamily: fontFamilies.sans.medium,
    fontSize: 13,
  },
  resultCard: {
    alignItems: "center",
    gap: spacing[2],
    paddingVertical: spacing[5],
    paddingHorizontal: spacing[6],
    borderRadius: radii.xl,
    backgroundColor: "#fff",
    width: "100%",
  },
  resultTitle: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 16,
    color: INK,
  },
  resultCopy: {
    textAlign: "center",
  },
  actions: {
    flexDirection: "row",
    gap: spacing[3],
    paddingTop: spacing[3],
  },
  action: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[2],
    height: 56,
    borderRadius: radii.full,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },
  actionText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 15,
    color: INK,
  },
});
