import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Share,
  Alert,
  ActivityIndicator,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { useRouter } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { useAuth } from "@/lib/supabase/auth";
import {
  getSellerStore,
  getAllCategories,
  bulkCreateSellerProducts,
  type BulkSellerProductInput,
} from "@/lib/api";
import { colors, typography, radii } from "@/lib/theme/tokens";
import type { Category } from "@/lib/types";

const TEMPLATE = `name,category,brand,gender,mrp,price,stock,material,short_description,description,tags,image_url,is_featured
Classic Crew T-Shirt,Men,,men,4990,2990,100,Cotton,"A wardrobe essential","Premium cotton crew neck tee. Soft hand-feel, perfect for layering.","tshirt,cotton,casual,summer",https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800,false
Linen Shirt,Women,,women,8990,5990,60,Linen,"Breezy linen","Lightweight summer linen shirt in oat.","shirt,linen,summer",https://images.unsplash.com/photo-1485968579580-b6d095142e6e?w=800,true
Sneakers,Footwear,,unisex,18990,12990,40,Mesh,"Daily runner","Comfortable everyday sneaker.","sneakers,running",https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800,true`;

const VALID_GENDERS = ["men", "women", "kids", "unisex"] as const;
const MAX_NAME = 200;
const MAX_DESCRIPTION = 5000;
const MAX_SHORT_DESC = 400;
const MAX_MATERIAL = 100;
const MAX_TAGS = 20;
const MAX_TAG_LENGTH = 50;
const MAX_ROWS = 200;

interface Row {
  index: number;
  raw: Record<string, string>;
  errors: string[];
  result?: { id?: string; error?: string };
}

interface Done {
  ok: number;
  fail: number;
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        inQuotes = !inQuotes;
        continue;
      }
      if (c === "," && !inQuotes) {
        cells.push(cur);
        cur = "";
        continue;
      }
      cur += c;
    }
    cells.push(cur);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = (cells[i] ?? "").trim();
    });
    return row;
  });
}

function isValidHexColor(value: string): boolean {
  return /^#?[0-9a-fA-F]{6}$/.test(value);
}

