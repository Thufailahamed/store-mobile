import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Input } from "@/components/ui/Input";
import {
  placeAutocomplete,
  placeDetails,
  type PlacePrediction,
  type GeocodeResult,
} from "@/lib/maps";
import { useDebounce } from "@/lib/hooks/useDebounce";
import { colors, radii, shadows, spacing, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

interface PlacesAutocompleteInputProps {
  label?: string;
  placeholder?: string;
  country?: string;
  value: string;
  onChangeText: (v: string) => void;
  onSelect: (result: GeocodeResult) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  error?: string;
  containerStyle?: object;
}

/**
 * Address input with Google Places Autocomplete predictions.
 * Tap a prediction → fetches full details (lat/lng + components) → onSelect.
 */
export function PlacesAutocompleteInput({
  label = "Address",
  placeholder = "Start typing your address…",
  country = "LK",
  value,
  onChangeText,
  onSelect,
  onFocus,
  onBlur,
  error,
  containerStyle,
}: PlacesAutocompleteInputProps) {
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [resolving, setResolving] = useState(false);
  const debounced = useDebounce(value, 350);
  const blurTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounced.trim().length < 2) {
      setPredictions([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    placeAutocomplete(debounced, { country }).then((res) => {
      if (cancelled) return;
      setPredictions(res);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [debounced, country]);

  const handleSelect = async (p: PlacePrediction) => {
    if (blurTimeout.current) clearTimeout(blurTimeout.current);
    Keyboard.dismiss();
    setOpen(false);
    setResolving(true);
    onChangeText(p.description);
    const details = await placeDetails(p.placeId);
    setResolving(false);
    if (details) onSelect(details);
  };

  const showDropdown = open && (predictions.length > 0 || loading || resolving);

  return (
    <View style={[styles.wrap, containerStyle]}>
      <Input
        label={label}
        placeholder={placeholder}
        value={value}
        onChangeText={(v) => {
          onChangeText(v);
          setOpen(true);
        }}
        onFocus={(e) => {
          setOpen(true);
          onFocus?.();
        }}
        onBlur={(e) => {
          blurTimeout.current = setTimeout(() => setOpen(false), 200);
          onBlur?.();
        }}
        autoCorrect={false}
        autoCapitalize="words"
        error={error}
        leftIcon={<Ionicons name="search-outline" size={16} color={colors.light.mutedForeground} />}
        rightIcon={
          (loading || resolving) ? (
            <ActivityIndicator size="small" color={colors.light.primary} />
          ) : value.length > 0 ? (
            <Pressable
              hitSlop={8}
              onPress={() => {
                onChangeText("");
                setPredictions([]);
              }}
            >
              <Ionicons name="close-circle" size={16} color={colors.light.mutedForeground} />
            </Pressable>
          ) : null
        }
      />

      {showDropdown && (
        <View style={styles.dropdown}>
          {loading && predictions.length === 0 && (
            <View style={styles.emptyRow}>
              <ActivityIndicator size="small" color={colors.light.mutedForeground} />
              <Text style={styles.emptyText}>Searching…</Text>
            </View>
          )}
          {!loading && predictions.length === 0 && debounced.length >= 2 && (
            <View style={styles.emptyRow}>
              <Ionicons name="search-outline" size={14} color={colors.light.mutedForeground} />
              <Text style={styles.emptyText}>No matches yet — try a fuller address</Text>
            </View>
          )}
          {predictions.map((p) => (
            <Pressable
              key={p.placeId}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={() => handleSelect(p)}
            >
              <View style={styles.rowIcon}>
                <Ionicons name="location-outline" size={16} color={colors.light.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.mainText} numberOfLines={1}>{p.mainText}</Text>
                {p.secondaryText ? (
                  <Text style={styles.secondaryText} numberOfLines={1}>{p.secondaryText}</Text>
                ) : null}
              </View>
              <Ionicons name="arrow-forward" size={12} color={colors.light.mutedForeground} />
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { zIndex: 100 },
  dropdown: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    marginTop: 6,
    backgroundColor: colors.light.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.light.border,
    paddingVertical: 6,
    maxHeight: 280,
    ...shadows.soft,
    zIndex: 100,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    paddingVertical: 10,
    paddingHorizontal: spacing[4],
  },
  rowPressed: { backgroundColor: colors.olive[50] },
  rowIcon: {
    width: 30,
    height: 30,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.olive[50],
  },
  mainText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: typography.fontSizes.sm,
    color: colors.light.foreground,
  },
  secondaryText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
    marginTop: 2,
  },
  emptyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    paddingVertical: 14,
    paddingHorizontal: spacing[4],
  },
  emptyText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.sm,
    color: colors.light.mutedForeground,
  },
});
