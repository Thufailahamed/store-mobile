import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams, useNavigation } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@/components/ui/Icon";
import { SellerGlow } from "@/components/seller/chrome";
import { useAuth } from "@/lib/supabase/auth";
import {
  getSellerStore,
  getSellerProductById,
  createSellerProduct,
  updateSellerProduct,
  deleteSellerProduct,
  deleteSellerProductImage,
  setSellerProductImagePrimary,
  reorderSellerProductImages,
  saveSellerVariants,
  getAllCategories,
  getBrands,
  preflightModeration,
  checkSellerSkuAvailability,
  type SellerVariantInput,
} from "@/lib/api";
import { uploadProductImage } from "@/lib/upload";
import { coerceSellerProductStatus, statusToIsActive } from "@/lib/seller-product-status";
import { validateStoreSkus } from "@/lib/product-sku";
import {
  ProductMediaSection,
  type PendingProductImage,
} from "@/components/seller/ProductMediaSection";
import {
  ProductVariantsSection,
  createEmptyVariant,
  type VariantDraft,
} from "@/components/seller/ProductVariantsSection";
import { ProductSizeChartSection } from "@/components/seller/ProductSizeChartSection";
import { OptionPickerField } from "@/components/seller/OptionPickerSheet";
import {
  ModerationResultBanner,
  type ModerationResult,
} from "@/components/seller/ModerationResultBanner";
import {
  EditorCard,
  Field,
  Input,
  AffixInput,
  SuggestInput,
  Segmented,
  ToggleRow,
  TagInput,
  MetricTile,
  editorStyles,
  INK,
  CREAM,
  GOLD,
  RUST,
  OK_GREEN,
  FIELD_BG,
} from "@/components/seller/product-editor/primitives";
import { ProductPreviewCard } from "@/components/seller/product-editor/ProductPreviewCard";
import { colors, typography, radii, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import {
  discountPct as computeDiscountPct,
  formatPrice,
  percentToTaxRate,
  taxRateToPercent,
} from "@/lib/utils";
import { Skeleton } from "@/components/ui/Skeleton";
import { sizeSystemFor, type SizeSystem } from "@/lib/size-presets";
import {
  getStandardSizeGuidesBackend,
  getProductSizeGuideBackend,
  setProductSizeGuideBackend,
  type SizeGuideGrid,
} from "@/lib/api/backend";
import type { Product, ProductImage, ProductVariant, Category, Brand } from "@/lib/types";

const LOW_STOCK = 5;
const NAME_MAX = 120;
const SHORT_MAX = 180;
const DESC_MAX = 8000;
const META_MAX = 160;
const DRAFT_KEY = (userId: string) => `luxe:mobile-product-draft:${userId}`;

// Same keys the web editor writes into products.attributes (LuxuryFieldsCard).
const ATELIER_SHORT = [
  { key: "craft", label: "Craft technique", placeholder: "Hand-stitched, jacquard…" },
  { key: "origin_city", label: "Made in", placeholder: "Colombo, Sri Lanka" },
  { key: "collection_season", label: "Collection", placeholder: "FW25 Capsule" },
  { key: "model_height", label: "Model", placeholder: "178 cm · wears S" },
] as const;
const ATELIER_LONG = [
  { key: "fit_notes", label: "Fit notes", placeholder: "How it sits, sizing guidance." },
  { key: "sustainability_notes", label: "Sustainability", placeholder: "Materials, certifications, traceability." },
  { key: "atelier_story", label: "Atelier story", placeholder: "The maker, the place, the intent." },
] as const;
type AtelierKey = (typeof ATELIER_SHORT)[number]["key"] | (typeof ATELIER_LONG)[number]["key"];
const ATELIER_KEYS: AtelierKey[] = [...ATELIER_SHORT.map((f) => f.key), ...ATELIER_LONG.map((f) => f.key)];

const SUGGEST = {
  material: ["Cotton", "Linen", "Silk", "Wool", "Denim", "Leather", "Polyester"],
  pattern: ["Solid", "Striped", "Checked", "Floral", "Printed", "Embroidered"],
  fit: ["Regular", "Slim", "Relaxed", "Oversized", "Tailored"],
  sleeve: ["Sleeveless", "Short", "Half", "Three-quarter", "Long"],
  season: ["All Season", "Summer", "Monsoon", "Winter", "Festive"],
  occasion: ["Casual", "Formal", "Party", "Work", "Wedding", "Lounge"],
} as const;

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

// Carries how far the pending-image upload loop got before failing, so the
// caller can report a specific "product created but incomplete" message
// instead of a generic error (see syncImages).
class ImageSyncError extends Error {
  uploadedCount: number;
  totalPending: number;
  constructor(message: string, uploadedCount: number, totalPending: number) {
    super(message);
    this.uploadedCount = uploadedCount;
    this.totalPending = totalPending;
  }
}

type SkuState = { state: "idle" | "checking" | "ok" | "conflict"; message?: string };

// Expo Router reuses this screen when only the [id] param changes (e.g. opening
// a product, going back, then tapping "Add"). Keying by id forces a fresh mount
// so no form state from the previously opened product leaks into the new one.
export default function SellerProductEditRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <SellerProductEdit key={id ?? "new"} id={id ?? "new"} />;
}

