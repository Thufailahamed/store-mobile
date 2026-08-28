import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Card } from "@/components/ui/Card";
import { TextField } from "./fields/TextField";
import { ImageField } from "./fields/ImageField";
import { ProductField } from "./fields/ProductField";
import { LinkField } from "./fields/LinkField";
import { ColorField } from "./fields/ColorField";
import { SelectField } from "./fields/SelectField";
import type { StorefrontSection } from "@/lib/api/backend";
import { colors, radii, spacing, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

interface Props {
  section: StorefrontSection;
  isFirst: boolean;
  isLast: boolean;
  onChange: (content: Record<string, unknown>) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  onRegenerate?: () => void;
}

type FieldSchema = { key: string; field: string; schema: Record<string, unknown> };
type SectionSchema = { label: string; fields: FieldSchema[] };

const SECTION_SCHEMAS: Record<string, SectionSchema> = {
  hero: {
    label: "Hero",
    fields: [
      { key: "headline", field: "text", schema: { label: "Headline", multiline: true, maxLength: 120 } },
      { key: "subheadline", field: "text", schema: { label: "Subheadline", multiline: true, maxLength: 240 } },
      { key: "backgroundImage", field: "image", schema: { label: "Background image", altText: "Hero background" } },
      { key: "cta", field: "link", schema: { label: "Call to action" } },
    ],
  },
  product_grid: {
    label: "Product grid",
    fields: [
      { key: "title", field: "text", schema: { label: "Title" } },
      { key: "productIds", field: "product", schema: { label: "Featured products" } },
    ],
  },
  image_text: {
    label: "Image + text",
    fields: [
      { key: "title", field: "text", schema: { label: "Title" } },
      { key: "body", field: "text", schema: { label: "Body", multiline: true, maxLength: 500 } },
      { key: "image", field: "image", schema: { label: "Image" } },
      { key: "alignment", field: "select", schema: { label: "Alignment", options: [{ value: "left", label: "Left" }, { value: "right", label: "Right" }] } },
    ],
  },
  announcement: {
    label: "Announcement bar",
    fields: [
      { key: "text", field: "text", schema: { label: "Text", maxLength: 200 } },
      { key: "backgroundColor", field: "color", schema: { label: "Background" } },
      { key: "textColor", field: "color", schema: { label: "Text" } },
    ],
  },
};

export function getSectionLabel(type: string): string {
  return SECTION_SCHEMAS[type]?.label ?? type;
}

export function SectionCard({ section, isFirst, isLast, onChange, onMoveUp, onMoveDown, onDelete, onRegenerate }: Props) {
  const schema = SECTION_SCHEMAS[section.type];

  const setField = (key: string, value: unknown) => {
    onChange({ ...section.content, [key]: value });
  };

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{schema?.label ?? section.type}</Text>
        <View style={styles.actions}>
          <Pressable accessibilityLabel="Move section up" disabled={isFirst} onPress={onMoveUp} style={[styles.btn, isFirst && styles.btnDisabled]}>
            <Text style={styles.btnIcon}>↑</Text>
          </Pressable>
          <Pressable accessibilityLabel="Move section down" disabled={isLast} onPress={onMoveDown} style={[styles.btn, isLast && styles.btnDisabled]}>
            <Text style={styles.btnIcon}>↓</Text>
          </Pressable>
          {onRegenerate ? (
            <Pressable accessibilityLabel="Regenerate with AI" onPress={onRegenerate} style={styles.btn}>
              <Text style={styles.btnIcon}>✨</Text>
            </Pressable>
          ) : null}
          <Pressable accessibilityLabel="Delete section" onPress={onDelete} style={[styles.btn, styles.btnDanger]}>
            <Text style={[styles.btnIcon, styles.btnIconDanger]}>×</Text>
          </Pressable>
        </View>
      </View>
      {schema?.fields.map(({ key, field, schema: fieldSchema }) => {
        const value = (section.content as Record<string, unknown>)[key];
        switch (field) {
          case "text":
            return <TextField key={key} value={(value as string) ?? ""} onChange={(v) => setField(key, v)} schema={fieldSchema as TextFieldPropsSchema} />;
          case "image":
            return <ImageField key={key} value={(value as string) ?? ""} onChange={(v) => setField(key, v)} schema={fieldSchema as ImageFieldPropsSchema} />;
          case "product":
            return <ProductField key={key} value={(value as string) ?? ""} onChange={(v) => setField(key, v)} schema={fieldSchema as ProductFieldPropsSchema} />;
          case "link":
            return <LinkField key={key} value={(value as { url?: string; label?: string }) ?? {}} onChange={(v) => setField(key, v)} schema={fieldSchema as LinkFieldPropsSchema} />;
          case "color":
            return <ColorField key={key} value={(value as string) ?? "#000000"} onChange={(v) => setField(key, v)} schema={fieldSchema as ColorFieldPropsSchema} />;
          case "select":
            return <SelectField key={key} value={(value as string) ?? ""} onChange={(v) => setField(key, v)} schema={fieldSchema as SelectFieldPropsSchema} />;
          default:
            return null;
        }
      })}
    </Card>
  );
}

type TextFieldPropsSchema = Parameters<typeof TextField>[0]["schema"];
type ImageFieldPropsSchema = Parameters<typeof ImageField>[0]["schema"];
type ProductFieldPropsSchema = Parameters<typeof ProductField>[0]["schema"];
type LinkFieldPropsSchema = Parameters<typeof LinkField>[0]["schema"];
type ColorFieldPropsSchema = Parameters<typeof ColorField>[0]["schema"];
type SelectFieldPropsSchema = Parameters<typeof SelectField>[0]["schema"];

const styles = StyleSheet.create({
  card: { marginVertical: spacing[2] },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing[3] },
  title: { fontFamily: fontFamilies.sans.semibold, fontSize: typography.fontSizes.md, color: colors.light.foreground },
  actions: { flexDirection: "row", gap: spacing[1] },
  btn: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: radii.sm, backgroundColor: colors.light.muted },
  btnDisabled: { opacity: 0.4 },
  btnDanger: { backgroundColor: colors.light.destructive + "20" },
  btnIcon: { fontSize: typography.fontSizes.md, color: colors.light.foreground },
  btnIconDanger: { color: colors.light.destructive },
});
