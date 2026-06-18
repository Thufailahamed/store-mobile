import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  StyleSheet,
  Alert,
  Modal,
  Switch,
} from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  getAdminCategoriesEnriched,
  getCategoryDeleteImpact,
  deleteCategoryWithOptions,
  createCategory,
  updateCategory,
  type AdminCategory,
} from "@/lib/api";
import { Card, EmptyState, Skeleton, Input, Button, Badge, Chip } from "@/components/ui";
import { colors, radii, shadows } from "@/lib/theme/tokens";
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
      ) as Array<AdminCategory & { depth: number }>,
    [q.data],
  );

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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>STRUCTURE</Text>
          <Text style={styles.title}>Categories</Text>
        </View>
        <Pressable onPress={() => openCreate(null)} style={styles.addBtn}>
          <Ionicons name="add" size={18} color="#fff" />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} />}
      >
        {q.isLoading ? (
          <Skeleton height={80} />
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
          <EmptyState icon="folder-outline" title="No categories" />
        ) : (
          flat.map((item) => (
            <CategoryRow
              key={item.id}
              item={item}
              onEdit={() => openEdit(item)}
              onDelete={() => setDeleting(item)}
              onAddChild={() => openCreate(item.id)}
            />
          ))
        )}
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

function CategoryRow({
  item,
  onEdit,
  onDelete,
  onAddChild,
}: {
  item: AdminCategory & { depth: number };
  onEdit: () => void;
  onDelete: () => void;
  onAddChild: () => void;
}) {
  return (
    <Pressable onLongPress={onEdit}>
      <Card style={[styles.card, { marginLeft: item.depth * 16 }] as never}>
        <View style={styles.row}>
          <Text style={styles.icon}>{item.icon || "📁"}</Text>
          <View style={{ flex: 1 }}>
            <View style={styles.nameRow}>
              <Text style={styles.name}>{item.name}</Text>
              {!item.is_active && <Badge variant="outline">inactive</Badge>}
            </View>
            <Text style={styles.meta}>
              /{item.slug} · {item.product_count} products · {item.child_count} children · #{item.position}
            </Text>
          </View>
          <Pressable onPress={onAddChild} hitSlop={8}>
            <Ionicons name="add-circle-outline" size={18} color={colors.light.primary} />
          </Pressable>
          <Pressable onPress={onDelete} hitSlop={8}>
            <Ionicons name="trash-outline" size={18} color={colors.light.muted} />
          </Pressable>
        </View>
      </Card>
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
  }, [category?.id]);

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
  header: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", padding: 20, paddingBottom: 12 },
  eyebrow: { fontFamily: fontFamilies.mono.medium, fontSize: 10, color: colors.light.primary, letterSpacing: 1.4 },
  title: { fontFamily: fontFamilies.display.regular, fontSize: 28, color: colors.light.foreground, marginTop: 4, letterSpacing: -0.5 },
  addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.light.primary, alignItems: "center", justifyContent: "center" },
  list: { padding: 20, paddingBottom: 100, gap: 10 },
  card: { padding: 14, ...shadows.soft },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  icon: { fontSize: 18, width: 28, textAlign: "center" },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: { fontFamily: fontFamilies.sans.semibold, fontSize: 14, color: colors.light.foreground },
  meta: { fontFamily: fontFamilies.mono.regular, fontSize: 10, color: colors.light.mutedForeground, marginTop: 2, letterSpacing: 0.5, textTransform: "uppercase" },
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
