import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  StyleSheet,
  Alert,

  Switch,
} from "react-native";
import { Modal } from "@/components/ui/Modal";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@/components/ui/Icon";
import {
  getAdminCategoriesEnriched,
  getCategoryDeleteImpact,
  deleteCategoryWithOptions,
  createCategory,
  updateCategory,
  type AdminCategory,
} from "@/lib/api";
import { EmptyState, Skeleton, Input, Button, Chip } from "@/components/ui";
import { colors, radii } from "@/lib/theme/tokens";
import { LinearGradient } from "expo-linear-gradient";
import { AdminMasthead, StatBand, SearchField, SectionLabel, premiumCard, RUST } from "@/components/admin/premium-kit";
import { fontFamilies } from "@/lib/theme/fonts";
import {
  buildCategoryTree,
  flattenCategoryTree,
  slugifyCategoryName,
  validateCategoryDelete,
  validateCategoryParent,
  getValidParentOptions,
  type CategoryDeleteOptions,
  type CategoryDeleteImpact,
} from "@/lib/utils/category-admin";
import type { Category, Gender } from "@/lib/types";

const GENDERS: (Gender | "none")[] = ["none", "men", "women", "kids", "unisex"];

const DEFAULT_DELETE_OPTIONS: CategoryDeleteOptions = {
  productAction: "unset",
  childAction: "detach",
};

