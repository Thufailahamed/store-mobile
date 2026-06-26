import React, { useEffect, useState } from "react";
import {
  Modal,
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Pressable,
} from "react-native";
import { Ionicons } from "@/components/ui/Icon";
import { fontFamilies } from "@/lib/theme/fonts";
import { radii, spacing } from "@/lib/theme/tokens";
import { formatPrice } from "@/lib/utils";
import type { WardrobeItem } from "@/lib/types";

const INK = "#16170f";
const MUTED = "#6b6b6b";
const OLIVE = "#556b2f";

interface Props {
  item: WardrobeItem | null;
  onClose: () => void;
  onConfirm: (wornAtIso: string) => void;
  pending: boolean;
}

export function LogWearSheet({ item, onClose, onConfirm, pending }: Props) {
  const [date, setDate] = useState<string>(() =>
    new Date().toISOString().slice(0, 10),
  );

  useEffect(() => {
    setDate(new Date().toISOString().slice(0, 10));
  }, [item?.id]);

  if (!item) return null;

  const cpwNow =
    item.purchase_price && item.wear_count > 0
      ? item.purchase_price / item.wear_count
      : null;
  const cpwNext =
    item.purchase_price && item.wear_count + 1 > 0
      ? item.purchase_price / (item.wear_count + 1)
      : null;

  const handleConfirm = () => {
    const iso = new Date(`${date}T12:00:00`).toISOString();
    onConfirm(iso);
  };

  return (
    <Modal
      visible={!!item}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => undefined}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Log a wear</Text>
              <Text style={styles.title} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.sub}>
                {item.wear_count}× worn so far{item.brand_name ? ` · ${item.brand_name}` : ""}
              </Text>
            </View>
            <TouchableOpacity hitSlop={8} onPress={onClose}>
              <Ionicons name="close" size={20} color={INK} />
            </TouchableOpacity>
          </View>

          <View style={styles.cpwRow}>
            <View style={styles.cpwCard}>
              <Text style={styles.cpwLabel}>Now</Text>
              <Text style={styles.cpwValue}>
                {cpwNow !== null ? formatPrice(cpwNow, item.currency) : "—"}
              </Text>
            </View>
            <View style={[styles.cpwCard, styles.cpwCardActive]}>
              <Text style={[styles.cpwLabel, { color: OLIVE }]}>After</Text>
              <Text style={styles.cpwValue}>
                {cpwNext !== null ? formatPrice(cpwNext, item.currency) : "—"}
              </Text>
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>When did you wear it?</Text>
            <DateField
              value={date}
              onChange={setDate}
              max={new Date().toISOString().slice(0, 10)}
            />
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.btn, styles.btnGhost]}
              onPress={onClose}
              activeOpacity={0.85}
            >
              <Text style={styles.btnGhostText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.btnPrimary, pending && { opacity: 0.6 }]}
              onPress={handleConfirm}
              activeOpacity={0.85}
              disabled={pending}
            >
              <Ionicons name="checkmark-circle" size={14} color="#fff" />
              <Text style={styles.btnPrimaryText}>
                {pending ? "Logging…" : "Log wear"}
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function DateField({
  value,
  onChange,
  max,
}: {
  value: string;
  onChange: (v: string) => void;
  max: string;
}) {
  const shift = (days: number) => {
    const d = new Date(value);
    d.setDate(d.getDate() + days);
    const iso = d.toISOString().slice(0, 10);
    if (iso > max) return;
    onChange(iso);
  };
  return (
    <View style={styles.dateWrap}>
      <TouchableOpacity
        style={styles.dateArrow}
        onPress={() => shift(-1)}
        activeOpacity={0.85}
      >
        <Ionicons name="chevron-back" size={16} color={INK} />
      </TouchableOpacity>
      <View style={styles.dateValue}>
        <Text style={styles.dateText}>{value}</Text>
      </View>
      <TouchableOpacity
        style={styles.dateArrow}
        onPress={() => shift(1)}
        activeOpacity={0.85}
        disabled={value >= max}
      >
        <Ionicons name="chevron-forward" size={16} color={INK} />
      </TouchableOpacity>
    </View>
  );
}

const styles: Record<string, any> = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(22,23,15,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: spacing[5],
    paddingTop: 12,
    paddingBottom: 28,
    gap: 16,
  },
  handle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    backgroundColor: "rgba(22,23,15,0.18)",
    borderRadius: 2,
    marginBottom: 6,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  label: {
    fontSize: 10,
    color: OLIVE,
    letterSpacing: 0.6,
    fontFamily: fontFamilies.sans.regular,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  title: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 22,
    color: INK,
    marginTop: 2,
  },
  sub: {
    fontSize: 12,
    color: MUTED,
    fontFamily: fontFamilies.sans.regular,
    marginTop: 2,
  },
  cpwRow: {
    flexDirection: "row",
    gap: 10,
  },
  cpwCard: {
    flex: 1,
    backgroundColor: "#f3f1e7",
    borderRadius: radii.md,
    padding: 12,
  },
  cpwCardActive: {
    backgroundColor: "rgba(85,107,47,0.10)",
    borderWidth: 1,
    borderColor: "rgba(85,107,47,0.25)",
  },
  cpwLabel: {
    fontSize: 10,
    color: MUTED,
    fontFamily: fontFamilies.sans.regular,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  cpwValue: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 18,
    color: INK,
    marginTop: 2,
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 11,
    color: MUTED,
    fontFamily: fontFamilies.sans.regular,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  dateWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fbfaf3",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(22,23,15,0.12)",
    overflow: "hidden",
  },
  dateArrow: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  dateValue: {
    flex: 1,
    alignItems: "center",
  },
  dateText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 14,
    color: INK,
    fontWeight: "600",
  },
  actions: {
    flexDirection: "row",
    gap: 10,
  },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  btnGhost: {
    backgroundColor: "rgba(22,23,15,0.06)",
  },
  btnGhostText: {
    color: INK,
    fontFamily: fontFamilies.sans.regular,
    fontWeight: "600",
    fontSize: 13,
  },
  btnPrimary: {
    backgroundColor: OLIVE,
  },
  btnPrimaryText: {
    color: "#fff",
    fontFamily: fontFamilies.sans.regular,
    fontWeight: "700",
    fontSize: 13,
  },
});
