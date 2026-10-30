import React, { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { colors, radii } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { bankMonogram, findBank, searchBanks, type SriLankaBank } from "@/lib/payouts/banks";

const INK = colors.olive[950];
const CREAM = colors.paper.cream;

/** Bank field that opens a searchable sheet of every licensed bank in Sri Lanka. */
export function BankPicker({ value, onChange }: { value: string; onChange: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const known = findBank(value);

  const sections = useMemo(() => {
    const hits = searchBanks(query);
    if (query.trim()) {
      return hits.length ? [{ title: `${hits.length} ${hits.length === 1 ? "match" : "matches"}`, data: hits }] : [];
    }
    return [
      { title: "Popular", data: hits.filter((b) => b.popular) },
      { title: "Commercial banks", data: hits.filter((b) => b.kind === "commercial" && !b.popular) },
      { title: "Specialised banks", data: hits.filter((b) => b.kind === "specialised") },
    ];
  }, [query]);

  const close = () => {
    setOpen(false);
    setQuery("");
  };
  const pick = (name: string) => {
    onChange(name);
    close();
  };
  const typed = query.trim();
  // Offer a typed-in name only when no licensed bank matches the search.
  const canUseTyped = typed.length >= 3 && searchBanks(typed).length === 0;

  return (
    <>
      <TouchableOpacity
        style={styles.field}
        onPress={() => setOpen(true)}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={`Bank: ${value || "not set"}. Change bank`}
      >
        <View style={[styles.mono, value ? styles.monoActive : null]}>
          {value ? (
            <Text style={[styles.monoText, styles.monoTextActive]}>{bankMonogram(value)}</Text>
          ) : (
            <Ionicons name="business-outline" size={16} color={colors.olive[800]} />
          )}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.fieldValue, !value && styles.fieldPlaceholder]} numberOfLines={2}>
            {value || "Choose your bank"}
          </Text>
          <Text style={styles.fieldSub} numberOfLines={1}>
            {known ? (known.kind === "specialised" ? "Licensed specialised bank" : "Licensed commercial bank") : value ? "Entered manually" : "All licensed banks in Sri Lanka"}
          </Text>
        </View>
        <View style={styles.changePill}>
          <Text style={styles.changeText}>{value ? "Change" : "Select"}</Text>
          <Ionicons name="chevron-down" size={12} color={colors.olive[800]} />
        </View>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close} accessibilityLabel="Close bank list" />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <SafeAreaView edges={["bottom"]} style={styles.sheet}>
            <View style={styles.grabber} />
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetKicker}>PAYOUT BANK</Text>
                <Text style={styles.sheetTitle}>Choose your bank</Text>
              </View>
              <TouchableOpacity onPress={close} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel="Close">
                <Ionicons name="close" size={18} color={INK} />
              </TouchableOpacity>
            </View>

            <View style={styles.search}>
              <Ionicons name="search" size={16} color={colors.ink.mute} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search bank name or code"
                placeholderTextColor="rgba(101,104,77,0.55)"
                style={styles.searchInput}
                autoCorrect={false}
                returnKeyType="search"
                accessibilityLabel="Search banks"
              />
              {query ? (
                <TouchableOpacity onPress={() => setQuery("")} hitSlop={8} accessibilityLabel="Clear search">
                  <Ionicons name="close-circle" size={16} color={colors.ink.mute} />
                </TouchableOpacity>
              ) : null}
            </View>

            <SectionList
              sections={sections}
              keyExtractor={(b) => b.name}
              keyboardShouldPersistTaps="handled"
              stickySectionHeadersEnabled={false}
              style={styles.list}
              contentContainerStyle={{ paddingBottom: 12 }}
              renderSectionHeader={({ section }) => <Text style={styles.sectionTitle}>{section.title}</Text>}
              renderItem={({ item }) => <BankRow bank={item} active={item.name === value} onPress={() => pick(item.name)} />}
              ListEmptyComponent={
                <Text style={styles.empty}>No licensed bank matches “{typed}”.</Text>
              }
              ListFooterComponent={
                canUseTyped ? (
                  <TouchableOpacity style={styles.customRow} onPress={() => pick(typed)} accessibilityRole="button">
                    <Ionicons name="add-circle-outline" size={18} color={colors.olive[800]} />
                    <Text style={styles.customText} numberOfLines={1}>
                      Use “{typed}”
                    </Text>
                  </TouchableOpacity>
                ) : null
              }
            />
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

