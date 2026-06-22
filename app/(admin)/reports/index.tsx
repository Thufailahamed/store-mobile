import React from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, Alert } from "react-native";
import { Ionicons } from "@/components/ui/Icon";
import { Card } from "@/components/ui";
import { colors, typography, radii, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

interface Report {
  key: string;
  title: string;
  description: string;
  format: "csv" | "pdf";
  icon: keyof typeof Ionicons.glyphMap;
}

const REPORTS: Report[] = [
  { key: "sales", title: "Sales by day", description: "Order totals grouped by day", format: "csv", icon: "trending-up-outline" },
  { key: "orders", title: "Order ledger", description: "Full order export with statuses", format: "csv", icon: "receipt-outline" },
  { key: "products", title: "Catalogue snapshot", description: "All products with stock", format: "csv", icon: "cube-outline" },
  { key: "stores", title: "Seller roster", description: "Stores + approval status", format: "csv", icon: "storefront-outline" },
  { key: "customers", title: "Customer list", description: "PII-safe export", format: "csv", icon: "people-outline" },
  { key: "payouts", title: "Payouts queue", description: "Pending seller payouts", format: "csv", icon: "wallet-outline" },
  { key: "tax", title: "Tax summary", description: "Quarterly tax filing export", format: "pdf", icon: "document-text-outline" },
  { key: "finance", title: "Finance pack", description: "Revenue, fees, refunds", format: "pdf", icon: "briefcase-outline" },
];

export default function AdminReports() {
  const onPress = (r: Report) => Alert.alert("Generate report", `${r.title} will be prepared and emailed to your admin address.`, [{ text: "OK" }]);
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>EXPORT</Text>
        <Text style={styles.title}>Reports</Text>
        <Text style={styles.sub}>{REPORTS.length} templates · CSV & PDF</Text>
      </View>

      <View style={styles.list}>
        {REPORTS.map((r, i) => (
          <Pressable key={r.key} onPress={() => onPress(r)}>
            <Card style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.index}>{String(i + 1).padStart(2, "0")}</Text>
                <View style={[styles.iconWrap, { backgroundColor: r.format === "pdf" ? "#fdf3d7" : "#dde4d6" }]}>
                  <Ionicons name={r.icon} size={18} color={colors.light.foreground} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{r.title}</Text>
                  <Text style={styles.cardDesc}>{r.description}</Text>
                </View>
                <View style={[styles.formatPill, { backgroundColor: r.format === "pdf" ? colors.light.foreground : colors.light.primary }]}>
                  <Text style={[styles.formatText, { color: r.format === "pdf" ? colors.light.card : "#fff" }]}>{r.format.toUpperCase()}</Text>
                </View>
              </View>
            </Card>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  content: { paddingBottom: 100 },
  header: { padding: 20, paddingBottom: 12 },
  eyebrow: { fontFamily: fontFamilies.mono.medium, fontSize: 10, color: colors.light.primary, letterSpacing: 1.4 },
  title: { fontFamily: fontFamilies.display.regular, fontSize: 28, color: colors.light.foreground, marginTop: 4, letterSpacing: -0.5 },
  sub: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: colors.light.mutedForeground, marginTop: 4 },
  list: { padding: 20, gap: 10 },
  card: { padding: 14, ...shadows.soft },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  index: { fontFamily: fontFamilies.mono.regular, fontSize: 11, color: colors.light.mutedForeground, width: 24 },
  iconWrap: { width: 36, height: 36, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  cardTitle: { fontFamily: fontFamilies.sans.semibold, fontSize: 14, color: colors.light.foreground },
  cardDesc: { fontFamily: fontFamilies.sans.regular, fontSize: 11, color: colors.light.mutedForeground, marginTop: 2 },
  formatPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  formatText: { fontFamily: fontFamilies.mono.semibold, fontSize: 9, letterSpacing: 0.5 },
});