export default function SellerBulkUpload() {
  const router = useRouter();
  const { user } = useAuth();
  const [storeId, setStoreId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [committing, setCommitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState<Done | null>(null);

  useEffect(() => {
    (async () => {
      if (!user) return;
      const [storeRes, catRes] = await Promise.all([
        getSellerStore(user.id),
        getAllCategories(),
      ]);
      if (storeRes.ok && storeRes.data) setStoreId(storeRes.data.id);
      if (catRes.ok) setCategories(catRes.data);
      setLoading(false);
    })();
  }, [user]);

  // Re-validate unknown-category errors once the category list loads.
  useEffect(() => {
    if (categories.length === 0 || rows.length === 0) return;
    setRows((prev) =>
      prev.map((r) => {
        if (!r.raw.category) return r;
        const known = categories.some(
          (c) => c.name.toLowerCase() === r.raw.category.toLowerCase(),
        );
        const filtered = r.errors.filter((e) => !e.startsWith("unknown category"));
        return {
          ...r,
          errors: known ? filtered : [...filtered, `unknown category "${r.raw.category}"`],
        };
      }),
    );
  }, [categories, rows.length]);

  const downloadTemplate = async () => {
    try {
      await Share.share({
        message: TEMPLATE,
        title: "luxe-products-template.csv",
      });
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Could not share template");
    }
  };

  const loadFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["text/csv", "text/comma-separated-values", "public.comma-separated-values-text"],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const file = result.assets[0];
      // Read the file from disk — DocumentPicker returns a content:// on Android
      // and a file:// on iOS. expo-file-system handles both.
      const FileSystem = await import("expo-file-system");
      const text = await FileSystem.readAsStringAsync(file.uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      const raw = parseCsv(text);
      if (raw.length === 0) {
        Alert.alert("Empty file", "No rows found.");
        return;
      }
      if (raw.length > MAX_ROWS) {
        Alert.alert(
          "Too many rows",
          `Maximum ${MAX_ROWS} products per upload. Found ${raw.length}.`,
        );
        return;
      }
      const nameCounts = new Map<string, number>();
      const processed: Row[] = raw.map((r, i) => {
        const errors: string[] = [];
        // Name
        const name = r.name?.trim() ?? "";
        if (!name) {
          errors.push("name is required");
        } else if (name.length > MAX_NAME) {
          errors.push(`name must be ≤ ${MAX_NAME} characters`);
        }
        const key = name.toLowerCase();
        if (key) nameCounts.set(key, (nameCounts.get(key) ?? 0) + 1);
        // MRP / Price / Stock
        const mrp = Number(r.mrp);
        const price = Number(r.price);
        const stock = Number(r.stock);
        if (!Number.isFinite(mrp) || mrp <= 0) errors.push("mrp must be > 0");
        if (!Number.isFinite(price) || price <= 0) errors.push("price must be > 0");
        if (!Number.isFinite(stock) || stock < 0) errors.push("stock must be ≥ 0");
        if (Number.isFinite(price) && Number.isFinite(mrp) && price > mrp) errors.push("price > mrp");
        // Gender
        const gender = (r.gender ?? "").toLowerCase();
        if (gender && !VALID_GENDERS.includes(gender as typeof VALID_GENDERS[number])) {
          errors.push(`invalid gender "${r.gender}" — must be one of: ${VALID_GENDERS.join(", ")}`);
        }
        // Category
        if (r.category && categories.length > 0) {
          const found = categories.some(
            (c) => c.name.toLowerCase() === r.category.toLowerCase(),
          );
          if (!found) errors.push(`unknown category "${r.category}"`);
        }
        // Material
        if (r.material && r.material.length > MAX_MATERIAL) {
          errors.push(`material must be ≤ ${MAX_MATERIAL} characters`);
        }
        // Short description
        if (r.short_description && r.short_description.length > MAX_SHORT_DESC) {
          errors.push(`short_description must be ≤ ${MAX_SHORT_DESC} characters`);
        }
        // Description
        if (r.description && r.description.length > MAX_DESCRIPTION) {
          errors.push(`description must be ≤ ${MAX_DESCRIPTION} characters`);
        }
        // Tags
        if (r.tags) {
          const tags = r.tags.split(",").map((t) => t.trim()).filter(Boolean);
          if (tags.length > MAX_TAGS) {
            errors.push(`maximum ${MAX_TAGS} tags allowed`);
          }
          const longTag = tags.find((t) => t.length > MAX_TAG_LENGTH);
          if (longTag) {
            errors.push(`tag "${longTag.slice(0, 30)}…" exceeds ${MAX_TAG_LENGTH} characters`);
          }
        }
        // Image URL
        if (r.image_url) {
          const looksLikeUrl =
            r.image_url.startsWith("http://") || r.image_url.startsWith("https://");
          if (!looksLikeUrl) errors.push("image_url must use http or https");
        }
        // is_featured
        if (r.is_featured && !["true", "false", "1", "0", "yes", "no"].includes(r.is_featured.toLowerCase())) {
          errors.push('is_featured must be "true" or "false"');
        }
        return { index: i + 1, raw: r, errors };
      });
      // Flag duplicate names.
      for (const [name, count] of nameCounts) {
        if (count > 1) {
          for (const row of processed) {
            if (row.raw.name?.toLowerCase() === name && row.errors.length === 0) {
              row.errors.push(`duplicate product name "${row.raw.name}" (${count} rows)`);
            }
          }
        }
      }
      setRows(processed);
      setDone(null);
      setProgress(0);
    } catch (e: any) {
      const msg = e?.message ?? "Could not read file";
      if (msg.toLowerCase().includes("cancel")) return;
      Alert.alert("File error", msg);
    }
  };

  const commit = async () => {
    if (!storeId) {
      Alert.alert("Store required", "Create your store before uploading products.");
      return;
    }
    const valid = rows.filter((r) => r.errors.length === 0);
    if (valid.length === 0) {
      Alert.alert("Nothing to import", "All rows have errors.");
      return;
    }
    setCommitting(true);
    setProgress(0);
    const products: BulkSellerProductInput[] = valid.map((r) => {
      const mrp = Number(r.raw.mrp);
      const price = Number(r.raw.price);
      const stock = Number(r.raw.stock);
      const category = categories.find(
        (c) => c.name.toLowerCase() === (r.raw.category || "").toLowerCase(),
      );
      const tags = r.raw.tags
        ? r.raw.tags.split(",").map((t) => t.trim()).filter(Boolean)
        : [];
      return {
        name: r.raw.name,
        category_id: category?.id,
        brand_id: r.raw.brand || undefined,
        material: r.raw.material || undefined,
        mrp,
        price,
        gender: (r.raw.gender as "men" | "women" | "kids" | "unisex") || "unisex",
        short_description: r.raw.short_description || undefined,
        description: r.raw.description || undefined,
        tags,
        images: r.raw.image_url ? [{ url: r.raw.image_url, is_primary: true }] : [],
        variants: [{ size: "M", mrp, price, stock }],
        is_featured: r.raw.is_featured === "true",
        status: "active",
      };
    });

    // Animate progress while awaiting the (single) bulk POST.
    const timer = setInterval(() => {
      setProgress((p) => Math.min(85, p + 8));
    }, 220);

    const res = await bulkCreateSellerProducts(storeId, products);
    clearInterval(timer);
    setProgress(100);
    setCommitting(false);
    if (!res.ok) {
      Alert.alert("Import failed", res.error);
      return;
    }
    const results = res.data.results ?? [];
    const ok = results.filter((x) => x.ok).length;
    const fail = results.length - ok;
    setDone({ ok, fail });
    setRows((prev) => {
      let validIdx = 0;
      return prev.map((r) => {
        if (r.errors.length > 0) return r;
        const res = results[validIdx];
        validIdx += 1;
        return res ? { ...r, result: { id: res.id, error: res.error } } : r;
      });
    });
    Alert.alert(
      `Imported ${ok} of ${results.length}`,
      fail > 0 ? `${fail} failed — see preview below.` : "All good.",
    );
    if (ok > 0) {
      setTimeout(() => router.replace("/(seller)/products" as any), 1500);
    }
  };

  const summary = useMemo(() => {
    const valid = rows.filter((r) => r.errors.length === 0).length;
    const errors = rows.length - valid;
    return { valid, errors, total: rows.length };
  }, [rows]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.light.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.titleBlock}>
        <Text style={styles.eyebrow}>CATALOGUE</Text>
        <Text style={styles.title}>Bulk upload</Text>
        <Text style={styles.subtitle}>Import many products at once via CSV.</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>CSV file</Text>
          <TouchableOpacity style={styles.templateBtn} onPress={downloadTemplate}>
            <Ionicons name="download-outline" size={14} color={colors.light.primary} />
            <Text style={styles.templateBtnText}>Template</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.helpText}>
          Required: <Text style={styles.helpBold}>name, mrp, price, stock</Text>. Optional:
          category, brand, gender, material, description, tags, image_url, is_featured.
        </Text>
        <TouchableOpacity style={styles.dropZone} onPress={loadFile} activeOpacity={0.85}>
          <Ionicons name="cloud-upload-outline" size={32} color={colors.light.primary} />
          <Text style={styles.dropTitle}>Pick a CSV file</Text>
          <Text style={styles.dropHint}>Tap to browse · CSV · UTF-8</Text>
        </TouchableOpacity>
      </View>

      {rows.length > 0 ? (
        <View style={styles.card}>
          <View style={styles.previewHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Preview</Text>
              <Text style={styles.previewMeta}>
                {summary.total} rows · <Text style={styles.previewValid}>{summary.valid} valid</Text> ·{" "}
                <Text style={styles.previewInvalid}>{summary.errors} with errors</Text>
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.commitBtn, (committing || summary.valid === 0) && styles.commitBtnDisabled]}
              onPress={commit}
              disabled={committing || summary.valid === 0}
            >
              {committing ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Ionicons name="checkmark-circle" size={16} color="#fff" />
              )}
              <Text style={styles.commitBtnText}>
                {committing ? "Importing…" : `Import ${summary.valid}`}
              </Text>
            </TouchableOpacity>
          </View>
          {committing ? (
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>
          ) : null}
          <View style={styles.tableWrap}>
            {/* Header */}
            <View style={styles.tableHeader}>
              <Text style={[styles.th, { width: 28 }]}>#</Text>
              <Text style={[styles.th, { flex: 1 }]}>Name</Text>
              <Text style={[styles.th, { width: 70 }]}>MRP</Text>
              <Text style={[styles.th, { width: 70 }]}>Price</Text>
              <Text style={[styles.th, { width: 56 }]}>Stock</Text>
              <Text style={[styles.th, { width: 88, textAlign: "right" }]}>Status</Text>
            </View>
            {rows.map((r) => {
              const status =
                r.result
                  ? r.result.error
                    ? "failed"
                    : "imported"
                  : r.errors.length === 0
                    ? "ready"
                    : "errors";
              return (
                <View
                  key={r.index}
                  style={[
                    styles.tr,
                    status === "failed" && styles.trFailed,
                  ]}
                >
                  <Text style={[styles.td, styles.tdIdx, { width: 28 }]}>{r.index}</Text>
                  <View style={[styles.td, { flex: 1 }]}>
                    <Text style={styles.tdName} numberOfLines={1}>
                      {r.raw.name || "—"}
                    </Text>
                    {r.raw.category ? (
                      <Text style={styles.tdCat} numberOfLines={1}>{r.raw.category}</Text>
                    ) : null}
                  </View>
                  <Text style={[styles.td, { width: 70 }]}>{r.raw.mrp || "—"}</Text>
                  <Text style={[styles.td, { width: 70 }]}>{r.raw.price || "—"}</Text>
                  <Text style={[styles.td, { width: 56 }]}>{r.raw.stock || "—"}</Text>
                  <View style={{ width: 88, alignItems: "flex-end" }}>
                    {status === "imported" ? (
                      <View style={[styles.pill, styles.pillOk]}>
                        <Ionicons name="checkmark" size={10} color="#166534" />
                        <Text style={[styles.pillText, styles.pillTextOk]}>Imported</Text>
                      </View>
                    ) : status === "failed" ? (
                      <View style={[styles.pill, styles.pillFail]}>
                        <Ionicons name="alert-circle" size={10} color="#9d174d" />
                        <Text style={[styles.pillText, styles.pillTextFail]}>Failed</Text>
                      </View>
                    ) : status === "ready" ? (
                      <View style={[styles.pill, styles.pillReady]}>
                        <Text style={[styles.pillText, styles.pillTextReady]}>Ready</Text>
                      </View>
                    ) : (
                      <View style={[styles.pill, styles.pillError]}>
                        <Ionicons name="alert-circle" size={10} color="#9d174d" />
                        <Text style={[styles.pillText, styles.pillTextFail]}>
                          {r.errors.length} {r.errors.length === 1 ? "err" : "errs"}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
          {/* Error details — collapsible per row by tapping status pill could be nice,
              but a flat list at the bottom is the simplest parity with web. */}
          {rows.some((r) => r.errors.length > 0 || r.result?.error) ? (
            <View style={styles.errorPanel}>
              <Text style={styles.errorPanelTitle}>Row details</Text>
              {rows
                .filter((r) => r.errors.length > 0 || r.result?.error)
                .map((r) => (
                  <View key={`err-${r.index}`} style={styles.errorRow}>
                    <Text style={styles.errorRowIdx}>#{r.index}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.errorRowName} numberOfLines={1}>
                        {r.raw.name || "(unnamed)"}
                      </Text>
                      {(r.errors.length > 0 ? r.errors : [r.result?.error ?? ""]).filter(Boolean).map((msg, i) => (
                        <Text key={i} style={styles.errorMsg}>· {msg}</Text>
                      ))}
                    </View>
                  </View>
                ))}
            </View>
          ) : null}
        </View>
      ) : null}

      {done ? (
        <View style={styles.doneBanner}>
          <View style={styles.doneIcon}>
            <Ionicons name="checkmark" size={20} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.doneTitle}>Import complete</Text>
            <Text style={styles.doneBody}>
              {done.ok} product{done.ok === 1 ? "" : "s"} added
              {done.fail > 0 ? `, ${done.fail} failed` : ""}.
            </Text>
          </View>
        </View>
      ) : null}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// Silence unused-var lint on the helper used by templates; intentional future hook.
void isValidHexColor;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  content: { padding: 16, paddingBottom: 120 },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.light.background,
  },
  headerRow: { marginBottom: 8 },
  backButton: {
    color: colors.light.primary,
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.medium as any,
  },
  titleBlock: { marginBottom: 16 },
  eyebrow: {
    fontSize: 10,
    color: colors.olive?.[600] ?? "#65a30d",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    fontWeight: typography.fontWeights.semibold as any,
  },
  title: {
    fontSize: typography.fontSizes["2xl"],
    fontWeight: typography.fontWeights.bold as any,
    color: colors.light.foreground,
    marginTop: 2,
  },
  subtitle: {
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
    marginTop: 4,
  },
  card: {
    backgroundColor: colors.light.card,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.lg,
    padding: 14,
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: typography.fontSizes.base,
    fontWeight: typography.fontWeights.semibold as any,
    color: colors.light.foreground,
  },
  templateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  templateBtnText: {
    color: colors.light.primary,
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.semibold as any,
  },
  helpText: {
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
    marginBottom: 10,
    lineHeight: 18,
  },
  helpBold: {
    fontFamily: "monospace",
    color: colors.light.foreground,
  },
  dropZone: {
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: colors.light.border,
    borderRadius: radii.lg,
    paddingVertical: 28,
    alignItems: "center",
    gap: 6,
  },
  dropTitle: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold as any,
    color: colors.light.foreground,
    marginTop: 6,
  },
  dropHint: {
    fontSize: 10,
    color: colors.light.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 10,
  },
  previewMeta: {
    fontSize: 11,
    color: colors.light.mutedForeground,
    marginTop: 2,
  },
  previewValid: { color: "#166534", fontWeight: typography.fontWeights.semibold as any },
  previewInvalid: { color: "#9d174d", fontWeight: typography.fontWeights.semibold as any },
  commitBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.light.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.full,
  },
  commitBtnDisabled: { opacity: 0.5 },
  commitBtnText: {
    color: "#fff",
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.semibold as any,
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.light.muted,
    borderRadius: 2,
    overflow: "hidden",
    marginBottom: 10,
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.light.primary,
  },
  tableWrap: { marginTop: 4 },
  tableHeader: {
    flexDirection: "row",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
    backgroundColor: colors.light.muted,
    paddingHorizontal: 6,
    borderTopLeftRadius: radii.md,
    borderTopRightRadius: radii.md,
  },
  th: {
    fontSize: 9,
    fontWeight: typography.fontWeights.semibold as any,
    color: colors.light.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: 1,
    paddingHorizontal: 4,
  },
  tr: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  trFailed: { backgroundColor: "#fef2f2" },
  td: {
    fontSize: typography.fontSizes.xs,
    color: colors.light.foreground,
    paddingHorizontal: 4,
  },
  tdIdx: { color: colors.light.mutedForeground },
  tdName: {
    fontSize: typography.fontSizes.xs,
    color: colors.light.foreground,
    fontWeight: typography.fontWeights.medium as any,
  },
  tdCat: {
    fontSize: 10,
    color: colors.light.mutedForeground,
    marginTop: 1,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  pillReady: { backgroundColor: colors.light.muted },
  pillOk: { backgroundColor: "#dcfce7" },
  pillFail: { backgroundColor: "#fce7f3" },
  pillError: { backgroundColor: "#fce7f3" },
  pillText: {
    fontSize: 10,
    fontWeight: typography.fontWeights.semibold as any,
  },
  pillTextReady: { color: colors.light.mutedForeground },
  pillTextOk: { color: "#166534" },
  pillTextFail: { color: "#9d174d" },

  errorPanel: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.light.border,
  },
  errorPanelTitle: {
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.semibold as any,
    color: colors.light.foreground,
    marginBottom: 6,
  },
  errorRow: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 4,
  },
  errorRowIdx: {
    fontSize: 11,
    fontFamily: "monospace",
    color: colors.light.mutedForeground,
    width: 28,
  },
  errorRowName: {
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.medium as any,
    color: colors.light.foreground,
  },
  errorMsg: {
    fontSize: 11,
    color: "#9d174d",
    marginTop: 1,
  },

  doneBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#ecfdf5",
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "#a7f3d0",
    padding: 14,
    marginBottom: 14,
  },
  doneIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: "#10b981",
    alignItems: "center",
    justifyContent: "center",
  },
  doneTitle: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold as any,
    color: "#065f46",
  },
  doneBody: {
    fontSize: 11,
    color: "#047857",
    marginTop: 1,
  },
});