function BankRow({ bank, active, onPress }: { bank: SriLankaBank; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      accessibilityLabel={bank.name}
      style={({ pressed }) => [styles.row, active && styles.rowActive, pressed && !active && styles.rowPressed]}
    >
      <View style={[styles.mono, active && styles.monoActive]}>
        <Text style={[styles.monoText, active && styles.monoTextActive]}>{bank.short}</Text>
      </View>
      <Text style={[styles.rowName, active && styles.rowNameActive]} numberOfLines={1}>
        {bank.name}
      </Text>
      {active ? (
        <View style={styles.check}>
          <Ionicons name="checkmark" size={13} color={CREAM} />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 60,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.18)",
    backgroundColor: colors.paper.DEFAULT,
  },
  fieldValue: { fontFamily: fontFamilies.sans.semibold, fontSize: 14.5, color: INK },
  fieldPlaceholder: { color: colors.ink.mute, fontFamily: fontFamilies.sans.regular },
  fieldSub: { marginTop: 1, fontFamily: fontFamilies.sans.regular, fontSize: 11.5, color: colors.ink.mute },
  changePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingLeft: 10,
    paddingRight: 8,
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: "#fffdf8",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(83,94,44,0.22)",
  },
  changeText: { fontFamily: fontFamilies.sans.semibold, fontSize: 12, color: colors.olive[800] },

  mono: {
    minWidth: 38,
    height: 38,
    paddingHorizontal: 4,
    borderRadius: 11,
    backgroundColor: colors.olive[50],
    alignItems: "center",
    justifyContent: "center",
  },
  monoActive: { backgroundColor: colors.olive[900] },
  monoText: { fontFamily: fontFamilies.mono.semibold, fontSize: 10, letterSpacing: 0.3, color: colors.olive[800] },
  monoTextActive: { color: CREAM },

  backdrop: { flex: 1, backgroundColor: "rgba(22,26,10,0.45)" },
  sheet: {
    maxHeight: 640,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 16,
  },
  grabber: { alignSelf: "center", width: 38, height: 4, borderRadius: 2, backgroundColor: "rgba(83,94,44,0.18)", marginTop: 8 },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 10, paddingBottom: 12 },
  sheetKicker: { fontFamily: fontFamilies.mono.medium, fontSize: 9, letterSpacing: 1.5, color: colors.olive[700] },
  sheetTitle: { marginTop: 2, fontFamily: fontFamilies.display.semibold, fontSize: 21, color: INK, letterSpacing: -0.2 },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.paper.DEFAULT, alignItems: "center", justifyContent: "center" },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: colors.paper.DEFAULT,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.12)",
  },
  searchInput: { flex: 1, minWidth: 0, fontFamily: fontFamilies.sans.regular, fontSize: 14, color: INK, paddingVertical: 0 },
  list: { marginTop: 4 },
  sectionTitle: {
    marginTop: 14,
    marginBottom: 6,
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: colors.ink.mute,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 8, paddingVertical: 8, borderRadius: 14 },
  rowActive: { backgroundColor: colors.olive[50] },
  rowPressed: { backgroundColor: "rgba(83,94,44,0.04)" },
  rowName: { flex: 1, fontFamily: fontFamilies.sans.medium, fontSize: 14, color: colors.ink.soft },
  rowNameActive: { fontFamily: fontFamilies.sans.semibold, color: INK },
  check: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.olive[900], alignItems: "center", justifyContent: "center" },
  empty: { paddingVertical: 24, textAlign: "center", fontFamily: fontFamilies.sans.regular, fontSize: 13, color: colors.ink.mute },
  customRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(83,94,44,0.3)",
  },
  customText: { flex: 1, fontFamily: fontFamilies.sans.semibold, fontSize: 13.5, color: colors.olive[800] },
});
