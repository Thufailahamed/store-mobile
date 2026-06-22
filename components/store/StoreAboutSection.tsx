import React from "react";
import { View, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { Ionicons } from "@/components/ui/Icon";
import { Display, Body, MonoLabel } from "@/components/ui/Typography";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { colors, radii, spacing, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import type { Store } from "@/lib/types";

interface StoreAboutSectionProps {
  store: Store;
}

const promises = [
  {
    icon: "shield-checkmark-outline",
    title: "Authenticity guaranteed",
    body: "Every piece inspected and verified by our atelier team.",
  },
  {
    icon: "refresh-circle-outline",
    title: "14-day returns",
    body: "Free returns on unworn pieces with original tags.",
  },
  {
    icon: "paper-plane-outline",
    title: "Islandwide dispatch",
    body: "Ships within 24 hours across Sri Lanka.",
  },
  {
    icon: "ribbon-outline",
    title: "Premium packaging",
    body: "LUXE signature wrap, dust bag & care card included.",
  },
];

export function StoreAboutSection({ store }: StoreAboutSectionProps) {
  return (
    <View style={styles.wrap}>
      <SectionHeader
        label="THE ATELIER"
        title="A note from the boutique"
        description="Crafted in small batches with obsessive attention to detail."
      />
      {store.description ? (
        <View style={styles.bodyCard}>
          <Body size="md" style={styles.body}>
            {store.description}
          </Body>
          <Body size="md" style={styles.body}>
            We work with master weavers, ateliers and small studios whose hands carry
            generations of craft. Each release is numbered, audited, and shipped with
            the care it deserves.
          </Body>
          <View style={styles.signRow}>
            <View style={styles.signLine} />
            <MonoLabel style={styles.signLabel}>— THE STUDIO</MonoLabel>
          </View>
        </View>
      ) : null}

      <View style={styles.promisesGrid}>
        {promises.map((p) => (
          <View key={p.title} style={styles.promiseCard}>
            <View style={styles.promiseIconWrap}>
              <Ionicons name={p.icon as any} size={20} color={colors.olive[600]} />
            </View>
            <Body size="sm" style={styles.promiseTitle}>{p.title}</Body>
            <Body size="xs" muted style={styles.promiseBody}>
              {p.body}
            </Body>
          </View>
        ))}
      </View>

      <View style={styles.creditRow}>
        <CreditTile
          icon="calendar-outline"
          label="Member since"
          value="2019"
        />
        <CreditTile
          icon="globe-outline"
          label="Ships from"
          value="Colombo"
        />
        <CreditTile
          icon="time-outline"
          label="Response"
          value="< 2 hrs"
        />
      </View>
    </View>
  );
}

function CreditTile({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={styles.creditTile}>
      <Ionicons name={icon} size={14} color={colors.olive[600]} />
      <MonoLabel style={styles.creditLabel}>{label.toUpperCase()}</MonoLabel>
      <Body size="sm" style={styles.creditValue}>{value}</Body>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingBottom: spacing[6],
  },
  bodyCard: {
    marginHorizontal: spacing[5],
    backgroundColor: colors.light.card,
    borderRadius: radii["2xl"],
    padding: spacing[5],
    borderWidth: 1,
    borderColor: `${colors.olive[600]}10`,
    gap: spacing[3],
    ...shadows.soft,
  },
  body: {
    lineHeight: 22,
    color: colors.ink.soft,
  },
  signRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    marginTop: spacing[2],
  },
  signLine: {
    width: 24,
    height: 1,
    backgroundColor: colors.olive[600],
  },
  signLabel: {
    fontSize: 9.5,
    letterSpacing: 1.4,
    color: colors.olive[600],
  },
  promisesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: spacing[5],
    gap: spacing[2],
    marginTop: spacing[5],
  },
  promiseCard: {
    flexBasis: "48%",
    flexGrow: 1,
    backgroundColor: colors.light.card,
    borderRadius: radii.xl,
    padding: spacing[4],
    borderWidth: 1,
    borderColor: `${colors.olive[600]}10`,
    gap: 6,
  },
  promiseIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radii.full,
    backgroundColor: `${colors.olive[600]}10`,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  promiseTitle: {
    fontFamily: fontFamilies.sans.semibold,
    color: colors.light.foreground,
  },
  promiseBody: {
    lineHeight: 17,
  },
  creditRow: {
    flexDirection: "row",
    paddingHorizontal: spacing[5],
    marginTop: spacing[5],
    gap: spacing[2],
  },
  creditTile: {
    flex: 1,
    backgroundColor: colors.olive[50],
    borderRadius: radii.xl,
    padding: spacing[3],
    alignItems: "flex-start",
    gap: 4,
  },
  creditLabel: {
    fontSize: 8.5,
    letterSpacing: 1.2,
    color: colors.olive[600],
  },
  creditValue: {
    fontFamily: fontFamilies.sans.semibold,
    color: colors.light.foreground,
  },
});