export default function AdminCategories() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<AdminCategory | null>(null);
  const [parentForCreate, setParentForCreate] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<AdminCategory | null>(null);
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const q = useQuery({
    queryKey: ["admin-categories"],
    queryFn: async () => {
      const r = await getAdminCategoriesEnriched();
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
  });

  const flat = useMemo(
    () =>
      flattenCategoryTree(
        buildCategoryTree((q.data ?? []) as Parameters<typeof buildCategoryTree>[0]) as Parameters<typeof flattenCategoryTree>[0],
      ) as FlatCategory[],
    [q.data],
  );

  // Split the depth-first list into one block per root so each top-level
  // category renders as its own card with descendants nested inside.
  const roots = useMemo(() => {
    const out: { root: FlatCategory; children: FlatCategory[] }[] = [];
    for (const c of flat) {
      if (c.depth === 0 || !out.length) out.push({ root: c, children: [] });
      else out[out.length - 1].children.push(c);
    }
    return out;
  }, [flat]);

  const term = search.trim().toLowerCase();
  const matches = useMemo(
    () => (term ? flat.filter((c) => `${c.name} ${c.slug}`.toLowerCase().includes(term)) : []),
    [flat, term],
  );

  const totals = useMemo(() => {
    let products = 0;
    let inactive = 0;
    for (const c of flat) {
      products += c.product_count ?? 0;
      if (!c.is_active) inactive += 1;
    }
    return { products, inactive };
  }, [flat]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-categories"] });
    qc.invalidateQueries({ queryKey: ["cat-categories"] });
  };

  const openCreate = (parentId?: string | null) => {
    setEditing(null);
    setParentForCreate(parentId ?? null);
    setShowCreate(true);
  };

  const openEdit = (item: AdminCategory) => {
    setShowCreate(false);
    setParentForCreate(null);
    setEditing(item);
  };

  const openActions = (item: AdminCategory) => {
    Alert.alert(item.name, `/${item.slug}`, [
      { text: "Add subcategory", onPress: () => openCreate(item.id) },
      { text: "Delete…", style: "destructive", onPress: () => setDeleting(item) },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const rowProps = (item: FlatCategory) => ({
    item,
    onEdit: () => openEdit(item),
    onMore: () => openActions(item),
  });

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={q.isFetching && !q.isLoading} onRefresh={() => q.refetch()} tintColor={colors.light.primary} />}
      >
        <AdminMasthead
          eyebrow="Structure"
          title="Category"
          italic="Tree"
          subtitle="Shape how shoppers browse the catalogue. Tap a row to edit."
          onAdd={() => openCreate(null)}
        />

        {flat.length ? (
          <StatBand
            items={[
              { label: "Categories", value: flat.length },
              { label: "Top level", value: roots.length },
              { label: "Products", value: totals.products },
              { label: "Hidden", value: totals.inactive, accent: totals.inactive > 0 },
            ]}
          />
        ) : null}

        {flat.length ? (
          <SearchField value={search} onChangeText={setSearch} placeholder="Find a category or slug…" />
        ) : null}

        <View style={styles.body}>
          {q.isLoading ? (
            <View style={{ gap: 12 }}>
              <Skeleton height={150} style={{ borderRadius: radii["2xl"] }} />
              <Skeleton height={150} style={{ borderRadius: radii["2xl"] }} />
            </View>
          ) : q.isError ? (
            <View style={styles.errorWrap}>
              <EmptyState
                icon="alert-circle-outline"
                title="Failed to load categories"
                description={(q.error as Error)?.message ?? "Pull to refresh or tap retry"}
              />
              <Button onPress={() => q.refetch()}>Retry</Button>
            </View>
          ) : !flat.length ? (
            <EmptyState icon="folder-outline" title="No categories" description="Tap + to plant the first branch." />
          ) : term ? (
            <>
              <SectionLabel label="Results" count={matches.length} />
              {matches.length ? (
                <View style={styles.card}>
                  {matches.map((c, i) => (
                    <CategoryRow key={c.id} {...rowProps(c)} flatMode last={i === matches.length - 1} />
                  ))}
                </View>
              ) : (
                <Text style={styles.noMatch}>Nothing matches “{search.trim()}”.</Text>
              )}
            </>
          ) : (
            roots.map(({ root, children }) => {
              const isCollapsed = collapsed.has(root.id);
              return (
                <View key={root.id} style={styles.card}>
                  <RootHeader
                    item={root}
                    collapsed={isCollapsed}
                    hasChildren={children.length > 0}
                    onToggle={() => toggle(root.id)}
                    onEdit={() => openEdit(root)}
                    onAddChild={() => openCreate(root.id)}
                    onMore={() => openActions(root)}
                  />
                  {!isCollapsed && children.length ? (
                    <View style={styles.childWrap}>
                      {children.map((c, i) => (
                        <CategoryRow key={c.id} {...rowProps(c)} last={i === children.length - 1} />
                      ))}
                    </View>
                  ) : null}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      <CategoryModal
        visible={showCreate || !!editing}
        categories={q.data ?? []}
        initial={editing}
        defaultParentId={parentForCreate}
        onClose={() => { setShowCreate(false); setEditing(null); setParentForCreate(null); }}
        onSaved={() => { invalidate(); setShowCreate(false); setEditing(null); setParentForCreate(null); }}
      />

      <DeleteModal
        category={deleting}
        categories={q.data ?? []}
        onClose={() => setDeleting(null)}
        onDeleted={() => { invalidate(); setDeleting(null); }}
      />
    </View>
  );
}

type FlatCategory = AdminCategory & { depth: number };

function InactiveTag() {
  return (
    <View style={styles.inactivePill}>
      <Text style={styles.inactivePillText}>Hidden</Text>
    </View>
  );
}

function RootHeader({
  item,
  collapsed,
  hasChildren,
  onToggle,
  onEdit,
  onAddChild,
  onMore,
}: {
  item: FlatCategory;
  collapsed: boolean;
  hasChildren: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onAddChild: () => void;
  onMore: () => void;
}) {
  return (
    <Pressable onPress={onEdit} onLongPress={onMore} style={({ pressed }) => [styles.rootRow, pressed && styles.pressed]}>
      <LinearGradient colors={["#f2f3e2", "#e0e4c6"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.rootIcon}>
        <Text style={styles.rootEmoji}>{item.icon || "📁"}</Text>
      </LinearGradient>
      <View style={{ flex: 1, gap: 3 }}>
        <View style={styles.nameRow}>
          <Text style={styles.rootName} numberOfLines={1}>{item.name}</Text>
          {!item.is_active ? <InactiveTag /> : null}
        </View>
        <Text style={styles.rootMeta} numberOfLines={1}>
          {item.child_count} sub · {item.product_count} products · /{item.slug}
        </Text>
      </View>
      <Pressable onPress={onAddChild} hitSlop={8} style={styles.ghostBtn} accessibilityLabel={`Add subcategory to ${item.name}`}>
        <Ionicons name="add" size={16} color={colors.olive[800]} />
      </Pressable>
      {hasChildren ? (
        <Pressable onPress={onToggle} hitSlop={8} style={styles.ghostBtn} accessibilityLabel={collapsed ? "Expand" : "Collapse"}>
          <Ionicons name={collapsed ? "chevron-down" : "chevron-up"} size={15} color={colors.olive[800]} />
        </Pressable>
      ) : (
        <Pressable onPress={onMore} hitSlop={8} style={styles.ghostBtn} accessibilityLabel="More actions">
          <Ionicons name="ellipsis-horizontal" size={15} color={colors.olive[800]} />
        </Pressable>
      )}
    </Pressable>
  );
}

function CategoryRow({
  item,
  onEdit,
  onMore,
  last,
  flatMode,
}: {
  item: FlatCategory;
  onEdit: () => void;
  onMore: () => void;
  last: boolean;
  flatMode?: boolean;
}) {
  const indent = flatMode ? 0 : Math.max(0, item.depth - 1) * 20;
  return (
    <Pressable onPress={onEdit} onLongPress={onMore} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
      {!flatMode ? (
        <View style={[styles.branch, { marginLeft: indent }]}>
          <View style={[styles.branchStem, last && styles.branchStemLast]} />
          <View style={styles.branchElbow} />
        </View>
      ) : null}
      <View style={styles.iconTile}>
        <Text style={styles.icon}>{item.icon || "📁"}</Text>
      </View>
      <View style={[styles.rowBody, !last && styles.rowDivider]}>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
            {!item.is_active ? <InactiveTag /> : null}
          </View>
          <Text style={styles.meta} numberOfLines={1}>/{item.slug}</Text>
        </View>
        <View style={[styles.countPill, !item.product_count && styles.countPillEmpty]}>
          <Text style={[styles.countText, !item.product_count && styles.countTextEmpty]}>{item.product_count}</Text>
        </View>
        <Pressable onPress={onMore} hitSlop={10} style={styles.moreBtn} accessibilityLabel="More actions">
          <Ionicons name="ellipsis-horizontal" size={15} color={colors.light.mutedForeground} />
        </Pressable>
      </View>
    </Pressable>
  );
}

function CategoryModal({
  visible,
  onClose,
  onSaved,
  initial,
  categories,
  defaultParentId,
}: {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  initial?: AdminCategory | null;
  categories: AdminCategory[];
  defaultParentId?: string | null;
}) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [parentId, setParentId] = useState<string | null>(null);
  const [position, setPosition] = useState("0");
  const [isActive, setIsActive] = useState(true);
  const [gender, setGender] = useState<Gender | "none">("none");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setName(initial?.name ?? "");
    setSlug(initial?.slug ?? "");
    setDescription(initial?.description ?? "");
    setIcon(initial?.icon ?? "");
    setImageUrl(initial?.image_url ?? "");
    setParentId(initial?.parent_id ?? defaultParentId ?? null);
    setPosition(String(initial?.position ?? 0));
    setIsActive(initial?.is_active ?? true);
    setGender(initial?.gender ?? "none");
  }, [visible, initial, defaultParentId]);

  const parentOptions = getValidParentOptions(initial?.id, categories);
  const parentError = validateCategoryParent(initial?.id, parentId, categories);

  const save = async () => {
    if (!name.trim()) return Alert.alert("Missing fields", "Name is required");
    const finalSlug = slug.trim() || slugifyCategoryName(name);
    if (!finalSlug) return Alert.alert("Missing fields", "Slug is required");
    const pErr = validateCategoryParent(initial?.id, parentId, categories);
    if (pErr) return Alert.alert("Invalid parent", pErr);

    setLoading(true);
    const payload: Partial<Category> = {
      name: name.trim(),
      slug: finalSlug,
      description: description.trim() || undefined,
      icon: icon.trim() || undefined,
      image_url: imageUrl.trim() || undefined,
      parent_id: parentId,
      position: Number(position) || 0,
      is_active: isActive,
      gender: gender === "none" ? undefined : gender,
    };

    const r = initial
      ? await updateCategory(initial.id, payload)
      : await createCategory(payload);
    setLoading(false);

    if (r.ok) onSaved();
    else Alert.alert("Error", r.error);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ScrollView style={styles.modal} contentContainerStyle={styles.modalContent}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{initial ? "Edit" : "New"} Category</Text>
          <Pressable onPress={onClose}><Ionicons name="close" size={22} color={colors.light.foreground} /></Pressable>
        </View>

        <Input label="Name" value={name} onChangeText={(v) => { setName(v); if (!initial) setSlug(slugifyCategoryName(v)); }} placeholder="Outerwear" />
        <View style={{ height: 12 }} />
        <Input label="Slug" value={slug} onChangeText={setSlug} placeholder="outerwear" autoCapitalize="none" />
        <View style={{ height: 12 }} />
        <Input label="Description" value={description} onChangeText={setDescription} placeholder="Optional" />
        <View style={{ height: 12 }} />
        <Input label="Icon" value={icon} onChangeText={setIcon} placeholder="👗" />
        <View style={{ height: 12 }} />
        <Input label="Image URL" value={imageUrl} onChangeText={setImageUrl} placeholder="https://…" autoCapitalize="none" />
        <View style={{ height: 12 }} />
        <Input label="Position" value={position} onChangeText={setPosition} keyboardType="number-pad" />

        <Text style={styles.fieldLabel}>Parent</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Chip selected={!parentId} onPress={() => setParentId(null)}>Root</Chip>
          {parentOptions.map((c) => (
            <Chip key={c.id} selected={parentId === c.id} onPress={() => setParentId(c.id)}>{c.name}</Chip>
          ))}
        </ScrollView>

        <Text style={styles.fieldLabel}>Gender</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {GENDERS.map((g) => (
            <Chip key={g} selected={gender === g} onPress={() => setGender(g)}>{g}</Chip>
          ))}
        </ScrollView>

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Active</Text>
          <Switch
            value={isActive}
            onValueChange={setIsActive}
            trackColor={{ true: colors.olive[500], false: colors.light.border }}
            thumbColor={colors.light.card}
          />
        </View>

        {parentError ? <Text style={styles.errorText}>{parentError}</Text> : null}

        <View style={{ height: 24 }} />
        <Button onPress={save} loading={loading} disabled={!!parentError}>{initial ? "Save" : "Create"}</Button>
      </ScrollView>
    </Modal>
  );
}

function DeleteModal({
  category,
  categories,
  onClose,
  onDeleted,
}: {
  category: AdminCategory | null;
  categories: AdminCategory[];
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [impact, setImpact] = useState<CategoryDeleteImpact | null>(null);
  const [loadingImpact, setLoadingImpact] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [options, setOptions] = useState<CategoryDeleteOptions>(DEFAULT_DELETE_OPTIONS);

  useEffect(() => {
    if (!category) {
      setImpact(null);
      setOptions(DEFAULT_DELETE_OPTIONS);
      return;
    }
    setLoadingImpact(true);
    getCategoryDeleteImpact(category.id).then((r) => {
      setImpact(r.ok ? r.data : null);
      setLoadingImpact(false);
      if (!r.ok) Alert.alert("Error", r.error);
    });
  }, [category]);

  const validationError = useMemo(() => {
    if (!category || !impact) return null;
    return validateCategoryDelete(category.id, impact, options, categories);
  }, [category, impact, options, categories]);

  const reassignTargets = useMemo(
    () => getValidParentOptions(category?.id, categories),
    [categories, category?.id],
  );

  const confirm = async () => {
    if (!category || validationError) return;
    setDeleting(true);
    const r = await deleteCategoryWithOptions(category.id, options, categories);
    setDeleting(false);
    if (r.ok) onDeleted();
    else Alert.alert("Delete failed", r.error);
  };

  return (
    <Modal visible={!!category} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ScrollView style={styles.modal} contentContainerStyle={styles.modalContent}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Delete {category?.name}?</Text>
          <Pressable onPress={onClose}><Ionicons name="close" size={22} color={colors.light.foreground} /></Pressable>
        </View>

        {loadingImpact ? (
          <Text style={styles.helpText}>Checking impact…</Text>
        ) : impact ? (
          <>
            <Text style={styles.helpText}>
              {impact.productCount} products · {impact.childCount} subcategories · {impact.couponCount} coupons
            </Text>

            {impact.productCount > 0 && (
              <>
                <Text style={styles.fieldLabel}>Products</Text>
                <View style={styles.chips}>
                  <Chip
                    selected={options.productAction === "unset"}
                    onPress={() => setOptions({ ...options, productAction: "unset" })}
                  >
                    Unset
                  </Chip>
                  <Chip
                    selected={options.productAction === "reassign"}
                    onPress={() => setOptions({ ...options, productAction: "reassign" })}
                  >
                    Reassign
                  </Chip>
                </View>
                {options.productAction === "reassign" && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                    {reassignTargets.map((c) => (
                      <Chip
                        key={c.id}
                        selected={options.productReassignId === c.id}
                        onPress={() => setOptions({ ...options, productReassignId: c.id })}
                      >
                        {c.name}
                      </Chip>
                    ))}
                  </ScrollView>
                )}
              </>
            )}

            {impact.childCount > 0 && (
              <>
                <Text style={styles.fieldLabel}>Subcategories</Text>
                <View style={styles.chips}>
                  <Chip
                    selected={options.childAction === "detach"}
                    onPress={() => setOptions({ ...options, childAction: "detach" })}
                  >
                    Detach
                  </Chip>
                  <Chip
                    selected={options.childAction === "reassign"}
                    onPress={() => setOptions({ ...options, childAction: "reassign" })}
                  >
                    Move
                  </Chip>
                </View>
                {options.childAction === "reassign" && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                    <Chip
                      selected={options.childReassignParentId === null}
                      onPress={() => setOptions({ ...options, childReassignParentId: null })}
                    >
                      Root
                    </Chip>
                    {reassignTargets.map((c) => (
                      <Chip
                        key={c.id}
                        selected={options.childReassignParentId === c.id}
                        onPress={() => setOptions({ ...options, childReassignParentId: c.id })}
                      >
                        {c.name}
                      </Chip>
                    ))}
                  </ScrollView>
                )}
              </>
            )}

            {validationError ? <Text style={styles.errorText}>{validationError}</Text> : null}
          </>
        ) : null}

        <View style={{ height: 24 }} />
        <Button
          onPress={confirm}
          loading={deleting}
          disabled={loadingImpact || !impact || !!validationError}
          variant="destructive"
        >
          Delete category
        </Button>
      </ScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  list: { paddingBottom: 140 },
  body: { paddingHorizontal: 16, gap: 14 },
  pressed: { opacity: 0.8 },
  card: { ...premiumCard, overflow: "hidden" },

  rootRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  rootIcon: {
    width: 50,
    height: 50,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#cfd3b0",
  },
  rootEmoji: { fontSize: 24 },
  rootName: { fontFamily: fontFamilies.display.semibold, fontSize: 19, color: colors.light.foreground, letterSpacing: -0.3, flexShrink: 1 },
  rootMeta: { fontFamily: fontFamilies.mono.regular, fontSize: 10, color: colors.light.mutedForeground, letterSpacing: 0.3 },
  ghostBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f1f0e6",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#d6d4c4",
    alignItems: "center",
    justifyContent: "center",
  },

  childWrap: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#dddccd", backgroundColor: "rgba(239,236,226,0.45)", paddingLeft: 14 },
  row: { flexDirection: "row", alignItems: "center", paddingLeft: 14 },
  rowPressed: { backgroundColor: "rgba(83,94,44,0.06)" },
  branch: { width: 22, alignSelf: "stretch", flexDirection: "row", alignItems: "center", marginRight: 6 },
  branchStem: { position: "absolute", left: 10, top: 0, bottom: 0, width: 1, backgroundColor: "#cfcdb9" },
  branchStemLast: { bottom: "50%" },
  branchElbow: { position: "absolute", left: 10, width: 12, height: 1, backgroundColor: "#cfcdb9" },
  iconTile: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: colors.light.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#d6d4c4",
    alignItems: "center",
    justifyContent: "center",
  },
  icon: { fontSize: 17 },
  rowBody: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, marginLeft: 12, paddingVertical: 12, paddingRight: 12 },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#dddccd" },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: { fontFamily: fontFamilies.sans.semibold, fontSize: 14.5, color: colors.light.foreground, flexShrink: 1 },
  meta: { fontFamily: fontFamilies.mono.regular, fontSize: 10, color: colors.light.mutedForeground },
  countPill: {
    minWidth: 28,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    backgroundColor: "rgba(83,94,44,0.12)",
    alignItems: "center",
  },
  countPillEmpty: { backgroundColor: "transparent", borderWidth: StyleSheet.hairlineWidth, borderColor: "#d6d4c4" },
  countText: { fontFamily: fontFamilies.mono.semibold, fontSize: 10, color: colors.olive[800] },
  countTextEmpty: { color: colors.light.mutedForeground },
  moreBtn: { paddingVertical: 4, paddingLeft: 2 },
  inactivePill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radii.full,
    backgroundColor: "rgba(184,92,58,0.1)",
  },
  inactivePillText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 8,
    color: RUST,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  noMatch: { fontFamily: fontFamilies.sans.regular, fontSize: 13, color: colors.light.mutedForeground, textAlign: "center", paddingVertical: 24 },
  modal: { flex: 1, backgroundColor: colors.light.background },
  modalContent: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  modalTitle: { fontFamily: fontFamilies.display.regular, fontSize: 22, color: colors.light.foreground },
  fieldLabel: { fontFamily: fontFamilies.sans.medium, fontSize: 12, color: colors.light.mutedForeground, marginTop: 16, marginBottom: 8 },
  chips: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 16 },
  switchLabel: { fontFamily: fontFamilies.sans.medium, fontSize: 14, color: colors.light.foreground },
  helpText: { fontFamily: fontFamilies.sans.regular, fontSize: 13, color: colors.light.mutedForeground, marginBottom: 8 },
  errorWrap: { alignItems: "center", gap: 12, paddingVertical: 24 },
  errorText: { fontFamily: fontFamilies.sans.medium, fontSize: 13, color: colors.light.destructive, marginTop: 12 },
});
