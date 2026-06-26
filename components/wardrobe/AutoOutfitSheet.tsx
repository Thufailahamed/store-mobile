import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Image as RNImage,
} from "react-native";
import { Ionicons } from "@/components/ui/Icon";
import { fontFamilies } from "@/lib/theme/fonts";
import { radii } from "@/lib/theme/tokens";
import { useToast } from "@/components/ui";
import {
  autoGenerateOutfits,
  createWardrobeOutfit,
} from "@/lib/api/wardrobe";
import type { AutoOutfit, AutoOutfitPiece, AutoOutfitResult, WardrobeItem, WardrobeOutfit } from "@/lib/types";

const INK = "#16170f";
const MUTED = "#6b6b6b";
const BORDER = "rgba(22,23,15,0.10)";
const OLIVE = "#556b2f";

const SEASONS: Array<{ key: "all" | "spring" | "summer" | "fall" | "winter"; label: string }> = [
  { key: "all", label: "Any" },
  { key: "spring", label: "Spring" },
  { key: "summer", label: "Summer" },
  { key: "fall", label: "Fall" },
  { key: "winter", label: "Winter" },
];

const garmentToSlot: Record<string, string> = {
  dress: "dress",
  top: "top",
  bottom: "bottom",
  footwear: "shoes",
  accessory: "accessory",
  bag: "accessory",
  jewelry: "accessory",
  watch: "accessory",
  beauty: "accessory",
  other: "other",
};