function SellerProductEdit({ id }: { id: string }) {
  const router = useRouter();
  const navigation = useNavigation();
  const { user } = useAuth();
  // "create" reaches this editor directly: /products/new is the static AI quick-upload route.
  const isNew = id === "new" || id === "create";

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState<false | "draft" | "submit" | "save">(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [storeId, setStoreId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [loadedSlug, setLoadedSlug] = useState("");
  const [sku, setSku] = useState("");
  const [description, setDescription] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [material, setMaterial] = useState("");
  const [pattern, setPattern] = useState("");
  const [fit, setFit] = useState("");
  const [sleeve, setSleeve] = useState("");
  const [occasion, setOccasion] = useState("");
  const [season, setSeason] = useState("");
  const [careInstructions, setCareInstructions] = useState("");
  const [atelier, setAtelier] = useState<Partial<Record<AtelierKey, string>>>({});
  const [extraAttributes, setExtraAttributes] = useState<Record<string, string | number | boolean>>({});
  const [mrp, setMrp] = useState("");
  const [price, setPrice] = useState("");
  const [taxRate, setTaxRate] = useState("0");
  const [gender, setGender] = useState<string>("unisex");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brandId, setBrandId] = useState<string | null>(null);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [status, setStatus] = useState<string>("draft");
  const [initialStatus, setInitialStatus] = useState<string>("draft");
  const [tags, setTags] = useState<string[]>([]);
  const [isFeatured, setIsFeatured] = useState(false);
  const [skuCheck, setSkuCheck] = useState<SkuState>({ state: "idle" });

  const [preflight, setPreflight] = useState<{
    auto_approved: boolean;
    flagged: boolean;
    score: number;
    threshold: number;
    reasons: { rule_id: string; message: string; blocking: boolean }[];
  } | null>(null);
  const [preflightBusy, setPreflightBusy] = useState(false);

  const [existingImages, setExistingImages] = useState<ProductImage[]>([]);
  const [pendingImages, setPendingImages] = useState<PendingProductImage[]>([]);
  const [removedImageIds, setRemovedImageIds] = useState<string[]>([]);
  const [moderation, setModeration] = useState<ModerationResult>(null);

  const [variants, setVariants] = useState<VariantDraft[]>([]);
  const [removedVariantIds, setRemovedVariantIds] = useState<string[]>([]);
  // Size system and size chart. The system defaults to the one detected from the
  // category and name. The chart is the product's own, or the standard for its system.
  const [sizeSystemPick, setSizeSystemPick] = useState<SizeSystem | null>(null);
  const [sizeGuide, setSizeGuide] = useState<SizeGuideGrid>({ columns: [], rows: [] });
  const [standardGuides, setStandardGuides] = useState<Partial<Record<SizeSystem, SizeGuideGrid>>>({});
  useEffect(() => {
    let alive = true;
    getStandardSizeGuidesBackend().then((res) => {
      if (!alive || !res.ok) return;
      const next: Partial<Record<SizeSystem, SizeGuideGrid>> = {};
      for (const g of res.data) next[g.size_system as SizeSystem] = { columns: g.columns, rows: g.rows };
      setStandardGuides(next);
    });
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    if (isNew) return;
    let alive = true;
    getProductSizeGuideBackend(id).then((res) => {
      if (!alive || !res.ok || !res.data) return;
      if (res.data.size_system) setSizeSystemPick(res.data.size_system as SizeSystem);
      setSizeGuide({ columns: res.data.columns ?? [], rows: res.data.rows ?? [] });
    });
    return () => {
      alive = false;
    };
  }, [id, isNew]);
  const [initialVariantIds, setInitialVariantIds] = useState<string[]>([]);

  const scrollRef = useRef<ScrollView>(null);
  const sectionY = useRef<Record<string, number>>({});
  const initialSnapshot = useRef<string | null>(null);
  const allowLeave = useRef(false);
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(null);

  const trackSection = (key: string) => (e: { nativeEvent: { layout: { y: number } } }) => {
    sectionY.current[key] = e.nativeEvent.layout.y;
  };
  const scrollToSection = (key: string) => {
    const y = sectionY.current[key];
    if (y != null) scrollRef.current?.scrollTo({ y: Math.max(0, y - 10), animated: true });
  };

  useEffect(() => {
    // Reset per-product edit-session state so leftover removals from a
    // previously edited product can never be applied to this one if the
    // screen instance is ever reused for a different id.
    setPendingImages([]);
    setRemovedImageIds([]);
    setRemovedVariantIds([]);
    setLoadError(null);
    initialSnapshot.current = null;

    (async () => {
      if (!user) return;
      const [storeRes, categoriesRes, brandsRes] = await Promise.all([
        getSellerStore(user.id),
        getAllCategories(),
        getBrands({ limit: 100 }),
      ]);
      if (storeRes.ok && storeRes.data) setStoreId(storeRes.data.id);
      if (categoriesRes.ok) setCategories(categoriesRes.data);
      if (brandsRes.ok) setBrands(brandsRes.data);

      if (!isNew && id) {
        const productRes = await getSellerProductById(id);
        if (!productRes.ok || !productRes.data) {
          setLoadError(!productRes.ok ? productRes.error : "This piece could not be found.");
          setLoading(false);
          return;
        }
        const p = productRes.data;
        setName(p.name);
        setSlug(p.slug ?? "");
        setLoadedSlug(p.slug ?? "");
        setSlugEdited(true);
        setSku(p.sku ?? "");
        setDescription(p.description ?? "");
        setShortDescription(p.short_description ?? "");
        setMetaDescription(p.meta_description ?? "");
        setMaterial(p.material ?? "");
        setPattern(p.pattern ?? "");
        setFit(p.fit ?? "");
        setSleeve(p.sleeve ?? "");
        setOccasion(p.occasion ?? "");
        setSeason(p.season ?? "");
        setCareInstructions(p.care_instructions ?? "");
        // Keep only scalar attribute values — the backend schema rejects
        // nested objects — and split our atelier keys out for editing.
        const attrs = (p.attributes ?? {}) as Record<string, unknown>;
        const nextAtelier: Partial<Record<AtelierKey, string>> = {};
        const extras: Record<string, string | number | boolean> = {};
        for (const [k, v] of Object.entries(attrs)) {
          if ((ATELIER_KEYS as string[]).includes(k) && typeof v === "string") {
            nextAtelier[k as AtelierKey] = v;
          } else if (["string", "number", "boolean"].includes(typeof v) && k !== "care_instructions") {
            extras[k] = v as string | number | boolean;
          }
        }
        setAtelier(nextAtelier);
        setExtraAttributes(extras);
        setMrp(p.mrp != null ? String(p.mrp) : "");
        setPrice(p.price != null ? String(p.price) : "");
        setTaxRate(String(taxRateToPercent(Number(p.tax_rate ?? 0))));
        setGender(p.gender ?? "unisex");
        setCategoryId(p.category_id ?? null);
        setBrandId(p.brand_id ?? null);
        setStatus(p.status);
        setInitialStatus(p.status);
        setTags(p.tags ?? []);
        setIsFeatured(Boolean(p.is_featured));
        setExistingImages(p.images ?? []);

        const loadedVariants =
          p.variants && p.variants.length > 0
            ? p.variants.map((v) => ({
                key: v.id,
                id: v.id,
                sku: v.sku ?? "",
                size: v.size ?? "",
                color: v.color ?? "",
                colorHex: (v as ProductVariant).color_hex ?? "",
                material: (v as ProductVariant).material ?? "",
                pattern: (v as ProductVariant).pattern ?? "",
                fit: (v as ProductVariant).fit ?? "",
                price: v.price != null ? String(v.price) : "",
                stock: v.stock != null ? String(v.stock) : "",
              }))
            : [];
        setVariants(loadedVariants);
        setInitialVariantIds(loadedVariants.map((v) => v.id).filter(Boolean) as string[]);
      }
      setLoading(false);
    })();
  }, [user, isNew, id]);

  // ── Derived ───────────────────────────────────────────────────────────
  const visibleExistingImages = useMemo(
    () => existingImages.filter((img) => !removedImageIds.includes(img.id)),
    [existingImages, removedImageIds],
  );

  const autoSlug = slugify(name);
  const effectiveSlug = slugEdited ? slug : autoSlug;

  const formSnapshot = useMemo(
    () =>
      JSON.stringify({
        name, slug: effectiveSlug, sku, description, shortDescription, metaDescription,
        material, pattern, fit, sleeve, occasion, season, careInstructions, atelier,
        mrp, price, taxRate, gender, categoryId, brandId, status, tags, isFeatured,
        variants: variants.map(({ key: _k, ...rest }) => rest),
        images: visibleExistingImages.map((i) => i.id),
      }),
    [name, effectiveSlug, sku, description, shortDescription, metaDescription, material, pattern, fit,
      sleeve, occasion, season, careInstructions, atelier, mrp, price, taxRate, gender, categoryId,
      brandId, status, tags, isFeatured, variants, visibleExistingImages],
  );

  useEffect(() => {
    if (!loading && initialSnapshot.current === null) initialSnapshot.current = formSnapshot;
  }, [loading, formSnapshot]);

  const isDirty =
    !loading &&
    initialSnapshot.current !== null &&
    (initialSnapshot.current !== formSnapshot || pendingImages.length > 0 || removedImageIds.length > 0);

  // ── Quick-with-AI handoff (analyze → prefill add-form for review) ────
  const quickAppliedRef = useRef(false);
  useEffect(() => {
    if (!isNew || loading || quickAppliedRef.current) return;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem("luxe:mobile-quick-ai-draft");
        if (!raw) {
          quickAppliedRef.current = true;
          return;
        }
        const peek = JSON.parse(raw) as Record<string, any>;
        // Categories load async — defer so a text guess can still be matched.
        if (!peek?.category_id && (peek?.category_guess || peek?.categoryGuess) && categories.length === 0) return;
        quickAppliedRef.current = true;
        const d = peek;
        if (!d?.name && !d?.description && !(d?.images as unknown[])?.length && !d?.localUri) return;
        const str = (v: unknown) => (typeof v === "string" ? v : "");
        const numStr = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? String(v) : "");
        const arr = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
        const normGuess = (s: string) => {
          let v = s.trim().toLowerCase();
          if (v.length > 3) {
            if (/(ches|shes|sses|xes|zes)$/.test(v)) v = v.slice(0, -2);
            else if (v.endsWith("ies")) v = v.slice(0, -3) + "y";
            else if (v.endsWith("s") && !v.endsWith("ss")) v = v.slice(0, -1);
          }
          return v;
        };
        setName(str(d.name).slice(0, 120));
        setDescription(str(d.description).slice(0, 8000));
        setShortDescription(str(d.short_description ?? d.shortDescription).slice(0, 180));
        setMaterial(str(d.material));
        setPattern(str(d.pattern));
        setFit(str(d.fit));
        setSleeve(str(d.sleeve));
        setOccasion(str(d.occasion));
        setSeason(str(d.season));
        setCareInstructions(str(d.care_instructions ?? d.careInstructions).slice(0, 400));
        const priceStr = numStr(d.price);
        const mrpStr = numStr(d.mrp) || priceStr;
        if (priceStr) setPrice(priceStr);
        if (mrpStr) setMrp(mrpStr);
        const gender = ["men", "women", "kids", "unisex"].includes(str(d.gender)) ? str(d.gender) : "unisex";
        setGender(gender);
        // Backend-resolved category wins; otherwise match the text guess locally.
        if (typeof d.category_id === "string" && d.category_id) {
          setCategoryId(d.category_id);
        } else if (str(d.category_guess || d.categoryGuess)) {
          const want = normGuess(str(d.category_guess || d.categoryGuess));
          const hit =
            categories.find((c) => normGuess(c.name) === want) ??
            categories.find((c) => {
              const have = normGuess(c.name);
              return have && want.length >= 4 && (have.includes(want) || want.includes(have));
            });
          if (hit) setCategoryId(hit.id);
        }
        const tags = arr(d.tags).slice(0, 20);
        if (tags.length) setTags(tags);
        const colorName = str(d.color) || arr(d.colors)[0] || "";
        const colorHex = typeof d.color_hex === "string" && /^#[0-9a-fA-F]{6}$/.test(d.color_hex) ? d.color_hex : "";
        setVariants((prev) => {
          // Keep the AI's colour and price on a variant with no size yet, so
          // the seller picks one instead of getting a placeholder "One Size" row.
          const base = prev.length ? prev : [{ ...createEmptyVariant(), size: "" }];
          return base.map((v, i) =>
            i === 0
              ? {
                  ...v,
                  color: colorName || v.color,
                  colorHex: colorHex || v.colorHex,
                  material: str(d.material) || v.material,
                  pattern: str(d.pattern) || v.pattern,
                  fit: str(d.fit) || v.fit,
                  price: priceStr || v.price,
                }
              : v,
          );
        });
        // Seed the exact photo the seller picked so save re-uploads it via
        // the existing syncImages path (remote vision URL is not reused).
        const localUri = str((d as Record<string, unknown>).localUri);
        if (localUri) {
          setPendingImages([
            {
              key: `quick-ai-${Date.now()}`,
              uri: localUri,
              mimeType: typeof d.localMimeType === "string" ? (d.localMimeType as string) : null,
              fileName: null,
              isPrimary: true,
            },
          ]);
        }
        await AsyncStorage.removeItem("luxe:mobile-quick-ai-draft").catch(() => {});
        const needsReview = Boolean(d.needs_review ?? d.needsReview);
        Alert.alert(
          "AI draft ready — review and publish",
          needsReview
            ? "The photo was unclear, so double-check the name, category and details before publishing."
            : "The AI filled the details from your photo. Change anything, then save.",
        );
      } catch {
        // ignore corrupt drafts
      }
    })();
  }, [isNew, loading, categories]);

  // ── Draft autosave (new products only; photos aren't persisted) ───────
  const restoredRef = useRef(false);
  useEffect(() => {
    if (!isNew || loading || !user || restoredRef.current) return;
    restoredRef.current = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(DRAFT_KEY(user.id));
        if (!raw) return;
        const d = JSON.parse(raw) as Record<string, any>;
        if (!d?.name && !d?.price && !d?.description) return;
        Alert.alert("Continue your draft?", `You have an unsaved product${d.name ? ` “${d.name}”` : ""}. Photos need to be added again.`, [
          {
            text: "Discard",
            style: "destructive",
            onPress: () => AsyncStorage.removeItem(DRAFT_KEY(user.id)).catch(() => {}),
          },
          {
            text: "Restore",
            onPress: () => {
              setName(d.name ?? "");
              if (d.slugEdited) {
                setSlug(d.slug ?? "");
                setSlugEdited(true);
              }
              setSku(d.sku ?? "");
              setDescription(d.description ?? "");
              setShortDescription(d.shortDescription ?? "");
              setMetaDescription(d.metaDescription ?? "");
              setMaterial(d.material ?? "");
              setPattern(d.pattern ?? "");
              setFit(d.fit ?? "");
              setSleeve(d.sleeve ?? "");
              setOccasion(d.occasion ?? "");
              setSeason(d.season ?? "");
              setCareInstructions(d.careInstructions ?? "");
              setAtelier(d.atelier ?? {});
              setMrp(d.mrp ?? "");
              setPrice(d.price ?? "");
              setTaxRate(d.taxRate ?? "0");
              setGender(d.gender ?? "unisex");
              setCategoryId(d.categoryId ?? null);
              setBrandId(d.brandId ?? null);
              setTags(Array.isArray(d.tags) ? d.tags : []);
              setIsFeatured(Boolean(d.isFeatured));
              if (Array.isArray(d.variants) && d.variants.length) {
                setVariants(d.variants.map((v: Omit<VariantDraft, "key">, i: number) => ({ ...createEmptyVariant(`restored-${i}`), ...v, id: undefined })));
              }
            },
          },
        ]);
      } catch {
        // ignore corrupt drafts
      }
    })();
  }, [isNew, loading, user]);

  useEffect(() => {
    if (!isNew || !user || !isDirty) return;
    const t = setTimeout(() => {
      const parsed = JSON.parse(formSnapshot);
      AsyncStorage.setItem(DRAFT_KEY(user.id), JSON.stringify({ ...parsed, slugEdited }))
        .then(() => setDraftSavedAt(new Date()))
        .catch(() => {});
    }, 1500);
    return () => clearTimeout(t);
  }, [formSnapshot, isDirty, isNew, user, slugEdited]);

  // ── Unsaved-changes guard (back button, swipe, hardware back) ─────────
  useEffect(() => {
    const unsub = navigation.addListener("beforeRemove" as any, (e: any) => {
      if (allowLeave.current || !isDirty || saving) return;
      e.preventDefault();
      Alert.alert(
        "Leave without saving?",
        isNew ? "Your text is kept as a draft on this device, but new photos will be lost." : "Your unsaved changes will be discarded.",
        [
          { text: "Stay", style: "cancel" },
          { text: "Leave", style: "destructive", onPress: () => navigation.dispatch(e.data.action) },
        ],
      );
    });
    return unsub;
  }, [navigation, isDirty, saving, isNew]);

  // ── Live SKU availability (debounced) ─────────────────────────────────
  useEffect(() => {
    const value = sku.trim();
    if (!value) {
      setSkuCheck({ state: "idle" });
      return;
    }
    setSkuCheck({ state: "checking" });
    const t = setTimeout(async () => {
      const res = await checkSellerSkuAvailability(value, isNew ? undefined : id);
      if (!res.ok) {
        setSkuCheck({ state: "idle" });
        return;
      }
      setSkuCheck(res.data.conflict ? { state: "conflict", message: res.data.message } : { state: "ok" });
    }, 550);
    return () => clearTimeout(t);
  }, [sku, isNew, id]);

  // ── Image handlers ────────────────────────────────────────────────────
  const handleAddPending = (image: PendingProductImage) => {
    setPendingImages((prev) => [...prev, image]);
  };

  const handleRemoveExisting = (imageId: string) => {
    setRemovedImageIds((prev) => [...prev, imageId]);
    setExistingImages((prev) =>
      prev.map((img) => (img.id === imageId ? { ...img, is_primary: false } : img)),
    );
  };

  const handleRemovePending = (key: string) => {
    setPendingImages((prev) => {
      const next = prev.filter((img) => img.key !== key);
      if (next.length > 0 && !next.some((img) => img.isPrimary)) {
        next[0] = { ...next[0], isPrimary: true };
      }
      return next;
    });
  };

  const handleSetPrimaryExisting = async (imageId: string) => {
    setExistingImages((prev) => prev.map((img) => ({ ...img, is_primary: img.id === imageId })));
    setPendingImages((prev) => prev.map((img) => ({ ...img, isPrimary: false })));
    if (!isNew && id) {
      await setSellerProductImagePrimary(id, imageId);
    }
  };

  const handleSetPrimaryPending = (key: string) => {
    setPendingImages((prev) => prev.map((img) => ({ ...img, isPrimary: img.key === key })));
    setExistingImages((prev) => prev.map((img) => ({ ...img, is_primary: false })));
  };

  const handleMoveExisting = (imageId: string, direction: "left" | "right") => {
    const visible = existingImages.filter((img) => !removedImageIds.includes(img.id));
    const idx = visible.findIndex((img) => img.id === imageId);
    if (idx < 0) return;
    const target = direction === "left" ? idx - 1 : idx + 1;
    if (target < 0 || target >= visible.length) return;
    const reordered = [...visible];
    const [moved] = reordered.splice(idx, 1);
    reordered.splice(target, 0, moved);
    setExistingImages((prev) => {
      const removed = prev.filter((img) => removedImageIds.includes(img.id));
      return [...reordered, ...removed];
    });
  };

  const buildVariantInputs = (): SellerVariantInput[] => {
    const baseMrp = Number(mrp) || Number(price) || 0;
    return variants.map((variant, index) => {
      const hex = variant.colorHex.trim();
      return {
        id: variant.id,
        sku: variant.sku.trim() || undefined,
        size: variant.size.trim() || undefined,
        color: variant.color.trim() || undefined,
        // Backend only accepts full #RRGGBB values.
        color_hex: /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : undefined,
        material: variant.material.trim() || undefined,
        pattern: variant.pattern.trim() || undefined,
        fit: variant.fit.trim() || undefined,
        price: variant.price.trim() ? Number(variant.price) : undefined,
        mrp: baseMrp,
        stock: Math.max(0, Number(variant.stock) || 0),
        position: index,
        is_active: true,
      };
    });
  };

  const syncImages = async (productId: string) => {
    if (!storeId) throw new Error("Store not found");

    for (const imageId of removedImageIds) {
      const res = await deleteSellerProductImage(productId, imageId);
      if (!res.ok) throw new Error(res.error);
    }

    // Sync reorder of remaining existing images
    if (visibleExistingImages.length > 1) {
      const order = visibleExistingImages.map((img, i) => ({ id: img.id, position: i }));
      const reorderRes = await reorderSellerProductImages(productId, order);
      if (!reorderRes.ok) throw new Error(reorderRes.error);
    }

    if (pendingImages.length === 0) return;

    setUploadingImages(true);
    const startPosition = visibleExistingImages.length;
    for (let i = 0; i < pendingImages.length; i++) {
      const img = pendingImages[i];
      const res = await uploadProductImage(
        storeId,
        productId,
        img.uri,
        startPosition + i,
        img.isPrimary,
        { mimeType: img.mimeType, fileName: img.fileName },
      );
      if (res.error) {
        // The product record already exists at this point (created/updated before
        // syncImages runs), and everything after this call — including variants —
        // never gets saved. Throw a typed error so handleSave can tell the seller
        // the product now exists in a half-configured state, instead of a generic
        // failure message that hides that.
        throw new ImageSyncError(res.error, i, pendingImages.length);
      }
    }
    setUploadingImages(false);

    const primaryExisting = visibleExistingImages.find((img) => img.is_primary);
    if (primaryExisting) {
      await setSellerProductImagePrimary(productId, primaryExisting.id);
    }
  };

  const buildAttributes = () => {
    const out: Record<string, string | number | boolean> = { ...extraAttributes };
    for (const k of ATELIER_KEYS) {
      const v = atelier[k]?.trim();
      if (v) out[k] = v.slice(0, k === "atelier_story" ? 1200 : 400);
    }
    // Web stores care in attributes too — keep both in sync.
    if (careInstructions.trim()) out.care_instructions = careInstructions.trim().slice(0, 400);
    return out;
  };

  const handleSave = async (mode: "draft" | "submit" | "save") => {
    if (!name.trim()) {
      scrollToSection("info");
      Alert.alert("Name needed", "Give this product a name before saving.");
      return;
    }
    if (!price || Number.isNaN(Number(price))) {
      scrollToSection("pricing");
      Alert.alert("Price needed", "Enter a valid selling price.");
      return;
    }
    // price ≤ mrp — same gate as the web form
    const mrpNum = Number(mrp);
    const priceNum = Number(price);
    if (mrpNum > 0 && priceNum > mrpNum) {
      scrollToSection("pricing");
      Alert.alert("Check prices", "Selling price must be less than or equal to the compare-at price.");
      return;
    }
    if (!storeId) {
      Alert.alert("Error", "Store not found");
      return;
    }
    if (variants.length === 0) {
      Alert.alert("Error", "Add at least one variant with stock");
      return;
    }
    if (variants.some((v) => !v.size.trim())) {
      scrollToSection("variants");
      Alert.alert("Choose a size", "Every variant needs a size. Pick one in Quick add sizes & colours.");
      return;
    }

    const totalImages = visibleExistingImages.length + pendingImages.length;
    if (totalImages === 0) {
      scrollToSection("photos");
      Alert.alert("Add a photo", "Add at least one product photo.");
      return;
    }
    if (skuCheck.state === "conflict") {
      scrollToSection("info");
      Alert.alert("Duplicate SKU", skuCheck.message ?? "This SKU is already used in your store.");
      return;
    }

    const skuValidation = await validateStoreSkus({
      storeId,
      productId: isNew ? undefined : id,
      productSku: sku.trim() || undefined,
      variants: variants.map((variant) => ({ id: variant.id, sku: variant.sku })),
    });
    if (!skuValidation.ok) {
      Alert.alert("Duplicate SKU", skuValidation.error);
      return;
    }

    const requested =
      mode === "draft" ? "draft" : mode === "submit" ? "active" : status;

    setSaving(mode);
    let productId: string | undefined = isNew ? undefined : id;
    let nextModeration: ModerationResult = null;
    try {
      const mrpValue = Number(mrp) || priceNum;
      const nextStatus = coerceSellerProductStatus(
        requested as Product["status"],
        initialStatus as Product["status"],
      );
      const cleanSlug = slugify(effectiveSlug);
      const slugToSend = isNew
        ? `${cleanSlug || "product"}${slugEdited ? "" : `-${Date.now().toString(36).slice(-5)}`}`
        : cleanSlug && cleanSlug !== loadedSlug
          ? cleanSlug
          : undefined;
      const attributes = buildAttributes();
      const productData: Partial<Product> = {
        name: name.trim(),
        slug: slugToSend,
        sku: sku.trim() || undefined,
        description: description.trim() || undefined,
        short_description: shortDescription.trim() || undefined,
        meta_description: (metaDescription.trim() || shortDescription.trim() || undefined)?.slice(0, 500),
        material: material.trim() || undefined,
        pattern: pattern.trim() || undefined,
        fit: fit.trim() || undefined,
        sleeve: sleeve.trim() || undefined,
        occasion: occasion.trim() || undefined,
        season: season.trim() || undefined,
        care_instructions: careInstructions.trim() || undefined,
        attributes: Object.keys(attributes).length ? attributes : undefined,
        mrp: mrpValue,
        price: priceNum,
        discount_pct: computeDiscountPct(mrpValue, priceNum),
        tax_rate: percentToTaxRate(Number(taxRate) || 0),
        gender: gender as Product["gender"],
        category_id: categoryId ?? undefined,
        brand_id: brandId ?? undefined,
        // Sellers cannot self-publish. coerceSellerProductStatus
        // downgrades "active" → "pending" unless the product is already live.
        status: nextStatus,
        is_active: statusToIsActive(nextStatus),
        is_featured: isFeatured,
        tags,
        store_id: storeId,
        currency: "LKR",
      };

      if (isNew) {
        const res = await createSellerProduct(productData);
        if (!res.ok) throw new Error(res.error);
        productId = res.data.product.id;
        nextModeration = res.data.moderation;
        setModeration(nextModeration);
      } else {
        const res = await updateSellerProduct(id!, productData);
        if (!res.ok) throw new Error(res.error);
        productId = res.data.product.id;
        nextModeration = res.data.moderation;
        setModeration(nextModeration);
      }

      if (!productId) throw new Error("Product could not be saved");

      await syncImages(productId);

      const removedIds = [
        ...removedVariantIds,
        ...initialVariantIds.filter((variantId) => !variants.some((v) => v.id === variantId)),
      ];
      const variantRes = await saveSellerVariants(productId, storeId, buildVariantInputs(), removedIds);
      if (!variantRes.ok) throw new Error(variantRes.error);

      // The chart is saved after the variants. A failure here doesn't undo the
      // product, so it is reported in the success banner instead.
      const guideRes = await setProductSizeGuideBackend(productId, {
        size_system: sizeSystemPick,
        columns: sizeGuide.columns,
        rows: sizeGuide.rows,
      });
      const guideWarning = guideRes.ok ? null : guideRes.error;

      if (isNew && user) AsyncStorage.removeItem(DRAFT_KEY(user.id)).catch(() => {});
      allowLeave.current = true;

      let title = mode === "draft" ? "Draft saved" : isNew ? "Submitted for review" : "Changes saved";
      let banner = mode === "draft" ? "You can finish and submit it any time from Products." : "We’ll notify you once it’s reviewed.";
      if (nextModeration && mode !== "draft") {
        if (nextModeration.auto_approved) {
          title = "Live now";
          banner = `Auto-approved · score ${nextModeration.score}/${nextModeration.threshold}`;
        } else if (nextModeration.flagged) {
          banner = `Pending review · score ${nextModeration.score}/${nextModeration.threshold}`;
        }
      }
      if (!isNew && mode === "save") banner = nextModeration ? banner : "Your product has been updated.";
      if (guideWarning) banner = `${banner} Size chart not saved: ${guideWarning}`;
      Alert.alert(title, banner, [{ text: "OK", onPress: () => router.back() }]);
    } catch (e: any) {
      if (e instanceof ImageSyncError && productId) {
        const failedCount = e.totalPending - e.uploadedCount;
        allowLeave.current = true;
        Alert.alert(
          "Product incomplete",
          `Product ${isNew ? "created" : "updated"}, but ${failedCount} of ${e.totalPending} image${e.totalPending === 1 ? "" : "s"} failed to upload and variants weren't saved. Please edit this product to finish setting it up.`,
          [
            {
              text: "Edit now",
              onPress: () => {
                if (isNew) router.replace(`/(seller)/products/${productId}` as any);
              },
            },
          ],
        );
      } else {
        Alert.alert("Couldn’t save", e?.message ?? "Failed to save product");
      }
    } finally {
      setSaving(false);
      setUploadingImages(false);
    }
  };

  const trackRemovedVariant = (next: VariantDraft[]) => {
    const removed = variants.filter((v) => v.id && !next.some((n) => n.id === v.id)).map((v) => v.id!);
    if (removed.length > 0) {
      setRemovedVariantIds((prev) => [...new Set([...prev, ...removed])]);
    }
    setVariants(next);
  };

  const generateSku = () => {
    const base = (autoSlug || "item")
      .split("-")
      .filter(Boolean)
      .slice(0, 3)
      .map((w) => w.slice(0, 3))
      .join("-")
      .toUpperCase();
    setSku(`LX-${base}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`);
  };

  const isLive = initialStatus === "active";
  const statuses = [
    { key: "draft", label: "Draft", icon: "document-outline" },
    { key: "active", label: isLive ? "Live" : "Submit", icon: isLive ? "radio-button-on" : "paper-plane-outline" },
    { key: "archived", label: "Archive", icon: "archive-outline" },
  ] as const;

  const hasPhotos = visibleExistingImages.length + pendingImages.length > 0;
  const totalStock = variants.reduce((s, v) => s + (Number(v.stock) || 0), 0);
  const priceAheadOfMrp = Number(mrp) > 0 && Number(price) > Number(mrp);
  const steps = [
    { key: "photos", section: "photos", label: "Photos", done: hasPhotos },
    { key: "name", section: "info", label: "Name", done: name.trim().length > 1 },
    { key: "price", section: "pricing", label: "Price", done: Number(price) > 0 && !priceAheadOfMrp },
    { key: "stock", section: "variants", label: "Stock", done: totalStock > 0 },
    { key: "category", section: "organise", label: "Category", done: Boolean(categoryId) },
    { key: "description", section: "info", label: "Description", done: Boolean(description.trim() || shortDescription.trim()) },
  ];
  const doneCount = steps.filter((x) => x.done).length;
  const allDone = doneCount === steps.length;
  const essentialsLeft = steps.slice(0, 4).filter((s) => !s.done);

  const priceNum = Number(price) || 0;
  const mrpNum = Number(mrp) || 0;
  const computedDiscount = computeDiscountPct(mrpNum, priceNum);
  const taxPct = Number(taxRate) || 0;
  const netOfTax = priceNum > 0 ? Math.round(priceNum / (1 + taxPct / 100)) : 0;

  const categoryOptions = useMemo(() => {
    const byId = new Map(categories.map((c) => [c.id, c]));
    return categories
      .map((c) => {
        const parent = c.parent_id ? byId.get(c.parent_id) : undefined;
        return { id: c.id, name: parent ? `${parent.name} › ${c.name}` : c.name };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [categories]);
  const categoryIsParent = Boolean(categoryId && categories.some((c) => c.parent_id === categoryId));
  const selectedCategory = categories.find((c) => c.id === categoryId);
  // Parent name too — "Footwear › Sneakers" still detects on either token.
  const categoryLabel = [
    selectedCategory?.parent_id
      ? categories.find((p) => p.id === selectedCategory.parent_id)?.name
      : null,
    selectedCategory?.name,
  ].filter(Boolean).join(" ");
  const sizeSystem: SizeSystem = sizeSystemPick ?? sizeSystemFor(categoryLabel, name);

  const coverUri =
    pendingImages.find((p) => p.isPrimary)?.uri ??
    visibleExistingImages.find((i) => i.is_primary)?.url ??
    visibleExistingImages[0]?.url ??
    pendingImages[0]?.uri;
  const brandName = brands.find((b) => b.id === brandId)?.name;
  const swatches = Array.from(new Set(variants.map((v) => v.colorHex).filter((h) => /^#[0-9a-fA-F]{6}$/.test(h))));
  const sizeList = Array.from(new Set(variants.map((v) => v.size.trim()).filter((s) => s && s !== "One Size")));
  const attributeSummary = [material, pattern, fit, sleeve, season, occasion].filter((v) => v.trim()).join(" · ");
  const atelierFilled = ATELIER_KEYS.filter((k) => atelier[k]?.trim()).length;
  const metaPreview = (metaDescription.trim() || shortDescription.trim() || description.trim()).slice(0, META_MAX);

  // Live moderation preflight (debounced)
  useEffect(() => {
    if (!name.trim() || !price || Number.isNaN(Number(price))) {
      setPreflight(null);
      return;
    }
    const handle = setTimeout(async () => {
      setPreflightBusy(true);
      const res = await preflightModeration({
        name: name.trim(),
        description: description.trim() || null,
        price: Number(price),
        mrp: Number(mrp) || undefined,
        brand_id: brandId,
        category_id: categoryId,
        image_urls: existingImages.filter((i) => !removedImageIds.includes(i.id)).map((i) => i.url),
        variant_count: variants.length,
      });
      setPreflightBusy(false);
      if (res.ok) setPreflight(res.data);
    }, 600);
    return () => clearTimeout(handle);
  }, [name, description, price, mrp, brandId, categoryId, existingImages, removedImageIds, variants.length]);

  const handleDeleteProduct = () => {
    if (isNew || !id) return;
    Alert.alert("Delete product?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setSaving("save");
          const res = await deleteSellerProduct(id);
          setSaving(false);
          if (res.ok) {
            allowLeave.current = true;
            router.back();
          } else {
            Alert.alert("Error", res.error);
          }
        },
      },
    ]);
  };

  const setAtelierField = useCallback((k: AtelierKey, v: string) => setAtelier((prev) => ({ ...prev, [k]: v })), []);

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={["top"]}>
        <StatusBar barStyle="dark-content" />
        <View style={{ width: "100%", padding: spacing[5], gap: 14 }}>
          <Skeleton width={72} height={10} />
          <Skeleton width="55%" height={28} />
          <Skeleton height={120} borderRadius={radii.xl} style={{ marginTop: 8 }} />
          <Skeleton height={48} borderRadius={radii.lg} />
          <Skeleton height={48} borderRadius={radii.lg} />
          <Skeleton height={48} borderRadius={radii.lg} />
        </View>
      </SafeAreaView>
    );
  }

  if (loadError) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={["top"]}>
        <StatusBar barStyle="dark-content" />
        <Ionicons name="cloud-offline-outline" size={40} color={colors.olive[700]} />
        <Text style={styles.errorTitle}>Couldn’t open this piece</Text>
        <Text style={styles.errorSub}>{loadError}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => router.back()}>
          <Text style={styles.retryBtnText}>Back to collection</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const statusLabel =
    status === "active" ? (isLive ? "Live" : "Submit") : status === "pending" ? "In review" : status === "archived" ? "Archived" : "Draft";

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar barStyle="dark-content" />
      <SellerGlow />
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back to products"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={20} color={INK} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.title} numberOfLines={1}>
            {isNew ? "New product" : "Edit product"}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {!isNew && name.trim()
              ? name.trim()
              : isDirty
                ? draftSavedAt
                  ? "Draft autosaved on this device"
                  : "Unsaved changes"
                : "Fill in the essentials to list"}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => scrollToSection("preview")}
          accessibilityRole="button"
          accessibilityLabel="Jump to storefront preview"
        >
          <Ionicons name="eye-outline" size={19} color={INK} />
        </TouchableOpacity>
        <View style={[styles.headerStatus, status === "active" && styles.headerStatusLive]}>
          <View style={[styles.headerStatusDot, status === "active" && styles.headerStatusDotLive]} />
          <Text style={[styles.headerStatusText, status === "active" && styles.headerStatusTextLive]}>{statusLabel}</Text>
        </View>
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          ref={scrollRef}
          style={styles.scroller}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {moderation ? <ModerationResultBanner result={moderation} isNew={isNew} /> : null}

          {/* ── Completeness ─────────────────────────────────────────── */}
          <View style={[styles.progressCard, allDone && styles.progressCardDone]}>
            <View style={styles.progressTop}>
              <View style={[styles.progressBadge, allDone && styles.progressBadgeDone]}>
                {allDone ? (
                  <Ionicons name="checkmark" size={20} color={CREAM} />
                ) : (
                  <Text style={styles.progressBadgeText}>
                    {doneCount}/{steps.length}
                  </Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.progressTitle}>{allDone ? "Ready to submit" : "Listing checklist"}</Text>
                <Text style={styles.progressSub}>
                  {allDone ? "Everything shoppers need is in place." : "Tap an item to jump to it"}
                </Text>
              </View>
              <Text style={styles.progressPct}>{Math.round((doneCount / steps.length) * 100)}%</Text>
            </View>
            <View style={styles.progressSegs}>
              {steps.map((x) => (
                <View key={x.key} style={[styles.progressSeg, x.done && styles.progressSegDone]} />
              ))}
            </View>
            <View style={styles.progressSteps}>
              {steps.map((x) => (
                <TouchableOpacity
                  key={x.key}
                  style={[styles.stepChip, x.done && styles.stepChipDone]}
                  onPress={() => scrollToSection(x.section)}
                  accessibilityRole="button"
                  accessibilityLabel={`${x.label}${x.done ? ", done" : ", to do"}`}
                >
                  <Ionicons
                    name={x.done ? "checkmark-circle" : "ellipse-outline"}
                    size={14}
                    color={x.done ? OK_GREEN : colors.ink.mute}
                  />
                  <Text style={[styles.stepText, x.done && styles.stepTextDone]}>{x.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* ── Photos ───────────────────────────────────────────────── */}
          <View onLayout={trackSection("photos")}>
            <ProductMediaSection
              existing={visibleExistingImages}
              pending={pendingImages}
              uploading={uploadingImages}
              onAddPending={handleAddPending}
              onRemoveExisting={handleRemoveExisting}
              onRemovePending={handleRemovePending}
              onSetPrimaryExisting={handleSetPrimaryExisting}
              onSetPrimaryPending={handleSetPrimaryPending}
              onMoveExisting={!isNew ? handleMoveExisting : undefined}
            />
          </View>

          {/* ── Product information ──────────────────────────────────── */}
          <EditorCard
            icon="document-text-outline"
            title="Product information"
            hint="The foundation of your catalogue entry."
            required
            onLayout={trackSection("info")}
          >
            <Field
              label="Product name"
              required
              counter={{ value: name.length, max: NAME_MAX }}
              hint={name.length ? undefined : "Clear and descriptive helps shoppers find it."}
            >
              <Input value={name} onChangeText={setName} placeholder="e.g. Atelier Cotton Crew Tee" maxLength={NAME_MAX + 20} />
            </Field>

            <Field
              label="Short description"
              hint="Shown on product cards"
              counter={{ value: shortDescription.length, max: SHORT_MAX }}
            >
              <Input
                value={shortDescription}
                onChangeText={setShortDescription}
                placeholder="e.g. Heritage cotton, garment-dyed"
                maxLength={SHORT_MAX + 40}
              />
            </Field>

            <Field
              label="Full description"
              hint="Craft, fit, occasion, styling notes."
              counter={{ value: description.length, max: DESC_MAX }}
            >
              <Input
                value={description}
                onChangeText={setDescription}
                placeholder="Describe the fabric, the cut, the maker…"
                multiline
                numberOfLines={5}
                style={{ minHeight: 132 }}
              />
            </Field>

            <Field
              label="SKU"
              style={{ marginBottom: 0 }}
              error={skuCheck.state === "conflict" ? skuCheck.message ?? "Already used in your store." : null}
              hint={
                skuCheck.state === "checking"
                  ? "Checking availability…"
                  : skuCheck.state === "ok"
                    ? "✓ SKU is available"
                    : "Optional · your internal stock code"
              }
              right={
                <TouchableOpacity onPress={generateSku} hitSlop={8} accessibilityRole="button" style={styles.inlineAction}>
                  <Ionicons name="sparkles-outline" size={13} color={colors.olive[700]} />
                  <Text style={styles.inlineActionText}>Generate</Text>
                </TouchableOpacity>
              }
            >
              <Input
                mono
                value={sku}
                onChangeText={setSku}
                placeholder="e.g. LX-CTN-TEE-01"
                autoCapitalize="characters"
                autoCorrect={false}
                warn={skuCheck.state === "conflict"}
              />
            </Field>
          </EditorCard>

          {/* ── Pricing ──────────────────────────────────────────────── */}
          <EditorCard
            icon="pricetag-outline"
            title="Pricing"
            hint="Selling price, compare-at and tax."
            required
            onLayout={trackSection("pricing")}
          >
            <View style={editorStyles.row}>
              <Field label="Selling price" required style={{ flex: 1 }}>
                <AffixInput
                  prefix="LKR"
                  value={price}
                  onChangeText={setPrice}
                  placeholder="0"
                  keyboardType="numeric"
                  warn={priceAheadOfMrp}
                />
              </Field>
              <Field label="Compare-at (MRP)" style={{ flex: 1 }}>
                <AffixInput prefix="LKR" value={mrp} onChangeText={setMrp} placeholder="Optional" keyboardType="numeric" />
              </Field>
            </View>

            {priceAheadOfMrp ? (
              <View style={[styles.priceNote, styles.priceNoteWarn]}>
                <Ionicons name="alert-circle-outline" size={15} color={RUST} />
                <Text style={styles.fieldHintWarn}>Selling price can’t be higher than the compare-at price.</Text>
              </View>
            ) : priceNum > 0 ? (
              <View style={styles.metricRow}>
                <MetricTile
                  icon="trending-down-outline"
                  label="Discount"
                  value={`${computedDiscount}%`}
                  hint={computedDiscount > 0 ? `Saves ${formatPrice(mrpNum - priceNum)}` : "Add an MRP to show one"}
                  tone={computedDiscount > 0 ? "olive" : "mute"}
                />
                <MetricTile
                  icon="wallet-outline"
                  label="Before tax"
                  value={formatPrice(netOfTax)}
                  hint={taxPct > 0 ? `${taxPct}% tax included` : "No tax set"}
                  tone={taxPct > 0 ? "gold" : "mute"}
                />
              </View>
            ) : (
              <Text style={styles.fieldHint}>Set a compare-at price above the selling price to show a discount.</Text>
            )}

            <Field label="Tax rate" style={{ marginBottom: 0 }}>
              <View style={styles.taxRow}>
                <View style={{ width: 110 }}>
                  <AffixInput suffix="%" value={taxRate} onChangeText={setTaxRate} placeholder="0" keyboardType="numeric" />
                </View>
                {["0", "8", "15", "18"].map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.taxChip, taxRate === t && styles.taxChipOn]}
                    onPress={() => setTaxRate(t)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: taxRate === t }}
                  >
                    <Text style={[styles.taxChipText, taxRate === t && styles.taxChipTextOn]}>{t}%</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Field>
          </EditorCard>

          {/* ── Variants & stock ─────────────────────────────────────── */}
          <ProductVariantsSection
            variants={variants}
            basePrice={price}
            onChange={trackRemovedVariant}
            lowStockThreshold={LOW_STOCK}
            sizeSystem={sizeSystem}
            onSizeSystemChange={setSizeSystemPick}
            onLayout={trackSection("variants")}
          />

          {/* ── Size chart ───────────────────────────────────────────── */}
          <ProductSizeChartSection
            sizeSystem={sizeSystem}
            standard={standardGuides[sizeSystem] ?? null}
            value={sizeGuide}
            onChange={setSizeGuide}
          />

          {/* ── Organise ─────────────────────────────────────────────── */}
          <EditorCard
            icon="grid-outline"
            title="Organise"
            hint="Where shoppers find this product."
            onLayout={trackSection("organise")}
          >
            <View style={styles.field}>
              <OptionPickerField
                label="Category"
                placeholder="Choose a category"
                icon="grid-outline"
                options={categoryOptions}
                value={categoryId}
                onChange={setCategoryId}
                noneLabel="No category"
              />
              {categoryIsParent ? (
                <View style={[styles.priceNote, styles.priceNoteGold, { marginTop: 8, marginBottom: 0 }]}>
                  <Ionicons name="alert-circle-outline" size={15} color="#8a6d1f" />
                  <Text style={[styles.priceNoteText, { color: "#6f5718" }]}>
                    This is a parent category — pick a subcategory so it shows in filters.
                  </Text>
                </View>
              ) : null}
            </View>

            <View style={styles.field}>
              <OptionPickerField
                label="Brand"
                placeholder="Choose a brand"
                icon="ribbon-outline"
                options={brands}
                value={brandId}
                onChange={setBrandId}
                noneLabel="No brand"
              />
            </View>

            <Field label="Who is it for?">
              <Segmented
                options={[
                  { key: "women", label: "Women" },
                  { key: "men", label: "Men" },
                  { key: "kids", label: "Kids" },
                  { key: "unisex", label: "Unisex" },
                ]}
                value={gender}
                onChange={setGender}
              />
            </Field>

            <Field
              label="Search tags"
              style={{ marginBottom: 0 }}
              hint="Tap return or comma to add · up to 20"
              counter={{ value: tags.length, max: 20 }}
            >
              <TagInput
                tags={tags}
                onChange={setTags}
                suggestions={[material, occasion, season, pattern]
                  .map((s) => s.trim().toLowerCase())
                  .filter(Boolean)}
              />
            </Field>
          </EditorCard>

          {/* ── Attributes ───────────────────────────────────────────── */}
          <EditorCard
            icon="options-outline"
            title="Product attributes"
            hint="Material, fit, season — powers search filters."
            summary={attributeSummary || "Material, fit, season, care — powers filters"}
            collapsible
            defaultOpen={false}
          >
            <Field label="Material">
              <SuggestInput value={material} onChange={setMaterial} suggestions={SUGGEST.material} placeholder="e.g. 100% organic cotton" />
            </Field>
            <Field label="Pattern">
              <SuggestInput value={pattern} onChange={setPattern} suggestions={SUGGEST.pattern} placeholder="Solid, striped…" />
            </Field>
            <Field label="Fit">
              <SuggestInput value={fit} onChange={setFit} suggestions={SUGGEST.fit} placeholder="Slim, regular…" />
            </Field>
            <Field label="Sleeve">
              <SuggestInput value={sleeve} onChange={setSleeve} suggestions={SUGGEST.sleeve} placeholder="Short, long…" />
            </Field>
            <Field label="Season">
              <SuggestInput value={season} onChange={setSeason} suggestions={SUGGEST.season} placeholder="Summer, all…" />
            </Field>
            <Field label="Occasion">
              <SuggestInput value={occasion} onChange={setOccasion} suggestions={SUGGEST.occasion} placeholder="Casual, formal…" />
            </Field>
            <Field label="Care instructions" style={{ marginBottom: 0 }} counter={{ value: careInstructions.length, max: 400 }}>
              <Input
                value={careInstructions}
                onChangeText={setCareInstructions}
                placeholder="Machine wash cold, tumble dry low…"
                multiline
                numberOfLines={3}
                style={{ minHeight: 80 }}
              />
            </Field>
          </EditorCard>

          {/* ── Atelier details (web parity) ─────────────────────────── */}
          <EditorCard
            icon="sparkles-outline"
            title="Atelier details"
            hint="The provenance and craft that set your piece apart."
            summary={atelierFilled ? `${atelierFilled} of ${ATELIER_KEYS.length} filled` : "Craft, origin, fit notes, story"}
            collapsible
            defaultOpen={false}
          >
            <View style={styles.grid2}>
              {ATELIER_SHORT.map((f) => (
                <Field key={f.key} label={f.label} style={styles.gridCell}>
                  <Input
                    value={atelier[f.key] ?? ""}
                    onChangeText={(v) => setAtelierField(f.key, v)}
                    placeholder={f.placeholder}
                    maxLength={80}
                  />
                </Field>
              ))}
            </View>
            {ATELIER_LONG.map((f, i) => {
              const max = f.key === "atelier_story" ? 1200 : 400;
              return (
                <Field
                  key={f.key}
                  label={f.label}
                  counter={{ value: (atelier[f.key] ?? "").length, max }}
                  style={i === ATELIER_LONG.length - 1 ? { marginBottom: 0 } : undefined}
                >
                  <Input
                    value={atelier[f.key] ?? ""}
                    onChangeText={(v) => setAtelierField(f.key, v)}
                    placeholder={f.placeholder}
                    multiline
                    numberOfLines={f.key === "atelier_story" ? 5 : 3}
                    style={{ minHeight: f.key === "atelier_story" ? 120 : 80 }}
                  />
                </Field>
              );
            })}
          </EditorCard>

          {/* ── Search & SEO ─────────────────────────────────────────── */}
          <EditorCard
            icon="search-outline"
            title="Search & SEO"
            hint="How it surfaces across search and social."
            summary={effectiveSlug ? `/products/${effectiveSlug}` : "URL and search snippet"}
            collapsible
            defaultOpen={false}
          >
            <View style={styles.serp}>
              <View style={styles.serpTop}>
                <View style={styles.serpFav}>
                  <Text style={styles.serpFavText}>L</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.serpSite}>LUXE</Text>
                  <Text style={styles.serpUrl} numberOfLines={1}>
                    luxe.lk › products › {effectiveSlug || "your-product"}
                  </Text>
                </View>
              </View>
              <Text style={styles.serpTitle} numberOfLines={2}>
                {name.trim() || "Product name"}
                {brandName ? ` — ${brandName}` : ""}
              </Text>
              <Text style={styles.serpDesc} numberOfLines={3}>
                {metaPreview || "Add a short or meta description to control this snippet."}
              </Text>
            </View>

            <Field
              label="URL slug"
              hint={slugEdited ? "Edited manually" : "Auto-generated from the name"}
              right={
                slugEdited && isNew ? (
                  <TouchableOpacity
                    onPress={() => {
                      setSlugEdited(false);
                      setSlug("");
                    }}
                    hitSlop={8}
                    style={styles.inlineAction}
                  >
                    <Ionicons name="refresh" size={13} color={colors.olive[700]} />
                    <Text style={styles.inlineActionText}>Reset</Text>
                  </TouchableOpacity>
                ) : null
              }
            >
              <AffixInput
                prefix="/products/"
                mono
                value={effectiveSlug}
                onChangeText={(v) => {
                  setSlugEdited(true);
                  setSlug(v.toLowerCase().replace(/[^a-z0-9-]/g, "-"));
                }}
                placeholder="atelier-cotton-crew"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </Field>

            <Field
              label="Meta description"
              style={{ marginBottom: 0 }}
              hint="Defaults to the short description."
              counter={{ value: metaDescription.length, max: META_MAX }}
            >
              <Input
                value={metaDescription}
                onChangeText={setMetaDescription}
                placeholder={shortDescription || "A single sentence that captures the piece."}
                multiline
                numberOfLines={3}
                style={{ minHeight: 80 }}
              />
            </Field>
          </EditorCard>

          {/* ── Live preview ─────────────────────────────────────────── */}
          <EditorCard
            icon="eye-outline"
            title="Live preview"
            hint="How the storefront card will read."
            onLayout={trackSection("preview")}
          >
            <View style={styles.previewStage}>
              <ProductPreviewCard
                name={name.trim()}
                shortDescription={shortDescription.trim()}
                brandName={brandName}
                price={priceNum}
                mrp={mrpNum}
                imageUri={coverUri}
                swatches={swatches}
                sizes={sizeList}
                stock={totalStock}
                isFeatured={isFeatured}
              />
            </View>
          </EditorCard>

          {/* ── Visibility & moderation ──────────────────────────────── */}
          <EditorCard icon="shield-checkmark-outline" title="Publishing" hint="Visibility, featuring and moderation.">
            {!isNew ? (
              <Field
                label="Status"
                hint={
                  isLive
                    ? "This piece is live. Submit again to re-run moderation. Archive hides it from shoppers."
                    : "Submit sends it for review. Archive keeps it out of the shop."
                }
              >
                <Segmented options={statuses} value={status} onChange={setStatus} />
              </Field>
            ) : (
              <View style={styles.flowNote}>
                {[
                  { icon: "document-outline" as const, t: "Save draft", d: "Only you see it" },
                  { icon: "paper-plane-outline" as const, t: "Submit", d: "We review it" },
                  { icon: "storefront-outline" as const, t: "Live", d: "Shoppers buy it" },
                ].map((s, i) => (
                  <React.Fragment key={s.t}>
                    {i > 0 ? <Ionicons name="chevron-forward" size={14} color={colors.ink.mute} style={{ marginTop: 12 }} /> : null}
                    <View style={styles.flowStep}>
                      <View style={styles.flowIcon}>
                        <Ionicons name={s.icon} size={15} color={colors.olive[800]} />
                      </View>
                      <Text style={styles.flowTitle}>{s.t}</Text>
                      <Text style={styles.flowDesc}>{s.d}</Text>
                    </View>
                  </React.Fragment>
                ))}
              </View>
            )}

            <ToggleRow
              icon={isFeatured ? "star" : "star-outline"}
              title="Feature on storefront"
              hint="Highlights this product in featured sections"
              value={isFeatured}
              onChange={setIsFeatured}
              tone="gold"
            />

            <View
              style={[
                styles.preflightCard,
                preflight
                  ? preflight.flagged
                    ? styles.preflightFlagged
                    : preflight.auto_approved
                      ? styles.preflightApproved
                      : styles.preflightPending
                  : styles.preflightIdle,
              ]}
            >
              <View style={styles.preflightHeader}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                  {preflightBusy ? (
                    <ActivityIndicator size="small" color={colors.olive[700]} />
                  ) : (
                    <Ionicons
                      name={
                        preflight
                          ? preflight.flagged
                            ? "warning-outline"
                            : preflight.auto_approved
                              ? "shield-checkmark"
                              : "time-outline"
                          : "shield-outline"
                      }
                      size={18}
                      color={preflight?.flagged ? RUST : preflight?.auto_approved ? OK_GREEN : colors.olive[700]}
                    />
                  )}
                  <Text style={styles.preflightTitle}>
                    {preflightBusy
                      ? "Scoring…"
                      : preflight
                        ? preflight.auto_approved
                          ? "Auto-approval likely"
                          : preflight.flagged
                            ? "Will be flagged"
                            : "Pending review"
                        : "Moderation preflight"}
                  </Text>
                </View>
                {preflight ? (
                  <Text style={styles.preflightScore}>
                    {preflight.score}/{preflight.threshold}
                  </Text>
                ) : null}
              </View>
              {preflight ? (
                <View style={styles.scoreTrack}>
                  <View
                    style={[
                      styles.scoreFill,
                      {
                        width: `${Math.min(100, (preflight.score / Math.max(1, preflight.threshold)) * 100)}%`,
                        backgroundColor: preflight.flagged ? RUST : preflight.auto_approved ? OK_GREEN : GOLD,
                      },
                    ]}
                  />
                </View>
              ) : null}
              {preflight && preflight.reasons.length > 0 ? (
                <View style={{ marginTop: 8, gap: 4 }}>
                  {preflight.reasons.slice(0, 3).map((r, i) => (
                    <View key={i} style={{ flexDirection: "row", gap: 6 }}>
                      <Text style={[styles.preflightReason, r.blocking && { color: RUST }]}>•</Text>
                      <Text style={[styles.preflightReason, { flex: 1 }, r.blocking && { color: RUST }]}>{r.message}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
              <Text style={styles.preflightHint}>
                {preflight ? "Updates as you type. Final check runs on save." : "Add a name and price to run the check."}
              </Text>
            </View>
          </EditorCard>

          {!isNew ? (
            <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteProduct} accessibilityRole="button">
              <Ionicons name="trash-outline" size={16} color={RUST} />
              <Text style={styles.deleteButtonText}>Delete product</Text>
            </TouchableOpacity>
          ) : null}

          <View style={{ height: 24 }} />
        </ScrollView>

        {/* ── Save bar ───────────────────────────────────────────────── */}
        <View style={styles.saveBar}>
          <TouchableOpacity
            style={styles.saveSummary}
            onPress={() => (essentialsLeft[0] ? scrollToSection(essentialsLeft[0].section) : scrollToSection("preview"))}
            activeOpacity={0.7}
            accessibilityRole="button"
          >
            <View
              style={[
                styles.saveSummaryDot,
                essentialsLeft.length
                  ? styles.dotPending
                  : preflight?.flagged
                    ? styles.dotFlagged
                    : styles.dotOk,
              ]}
            />
            <Text style={styles.saveSummaryTitle} numberOfLines={1}>
              {essentialsLeft.length
                ? `${essentialsLeft.length} essential${essentialsLeft.length === 1 ? "" : "s"} left · ${essentialsLeft.map((x) => x.label).join(", ")}`
                : preflightBusy
                  ? "Running moderation check…"
                  : preflight?.auto_approved
                    ? "Ready · auto-approval likely"
                    : preflight?.flagged
                      ? "Ready · may be flagged for review"
                      : "Ready to go"}
            </Text>
            {!allDone && !essentialsLeft.length ? (
              <Text style={styles.saveSummaryMeta}>{doneCount}/{steps.length}</Text>
            ) : null}
          </TouchableOpacity>
          <View style={styles.saveActions}>
            {isNew ? (
              <>
                <TouchableOpacity
                  style={[styles.secondaryBtn, saving && styles.saveButtonDisabled]}
                  onPress={() => handleSave("draft")}
                  disabled={Boolean(saving)}
                  accessibilityRole="button"
                >
                  {saving === "draft" ? (
                    <ActivityIndicator color={colors.olive[900]} />
                  ) : (
                    <Text style={styles.secondaryBtnText}>Save draft</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                  onPress={() => handleSave("submit")}
                  disabled={Boolean(saving)}
                  accessibilityRole="button"
                >
                  {saving === "submit" ? (
                    <ActivityIndicator color={CREAM} />
                  ) : (
                    <>
                      <Ionicons name="paper-plane-outline" size={17} color={CREAM} />
                      <Text style={styles.saveButtonText}>Submit for review</Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                style={[styles.saveButton, (saving || !isDirty) && styles.saveButtonDisabled]}
                onPress={() => handleSave("save")}
                disabled={Boolean(saving) || !isDirty}
                accessibilityRole="button"
              >
                {saving ? (
                  <ActivityIndicator color={CREAM} />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={18} color={CREAM} />
                    <Text style={styles.saveButtonText}>{isDirty ? "Save changes" : "No changes yet"}</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroller: { flex: 1 },
  container: { flex: 1, backgroundColor: "#f8f7f2" },
  content: { paddingHorizontal: spacing[4], paddingTop: spacing[3], paddingBottom: spacing[7] },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8f7f2",
    paddingHorizontal: 32,
    gap: 8,
  },
  errorTitle: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 22,
    color: INK,
    marginTop: 12,
    textAlign: "center",
  },
  errorSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.sm,
    color: colors.light.mutedForeground,
    textAlign: "center",
    lineHeight: 20,
  },
  retryBtn: {
    marginTop: 16,
    backgroundColor: colors.olive[800],
    paddingHorizontal: 18,
    minHeight: 44,
    borderRadius: radii.full,
    alignItems: "center",
    justifyContent: "center",
  },
  retryBtnText: { color: CREAM, fontFamily: fontFamilies.sans.semibold, fontSize: typography.fontSizes.sm },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: spacing[5],
    paddingTop: 8,
    paddingBottom: 14,
  },
  iconBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#16170f",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 3,
  },
  headerCopy: { flex: 1, minWidth: 0 },
  title: { fontFamily: fontFamilies.sans.bold, fontSize: 21, lineHeight: 26, color: INK, letterSpacing: -0.3 },
  subtitle: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: colors.light.mutedForeground, marginTop: 1 },
  headerStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 11,
    height: 32,
    borderRadius: radii.full,
    backgroundColor: colors.paper.warm,
  },
  headerStatusLive: { backgroundColor: colors.olive[50] },
  headerStatusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.ink.mute },
  headerStatusDotLive: { backgroundColor: OK_GREEN },
  headerStatusText: { fontFamily: fontFamilies.sans.semibold, fontSize: 12, color: colors.ink.mute },
  headerStatusTextLive: { color: colors.olive[800] },

  progressCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.12)",
    borderRadius: 22,
    padding: 16,
    marginBottom: 14,
    gap: 14,
  },
  progressCardDone: { borderColor: "rgba(78,141,66,0.35)", backgroundColor: "#F6F8EF" },
  progressTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  progressBadge: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2,
    borderColor: colors.olive[700],
    alignItems: "center",
    justifyContent: "center",
  },
  progressBadgeDone: { backgroundColor: OK_GREEN, borderColor: OK_GREEN },
  progressBadgeText: { fontFamily: fontFamilies.sans.semibold, fontSize: 13, color: colors.olive[800], fontVariant: ["tabular-nums"] },
  progressTitle: { fontFamily: fontFamilies.sans.bold, fontSize: 17, color: INK },
  progressSub: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: colors.light.mutedForeground, marginTop: 1 },
  progressPct: { fontFamily: fontFamilies.sans.semibold, fontSize: 13, color: colors.olive[800], fontVariant: ["tabular-nums"] },
  progressSegs: { flexDirection: "row", gap: 4 },
  progressSeg: { flex: 1, height: 5, borderRadius: 3, backgroundColor: colors.olive[50] },
  progressSegDone: { backgroundColor: colors.olive[700] },
  progressSteps: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  stepChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    minHeight: 32,
    borderRadius: radii.full,
    backgroundColor: FIELD_BG,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.12)",
  },
  stepChipDone: { backgroundColor: colors.olive[50], borderColor: "rgba(83,94,44,0.25)" },
  stepText: { fontFamily: fontFamilies.sans.medium, fontSize: 12, color: colors.ink.mute },
  stepTextDone: { color: colors.olive[800] },

  field: { marginBottom: 16 },
  inlineAction: { flexDirection: "row", alignItems: "center", gap: 4 },
  inlineActionText: { fontFamily: fontFamilies.sans.semibold, fontSize: 12, color: colors.olive[700] },
  fieldHint: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    lineHeight: 17,
    color: colors.light.mutedForeground,
    marginTop: -6,
    marginBottom: 16,
  },
  fieldHintWarn: { flex: 1, fontFamily: fontFamilies.sans.medium, fontSize: 12, lineHeight: 17, color: RUST },
  priceNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: -4,
    marginBottom: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.olive[50],
  },
  priceNoteWarn: { backgroundColor: "rgba(184,92,58,0.08)" },
  priceNoteGold: { backgroundColor: "#f7f1de" },
  priceNoteText: { flex: 1, fontFamily: fontFamilies.sans.regular, fontSize: 12.5, lineHeight: 17, color: colors.olive[900] },
  metricRow: { flexDirection: "row", gap: 10, marginTop: -4, marginBottom: 16 },
  taxRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  taxChip: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.14)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  taxChipOn: { backgroundColor: colors.olive[50], borderColor: colors.olive[700] },
  taxChipText: { fontFamily: fontFamilies.sans.medium, fontSize: 13, color: colors.olive[800] },
  taxChipTextOn: { fontFamily: fontFamilies.sans.semibold, color: INK },

  grid2: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  gridCell: { width: "48.5%" },

  serp: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(22,23,15,0.08)",
    marginBottom: 16,
    gap: 4,
  },
  serpTop: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  serpFav: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.olive[900], alignItems: "center", justifyContent: "center" },
  serpFavText: { fontFamily: fontFamilies.display.semibold, fontSize: 13, color: CREAM },
  serpSite: { fontFamily: fontFamilies.sans.medium, fontSize: 12.5, color: "#202124" },
  serpUrl: { fontFamily: fontFamilies.sans.regular, fontSize: 11.5, color: "#4d5156" },
  serpTitle: { fontFamily: fontFamilies.sans.medium, fontSize: 17, lineHeight: 22, color: "#1a0dab" },
  serpDesc: { fontFamily: fontFamilies.sans.regular, fontSize: 13, lineHeight: 19, color: "#4d5156" },

  previewStage: {
    paddingVertical: 20,
    borderRadius: 18,
    backgroundColor: colors.olive[50],
  },

  flowNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 16,
    backgroundColor: FIELD_BG,
    marginBottom: 12,
  },
  flowStep: { flex: 1, alignItems: "center", gap: 3 },
  flowIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 3,
  },
  flowTitle: { fontFamily: fontFamilies.sans.semibold, fontSize: 12.5, color: INK },
  flowDesc: { fontFamily: fontFamilies.sans.regular, fontSize: 11, color: colors.light.mutedForeground, textAlign: "center" },

  preflightCard: { marginTop: 12, padding: 14, borderRadius: 16, borderWidth: 1, backgroundColor: "#FFFFFF" },
  preflightIdle: { borderColor: "rgba(83,94,44,0.14)" },
  preflightApproved: { borderColor: "rgba(83,94,44,0.35)", backgroundColor: colors.olive[50] },
  preflightPending: { borderColor: "rgba(200,164,74,0.45)", backgroundColor: "#f3efe2" },
  preflightFlagged: { borderColor: "rgba(184,92,58,0.35)", backgroundColor: "#f4e6df" },
  preflightHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  preflightTitle: { fontSize: 15, fontFamily: fontFamilies.sans.bold, color: INK },
  preflightScore: { fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground, fontFamily: fontFamilies.mono.medium },
  scoreTrack: { height: 5, borderRadius: 3, backgroundColor: "rgba(83,94,44,0.1)", overflow: "hidden", marginTop: 10 },
  scoreFill: { height: "100%", borderRadius: 3 },
  preflightReason: { fontSize: 12.5, lineHeight: 17, fontFamily: fontFamilies.sans.regular, color: colors.light.mutedForeground },
  preflightHint: { fontSize: 11.5, fontFamily: fontFamilies.sans.regular, color: colors.light.mutedForeground, marginTop: 8 },

  deleteButton: {
    marginTop: 4,
    minHeight: 48,
    flexDirection: "row",
    gap: 7,
    borderRadius: radii.full,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteButtonText: { color: RUST, fontSize: 14, fontFamily: fontFamilies.sans.semibold },

  saveBar: {
    paddingHorizontal: spacing[4],
    paddingTop: 10,
    paddingBottom: 10,
    gap: 10,
    backgroundColor: "#FFFFFF",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(83,94,44,0.14)",
    shadowColor: "#2a2c1f",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 6,
  },
  saveSummary: { flexDirection: "row", alignItems: "center", gap: 8 },
  saveSummaryDot: { width: 8, height: 8, borderRadius: 4 },
  dotOk: { backgroundColor: OK_GREEN },
  dotPending: { backgroundColor: GOLD },
  dotFlagged: { backgroundColor: RUST },
  saveSummaryTitle: { flex: 1, fontFamily: fontFamilies.sans.medium, fontSize: 12.5, color: colors.olive[900] },
  saveSummaryMeta: { fontFamily: fontFamilies.sans.semibold, fontSize: 12, color: colors.ink.mute },
  saveActions: { flexDirection: "row", gap: 10 },
  secondaryBtn: {
    flex: 1,
    minHeight: 52,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.3)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  secondaryBtnText: { fontFamily: fontFamilies.sans.semibold, fontSize: 15, color: colors.olive[900] },
  saveButton: {
    flex: 1.6,
    minHeight: 52,
    flexDirection: "row",
    gap: 7,
    backgroundColor: colors.olive[900],
    borderRadius: radii.full,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  saveButtonDisabled: { opacity: 0.55 },
  saveButtonText: { color: CREAM, fontSize: 15.5, fontFamily: fontFamilies.sans.semibold },
});
