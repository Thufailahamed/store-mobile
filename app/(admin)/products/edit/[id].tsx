import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type TextInputProps,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui";
import { getAdminBrands, getAdminCategories } from "@/lib/api";
import {
  getAdminCatalogProductBackend,
  updateAdminCatalogProductBackend,
} from "@/lib/api/backend";
import { colors, radii, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";
import {
  fromProduct,
  GENDERS,
  NONE,
  STATUSES,
  STYLE_FIELDS,
  productEditPatch,
  type ProductEditForm as Form,
} from "@/lib/admin/product-edit";

const INK = colors.olive[950];
const RUST = "#7a2f1a";

/**
 * Admin correction of a seller's listing: details, pricing, category/brand,
 * status, style fields and tags. Every save is audit-logged by the backend.
 * Variants and images stay on web (/admin/products/<id>?tab=variants|media).
 */
export default function AdminProductEdit() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const productQ = useQuery({
    queryKey: ["admin-catalog-product", id],
    queryFn: async () => {
      const r = await getAdminCatalogProductBackend(id!);
      if (!r.ok) throw new Error(r.error);
      return r.data.product;
    },
    enabled: !!id,
  });
  const categoriesQ = useQuery({
    queryKey: ["admin-categories-picker"],
    queryFn: async () => {
      const r = await getAdminCategories();
      return r.ok ? r.data : [];
    },
  });
  const brandsQ = useQuery({
    queryKey: ["admin-brands-picker"],
    queryFn: async () => {
      const r = await getAdminBrands({ limit: 500 });
      return r.ok ? r.data.brands : [];
    },
  });

  const initial = useMemo(() => (productQ.data ? fromProduct(productQ.data) : null), [productQ.data]);
  const [form, setForm] = useState<Form | null>(null);
  const [tagDraft, setTagDraft] = useState("");
  const [picker, setPicker] = useState<"category" | "brand" | null>(null);
  useEffect(() => setForm(initial), [initial]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  const dirty = useMemo(() => (form && initial ? productEditPatch(form, initial) : {}), [form, initial]);
  const dirtyCount = Object.keys(dirty).length;

  const categoryOptions = useMemo(() => {
    const list = categoriesQ.data ?? [];
    const byId = new Map(list.map((c) => [c.id, c]));
    return list
      .map((c) => ({
        id: c.id,
        label: c.parent_id && byId.get(c.parent_id) ? `${byId.get(c.parent_id)!.name} › ${c.name}` : c.name,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [categoriesQ.data]);
  const brandOptions = useMemo(
    () => (brandsQ.data ?? []).map((b) => ({ id: b.id, label: b.name })).sort((a, b) => a.label.localeCompare(b.label)),
    [brandsQ.data],
  );

  const save = useMutation({
    mutationFn: async () => {
      const r = await updateAdminCatalogProductBackend(id!, dirty);
      if (!r.ok) throw new Error(r.error);
      return r.data.product;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin-catalog-product", id] });
      void qc.invalidateQueries({ queryKey: ["admin-product", id] });
      void qc.invalidateQueries({ queryKey: ["cat-products"] });
      router.back();
    },
    onError: (e) => Alert.alert("Couldn't save", e instanceof Error ? e.message : "Try again."),
  });

  const header = (
    <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) + 8 }]}>
      <TouchableOpacity onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
        <Ionicons name="chevron-back" size={22} color={INK} />
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={styles.kicker}>Admin · Correct listing</Text>
        <Text style={styles.title} numberOfLines={1}>{productQ.data?.name ?? "Edit product"}</Text>
      </View>
    </View>
  );

  if (productQ.isLoading || (!form && !productQ.isError)) {
    return (
      <View style={styles.container}>
        {header}
        <View style={{ padding: spacing[5], gap: 12 }}>
          <Skeleton height={140} style={{ borderRadius: radii.xl }} />
          <Skeleton height={110} style={{ borderRadius: radii.xl }} />
          <Skeleton height={160} style={{ borderRadius: radii.xl }} />
        </View>
      </View>
    );
  }

  if (productQ.isError || !form) {
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.center}>
          <Text style={styles.errorText}>
            {productQ.error instanceof Error ? productQ.error.message : "Couldn't load this product."}
          </Text>
          <TouchableOpacity onPress={() => void productQ.refetch()} style={styles.retryBtn} accessibilityRole="button">
            <Text style={styles.retryLabel}>Try again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const price = Number(form.price) || 0;
  const mrp = Number(form.mrp) || 0;
  const priceError =
    !/^\d*$/.test(form.price) || !/^\d*$/.test(form.mrp)
      ? "Prices must be whole numbers"
      : mrp > 0 && price > mrp
        ? "Selling price is higher than MRP"
        : null;
  const nameError = !form.name.trim() ? "Name is required" : null;
  const canSave = dirtyCount > 0 && !priceError && !nameError && !save.isPending;

  const addTags = () => {
    const parts = tagDraft.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
    if (parts.length) set("tags", [...new Set([...form.tags, ...parts])].slice(0, 40));
    setTagDraft("");
  };

  const categoryLabel = categoryOptions.find((c) => c.id === form.category_id)?.label ?? "Uncategorised";
  const brandLabel = brandOptions.find((b) => b.id === form.brand_id)?.label ?? "No brand";

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {header}
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {productQ.data?.store?.name ? (
          <Text style={styles.storeLine}>Seller · {productQ.data.store.name}</Text>
        ) : null}

        <Section title="Details">
          <Field label="Product name" error={nameError} value={form.name} onChangeText={(v) => set("name", v)} />
          <Field label="SKU" value={form.sku} onChangeText={(v) => set("sku", v)} autoCapitalize="characters" />
          <Field
            label="Short description"
            value={form.short_description}
            onChangeText={(v) => set("short_description", v)}
            multiline
            maxLength={500}
          />
          <Field
            label="Full description"
            value={form.description}
            onChangeText={(v) => set("description", v)}
            multiline
            tall
          />
        </Section>

        <Section title="Pricing" hint="LKR, whole numbers">
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Field label="MRP" value={form.mrp} onChangeText={(v) => set("mrp", v)} keyboardType="number-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Selling price" value={form.price} onChangeText={(v) => set("price", v)} keyboardType="number-pad" />
            </View>
          </View>
          {priceError ? (
            <Text style={styles.fieldError}>{priceError}</Text>
          ) : (
            <Text style={styles.pricePreview}>
              {formatPrice(price)}
              {mrp > price ? `  ·  ${Math.round(((mrp - price) / mrp) * 100)}% off ${formatPrice(mrp)}` : ""}
            </Text>
          )}
        </Section>

        <Section title="Category & brand">
          <PickerRow label="Category" value={categoryLabel} onPress={() => setPicker("category")} />
          <PickerRow label="Brand" value={brandLabel} onPress={() => setPicker("brand")} />
          <Text style={styles.fieldLabel}>GENDER</Text>
          <ChipRow
            options={[{ value: NONE, label: "Not set" }, ...GENDERS.map((g) => ({ value: g, label: cap(g) }))]}
            value={form.gender}
            onChange={(v) => set("gender", v)}
          />
        </Section>

        <Section title="Status & visibility">
          <ChipRow
            options={STATUSES.map((s) => ({ value: s, label: s === "active" ? "Active (live)" : cap(s) }))}
            value={form.status}
            onChange={(v) => set("status", v)}
          />
          <ToggleRow label="Visible" sub="Shown in the catalogue" value={form.is_active} onChange={(v) => set("is_active", v)} />
          <ToggleRow label="Featured" sub="Homepage & rails" value={form.is_featured} onChange={(v) => set("is_featured", v)} />
        </Section>

        <Section title="Style details" hint="Used by filters and search">
          <View style={styles.grid}>
            {STYLE_FIELDS.map(([k, label]) => (
              <View key={k} style={styles.gridCell}>
                <Field label={label} value={form[k]} onChangeText={(v) => set(k, v)} />
              </View>
            ))}
          </View>
          <Field
            label="Care instructions"
            value={form.care_instructions}
            onChangeText={(v) => set("care_instructions", v)}
            multiline
          />
        </Section>

        <Section title="Tags" hint={`${form.tags.length}/40`}>
          <View style={styles.tagWrap}>
            {form.tags.map((t) => (
              <Pressable
                key={t}
                onPress={() => set("tags", form.tags.filter((x) => x !== t))}
                style={styles.tag}
                accessibilityRole="button"
                accessibilityLabel={`Remove tag ${t}`}
              >
                <Text style={styles.tagText}>{t}</Text>
                <Ionicons name="close" size={12} color={colors.olive[800]} />
              </Pressable>
            ))}
          </View>
          <View style={styles.row}>
            <TextInput
              value={tagDraft}
              onChangeText={setTagDraft}
              onSubmitEditing={addTags}
              placeholder="Add tags, comma separated"
              placeholderTextColor="rgba(101,104,77,0.55)"
              autoCapitalize="none"
              returnKeyType="done"
              style={[styles.input, { flex: 1 }]}
            />
            <TouchableOpacity onPress={addTags} style={styles.addTagBtn} accessibilityRole="button" accessibilityLabel="Add tags">
              <Ionicons name="add" size={18} color={colors.paper.cream} />
            </TouchableOpacity>
          </View>
        </Section>

        <Text style={styles.footnote}>Sizes, colours, stock and photos are edited from the web admin.</Text>
      </ScrollView>

      <View style={[styles.saveBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Text style={styles.saveBarText}>
          {dirtyCount > 0 ? `${dirtyCount} unsaved change${dirtyCount === 1 ? "" : "s"}` : "No changes"}
        </Text>
        {dirtyCount > 0 ? (
          <TouchableOpacity onPress={() => setForm(initial)} style={styles.discardBtn} accessibilityRole="button">
            <Text style={styles.discardText}>Discard</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          onPress={() => save.mutate()}
          disabled={!canSave}
          style={[styles.saveBtn, !canSave && { opacity: 0.45 }]}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSave, busy: save.isPending }}
        >
          {save.isPending ? (
            <ActivityIndicator color={colors.paper.cream} />
          ) : (
            <Text style={styles.saveText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <PickerSheet
        visible={picker !== null}
        title={picker === "category" ? "Category" : "Brand"}
        noneLabel={picker === "category" ? "Uncategorised" : "No brand"}
        options={picker === "category" ? categoryOptions : brandOptions}
        loading={picker === "category" ? categoriesQ.isLoading : brandsQ.isLoading}
        selected={picker === "category" ? form.category_id : form.brand_id}
        onSelect={(v) => {
          if (picker === "category") set("category_id", v);
          else if (picker === "brand") set("brand_id", v);
          setPicker(null);
        }}
        onClose={() => setPicker(null)}
      />
    </KeyboardAvoidingView>
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {hint ? <Text style={styles.sectionHint}>{hint}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function Field({
  label, error, multiline, tall, ...props
}: TextInputProps & { label: string; error?: string | null; tall?: boolean }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label.toUpperCase()}</Text>
      <TextInput
        {...props}
        multiline={multiline}
        textAlignVertical={multiline ? "top" : "center"}
        placeholderTextColor="rgba(101,104,77,0.55)"
        selectionColor={colors.olive[600]}
        accessibilityLabel={label}
        style={[styles.input, multiline && { height: tall ? 160 : 84, paddingTop: 12 }, error ? styles.inputError : null]}
      />
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

function PickerRow({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.pickerRow} onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}: ${value}`}>
      <View style={{ flex: 1 }}>
        <Text style={styles.fieldLabel}>{label.toUpperCase()}</Text>
        <Text style={styles.pickerValue} numberOfLines={1}>{value}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.ink.mute} />
    </TouchableOpacity>
  );
}

function ChipRow({
  options, value, onChange,
}: { options: Array<{ value: string; label: string }>; value: string; onChange: (v: string) => void }) {
  return (
    <View style={styles.chipRow}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value || "none"}
            onPress={() => onChange(o.value)}
            style={[styles.chip, on && styles.chipOn]}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
          >
            <Text style={[styles.chipText, on && styles.chipTextOn]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ToggleRow({ label, sub, value, onChange }: { label: string; sub: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.toggleRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.toggleLabel}>{label}</Text>
        <Text style={styles.toggleSub}>{sub}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.olive[600] }} />
    </View>
  );
}

function PickerSheet({
  visible, title, noneLabel, options, loading, selected, onSelect, onClose,
}: {
  visible: boolean;
  title: string;
  noneLabel: string;
  options: Array<{ id: string; label: string }>;
  loading: boolean;
  selected: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  useEffect(() => {
    if (!visible) setQuery("");
  }, [visible]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
    return [{ id: NONE, label: noneLabel }, ...list];
  }, [options, query, noneLabel]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Close" />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
              <Ionicons name="close" size={22} color={INK} />
            </TouchableOpacity>
          </View>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={`Search ${title.toLowerCase()}…`}
            placeholderTextColor="rgba(101,104,77,0.55)"
            autoCapitalize="none"
            style={[styles.input, { marginHorizontal: spacing[5], marginBottom: 8 }]}
          />
          {loading ? (
            <ActivityIndicator style={{ marginVertical: 24 }} color={colors.olive[700]} />
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(o) => o.id || "none"}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const on = item.id === selected;
                return (
                  <TouchableOpacity
                    style={styles.sheetItem}
                    onPress={() => onSelect(item.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                  >
                    <Text style={[styles.sheetItemText, on && { fontFamily: fontFamilies.sans.semibold }]} numberOfLines={1}>
                      {item.label}
                    </Text>
                    {on ? <Ionicons name="checkmark" size={18} color={colors.olive[700]} /> : null}
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper.DEFAULT },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[3],
  },
  kicker: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: colors.olive[700],
  },
  title: { fontFamily: fontFamilies.display.semibold, fontSize: 22, color: INK },
  content: { paddingHorizontal: spacing[5], paddingBottom: 120 },
  storeLine: { fontFamily: fontFamilies.sans.medium, fontSize: 13, color: colors.ink.mute, marginBottom: spacing[3] },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing[6], gap: 12 },
  errorText: { fontFamily: fontFamilies.sans.regular, fontSize: 14, color: colors.ink.mute, textAlign: "center" },
  retryBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999, backgroundColor: INK },
  retryLabel: { fontFamily: fontFamilies.sans.semibold, color: colors.paper.cream },
  section: {
    marginBottom: spacing[4],
    padding: spacing[4],
    borderRadius: radii.xl,
    backgroundColor: colors.paper.cream,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(22,23,15,0.12)",
  },
  sectionHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 },
  sectionTitle: { fontFamily: fontFamilies.display.semibold, fontSize: 18, color: INK },
  sectionHint: { fontFamily: fontFamilies.mono.medium, fontSize: 10, color: colors.ink.mute },
  row: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  grid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -5 },
  gridCell: { width: "50%", paddingHorizontal: 5 },
  field: { marginBottom: 12 },
  fieldLabel: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 1.4,
    color: colors.ink.mute,
    marginBottom: 6,
  },
  input: {
    height: 46,
    paddingHorizontal: 12,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(22,23,15,0.12)",
    backgroundColor: colors.paper.DEFAULT,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 15,
    color: INK,
  },
  inputError: { borderColor: RUST },
  fieldError: { fontFamily: fontFamilies.sans.medium, fontSize: 12, color: RUST, marginTop: 4 },
  pricePreview: { fontFamily: fontFamilies.sans.semibold, fontSize: 14, color: colors.olive[800] },
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    marginBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(22,23,15,0.12)",
  },
  pickerValue: { fontFamily: fontFamilies.sans.medium, fontSize: 15, color: INK },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(22,23,15,0.15)",
  },
  chipOn: { backgroundColor: INK, borderColor: INK },
  chipText: { fontFamily: fontFamilies.sans.medium, fontSize: 13, color: INK },
  chipTextOn: { color: colors.paper.cream },
  toggleRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8 },
  toggleLabel: { fontFamily: fontFamilies.sans.semibold, fontSize: 14, color: INK },
  toggleSub: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: colors.ink.mute },
  tagWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingLeft: 10,
    paddingRight: 6,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(83,94,44,0.12)",
  },
  tagText: { fontFamily: fontFamilies.sans.medium, fontSize: 12, color: colors.olive[800] },
  addTagBtn: { width: 46, height: 46, borderRadius: radii.md, alignItems: "center", justifyContent: "center", backgroundColor: INK },
  footnote: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: colors.ink.mute, textAlign: "center", marginTop: 4 },
  saveBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: spacing[5],
    paddingTop: 12,
    backgroundColor: colors.paper.cream,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(22,23,15,0.15)",
  },
  saveBarText: { flex: 1, fontFamily: fontFamilies.sans.medium, fontSize: 13, color: colors.ink.mute },
  discardBtn: { paddingHorizontal: 12, paddingVertical: 10 },
  discardText: { fontFamily: fontFamilies.sans.medium, fontSize: 14, color: colors.ink.mute },
  saveBtn: {
    minWidth: 96,
    height: 44,
    paddingHorizontal: 20,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: INK,
  },
  saveText: { fontFamily: fontFamilies.sans.semibold, fontSize: 15, color: colors.paper.cream },
  sheetBackdrop: { flex: 1, backgroundColor: "rgba(22,23,15,0.4)" },
  sheet: {
    maxHeight: "75%",
    paddingTop: spacing[4],
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: colors.paper.cream,
  },
  sheetHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[5],
    marginBottom: 12,
  },
  sheetTitle: { fontFamily: fontFamilies.display.semibold, fontSize: 20, color: INK },
  sheetItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: spacing[5],
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(22,23,15,0.08)",
  },
  sheetItemText: { flex: 1, fontFamily: fontFamilies.sans.regular, fontSize: 15, color: INK },
});