export function AutoOutfitSheet({
  visible,
  onClose,
  items,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  items: WardrobeItem[];
  onSaved: (outfit: WardrobeOutfit) => void;
}) {
  const { toast } = useToast();
  const [occasion, setOccasion] = useState("");
  const [season, setSeason] = useState<typeof SEASONS[number]["key"]>("all");
  const [seedItemId, setSeedItemId] = useState<string>("");
  const [limit, setLimit] = useState(5);
  const [result, setResult] = useState<AutoOutfitResult | null>(null);
  const [savingIdx, setSavingIdx] = useState<number | null>(null);

  useEffect(() => {
    if (!visible) {
      setResult(null);
      setSavingIdx(null);
    }
  }, [visible]);

  const seedCandidates = useMemo(
    () => items.filter((i) => i.status === "active"),
    [items],
  );

  const handleGenerate = async () => {
    const res = await autoGenerateOutfits({
      occasion: occasion || undefined,
      season: season === "all" ? null : season,
      seed_item_id: seedItemId || undefined,
      limit,
    });
    if (!res.ok) {
      toast(res.error, "error");
      return;
    }
    setResult(res.data as unknown as AutoOutfitResult);
    if ((res.data.outfits ?? []).length === 0) {
      toast("No outfits could be generated", "info");
    }
  };

  const handleSave = async (combo: AutoOutfit, idx: number) => {
    setSavingIdx(idx);
    const name = `${occasion || combo.occasion || "Auto"} look`;
    const payloadItems = combo.pieces.map((p, i) => ({
      wardrobe_item_id: p.wardrobe_item_id,
      slot: garmentToSlot[p.garment_type as string] ?? "other",
      position: i,
    }));
    const res = await createWardrobeOutfit({
      name,
      occasion: combo.occasion ?? occasion ?? undefined,
      season: combo.season ?? (season !== "all" ? season : undefined),
      items: payloadItems,
    });
    setSavingIdx(null);
    if (!res.ok) {
      toast(res.error, "error");
      return;
    }
    toast("Outfit saved", "success");
    if (res.data.outfit) onSaved(res.data.outfit);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          <View style={styles.head}>
            <View style={{ flex: 1 }}>
              <Text style={styles.kicker}>AUTO-GENERATE</Text>
              <Text style={styles.title}>Outfits from your wardrobe</Text>
              <Text style={styles.sub}>
                Slot-rules engine pairs least-worn pieces.
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={20} color={INK} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={{ maxHeight: 480 }}
            contentContainerStyle={{ paddingBottom: 20 }}
            showsVerticalScrollIndicator={false}
          >
            <Field label="Occasion">
              <TouchableOpacity
                style={styles.input}
                onPress={() => {
                  // Lightweight inline prompt: cycle through 4 presets then free.
                  const presets = ["", "Work", "Brunch", "Date night", "Wedding"];
                  const i = presets.indexOf(occasion);
                  setOccasion(presets[(i + 1) % presets.length]);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.inputTxt}>
                  {occasion || "Tap to set (Work, Brunch, …)"}
                </Text>
              </TouchableOpacity>
            </Field>

            <Field label="Season">
              <View style={styles.chipRow}>
                {SEASONS.map((s) => {
                  const active = s.key === season;
                  return (
                    <TouchableOpacity
                      key={s.key}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => setSeason(s.key)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.chipTxt, active && styles.chipTxtActive]}>
                        {s.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Field>

            <Field label="Seed item">
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8 }}
              >
                <TouchableOpacity
                  style={[styles.seed, seedItemId === "" && styles.seedActive]}
                  onPress={() => setSeedItemId("")}
                  activeOpacity={0.8}
                >
                  <Ionicons name="shuffle" size={14} color={INK} />
                  <Text style={styles.seedTxt}>Any</Text>
                </TouchableOpacity>
                {seedCandidates.slice(0, 30).map((it) => {
                  const active = seedItemId === it.id;
                  return (
                    <TouchableOpacity
                      key={it.id}
                      style={[styles.seed, active && styles.seedActive]}
                      onPress={() => setSeedItemId(it.id)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.seedTxt, active && styles.seedTxtActive]} numberOfLines={1}>
                        {it.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </Field>

            <Field label={`Limit: ${limit}`}>
              <View style={styles.chipRow}>
                {[3, 5, 8, 10].map((n) => {
                  const active = n === limit;
                  return (
                    <TouchableOpacity
                      key={n}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => setLimit(n)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.chipTxt, active && styles.chipTxtActive]}>
                        {n}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Field>

            <TouchableOpacity style={styles.cta} onPress={handleGenerate} activeOpacity={0.85}>
              <Ionicons name="sparkles" size={16} color="#fff" />
              <Text style={styles.ctaTxt}>Generate outfits</Text>
            </TouchableOpacity>

            {result && result.outfits.length > 0 && (
              <View style={{ marginTop: 14, gap: 8 }}>
                {result.outfits.map((combo, idx) => (
                  <View key={idx} style={styles.combo}>
                    <View style={styles.thumbRow}>
                      {combo.pieces.slice(0, 4).map((p: AutoOutfitPiece) => (
                        <View key={p.wardrobe_item_id} style={styles.thumb}>
                          {p.image_url ? (
                            <RNImage source={{ uri: p.image_url }} style={styles.thumbImg} />
                          ) : (
                            <Ionicons name="shirt-outline" size={14} color={MUTED} />
                          )}
                        </View>
                      ))}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.comboRule}>{combo.slot_rule}</Text>
                      <Text style={styles.comboPieces} numberOfLines={2}>
                        {combo.pieces.map((p) => p.name).join(" · ")}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.saveBtn}
                      onPress={() => handleSave(combo, idx)}
                      disabled={savingIdx === idx}
                      activeOpacity={0.85}
                    >
                      {savingIdx === idx ? (
                        <ActivityIndicator size="small" color={OLIVE} />
                      ) : (
                        <Text style={styles.saveBtnTxt}>Save</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {result && result.outfits.length === 0 && (
              <Text style={styles.noOutfits}>
                No outfits could be generated — add more tops, bottoms, or dresses.
              </Text>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles: Record<string, any> = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(22,23,15,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 32,
    maxHeight: "92%",
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: BORDER,
    alignSelf: "center",
    marginBottom: 10,
  },
  head: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 8,
  },
  kicker: {
    fontSize: 9,
    color: OLIVE,
    fontFamily: fontFamilies.sans.regular,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 20,
    fontFamily: fontFamilies.display.regular,
    fontWeight: "600",
    color: INK,
    marginTop: 2,
  },
  sub: {
    fontSize: 11,
    color: MUTED,
    fontFamily: fontFamilies.sans.regular,
    marginTop: 2,
  },
  field: {
    marginTop: 12,
    gap: 6,
  },
  fieldLabel: {
    fontSize: 10,
    color: MUTED,
    fontFamily: fontFamilies.sans.regular,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  input: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#fbfaf3",
  },
  inputTxt: {
    fontSize: 13,
    fontFamily: fontFamilies.sans.regular,
    color: INK,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#fff",
  },
  chipActive: {
    backgroundColor: INK,
    borderColor: INK,
  },
  chipTxt: {
    fontSize: 12,
    color: INK,
    fontFamily: fontFamilies.sans.regular,
    fontWeight: "600",
  },
  chipTxtActive: {
    color: "#fff",
  },
  seed: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#fff",
    maxWidth: 140,
  },
  seedActive: {
    backgroundColor: INK,
    borderColor: INK,
  },
  seedTxt: {
    fontSize: 11,
    color: INK,
    fontFamily: fontFamilies.sans.regular,
    fontWeight: "600",
  },
  seedTxtActive: {
    color: "#fff",
  },
  cta: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: OLIVE,
    paddingVertical: 12,
    borderRadius: radii.full,
  },
  ctaTxt: {
    fontSize: 13,
    color: "#fff",
    fontFamily: fontFamilies.sans.regular,
    fontWeight: "700",
  },
  combo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    backgroundColor: "#fbfaf3",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: BORDER,
  },
  thumbRow: {
    flexDirection: "row",
  },
  thumb: {
    width: 36,
    height: 36,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#f1efe6",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -8,
    borderWidth: 2,
    borderColor: "#fff",
  },
  thumbImg: {
    width: "100%",
    height: "100%",
  },
  comboRule: {
    fontSize: 9,
    color: OLIVE,
    fontFamily: fontFamilies.sans.regular,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  comboPieces: {
    fontSize: 12,
    fontFamily: fontFamilies.sans.regular,
    color: INK,
    marginTop: 2,
  },
  saveBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: OLIVE,
    backgroundColor: "#fff",
    minWidth: 56,
    alignItems: "center",
  },
  saveBtnTxt: {
    fontSize: 11,
    fontFamily: fontFamilies.sans.regular,
    fontWeight: "700",
    color: OLIVE,
  },
  noOutfits: {
    marginTop: 14,
    fontSize: 12,
    fontFamily: fontFamilies.sans.regular,
    color: MUTED,
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: 8,
  },
});