/**
 * Shared chrome for the buyer order + return detail screens: the round-button
 * top bar and the ⋮ action sheet.
 */
import React from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@/components/ui/Icon";
import { fontFamilies } from "@/lib/theme/fonts";
import { C } from "@/components/orders/parcel-track";

export function DetailTopBar({
  title,
  onBack,
  onMore,
}: {
  title: string;
  onBack: () => void;
  onMore?: () => void;
}) {
  return (
    <View style={styles.topBar}>
      <TouchableOpacity style={styles.circleBtn} onPress={onBack} activeOpacity={0.8} accessibilityLabel="Back">
        <Ionicons name="arrow-back" size={20} color={C.text} />
      </TouchableOpacity>
      <Text style={styles.topTitle} accessibilityRole="header">{title}</Text>
      {onMore ? (
        <TouchableOpacity style={styles.circleBtn} onPress={onMore} activeOpacity={0.8} accessibilityLabel="More actions">
          <Ionicons name="ellipsis-vertical" size={18} color={C.text} />
        </TouchableOpacity>
      ) : (
        <View style={{ width: 46 }} />
      )}
    </View>
  );
}

export type MenuItem = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  danger?: boolean;
};

export function MenuSheet({
  open,
  items,
  onClose,
  bottom,
}: {
  open: boolean;
  items: MenuItem[];
  onClose: () => void;
  bottom: number;
}) {
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.menuBackdrop} onPress={onClose} accessibilityLabel="Close menu" />
      <View style={[styles.menuSheet, { paddingBottom: Math.max(bottom, 16) + 8 }]}>
        <View style={styles.grabber} />
        {items.map((m) => (
          <TouchableOpacity
            key={m.label}
            style={styles.menuItem}
            activeOpacity={0.7}
            onPress={() => {
              onClose();
              setTimeout(m.onPress, 250);
            }}
          >
            <View style={[styles.menuIcon, m.danger && { backgroundColor: "rgba(184,92,58,0.1)" }]}>
              <Ionicons name={m.icon} size={18} color={m.danger ? C.rust : C.text} />
            </View>
            <Text style={[styles.menuText, m.danger && { color: C.rust }]}>{m.label}</Text>
            <Ionicons name="chevron-forward" size={16} color={C.faint} />
          </TouchableOpacity>
        ))}
      </View>
    </Modal>
  );
}

/** Paper background + gold glow + top bar + padded scroll body. */
export function ParcelScreen({
  title,
  onBack,
  onMore,
  footer,
  children,
}: {
  title: string;
  onBack: () => void;
  onMore?: () => void;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      <LinearGradient
        pointerEvents="none"
        colors={[C.glow, C.glowSoft, C.paper]}
        locations={[0, 0.55, 1]}
        style={styles.glow}
      />
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <DetailTopBar title={title} onBack={onBack} onMore={onMore} />
        <ScrollView
          contentContainerStyle={[styles.body, { paddingBottom: footer ? 24 : insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
        {footer ? (
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) + 4 }]}>{footer}</View>
        ) : null}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.paper },
  glow: { position: "absolute", top: 0, left: 0, right: 0, height: 380 },
  body: { paddingHorizontal: 20, paddingTop: 6, gap: 14 },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    shadowColor: "#16170f",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 10,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 10,
  },
  topTitle: { fontFamily: fontFamilies.sans.bold, fontSize: 18, letterSpacing: -0.3, color: C.text },
  circleBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#16170f",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
  },

  menuBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(21,22,15,0.4)" },
  menuSheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  menuItem: { flexDirection: "row", alignItems: "center", gap: 14, height: 58 },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f3f2ec",
    alignItems: "center",
    justifyContent: "center",
  },
  menuText: { flex: 1, fontFamily: fontFamilies.sans.semibold, fontSize: 15, color: C.text },
  grabber: { alignSelf: "center", width: 44, height: 5, borderRadius: 3, backgroundColor: "#e2e0d6", marginBottom: 16 },
});
