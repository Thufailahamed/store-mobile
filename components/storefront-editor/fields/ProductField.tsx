import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { colors, radii, spacing, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { fetchJson } from "@/lib/api/_fetch";

export interface ProductFieldProps {
  value: string;
  onChange: (v: string) => void;
  schema: { label?: string };
}

interface ProductSummary {
  id: string;
  title: string;
  price: number;
  thumbnail?: string;
}

export function ProductField({ value, onChange, schema }: ProductFieldProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProductSummary[]>([]);
  const [selected, setSelected] = useState<ProductSummary | null>(null);
  const [loading, setLoading] = useState(false);

  const search = React.useCallback(async (q: string) => {
    setQuery(q);
    if (q.length < 2) { setResults([]); return; }
    setLoading(true);
    const res = await fetchJson<{ products: ProductSummary[] }>("/api/catalog/search", { query: { q, limit: 5 } });
    setLoading(false);
    if (res.ok) setResults(res.data.products);
  }, []);

  return (
    <View style={styles.wrap}>
      {schema.label ? <Text style={styles.label}>{schema.label}</Text> : null}
      {selected ? (
        <View style={styles.selected}>
          <Text style={styles.selectedTitle}>{selected.title}</Text>
          <Pressable onPress={() => { setSelected(null); onChange(""); }} accessibilityLabel="Clear product">
            <Text style={styles.clear}>×</Text>
          </Pressable>
        </View>
      ) : (
        <View>
          <Text style={styles.hint}>Search and select a product (placeholder UI — wire to your product picker sheet)</Text>
          {loading ? <ActivityIndicator accessibilityLabel="Searching products" /> : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginVertical: spacing[2] },
  label: { fontFamily: fontFamilies.sans.medium, fontSize: typography.fontSizes.sm, color: colors.light.foreground, marginBottom: spacing[1] },
  selected: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing[3], borderWidth: 1, borderColor: colors.light.border, borderRadius: radii.md, backgroundColor: colors.light.muted },
  selectedTitle: { fontFamily: fontFamilies.sans.regular, fontSize: typography.fontSizes.sm, color: colors.light.foreground, flex: 1 },
  clear: { fontSize: typography.fontSizes.lg, color: colors.light.mutedForeground, paddingHorizontal: spacing[2] },
  hint: { fontFamily: fontFamilies.sans.regular, fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground },
});
