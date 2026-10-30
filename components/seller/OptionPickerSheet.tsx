import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  Modal,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@/components/ui/Icon";
import { colors, radii } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

const INK = colors.olive[950];

export type PickerOption = { id: string; name: string };

type Props = {
  label: string;
  placeholder: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  options: PickerOption[];
  value: string | null;
  onChange: (id: string | null) => void;
  noneLabel?: string;
};

/** Tappable field that opens a searchable bottom sheet — replaces long chip scrollers. */
export function OptionPickerField({
  label,
  placeholder,
  icon,
  options,
  value,
  onChange,
  noneLabel = "None",
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = options.find((o) => o.id === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.name.toLowerCase().includes(q)) : options;
  }, [options, query]);

  const close = () => {
    setOpen(false);
    setQuery("");
  };
  const pick = (id: string | null) => {
    onChange(id);
    close();
  };

  return (
    <>
      <TouchableOpacity
        style={styles.field}
        onPress={() => setOpen(true)}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selected?.name ?? "not set"}`}
      >
        <View style={styles.fieldIcon}>
          <Ionicons name={icon} size={18} color={colors.olive[800]} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.fieldLabel}>{label}</Text>
          <Text style={[styles.fieldValue, !selected && styles.fieldPlaceholder]} numberOfLines={1}>
            {selected?.name ?? placeholder}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.ink.mute} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close} />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <SafeAreaView edges={["bottom"]} style={styles.sheet}>
            <View style={styles.grabber} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Select {label.toLowerCase()}</Text>
              <TouchableOpacity onPress={close} hitSlop={10} accessibilityLabel="Close">
                <Ionicons name="close" size={22} color={INK} />
              </TouchableOpacity>
            </View>
            {options.length > 6 ? (
              <View style={styles.search}>
                <Ionicons name="search-outline" size={17} color={colors.ink.mute} />
                <TextInput
                  style={styles.searchInput}
                  value={query}
                  onChangeText={setQuery}
                  placeholder={`Search ${label.toLowerCase()}`}
                  placeholderTextColor={colors.light.mutedForeground}
                  autoCorrect={false}
                />
              </View>
            ) : null}
            <FlatList
              data={[{ id: "__none", name: noneLabel }, ...filtered]}
              keyExtractor={(o) => o.id}
              style={{ maxHeight: 380 }}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={<Text style={styles.empty}>No matches</Text>}
              renderItem={({ item }) => {
                const isNone = item.id === "__none";
                const active = isNone ? !value : value === item.id;
                return (
                  <TouchableOpacity
                    style={[styles.row, active && styles.rowActive]}
                    onPress={() => pick(isNone ? null : item.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[styles.rowText, active && styles.rowTextActive, isNone && styles.rowNone]}>
                      {item.name}
                    </Text>
                    {active ? <Ionicons name="checkmark-circle" size={20} color={colors.olive[800]} /> : null}
                  </TouchableOpacity>
                );
              }}
            />
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 64,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: "#FAF9F5",
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.14)",
  },
  fieldIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.olive[50],
    alignItems: "center",
    justifyContent: "center",
  },
  fieldLabel: { fontFamily: fontFamilies.sans.medium, fontSize: 11, color: colors.ink.mute, textTransform: "uppercase", letterSpacing: 0.6 },
  fieldValue: { fontFamily: fontFamilies.sans.semibold, fontSize: 15, color: INK, marginTop: 2 },
  fieldPlaceholder: { fontFamily: fontFamilies.sans.regular, color: colors.light.mutedForeground },
  backdrop: { flex: 1, backgroundColor: "rgba(22,26,10,0.45)" },
  sheet: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 16, paddingBottom: 8 },
  grabber: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(83,94,44,0.25)", marginTop: 10 },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14 },
  sheetTitle: { fontFamily: fontFamilies.display.semibold, fontSize: 20, color: INK },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 46,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: "#FAF9F5",
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.14)",
    marginBottom: 8,
  },
  searchInput: { flex: 1, fontFamily: fontFamilies.sans.regular, fontSize: 15, color: INK, minHeight: 44 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 52, paddingHorizontal: 12, borderRadius: 14 },
  rowActive: { backgroundColor: colors.olive[50] },
  rowText: { fontFamily: fontFamilies.sans.medium, fontSize: 16, color: INK },
  rowTextActive: { fontFamily: fontFamilies.sans.semibold },
  rowNone: { color: colors.light.mutedForeground },
  empty: { textAlign: "center", paddingVertical: 24, fontFamily: fontFamilies.sans.regular, color: colors.light.mutedForeground },
});
